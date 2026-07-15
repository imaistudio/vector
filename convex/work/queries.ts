import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { query, type QueryCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { canEditIssue, canViewIssue } from '../access';
import {
  isCanonicalWork,
  requireOrganization,
  requireWorkByKey,
  statusFromLegacyState,
} from './lib';

async function userSummary(ctx: QueryCtx, userId?: Id<'users'>) {
  if (!userId) return null;
  const user = await ctx.db.get('users', userId);
  return user
    ? {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        image: user.image,
      }
    : null;
}

export const list = query({
  args: {
    orgSlug: v.string(),
    scope: v.optional(
      v.union(
        v.literal('active'),
        v.literal('mine'),
        v.literal('attention'),
        v.literal('all'),
      ),
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const { organization, userId } = await requireOrganization(
      ctx,
      args.orgSlug,
    );
    const fetchPage = (paginationOpts: typeof args.paginationOpts) =>
      args.scope === 'mine'
        ? ctx.db
            .query('issues')
            .withIndex('by_org_kind_owner_focus_activity', q =>
              q
                .eq('organizationId', organization._id)
                .eq('kind', 'work')
                .eq('ownerId', userId),
            )
            .order('asc')
            .paginate(paginationOpts)
        : ctx.db
            .query('issues')
            .withIndex('by_org_kind_focus_activity', q =>
              q.eq('organizationId', organization._id).eq('kind', 'work'),
            )
            .order('asc')
            .paginate(paginationOpts);

    const enrich = async (works: Doc<'issues'>[]) => {
      const visible = (
        await Promise.all(
          works.map(async work =>
            (await canViewIssue(ctx, work)) ? work : null,
          ),
        )
      ).filter((work): work is Doc<'issues'> => Boolean(work));

      const rows = await Promise.all(
        visible.map(async work => {
          const [owner, state, activities, attention] = await Promise.all([
            userSummary(ctx, work.ownerId),
            work.workflowStateId
              ? ctx.db.get('issueStates', work.workflowStateId)
              : null,
            Promise.all(
              (['active', 'waiting_for_input', 'paused'] as const).map(status =>
                ctx.db
                  .query('issueLiveActivities')
                  .withIndex('by_issue_status', q =>
                    q.eq('issueId', work._id).eq('status', status),
                  )
                  .take(20),
              ),
            ).then(groups => groups.flat()),
            ctx.db
              .query('workAttentionRequests')
              .withIndex('by_work_status', q =>
                q.eq('workId', work._id).eq('status', 'open'),
              )
              .take(20),
          ]);
          return {
            ...work,
            workStatus: work.workStatus ?? statusFromLegacyState(state),
            owner,
            taskProgress: {
              done: work.taskDone ?? 0,
              total: work.taskTotal ?? 0,
            },
            activeExecutionCount: activities.filter(activity =>
              ['active', 'waiting_for_input', 'paused'].includes(
                activity.status,
              ),
            ).length,
            openAttentionCount: attention.length,
          };
        }),
      );

      return args.scope === 'attention'
        ? rows.filter(
            row =>
              row.openAttentionCount > 0 ||
              row.workStatus === 'blocked' ||
              row.workStatus === 'ready_for_review',
          )
        : args.scope === 'active'
          ? rows.filter(
              row =>
                ['active', 'waiting', 'blocked'].includes(row.workStatus) ||
                row.activeExecutionCount > 0,
            )
          : rows;
    };

    const page = await fetchPage(args.paginationOpts);
    const filtered = await enrich(page.page);
    const statusRank: Record<string, number> = {
      blocked: 0,
      ready_for_review: 1,
      active: 2,
      waiting: 3,
      planned: 4,
      completed: 5,
      canceled: 6,
    };
    const effortRank: Record<string, number> = {
      l: 0,
      m: 1,
      s: 2,
      xs: 3,
      unknown: 4,
    };
    filtered.sort(
      (left, right) =>
        (statusRank[left.workStatus] ?? 9) -
          (statusRank[right.workStatus] ?? 9) ||
        (effortRank[left.effort ?? 'unknown'] ?? 9) -
          (effortRank[right.effort ?? 'unknown'] ?? 9) ||
        (left.lastMeaningfulActivityAt ?? left._creationTime) -
          (right.lastMeaningfulActivityAt ?? right._creationTime),
    );
    return { ...page, page: filtered };
  },
});

export const getByKey = query({
  args: { orgSlug: v.string(), workKey: v.string() },
  handler: async (ctx, args) => {
    const { organization, userId } = await requireOrganization(
      ctx,
      args.orgSlug,
    );
    const work = await ctx.db
      .query('issues')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', organization._id).eq('key', args.workKey),
      )
      .first();
    if (!work || !isCanonicalWork(work) || !(await canViewIssue(ctx, work)))
      return null;
    const [
      owner,
      state,
      project,
      team,
      priority,
      contributors,
      requestLinks,
      tasks,
      ownershipPeriods,
      handoffs,
      attention,
      executions,
    ] = await Promise.all([
      userSummary(ctx, work.ownerId),
      work.workflowStateId
        ? ctx.db.get('issueStates', work.workflowStateId)
        : null,
      work.projectId ? ctx.db.get('projects', work.projectId) : null,
      work.teamId ? ctx.db.get('teams', work.teamId) : null,
      work.priorityId ? ctx.db.get('issuePriorities', work.priorityId) : null,
      ctx.db
        .query('workContributors')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .collect(),
      ctx.db
        .query('requestWorkLinks')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .collect(),
      ctx.db
        .query('tasks')
        .withIndex('by_work_position', q => q.eq('workId', work._id))
        .collect(),
      ctx.db
        .query('workOwnershipPeriods')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .order('desc')
        .take(200),
      ctx.db
        .query('workHandoffs')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .order('desc')
        .take(200),
      ctx.db
        .query('workAttentionRequests')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .order('desc')
        .take(200),
      ctx.db
        .query('issueLiveActivities')
        .withIndex('by_issue', q => q.eq('issueId', work._id))
        .order('desc')
        .take(200),
    ]);
    const contributorUsers = await Promise.all(
      contributors.map(row => userSummary(ctx, row.userId)),
    );
    const requests = (
      await Promise.all(
        requestLinks.map(async link => {
          const request = await ctx.db.get('requests', link.requestId);
          return request ? { ...request, relation: link.relation } : null;
        }),
      )
    ).filter(Boolean);
    const assigneeIds = Array.from(
      new Set(tasks.map(task => task.assigneeId).filter(Boolean)),
    ) as Id<'users'>[];
    const assigneePairs = await Promise.all(
      assigneeIds.map(async id => [id, await userSummary(ctx, id)] as const),
    );
    const assignees = new Map(assigneePairs);
    const historyUserIds = Array.from(
      new Set([
        ...ownershipPeriods.flatMap(period =>
          [period.ownerId, period.startedBy, period.endedBy].filter(Boolean),
        ),
        ...handoffs.flatMap(handoff =>
          [
            handoff.fromOwnerId,
            handoff.toOwnerId,
            handoff.initiatedBy,
            handoff.respondedBy,
          ].filter(Boolean),
        ),
      ]),
    ) as Id<'users'>[];
    const historyUserPairs = await Promise.all(
      historyUserIds.map(async id => [id, await userSummary(ctx, id)] as const),
    );
    const historyUsers = new Map(historyUserPairs);
    const canEdit = await canEditIssue(ctx, work);
    return {
      ...work,
      workStatus: work.workStatus ?? statusFromLegacyState(state),
      owner,
      workflowState: state,
      project,
      team,
      priority,
      contributors: contributorUsers.filter(Boolean),
      linkedRequests: requests,
      tasks: tasks.map(task => ({
        ...task,
        canUpdateStatus: canEdit || task.assigneeId === userId,
        assignee: task.assigneeId
          ? (assignees.get(task.assigneeId) ?? null)
          : null,
      })),
      ownershipPeriods: ownershipPeriods.map(period => ({
        ...period,
        owner: historyUsers.get(period.ownerId) ?? null,
        startedByUser: historyUsers.get(period.startedBy) ?? null,
        endedByUser: period.endedBy
          ? (historyUsers.get(period.endedBy) ?? null)
          : null,
      })),
      handoffs: handoffs.map(handoff => ({
        ...handoff,
        fromOwner: historyUsers.get(handoff.fromOwnerId) ?? null,
        toOwner: historyUsers.get(handoff.toOwnerId) ?? null,
        isRecipient: handoff.toOwnerId === userId,
      })),
      attention,
      executions,
      canEdit,
    };
  },
});

export const getContext = query({
  args: {
    orgSlug: v.string(),
    workKey: v.string(),
    taskId: v.optional(v.id('tasks')),
  },
  handler: async (ctx, args) => {
    const { work } = await requireWorkByKey(ctx, args.orgSlug, args.workKey);
    const [
      requests,
      tasks,
      ownership,
      handoffs,
      attention,
      artifacts,
      activity,
      executions,
    ] = await Promise.all([
      ctx.db
        .query('requestWorkLinks')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .collect(),
      ctx.db
        .query('tasks')
        .withIndex('by_work_position', q => q.eq('workId', work._id))
        .collect(),
      ctx.db
        .query('workOwnershipPeriods')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .order('desc')
        .take(10),
      ctx.db
        .query('workHandoffs')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .order('desc')
        .take(10),
      ctx.db
        .query('workAttentionRequests')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .order('desc')
        .take(20),
      ctx.db
        .query('githubArtifactLinks')
        .withIndex('by_issue_active', q =>
          q.eq('issueId', work._id).eq('active', true),
        )
        .take(50),
      ctx.db
        .query('activityEvents')
        .withIndex('by_issue', q => q.eq('issueId', work._id))
        .order('desc')
        .take(50),
      ctx.db
        .query('issueLiveActivities')
        .withIndex('by_issue', q => q.eq('issueId', work._id))
        .order('desc')
        .take(20),
    ]);
    if (args.taskId && !tasks.some(task => task._id === args.taskId)) {
      throw new ConvexError('TASK_NOT_IN_WORK');
    }
    const linkedRequests = (
      await Promise.all(
        requests.map(link => ctx.db.get('requests', link.requestId)),
      )
    ).filter(Boolean);
    return {
      schemaVersion: 1,
      work,
      requests: linkedRequests,
      tasks: args.taskId
        ? tasks.filter(task => task._id === args.taskId)
        : tasks,
      ownership,
      handoffs,
      blockers: tasks.filter(task => task.status === 'blocked'),
      attention: attention.filter(item => item.status === 'open'),
      development: artifacts,
      recentActivity: activity,
      executions,
    };
  },
});

export const resolveLegacyIssueRoute = query({
  args: { orgSlug: v.string(), issueKey: v.string() },
  handler: async (ctx, args) => {
    const { organization } = await requireOrganization(ctx, args.orgSlug);
    const issue = await ctx.db
      .query('issues')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', organization._id).eq('key', args.issueKey),
      )
      .first();
    if (!issue || !(await canViewIssue(ctx, issue))) return null;
    if (!issue.parentIssueId) return { workKey: issue.key, taskId: null };
    const task = await ctx.db
      .query('tasks')
      .withIndex('by_legacy_issue', q => q.eq('legacyIssueId', issue._id))
      .first();
    if (!task) return null;
    const work = await ctx.db.get('issues', task.workId);
    if (!work || !(await canViewIssue(ctx, work))) return null;
    return { workKey: work.key, taskId: task._id };
  },
});
