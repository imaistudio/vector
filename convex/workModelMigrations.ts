import { Migrations } from '@convex-dev/migrations';
import { components } from './_generated/api';
import schema from './schema';

export const migrations = new Migrations(components.migrations, { schema });

function taskStatusForState(type: string | undefined) {
  switch (type) {
    case 'in_progress':
      return 'in_progress' as const;
    case 'done':
      return 'done' as const;
    case 'canceled':
      return 'canceled' as const;
    case 'backlog':
    case 'todo':
    default:
      return 'todo' as const;
  }
}

function workStatusForState(type: string | undefined) {
  switch (type) {
    case 'in_progress':
      return 'active' as const;
    case 'done':
      return 'completed' as const;
    case 'canceled':
      return 'canceled' as const;
    case 'backlog':
    case 'todo':
    default:
      return 'planned' as const;
  }
}

export const migrateIssuesToWorkAndTasks = migrations.define({
  table: 'issues',
  migrateOne: async (ctx, issue) => {
    const state = issue.workflowStateId
      ? await ctx.db.get('issueStates', issue.workflowStateId)
      : null;
    const assignments = await ctx.db
      .query('issueAssignees')
      .withIndex('by_issue', q => q.eq('issueId', issue._id))
      .collect();
    const assignedUsers = assignments
      .map(row => row.assigneeId)
      .filter((id): id is NonNullable<typeof id> => Boolean(id));
    const primaryOwner = issue.ownerId ?? assignedUsers[0];
    const now = Date.now();

    if (issue.parentIssueId) {
      let rootWorkId = issue.parentIssueId;
      let parent = await ctx.db.get('issues', rootWorkId);
      while (parent?.parentIssueId) {
        rootWorkId = parent.parentIssueId;
        parent = await ctx.db.get('issues', rootWorkId);
      }
      const existingTask = await ctx.db
        .query('tasks')
        .withIndex('by_legacy_issue', q => q.eq('legacyIssueId', issue._id))
        .first();
      if (!existingTask) {
        const siblings = await ctx.db
          .query('tasks')
          .withIndex('by_work', q => q.eq('workId', rootWorkId))
          .collect();
        const number =
          siblings.reduce((max, task) => Math.max(max, task.number), 0) + 1;
        await ctx.db.insert('tasks', {
          organizationId: issue.organizationId,
          workId: rootWorkId,
          number,
          title: issue.title,
          description: issue.description,
          status: taskStatusForState(state?.type),
          assigneeId: primaryOwner,
          dueDate: issue.dueDate,
          position: number * 1000,
          createdBy: issue.createdBy ?? issue.reporterId ?? primaryOwner,
          creationSource: 'migration',
          legacyIssueId: issue._id,
          startedAt:
            state?.type === 'in_progress'
              ? (issue.updatedAt ?? issue._creationTime)
              : undefined,
          completedAt:
            state?.type === 'done'
              ? (issue.closedAt ?? issue.updatedAt ?? issue._creationTime)
              : undefined,
          createdAt: issue._creationTime,
          updatedAt: issue.updatedAt ?? issue._creationTime,
        });
      }
      return { kind: 'legacy_task_source' as const, workStatus: undefined };
    }

    if (primaryOwner && !issue.ownerId) {
      const activePeriod = await ctx.db
        .query('workOwnershipPeriods')
        .withIndex('by_work', q => q.eq('workId', issue._id))
        .first();
      if (!activePeriod) {
        await ctx.db.insert('workOwnershipPeriods', {
          workId: issue._id,
          ownerId: primaryOwner,
          startedBy: issue.createdBy ?? issue.reporterId ?? primaryOwner,
          startedAt: issue._creationTime,
          summary: 'Imported from the legacy issue assignment history.',
        });
      }
    }
    for (const contributorId of assignedUsers.filter(
      id => id !== primaryOwner,
    )) {
      const existing = await ctx.db
        .query('workContributors')
        .withIndex('by_work_user', q =>
          q.eq('workId', issue._id).eq('userId', contributorId),
        )
        .first();
      if (!existing)
        await ctx.db.insert('workContributors', {
          workId: issue._id,
          userId: contributorId,
          addedBy: issue.createdBy,
          addedAt: issue._creationTime,
        });
    }
    return {
      kind: 'work' as const,
      workStatus: issue.workStatus ?? workStatusForState(state?.type),
      ownerId: primaryOwner,
      effort: issue.effort ?? ('unknown' as const),
      completionPolicy: issue.completionPolicy ?? ('manual' as const),
      agentTaskCreationPolicy:
        issue.agentTaskCreationPolicy ?? ('allow' as const),
      creationSource: issue.creationSource ?? ('migration' as const),
      lastMeaningfulActivityAt:
        issue.lastMeaningfulActivityAt ??
        issue.updatedAt ??
        issue._creationTime,
      updatedAt: issue.updatedAt ?? now,
    };
  },
});

export const migrateCommentsToTasks = migrations.define({
  table: 'comments',
  migrateOne: async (ctx, comment) => {
    if (!comment.issueId || comment.taskId) return;
    const task = await ctx.db
      .query('tasks')
      .withIndex('by_legacy_issue', q =>
        q.eq('legacyIssueId', comment.issueId!),
      )
      .first();
    if (task) return { issueId: task.workId, taskId: task._id };
  },
});

export const migrateIssueActivitiesToTasks = migrations.define({
  table: 'issueActivities',
  migrateOne: async (ctx, activity) => {
    if (activity.taskId) return;
    const task = await ctx.db
      .query('tasks')
      .withIndex('by_legacy_issue', q =>
        q.eq('legacyIssueId', activity.issueId),
      )
      .first();
    if (task) return { issueId: task.workId, taskId: task._id };
  },
});

export const migrateGithubLinksToTasks = migrations.define({
  table: 'githubArtifactLinks',
  migrateOne: async (ctx, link) => {
    if (link.taskId) return;
    const task = await ctx.db
      .query('tasks')
      .withIndex('by_legacy_issue', q => q.eq('legacyIssueId', link.issueId))
      .first();
    if (task) return { issueId: task.workId, taskId: task._id };
  },
});

export const migrateGithubSuppressionsToTasks = migrations.define({
  table: 'githubArtifactSuppressions',
  migrateOne: async (ctx, suppression) => {
    if (suppression.taskId) return;
    const task = await ctx.db
      .query('tasks')
      .withIndex('by_legacy_issue', q =>
        q.eq('legacyIssueId', suppression.issueId),
      )
      .first();
    if (task) return { issueId: task.workId, taskId: task._id };
  },
});

export const migrateActivityEventsToTasks = migrations.define({
  table: 'activityEvents',
  migrateOne: async (ctx, event) => {
    if (!event.issueId || event.taskId) return;
    const task = await ctx.db
      .query('tasks')
      .withIndex('by_legacy_issue', q => q.eq('legacyIssueId', event.issueId!))
      .first();
    if (task) return { issueId: task.workId, taskId: task._id };
  },
});

export const migrateNotificationEventsToTasks = migrations.define({
  table: 'notificationEvents',
  migrateOne: async (ctx, event) => {
    if (!event.issueId || event.taskId) return;
    const task = await ctx.db
      .query('tasks')
      .withIndex('by_legacy_issue', q => q.eq('legacyIssueId', event.issueId!))
      .first();
    if (task) return { issueId: task.workId, taskId: task._id };
  },
});

export const migrateDelegatedRunsToTasks = migrations.define({
  table: 'delegatedRuns',
  migrateOne: async (ctx, run) => {
    if (run.taskId) return;
    const task = await ctx.db
      .query('tasks')
      .withIndex('by_legacy_issue', q => q.eq('legacyIssueId', run.issueId))
      .first();
    if (task) return { issueId: task.workId, taskId: task._id };
  },
});

export const migrateWorkSessionsToTasks = migrations.define({
  table: 'workSessions',
  migrateOne: async (ctx, session) => {
    if (session.taskId) return;
    const task = await ctx.db
      .query('tasks')
      .withIndex('by_legacy_issue', q => q.eq('legacyIssueId', session.issueId))
      .first();
    if (task) return { issueId: task.workId, taskId: task._id };
  },
});

export const migrateLiveActivitiesToTasks = migrations.define({
  table: 'issueLiveActivities',
  migrateOne: async (ctx, activity) => {
    if (activity.taskId) return;
    const task = await ctx.db
      .query('tasks')
      .withIndex('by_legacy_issue', q =>
        q.eq('legacyIssueId', activity.issueId),
      )
      .first();
    if (task)
      return {
        issueId: task.workId,
        taskId: task._id,
        originKind: activity.originKind ?? ('migration' as const),
      };
    return { originKind: activity.originKind ?? ('migration' as const) };
  },
});

export const run = migrations.runner();
