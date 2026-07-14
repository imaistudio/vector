import { ConvexError, v } from 'convex/values';
import {
  internalMutation,
  mutation,
  query,
  type MutationCtx,
} from './_generated/server';
import type { Doc, Id } from './_generated/dataModel';
import { canViewRequest } from './requests/lib';
import {
  createNotificationEvent,
  getIssueHref,
  getRequestHref,
} from './notifications/lib';
import {
  reminderCadenceValidator,
  reminderRecipientPolicyValidator,
  reminderTargetTypeValidator,
} from './_shared/work';
import { requireOrganization, requireUser, requireWork } from './work/lib';

function nextOccurrence(rule: Doc<'reminderRules'>, scheduledFor: number) {
  if (rule.cadence === 'once') return null;
  const day = 24 * 60 * 60 * 1000;
  let next =
    scheduledFor +
    (rule.cadence === 'weekly'
      ? 7
      : rule.cadence === 'custom_days'
        ? Math.max(1, rule.intervalDays ?? 1)
        : 1) *
      day;
  if (rule.cadence === 'weekdays') {
    while ([0, 6].includes(new Date(next).getUTCDay())) next += day;
  }
  return next;
}

async function targetContext(ctx: MutationCtx, rule: Doc<'reminderRules'>) {
  if (rule.targetType === 'request' && rule.requestId) {
    const request = await ctx.db.get('requests', rule.requestId);
    if (!request) return null;
    return {
      completed: ['completed', 'declined', 'duplicate'].includes(
        request.status,
      ),
      updatedAt: request.updatedAt,
      request,
      work: null,
      task: null,
    };
  }
  if (rule.targetType === 'work' && rule.workId) {
    const work = await ctx.db.get('issues', rule.workId);
    if (!work) return null;
    return {
      completed: ['completed', 'canceled'].includes(work.workStatus ?? ''),
      updatedAt:
        work.lastMeaningfulActivityAt ?? work.updatedAt ?? work._creationTime,
      request: null,
      work,
      task: null,
    };
  }
  if (rule.targetType === 'task' && rule.taskId) {
    const task = await ctx.db.get('tasks', rule.taskId);
    if (!task) return null;
    const work = await ctx.db.get('issues', task.workId);
    return {
      completed: ['done', 'canceled'].includes(task.status),
      updatedAt: task.updatedAt,
      request: null,
      work,
      task,
    };
  }
  return null;
}

async function resolveRecipients(
  ctx: MutationCtx,
  rule: Doc<'reminderRules'>,
  target: NonNullable<Awaited<ReturnType<typeof targetContext>>>,
) {
  const recipients = new Set<Id<'users'>>();
  for (const policy of rule.recipientPolicies) {
    if (policy === 'requester' && target.request?.requesterId)
      recipients.add(target.request.requesterId);
    if (policy === 'request_owner' && target.request?.ownerId)
      recipients.add(target.request.ownerId);
    if (policy === 'work_owner' && target.work?.ownerId)
      recipients.add(target.work.ownerId);
    if (policy === 'work_creator' && target.work?.createdBy)
      recipients.add(target.work.createdBy);
    if (policy === 'task_assignee' && target.task?.assigneeId)
      recipients.add(target.task.assigneeId);
    if (policy === 'watchers' && target.request) {
      const watchers = await ctx.db
        .query('requestRecipients')
        .withIndex('by_request', q => q.eq('requestId', target.request!._id))
        .collect();
      for (const watcher of watchers.filter(row => row.role === 'watcher'))
        recipients.add(watcher.userId);
    }
  }
  return Array.from(recipients);
}

export const listForTarget = query({
  args: {
    orgSlug: v.string(),
    requestId: v.optional(v.id('requests')),
    workId: v.optional(v.id('issues')),
    taskId: v.optional(v.id('tasks')),
  },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx, args.orgSlug);
    const ids = [args.requestId, args.workId, args.taskId].filter(Boolean);
    if (ids.length !== 1)
      throw new ConvexError('EXACTLY_ONE_REMINDER_TARGET_REQUIRED');
    if (args.requestId) {
      const request = await ctx.db.get('requests', args.requestId);
      if (
        !request ||
        request.organizationId !== organization._id ||
        !(await canViewRequest(ctx, request))
      ) {
        throw new ConvexError('REQUEST_NOT_FOUND');
      }
    } else if (args.workId) {
      const work = await requireWork(ctx, args.workId, 'view');
      if (work.organizationId !== organization._id)
        throw new ConvexError('WORK_NOT_FOUND');
    } else if (args.taskId) {
      const task = await ctx.db.get('tasks', args.taskId);
      if (!task || task.organizationId !== organization._id)
        throw new ConvexError('TASK_NOT_FOUND');
      await requireWork(ctx, task.workId, 'view');
    }
    const rows = await ctx.db
      .query('reminderRules')
      .withIndex('by_organization', q =>
        q.eq('organizationId', organization._id),
      )
      .collect();
    return rows.filter(rule =>
      args.requestId
        ? rule.requestId === args.requestId
        : args.workId
          ? rule.workId === args.workId
          : rule.taskId === args.taskId,
    );
  },
});

export const create = mutation({
  args: {
    orgSlug: v.string(),
    targetType: reminderTargetTypeValidator,
    requestId: v.optional(v.id('requests')),
    workId: v.optional(v.id('issues')),
    taskId: v.optional(v.id('tasks')),
    recipientPolicies: v.array(reminderRecipientPolicyValidator),
    cadence: reminderCadenceValidator,
    intervalDays: v.optional(v.number()),
    localTime: v.string(),
    timezone: v.string(),
    inactivityHours: v.optional(v.number()),
    firstFireAt: v.number(),
  },
  handler: async (ctx, args) => {
    const { organization, userId } = await requireOrganization(
      ctx,
      args.orgSlug,
    );
    const ids = [args.requestId, args.workId, args.taskId].filter(Boolean);
    if (ids.length !== 1)
      throw new ConvexError('EXACTLY_ONE_REMINDER_TARGET_REQUIRED');
    if (args.targetType === 'request' && args.requestId) {
      const request = await ctx.db.get('requests', args.requestId);
      if (
        !request ||
        request.organizationId !== organization._id ||
        !(await canViewRequest(ctx, request))
      )
        throw new ConvexError('REQUEST_NOT_FOUND');
    } else if (args.targetType === 'work' && args.workId) {
      const work = await requireWork(ctx, args.workId, 'view');
      if (work.organizationId !== organization._id)
        throw new ConvexError('WORK_NOT_FOUND');
    } else if (args.targetType === 'task' && args.taskId) {
      const task = await ctx.db.get('tasks', args.taskId);
      if (!task || task.organizationId !== organization._id)
        throw new ConvexError('TASK_NOT_FOUND');
      await requireWork(ctx, task.workId, 'view');
    } else throw new ConvexError('REMINDER_TARGET_MISMATCH');
    if (args.recipientPolicies.length === 0)
      throw new ConvexError('RECIPIENT_POLICY_REQUIRED');
    if (args.firstFireAt <= Date.now())
      throw new ConvexError('REMINDER_MUST_BE_IN_FUTURE');
    const now = Date.now();
    const reminderRuleId = await ctx.db.insert('reminderRules', {
      organizationId: organization._id,
      targetType: args.targetType,
      requestId: args.requestId,
      workId: args.workId,
      taskId: args.taskId,
      recipientPolicies: Array.from(new Set(args.recipientPolicies)),
      cadence: args.cadence,
      intervalDays: args.intervalDays,
      localTime: args.localTime,
      timezone: args.timezone,
      inactivityHours: args.inactivityHours,
      enabled: true,
      nextFireAt: args.firstFireAt,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    });
    return { reminderRuleId };
  },
});

export const setEnabled = mutation({
  args: { reminderRuleId: v.id('reminderRules'), enabled: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const rule = await ctx.db.get('reminderRules', args.reminderRuleId);
    if (!rule || rule.createdBy !== userId)
      throw new ConvexError('REMINDER_NOT_FOUND');
    await ctx.db.patch('reminderRules', rule._id, {
      enabled: args.enabled,
      updatedAt: Date.now(),
    });
    return { success: true } as const;
  },
});

export const processDue = internalMutation({
  args: {},
  handler: async ctx => {
    const now = Date.now();
    const rules = await ctx.db
      .query('reminderRules')
      .withIndex('by_enabled_next_fire', q =>
        q.eq('enabled', true).lte('nextFireAt', now),
      )
      .take(50);
    for (const rule of rules) {
      const target = await targetContext(ctx, rule);
      if (!target || target.completed) {
        await ctx.db.patch('reminderRules', rule._id, {
          enabled: false,
          updatedAt: now,
        });
        continue;
      }
      if (
        rule.inactivityHours &&
        now - target.updatedAt < rule.inactivityHours * 60 * 60 * 1000
      ) {
        const next =
          nextOccurrence(rule, rule.nextFireAt) ??
          now + rule.inactivityHours * 60 * 60 * 1000;
        await ctx.db.patch('reminderRules', rule._id, {
          nextFireAt: next,
          updatedAt: now,
        });
        continue;
      }
      const dedupeKey = `reminder:${rule._id}:${rule.nextFireAt}`;
      const prior = await ctx.db
        .query('reminderOccurrences')
        .withIndex('by_dedupe_key', q => q.eq('dedupeKey', dedupeKey))
        .first();
      if (!prior) {
        const recipients = await resolveRecipients(ctx, rule, target);
        const org = await ctx.db.get('organizations', rule.organizationId);
        const href =
          target.request && org
            ? getRequestHref(org.slug, target.request.key)
            : target.work && org
              ? getIssueHref(org.slug, target.work.key)
              : undefined;
        await createNotificationEvent(ctx, {
          type: 'reminder_due',
          organizationId: rule.organizationId,
          requestId: target.request?._id,
          issueId: target.work?._id,
          taskId: target.task?._id,
          payload: {
            requestKey: target.request?.key,
            requestTitle: target.request?.title,
            workKey: target.work?.key,
            workTitle: target.work?.title,
            taskTitle: target.task?.title,
            href,
          },
          recipients: recipients.map(userId => ({ userId })),
          dedupeKey,
        });
        await ctx.db.insert('reminderOccurrences', {
          reminderRuleId: rule._id,
          scheduledFor: rule.nextFireAt,
          firedAt: now,
          recipientUserIds: recipients,
          dedupeKey,
        });
      }
      const next = nextOccurrence(rule, rule.nextFireAt);
      await ctx.db.patch('reminderRules', rule._id, {
        enabled: next !== null,
        nextFireAt: next ?? rule.nextFireAt,
        lastFiredAt: now,
        updatedAt: now,
      });
    }
    return { processed: rules.length };
  },
});
