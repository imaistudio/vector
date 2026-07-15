import { ConvexError, v } from 'convex/values';
import { mutation, type MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { canEditIssue } from '../access';
import {
  recordActivity,
  resolveIssueScope,
  snapshotForIssue,
} from '../activities/lib';
import { createNotificationEvent, getIssueHref } from '../notifications/lib';
import { taskStatusValidator } from '../_shared/work';
import {
  assertOrganizationUser,
  requireUser,
  requireWork,
  touchMeaningfulWork,
} from '../work/lib';

async function nextTaskNumber(ctx: MutationCtx, workId: Id<'issues'>) {
  const last = await ctx.db
    .query('tasks')
    .withIndex('by_work_number', q => q.eq('workId', workId))
    .order('desc')
    .first();
  return (last?.number ?? 0) + 1;
}

async function insertTask(
  ctx: MutationCtx,
  input: {
    work: Doc<'issues'>;
    actorId: Id<'users'>;
    title: string;
    description?: string;
    assigneeId?: Id<'users'>;
    dueDate?: string;
    creationSource: 'human' | 'agent';
    liveActivityId?: Id<'issueLiveActivities'>;
    agentProcessId?: Id<'agentProcesses'>;
  },
) {
  const title = input.title.trim();
  if (!title || title.length > 300) throw new ConvexError('INVALID_TASK_TITLE');
  if (input.description && input.description.length > 20_000)
    throw new ConvexError('TASK_DESCRIPTION_TOO_LONG');
  if (input.assigneeId)
    await assertOrganizationUser(
      ctx,
      input.work.organizationId,
      input.assigneeId,
    );
  const number = await nextTaskNumber(ctx, input.work._id);
  const now = Date.now();
  const taskId = await ctx.db.insert('tasks', {
    organizationId: input.work.organizationId,
    workId: input.work._id,
    number,
    title,
    description: input.description?.trim() || undefined,
    status: 'todo',
    assigneeId: input.assigneeId,
    dueDate: input.dueDate?.trim() || undefined,
    position: number * 1000,
    createdBy: input.actorId,
    creationSource: input.creationSource,
    createdByLiveActivityId: input.liveActivityId,
    createdByAgentProcessId: input.agentProcessId,
    createdAt: now,
    updatedAt: now,
  });
  let taskTotal = input.work.taskTotal;
  let taskDone = input.work.taskDone;
  if (taskTotal === undefined || taskDone === undefined) {
    const tasks = await ctx.db
      .query('tasks')
      .withIndex('by_work', q => q.eq('workId', input.work._id))
      .collect();
    taskTotal = tasks.length;
    taskDone = tasks.filter(task => task.status === 'done').length;
  } else {
    taskTotal += 1;
  }
  await touchMeaningfulWork(ctx, input.work._id, {
    taskTotal,
    taskDone,
    lastActivityEventType: 'task_created',
  });
  await recordActivity(ctx, {
    scope: resolveIssueScope(input.work),
    taskId,
    actorId: input.actorId,
    entityType: 'task',
    eventType: 'task_created',
    details: {
      toId: taskId,
      toLabel: title,
      viaAgent: input.creationSource === 'agent',
    },
    snapshot: snapshotForIssue(input.work),
  });
  return taskId;
}

async function notifyAssignee(
  ctx: MutationCtx,
  work: Doc<'issues'>,
  task: Doc<'tasks'>,
  actorId: Id<'users'>,
  type: 'task_assigned' | 'task_transferred',
) {
  if (!task.assigneeId || task.assigneeId === actorId) return;
  const org = await ctx.db.get('organizations', work.organizationId);
  await createNotificationEvent(ctx, {
    type,
    actorId,
    organizationId: work.organizationId,
    issueId: work._id,
    taskId: task._id,
    payload: {
      workKey: work.key,
      workTitle: work.title,
      taskTitle: task.title,
      href: org ? getIssueHref(org.slug, work.key) : undefined,
    },
    recipients: [{ userId: task.assigneeId }],
    dedupeKey: `${type}:${task._id}:${task.updatedAt}`,
  });
}

export const create = mutation({
  args: {
    workId: v.id('issues'),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.id('users')),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const work = await requireWork(ctx, args.workId, 'edit');
    const taskId = await insertTask(ctx, {
      work,
      actorId,
      title: args.title,
      description: args.description,
      assigneeId: args.assigneeId,
      dueDate: args.dueDate,
      creationSource: 'human',
    });
    const task = await ctx.db.get('tasks', taskId);
    if (task) await notifyAssignee(ctx, work, task, actorId, 'task_assigned');
    return { taskId };
  },
});

export const createFromExecution = mutation({
  args: {
    workId: v.id('issues'),
    liveActivityId: v.id('issueLiveActivities'),
    title: v.string(),
    description: v.optional(v.string()),
    assigneeId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const work = await requireWork(ctx, args.workId, 'edit');
    if (work.agentTaskCreationPolicy === 'deny')
      throw new ConvexError('AGENT_TASK_CREATION_DISABLED');
    if (work.agentTaskCreationPolicy === 'approval_required')
      throw new ConvexError('AGENT_TASK_APPROVAL_REQUIRED');
    const execution = await ctx.db.get(
      'issueLiveActivities',
      args.liveActivityId,
    );
    if (
      !execution ||
      execution.issueId !== work._id ||
      execution.ownerUserId !== actorId
    )
      throw new ConvexError('INVALID_EXECUTION_ATTRIBUTION');
    const taskId = await insertTask(ctx, {
      work,
      actorId,
      title: args.title,
      description: args.description,
      assigneeId: args.assigneeId,
      creationSource: 'agent',
      liveActivityId: execution._id,
      agentProcessId: execution.processId,
    });
    const task = await ctx.db.get('tasks', taskId);
    if (task) await notifyAssignee(ctx, work, task, actorId, 'task_assigned');
    return { taskId };
  },
});

export const update = mutation({
  args: {
    taskId: v.id('tasks'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    const task = await ctx.db.get('tasks', args.taskId);
    if (!task) throw new ConvexError('TASK_NOT_FOUND');
    const work = await requireWork(ctx, task.workId, 'edit');
    const title = args.title?.trim();
    if (args.title !== undefined && (!title || title.length > 300))
      throw new ConvexError('INVALID_TASK_TITLE');
    await ctx.db.patch('tasks', task._id, {
      title: title ?? task.title,
      description:
        args.description === undefined
          ? task.description
          : args.description?.trim() || undefined,
      dueDate:
        args.dueDate === undefined
          ? task.dueDate
          : args.dueDate?.trim() || undefined,
      updatedAt: Date.now(),
    });
    await touchMeaningfulWork(ctx, work._id, {
      lastActivityEventType: 'task_updated',
    });
    return { success: true } as const;
  },
});

export const setStatus = mutation({
  args: { taskId: v.id('tasks'), status: taskStatusValidator },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const task = await ctx.db.get('tasks', args.taskId);
    if (!task) throw new ConvexError('TASK_NOT_FOUND');
    const work = await requireWork(ctx, task.workId, 'view');
    if (task.assigneeId !== actorId && !(await canEditIssue(ctx, work)))
      throw new ConvexError('FORBIDDEN');
    const now = Date.now();
    const wasDone = task.status === 'done';
    const willBeDone = args.status === 'done';
    const doneDelta = wasDone === willBeDone ? 0 : willBeDone ? 1 : -1;
    await ctx.db.patch('tasks', task._id, {
      status: args.status,
      startedAt:
        args.status === 'in_progress'
          ? (task.startedAt ?? now)
          : task.startedAt,
      completedAt: args.status === 'done' ? now : undefined,
      updatedAt: now,
    });
    let taskTotal = work.taskTotal;
    let taskDone = work.taskDone;
    if (taskTotal === undefined || taskDone === undefined) {
      const tasks = await ctx.db
        .query('tasks')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .collect();
      taskTotal = tasks.length;
      taskDone = tasks.filter(candidate => candidate.status === 'done').length;
    } else {
      taskDone = Math.max(0, taskDone + doneDelta);
    }
    await touchMeaningfulWork(ctx, work._id, {
      taskTotal,
      taskDone,
      lastActivityEventType: 'task_status_changed',
    });
    await recordActivity(ctx, {
      scope: resolveIssueScope(work),
      taskId: task._id,
      actorId,
      entityType: 'task',
      eventType: 'task_status_changed',
      details: {
        field: 'task_status',
        fromLabel: task.status,
        toLabel: args.status,
      },
      snapshot: snapshotForIssue(work),
    });
    return { success: true } as const;
  },
});

export const assign = mutation({
  args: { taskId: v.id('tasks'), assigneeId: v.optional(v.id('users')) },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const task = await ctx.db.get('tasks', args.taskId);
    if (!task) throw new ConvexError('TASK_NOT_FOUND');
    const work = await requireWork(ctx, task.workId, 'edit');
    if (args.assigneeId)
      await assertOrganizationUser(ctx, work.organizationId, args.assigneeId);
    const previous = task.assigneeId;
    const now = Date.now();
    await ctx.db.patch('tasks', task._id, {
      assigneeId: args.assigneeId,
      updatedAt: now,
    });
    const updated = { ...task, assigneeId: args.assigneeId, updatedAt: now };
    await notifyAssignee(
      ctx,
      work,
      updated,
      actorId,
      previous ? 'task_transferred' : 'task_assigned',
    );
    return { success: true } as const;
  },
});

export const reorder = mutation({
  args: { workId: v.id('issues'), taskIds: v.array(v.id('tasks')) },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await requireWork(ctx, args.workId, 'edit');
    const unique = Array.from(new Set(args.taskIds));
    for (let index = 0; index < unique.length; index += 1) {
      const task = await ctx.db.get('tasks', unique[index]);
      if (!task || task.workId !== args.workId)
        throw new ConvexError('TASK_NOT_IN_WORK');
      await ctx.db.patch('tasks', task._id, {
        position: (index + 1) * 1000,
        updatedAt: Date.now(),
      });
    }
    return { success: true } as const;
  },
});
