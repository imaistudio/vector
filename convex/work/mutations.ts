import { ConvexError, v } from 'convex/values';
import { mutation, type MutationCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { canAssignIssue } from '../access';
import {
  recordActivity,
  resolveIssueScope,
  snapshotForIssue,
} from '../activities/lib';
import { buildIssueSearchText } from '../issues/search';
import { getNextAvailableIssueKey, getNextSequenceSeed } from '../issues/keys';
import { createNotificationEvent, getIssueHref } from '../notifications/lib';
import { PERMISSIONS, requirePermission } from '../permissions/utils';
import { canEditRequest, requestFocusRank } from '../requests/lib';
import {
  agentTaskCreationPolicyValidator,
  workCompletionPolicyValidator,
  workEffortValidator,
  workStatusValidator,
} from '../_shared/work';
import {
  assertOrganizationUser,
  requireOrganization,
  requireUser,
  requireWork,
  touchMeaningfulWork,
  workFocusRank,
  workflowStateForWorkStatus,
} from './lib';
import {
  maybeRaiseLinkedRequestsForReview,
  reopenLinkedRequestsAfterCancellation,
  setLinkedRequestsInDelivery,
} from './requestReconciliation';

const visibilityValidator = v.union(
  v.literal('private'),
  v.literal('organization'),
  v.literal('public'),
);

async function createWorkRecord(
  ctx: MutationCtx,
  input: {
    organization: Doc<'organizations'>;
    actorId: Id<'users'>;
    title: string;
    description?: string;
    projectId?: Id<'projects'>;
    teamId?: Id<'teams'>;
    priorityId?: Id<'issuePriorities'>;
    ownerId?: Id<'users'>;
    dueDate?: string;
    visibility?: 'private' | 'organization' | 'public';
    effort?: 'unknown' | 'xs' | 's' | 'm' | 'l';
    completionPolicy?: 'manual' | 'tracked_work' | 'github';
    agentTaskCreationPolicy?: 'allow' | 'approval_required' | 'deny';
  },
) {
  const title = input.title.trim();
  if (!title || title.length > 200) throw new ConvexError('INVALID_TITLE');
  if (input.description && input.description.length > 100_000) {
    throw new ConvexError('WORKPAD_TOO_LONG');
  }
  if (input.ownerId) {
    await assertOrganizationUser(ctx, input.organization._id, input.ownerId);
  }

  let project: Doc<'projects'> | null = null;
  if (input.projectId) {
    project = await ctx.db.get('projects', input.projectId);
    if (!project || project.organizationId !== input.organization._id) {
      throw new ConvexError('PROJECT_NOT_FOUND');
    }
  }
  let teamId = input.teamId ?? project?.teamId;
  if (teamId) {
    const team = await ctx.db.get('teams', teamId);
    if (!team || team.organizationId !== input.organization._id) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }
  }
  const prefix = project?.key ?? input.organization.slug.toUpperCase();
  const next = await getNextAvailableIssueKey(ctx, {
    organizationId: input.organization._id,
    prefix,
    startingSequenceNumber: await getNextSequenceSeed(
      ctx,
      input.organization._id,
      input.projectId,
    ),
  });
  const state = await workflowStateForWorkStatus(
    ctx,
    input.organization._id,
    'planned',
  );
  const now = Date.now();
  const workId = await ctx.db.insert('issues', {
    organizationId: input.organization._id,
    key: next.key,
    sequenceNumber: next.sequenceNumber,
    title,
    description: input.description?.trim() || undefined,
    searchText: buildIssueSearchText({
      key: next.key,
      title,
      description: input.description?.trim(),
    }),
    priorityId: input.priorityId,
    workflowStateId: state?._id,
    teamId,
    projectId: input.projectId,
    reporterId: input.actorId,
    dueDate: input.dueDate?.trim() || undefined,
    visibility: input.visibility ?? 'organization',
    createdBy: input.actorId,
    updatedAt: now,
    lastMeaningfulActivityAt: now,
    lastActivityEventType: 'work_created',
    kind: 'work',
    workStatus: 'planned',
    focusRank: workFocusRank('planned', input.effort ?? 'unknown'),
    taskTotal: 0,
    taskDone: 0,
    ownerId: input.ownerId,
    effort: input.effort ?? 'unknown',
    completionPolicy: input.completionPolicy ?? 'manual',
    agentTaskCreationPolicy: input.agentTaskCreationPolicy ?? 'allow',
    creationSource: 'human',
  });
  if (state) {
    await ctx.db.insert('issueAssignees', {
      issueId: workId,
      assigneeId: input.ownerId,
      stateId: state._id,
    });
  }
  if (input.ownerId) {
    await ctx.db.insert('workOwnershipPeriods', {
      workId,
      ownerId: input.ownerId,
      startedBy: input.actorId,
      startedAt: now,
    });
  }
  return workId;
}

export const create = mutation({
  args: {
    orgSlug: v.string(),
    data: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      projectId: v.optional(v.id('projects')),
      teamId: v.optional(v.id('teams')),
      priorityId: v.optional(v.id('issuePriorities')),
      ownerId: v.optional(v.id('users')),
      dueDate: v.optional(v.string()),
      visibility: v.optional(visibilityValidator),
      effort: v.optional(workEffortValidator),
      completionPolicy: v.optional(workCompletionPolicyValidator),
      agentTaskCreationPolicy: v.optional(agentTaskCreationPolicyValidator),
      requestIds: v.optional(v.array(v.id('requests'))),
    }),
  },
  handler: async (ctx, args) => {
    const { organization, userId } = await requireOrganization(
      ctx,
      args.orgSlug,
    );
    await requirePermission(ctx, organization._id, PERMISSIONS.ISSUE_CREATE);
    const workId = await createWorkRecord(ctx, {
      organization,
      actorId: userId,
      ...args.data,
    });
    const work = await ctx.db.get('issues', workId);
    if (!work) throw new ConvexError('WORK_CREATE_FAILED');
    for (const requestId of new Set(args.data.requestIds ?? [])) {
      const request = await ctx.db.get('requests', requestId);
      if (
        !request ||
        request.organizationId !== organization._id ||
        !(await canEditRequest(ctx, request))
      ) {
        throw new ConvexError('REQUEST_NOT_FOUND');
      }
      const existing = await ctx.db
        .query('requestWorkLinks')
        .withIndex('by_request_work', q =>
          q.eq('requestId', requestId).eq('workId', workId),
        )
        .first();
      if (!existing) {
        await ctx.db.insert('requestWorkLinks', {
          requestId,
          workId,
          relation: 'fulfills',
          createdBy: userId,
          createdAt: Date.now(),
        });
      }
      if (['new', 'routed'].includes(request.status)) {
        await ctx.db.patch('requests', requestId, {
          status: work.startedAt ? 'in_delivery' : 'planned',
          focusRank: requestFocusRank(
            work.startedAt ? 'in_delivery' : 'planned',
          ),
          updatedAt: Date.now(),
        });
      }
    }
    await recordActivity(ctx, {
      scope: resolveIssueScope(work),
      actorId: userId,
      entityType: 'work',
      eventType: 'work_created',
      snapshot: snapshotForIssue(work),
    });
    return { workId, workKey: work.key };
  },
});

export const updateDetails = mutation({
  args: {
    workId: v.id('issues'),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    effort: v.optional(workEffortValidator),
    completionPolicy: v.optional(workCompletionPolicyValidator),
    agentTaskCreationPolicy: v.optional(agentTaskCreationPolicyValidator),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const work = await requireWork(ctx, args.workId, 'edit');
    const title = args.title?.trim();
    if (args.title !== undefined && (!title || title.length > 200))
      throw new ConvexError('INVALID_TITLE');
    if (args.description && args.description.length > 100_000)
      throw new ConvexError('WORKPAD_TOO_LONG');
    await touchMeaningfulWork(ctx, work._id, {
      title: title ?? work.title,
      description:
        args.description === undefined ? work.description : args.description,
      effort: args.effort ?? work.effort,
      focusRank: workFocusRank(
        work.workStatus ?? 'planned',
        args.effort ?? work.effort ?? 'unknown',
      ),
      completionPolicy: args.completionPolicy ?? work.completionPolicy,
      agentTaskCreationPolicy:
        args.agentTaskCreationPolicy ?? work.agentTaskCreationPolicy,
      dueDate:
        args.dueDate === undefined ? work.dueDate : args.dueDate || undefined,
      searchText: buildIssueSearchText({
        key: work.key,
        title: title ?? work.title,
        description:
          args.description === undefined ? work.description : args.description,
      }),
    });
    return { success: true } as const;
  },
});

export const start = mutation({
  args: { workId: v.id('issues') },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const work = await requireWork(ctx, args.workId, 'edit');
    if (work.ownerId && work.ownerId !== userId)
      throw new ConvexError('ONLY_OWNER_CAN_START_WORK');
    if (
      ['ready_for_review', 'completed', 'canceled'].includes(
        work.workStatus ?? '',
      )
    )
      throw new ConvexError('WORK_NOT_STARTABLE');
    const state = await workflowStateForWorkStatus(
      ctx,
      work.organizationId,
      'active',
    );
    const now = Date.now();
    const ownerId = work.ownerId ?? userId;
    await touchMeaningfulWork(ctx, work._id, {
      kind: 'work',
      ownerId,
      workStatus: 'active',
      focusRank: workFocusRank('active', work.effort ?? 'unknown'),
      taskTotal: work.taskTotal ?? 0,
      taskDone: work.taskDone ?? 0,
      workflowStateId: state?._id ?? work.workflowStateId,
      startedAt: work.startedAt ?? now,
      startedBy: work.startedBy ?? userId,
      ownerStartedAt: work.ownerStartedAt ?? now,
      ownerStartedBy: work.ownerStartedBy ?? userId,
      lastActivityEventType: 'work_started',
    });
    if (!work.ownerId) {
      await ctx.db.insert('workOwnershipPeriods', {
        workId: work._id,
        ownerId: userId,
        startedBy: userId,
        startedAt: now,
        executionStartedAt: now,
        executionStartedBy: userId,
      });
    } else {
      const activePeriod = await ctx.db
        .query('workOwnershipPeriods')
        .withIndex('by_work', query => query.eq('workId', work._id))
        .order('desc')
        .first();
      if (
        activePeriod &&
        !activePeriod.endedAt &&
        activePeriod.ownerId === ownerId &&
        !activePeriod.executionStartedAt
      ) {
        await ctx.db.patch('workOwnershipPeriods', activePeriod._id, {
          executionStartedAt: now,
          executionStartedBy: userId,
        });
      }
    }
    await setLinkedRequestsInDelivery(ctx, work._id);
    await recordActivity(ctx, {
      scope: resolveIssueScope(work),
      actorId: userId,
      entityType: 'work',
      eventType: 'work_started',
      snapshot: snapshotForIssue(work),
    });
    return { success: true } as const;
  },
});

export const setStatus = mutation({
  args: { workId: v.id('issues'), status: workStatusValidator },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const work = await requireWork(ctx, args.workId, 'edit');
    if (args.status === 'active' && !work.startedAt)
      throw new ConvexError('USE_START_WORK');
    if (args.status === 'ready_for_review' || args.status === 'completed') {
      throw new ConvexError('USE_REVIEW_LIFECYCLE_ACTION');
    }
    if (work.workStatus === args.status) return { success: true } as const;
    if (['completed', 'canceled'].includes(work.workStatus ?? ''))
      throw new ConvexError('WORK_TERMINAL');
    const state = await workflowStateForWorkStatus(
      ctx,
      work.organizationId,
      args.status,
    );
    await touchMeaningfulWork(ctx, work._id, {
      workStatus: args.status,
      focusRank: workFocusRank(args.status, work.effort ?? 'unknown'),
      workflowStateId: state?._id ?? work.workflowStateId,
    });
    await recordActivity(ctx, {
      scope: resolveIssueScope(work),
      actorId: userId,
      entityType: 'work',
      eventType: 'issue_workflow_state_changed',
      details: {
        field: 'status',
        fromLabel: work.workStatus,
        toLabel: args.status,
      },
      snapshot: snapshotForIssue(work),
    });
    if (args.status === 'blocked') {
      const recipients = new Set<Id<'users'>>();
      if (work.ownerId && work.ownerId !== userId) recipients.add(work.ownerId);
      if (work.createdBy && work.createdBy !== userId)
        recipients.add(work.createdBy);
      if (work.reporterId && work.reporterId !== userId)
        recipients.add(work.reporterId);
      const org = await ctx.db.get('organizations', work.organizationId);
      if (recipients.size > 0) {
        await createNotificationEvent(ctx, {
          type: 'work_blocked',
          actorId: userId,
          organizationId: work.organizationId,
          issueId: work._id,
          payload: {
            workKey: work.key,
            workTitle: work.title,
            href: org ? getIssueHref(org.slug, work.key) : undefined,
          },
          recipients: Array.from(recipients).map(recipientId => ({
            userId: recipientId,
          })),
          dedupeKey: `work-blocked:${work._id}:${work.updatedAt ?? work._creationTime}`,
        });
      }
    }
    if (args.status === 'canceled')
      await reopenLinkedRequestsAfterCancellation(ctx, work._id);
    return { success: true } as const;
  },
});

export const readyForReview = mutation({
  args: { workId: v.id('issues') },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const work = await requireWork(ctx, args.workId, 'edit');
    if (['completed', 'canceled'].includes(work.workStatus ?? ''))
      throw new ConvexError('WORK_TERMINAL');
    if (!work.ownerStartedAt) throw new ConvexError('WORK_NOT_STARTED');
    if (work.workStatus === 'ready_for_review')
      return { success: true } as const;
    if (
      work.ownerId &&
      work.ownerId !== userId &&
      !(await canAssignIssue(ctx, work))
    ) {
      throw new ConvexError('FORBIDDEN');
    }
    const state = await workflowStateForWorkStatus(
      ctx,
      work.organizationId,
      'ready_for_review',
    );
    await touchMeaningfulWork(ctx, work._id, {
      workStatus: 'ready_for_review',
      focusRank: workFocusRank('ready_for_review', work.effort ?? 'unknown'),
      workflowStateId: state?._id ?? work.workflowStateId,
      readyForReviewAt: Date.now(),
      lastActivityEventType: 'work_ready_for_review',
    });
    await maybeRaiseLinkedRequestsForReview(
      ctx,
      { ...work, workStatus: 'ready_for_review' },
      userId,
    );
    const org = await ctx.db.get('organizations', work.organizationId);
    const reviewers = new Set<Id<'users'>>();
    if (work.createdBy && work.createdBy !== userId)
      reviewers.add(work.createdBy);
    if (work.reporterId && work.reporterId !== userId)
      reviewers.add(work.reporterId);
    if (reviewers.size > 0) {
      await createNotificationEvent(ctx, {
        type: 'work_ready_for_review',
        actorId: userId,
        organizationId: work.organizationId,
        issueId: work._id,
        payload: {
          workKey: work.key,
          workTitle: work.title,
          href: org ? getIssueHref(org.slug, work.key) : undefined,
        },
        recipients: Array.from(reviewers).map(recipientId => ({
          userId: recipientId,
        })),
        dedupeKey: `work-ready:${work._id}:${work.updatedAt ?? work._creationTime}`,
      });
    }
    await recordActivity(ctx, {
      scope: resolveIssueScope(work),
      actorId: userId,
      entityType: 'work',
      eventType: 'work_ready_for_review',
      snapshot: snapshotForIssue(work),
    });
    return { success: true } as const;
  },
});

export const complete = mutation({
  args: { workId: v.id('issues') },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const work = await requireWork(ctx, args.workId, 'edit');
    if (work.workStatus === 'completed') return { success: true } as const;
    if (work.workStatus !== 'ready_for_review')
      throw new ConvexError('WORK_NOT_READY_FOR_COMPLETION');
    const state = await workflowStateForWorkStatus(
      ctx,
      work.organizationId,
      'completed',
    );
    await touchMeaningfulWork(ctx, work._id, {
      workStatus: 'completed',
      focusRank: workFocusRank('completed', work.effort ?? 'unknown'),
      workflowStateId: state?._id ?? work.workflowStateId,
      closedAt: Date.now(),
      lastActivityEventType: 'work_completed',
    });
    await maybeRaiseLinkedRequestsForReview(
      ctx,
      { ...work, workStatus: 'completed' },
      userId,
    );
    const org = await ctx.db.get('organizations', work.organizationId);
    const stakeholders = new Set<Id<'users'>>();
    if (work.createdBy && work.createdBy !== userId)
      stakeholders.add(work.createdBy);
    if (work.reporterId && work.reporterId !== userId)
      stakeholders.add(work.reporterId);
    const contributors = await ctx.db
      .query('workContributors')
      .withIndex('by_work', query => query.eq('workId', work._id))
      .collect();
    for (const contributor of contributors) {
      if (contributor.userId !== userId) stakeholders.add(contributor.userId);
    }
    if (stakeholders.size > 0) {
      await createNotificationEvent(ctx, {
        type: 'work_completed',
        actorId: userId,
        organizationId: work.organizationId,
        issueId: work._id,
        payload: {
          workKey: work.key,
          workTitle: work.title,
          href: org ? getIssueHref(org.slug, work.key) : undefined,
        },
        recipients: Array.from(stakeholders).map(recipientId => ({
          userId: recipientId,
        })),
        dedupeKey: `work-completed:${work._id}:${work.readyForReviewAt ?? work.updatedAt ?? work._creationTime}`,
      });
    }
    await recordActivity(ctx, {
      scope: resolveIssueScope(work),
      actorId: userId,
      entityType: 'work',
      eventType: 'work_completed',
      snapshot: snapshotForIssue(work),
    });
    return { success: true } as const;
  },
});

export const addContributor = mutation({
  args: { workId: v.id('issues'), userId: v.id('users') },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const work = await requireWork(ctx, args.workId, 'edit');
    await assertOrganizationUser(ctx, work.organizationId, args.userId);
    const existing = await ctx.db
      .query('workContributors')
      .withIndex('by_work_user', q =>
        q.eq('workId', work._id).eq('userId', args.userId),
      )
      .first();
    if (!existing)
      await ctx.db.insert('workContributors', {
        workId: work._id,
        userId: args.userId,
        addedBy: actorId,
        addedAt: Date.now(),
      });
    return { success: true } as const;
  },
});

export const removeContributor = mutation({
  args: { workId: v.id('issues'), userId: v.id('users') },
  handler: async (ctx, args) => {
    await requireUser(ctx);
    await requireWork(ctx, args.workId, 'edit');
    const existing = await ctx.db
      .query('workContributors')
      .withIndex('by_work_user', q =>
        q.eq('workId', args.workId).eq('userId', args.userId),
      )
      .first();
    if (existing) await ctx.db.delete('workContributors', existing._id);
    return { success: true } as const;
  },
});

export const proposeHandoff = mutation({
  args: {
    workId: v.id('issues'),
    toOwnerId: v.id('users'),
    note: v.optional(v.string()),
    summary: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const work = await requireWork(ctx, args.workId, 'edit');
    if (!work.ownerId) throw new ConvexError('WORK_HAS_NO_OWNER');
    if (work.ownerId !== actorId && !(await canAssignIssue(ctx, work)))
      throw new ConvexError('FORBIDDEN');
    if (args.toOwnerId === work.ownerId) throw new ConvexError('ALREADY_OWNER');
    const summary = args.summary?.trim();
    if (!summary) throw new ConvexError('HANDOFF_SUMMARY_REQUIRED');
    await assertOrganizationUser(ctx, work.organizationId, args.toOwnerId);
    const pending = await ctx.db
      .query('workHandoffs')
      .withIndex('by_work_status', q =>
        q.eq('workId', work._id).eq('status', 'pending'),
      )
      .first();
    if (pending) throw new ConvexError('HANDOFF_ALREADY_PENDING');
    const handoffId = await ctx.db.insert('workHandoffs', {
      workId: work._id,
      fromOwnerId: work.ownerId,
      toOwnerId: args.toOwnerId,
      initiatedBy: actorId,
      status: 'pending',
      note: args.note?.trim() || undefined,
      summary,
      createdAt: Date.now(),
    });
    const org = await ctx.db.get('organizations', work.organizationId);
    await createNotificationEvent(ctx, {
      type: 'work_handoff_proposed',
      actorId,
      organizationId: work.organizationId,
      issueId: work._id,
      payload: {
        workKey: work.key,
        workTitle: work.title,
        href: org ? getIssueHref(org.slug, work.key) : undefined,
      },
      recipients: [{ userId: args.toOwnerId }],
      dedupeKey: `handoff-proposed:${handoffId}`,
    });
    return { handoffId };
  },
});

export const respondToHandoff = mutation({
  args: { handoffId: v.id('workHandoffs'), accept: v.boolean() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const handoff = await ctx.db.get('workHandoffs', args.handoffId);
    if (!handoff || handoff.status !== 'pending')
      throw new ConvexError('HANDOFF_NOT_FOUND');
    if (handoff.toOwnerId !== userId) throw new ConvexError('FORBIDDEN');
    const work = await requireWork(ctx, handoff.workId, 'view');
    const now = Date.now();
    await ctx.db.patch('workHandoffs', handoff._id, {
      status: args.accept ? 'accepted' : 'declined',
      respondedAt: now,
      respondedBy: userId,
    });
    if (args.accept) {
      const active = await ctx.db
        .query('workOwnershipPeriods')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .order('desc')
        .first();
      if (active && !active.endedAt)
        await ctx.db.patch('workOwnershipPeriods', active._id, {
          endedAt: now,
          endedBy: userId,
          handoffId: handoff._id,
          summary: handoff.summary,
        });
      await ctx.db.insert('workOwnershipPeriods', {
        workId: work._id,
        ownerId: userId,
        startedBy: userId,
        startedAt: now,
        handoffId: handoff._id,
      });
      await touchMeaningfulWork(ctx, work._id, {
        ownerId: userId,
        ownerStartedAt: undefined,
        ownerStartedBy: undefined,
      });
    }
    const org = await ctx.db.get('organizations', work.organizationId);
    await createNotificationEvent(ctx, {
      type: args.accept ? 'work_handoff_accepted' : 'work_handoff_declined',
      actorId: userId,
      organizationId: work.organizationId,
      issueId: work._id,
      payload: {
        workKey: work.key,
        workTitle: work.title,
        href: org ? getIssueHref(org.slug, work.key) : undefined,
      },
      recipients: [
        { userId: handoff.fromOwnerId },
        { userId: handoff.initiatedBy },
      ],
      dedupeKey: `handoff-response:${handoff._id}`,
    });
    return { success: true, ownerChanged: args.accept } as const;
  },
});

export const raiseAttention = mutation({
  args: {
    workId: v.id('issues'),
    taskId: v.optional(v.id('tasks')),
    liveActivityId: v.optional(v.id('issueLiveActivities')),
    title: v.string(),
    details: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const work = await requireWork(ctx, args.workId, 'edit');
    if (args.taskId) {
      const task = await ctx.db.get('tasks', args.taskId);
      if (!task || task.workId !== work._id)
        throw new ConvexError('TASK_NOT_IN_WORK');
    }
    const execution = args.liveActivityId
      ? await ctx.db.get('issueLiveActivities', args.liveActivityId)
      : null;
    if (
      args.liveActivityId &&
      (!execution ||
        execution.issueId !== work._id ||
        execution.ownerUserId !== actorId)
    ) {
      throw new ConvexError('INVALID_EXECUTION_ATTRIBUTION');
    }
    const attentionId = await ctx.db.insert('workAttentionRequests', {
      organizationId: work.organizationId,
      workId: work._id,
      taskId: args.taskId,
      liveActivityId: args.liveActivityId,
      raisedByUserId: actorId,
      agentProvider: execution?.provider,
      title: args.title.trim(),
      details: args.details?.trim() || undefined,
      status: 'open',
      createdAt: Date.now(),
    });
    const recipients = new Set<Id<'users'>>();
    if (work.ownerId) recipients.add(work.ownerId);
    if (work.createdBy) recipients.add(work.createdBy);
    if (work.reporterId) recipients.add(work.reporterId);
    const contributors = await ctx.db
      .query('workContributors')
      .withIndex('by_work', q => q.eq('workId', work._id))
      .collect();
    for (const contributor of contributors) recipients.add(contributor.userId);
    const org = await ctx.db.get('organizations', work.organizationId);
    await createNotificationEvent(ctx, {
      type: 'agent_attention_requested',
      actorId,
      organizationId: work.organizationId,
      issueId: work._id,
      taskId: args.taskId,
      payload: {
        workKey: work.key,
        workTitle: work.title,
        taskTitle: args.title,
        href: org ? getIssueHref(org.slug, work.key) : undefined,
      },
      recipients: Array.from(recipients).map(userId => ({ userId })),
      dedupeKey: `attention:${attentionId}`,
      allowActorRecipient: Boolean(execution),
    });
    return { attentionId };
  },
});

export const resolveAttention = mutation({
  args: {
    attentionId: v.id('workAttentionRequests'),
    dismiss: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const attention = await ctx.db.get(
      'workAttentionRequests',
      args.attentionId,
    );
    if (!attention || attention.status !== 'open')
      throw new ConvexError('ATTENTION_NOT_FOUND');
    await requireWork(ctx, attention.workId, 'edit');
    await ctx.db.patch('workAttentionRequests', attention._id, {
      status: args.dismiss ? 'dismissed' : 'resolved',
      resolvedAt: Date.now(),
      resolvedBy: userId,
    });
    if (attention.liveActivityId) {
      const execution = await ctx.db.get(
        'issueLiveActivities',
        attention.liveActivityId,
      );
      const work = await ctx.db.get('issues', attention.workId);
      const org = work
        ? await ctx.db.get('organizations', work.organizationId)
        : null;
      if (execution && work && execution.ownerUserId !== userId) {
        await createNotificationEvent(ctx, {
          type: 'agent_attention_resolved',
          actorId: userId,
          organizationId: work.organizationId,
          issueId: work._id,
          taskId: attention.taskId,
          payload: {
            workKey: work.key,
            workTitle: work.title,
            href: org ? getIssueHref(org.slug, work.key) : undefined,
          },
          recipients: [{ userId: execution.ownerUserId }],
          dedupeKey: `attention-resolved:${attention._id}`,
        });
      }
    }
    return { success: true } as const;
  },
});
