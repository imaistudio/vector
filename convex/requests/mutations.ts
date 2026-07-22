import { ConvexError, v } from 'convex/values';
import { mutation, type MutationCtx } from '../_generated/server';
import { internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import {
  getCommentPreview,
  recordActivity,
  resolveIssueScope,
  snapshotForIssue,
} from '../activities/lib';
import { getOrganizationBySlug, requireOrganizationMember } from '../authz';
import { createNotificationEvent } from '../notifications/lib';
import { PERMISSIONS, requirePermission } from '../permissions/utils';
import { requestWorkRelationValidator } from '../_shared/work';
import {
  assertOrganizationUser,
  requireUser,
  requireWork,
  touchMeaningfulWork,
  workFocusRank,
  workflowStateForWorkStatus,
} from '../work/lib';
import { cancelPendingHandoffs } from '../work/handoffs';
import {
  canEditRequest,
  nextRequestKey,
  requestFocusRank,
  requestHref,
  requestSearchText,
  requireRequest,
} from './lib';

const visibilityValidator = v.union(
  v.literal('private'),
  v.literal('organization'),
  v.literal('public'),
);

const PUBLIC_REQUEST_WINDOW_MS = 15 * 60 * 1000;
const PUBLIC_REQUEST_ORGANIZATION_LIMIT = 20;
const PUBLIC_REQUEST_IDENTITY_LIMIT = 3;

async function consumePublicRequestQuota(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  requesterEmail: string,
) {
  const now = Date.now();
  const windowStartedAt =
    Math.floor(now / PUBLIC_REQUEST_WINDOW_MS) * PUBLIC_REQUEST_WINDOW_MS;
  const identity = requesterEmail.trim().toLowerCase() || 'anonymous';
  const quotas = [
    { scope: 'organization', limit: PUBLIC_REQUEST_ORGANIZATION_LIMIT },
    { scope: `identity:${identity}`, limit: PUBLIC_REQUEST_IDENTITY_LIMIT },
  ];

  for (const quota of quotas) {
    const existing = await ctx.db
      .query('publicRequestRateLimits')
      .withIndex('by_org_scope', q =>
        q.eq('organizationId', organizationId).eq('scope', quota.scope),
      )
      .unique();
    if (
      existing &&
      existing.windowStartedAt === windowStartedAt &&
      existing.count >= quota.limit
    )
      throw new ConvexError('PUBLIC_REQUEST_RATE_LIMITED');

    if (existing) {
      await ctx.db.patch('publicRequestRateLimits', existing._id, {
        windowStartedAt,
        count:
          existing.windowStartedAt === windowStartedAt ? existing.count + 1 : 1,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('publicRequestRateLimits', {
        organizationId,
        scope: quota.scope,
        windowStartedAt,
        count: 1,
        updatedAt: now,
      });
    }
  }
}

async function insertRequest(
  ctx: MutationCtx,
  input: {
    organizationId: Id<'organizations'>;
    title: string;
    description?: string;
    expectedOutput: string;
    reviewGuidance?: string;
    source: 'workspace' | 'public' | 'github' | 'api';
    requesterId?: Id<'users'>;
    requesterName?: string;
    requesterEmail?: string;
    routedTeamId?: Id<'teams'>;
    recipientIds?: Id<'users'>[];
    priorityId?: Id<'issuePriorities'>;
    projectId?: Id<'projects'>;
    dueDate?: string;
    visibility: 'private' | 'organization' | 'public';
    createdBy?: Id<'users'>;
    clientRequestId?: string;
  },
) {
  const organization = await ctx.db.get('organizations', input.organizationId);
  if (!organization) throw new ConvexError('ORGANIZATION_NOT_FOUND');
  const title = input.title.trim();
  const expectedOutput = input.expectedOutput.trim();
  if (!title || title.length > 200) throw new ConvexError('INVALID_TITLE');
  if (!expectedOutput || expectedOutput.length > 10_000)
    throw new ConvexError('EXPECTED_OUTPUT_REQUIRED');
  if (input.description && input.description.length > 20_000)
    throw new ConvexError('DESCRIPTION_TOO_LONG');
  const clientRequestId = input.clientRequestId?.trim() || undefined;
  if (clientRequestId && clientRequestId.length > 100)
    throw new ConvexError('INVALID_CLIENT_REQUEST_ID');
  const recipientIds = Array.from(new Set(input.recipientIds ?? []));
  for (const recipientId of recipientIds)
    await assertOrganizationUser(ctx, input.organizationId, recipientId);
  if (input.routedTeamId) {
    const team = await ctx.db.get('teams', input.routedTeamId);
    if (!team || team.organizationId !== input.organizationId)
      throw new ConvexError('TEAM_NOT_FOUND');
  }
  if (input.priorityId) {
    const priority = await ctx.db.get('issuePriorities', input.priorityId);
    if (!priority || priority.organizationId !== input.organizationId)
      throw new ConvexError('PRIORITY_NOT_FOUND');
  }
  if (input.projectId) {
    const project = await ctx.db.get('projects', input.projectId);
    if (!project || project.organizationId !== input.organizationId)
      throw new ConvexError('PROJECT_NOT_FOUND');
  }
  const next = await nextRequestKey(ctx, organization);
  const now = Date.now();
  const initialStatus =
    recipientIds.length > 0 || input.routedTeamId ? 'routed' : 'new';
  const requestId = await ctx.db.insert('requests', {
    organizationId: input.organizationId,
    key: next.key,
    sequenceNumber: next.sequenceNumber,
    title,
    description: input.description?.trim() || undefined,
    expectedOutput,
    reviewGuidance: input.reviewGuidance?.trim() || undefined,
    searchText: requestSearchText({
      key: next.key,
      title,
      description: input.description,
      expectedOutput,
    }),
    status: initialStatus,
    focusRank: requestFocusRank(initialStatus),
    source: input.source,
    requesterId: input.requesterId,
    requesterName: input.requesterName?.trim() || undefined,
    requesterEmail: input.requesterEmail?.trim().toLowerCase() || undefined,
    routedTeamId: input.routedTeamId,
    ownerId: recipientIds.length === 1 ? recipientIds[0] : undefined,
    priorityId: input.priorityId,
    projectId: input.projectId,
    dueDate: input.dueDate?.trim() || undefined,
    visibility: input.visibility,
    createdBy: input.createdBy,
    clientRequestId,
    createdAt: now,
    updatedAt: now,
  });
  for (const recipientId of recipientIds)
    await ctx.db.insert('requestRecipients', {
      requestId,
      userId: recipientId,
      role: 'recipient',
      assignedBy: input.createdBy,
      assignedAt: now,
    });
  const activityActorId = input.createdBy ?? input.requesterId;
  if (activityActorId) {
    await recordActivity(ctx, {
      organizationId: input.organizationId,
      requestId,
      actorId: activityActorId,
      entityType: 'request',
      eventType: 'request_created',
      snapshot: { entityKey: next.key, entityName: title },
    });
  }
  if (
    organization.requestAutoRoutingEnabled &&
    organization.requestRoutingRules?.trim() &&
    recipientIds.length === 0 &&
    !input.routedTeamId
  ) {
    await ctx.scheduler.runAfter(
      0,
      internal.requests.autoRoutingActions.routeRequest,
      { requestId },
    );
  }
  return { requestId, requestKey: next.key, recipientIds };
}

async function reconcileRequestAfterWorkLink(
  ctx: MutationCtx,
  request: Awaited<ReturnType<typeof requireRequest>>,
  actorId: Id<'users'>,
) {
  if (['completed', 'declined', 'duplicate'].includes(request.status)) return;
  const links = await ctx.db
    .query('requestWorkLinks')
    .withIndex('by_request', q => q.eq('requestId', request._id))
    .collect();
  const fulfilling = links.filter(link => link.relation === 'fulfills');
  if (fulfilling.length === 0) {
    if (request.status === 'changes_requested') return;
    const recipient = await ctx.db
      .query('requestRecipients')
      .withIndex('by_request', q => q.eq('requestId', request._id))
      .first();
    const nextStatus = request.ownerId
      ? 'planned'
      : recipient || request.routedTeamId
        ? 'routed'
        : 'new';
    if (request.status !== nextStatus || request.readyForReviewAt) {
      await ctx.db.patch('requests', request._id, {
        status: nextStatus,
        focusRank: requestFocusRank(nextStatus),
        readyForReviewAt: undefined,
        updatedAt: Date.now(),
      });
    }
    return;
  }
  const work = (
    await Promise.all(fulfilling.map(link => ctx.db.get('issues', link.workId)))
  ).filter((item): item is Doc<'issues'> => item !== null);
  if (work.length !== fulfilling.length) return;

  const allReady = work.every(item =>
    ['ready_for_review', 'completed'].includes(item.workStatus ?? ''),
  );
  const now = Date.now();
  if (allReady) {
    if (request.status === 'ready_for_review') return;
    await ctx.db.patch('requests', request._id, {
      status: 'ready_for_review',
      focusRank: requestFocusRank('ready_for_review'),
      readyForReviewAt: now,
      updatedAt: now,
    });
    await recordActivity(ctx, {
      organizationId: request.organizationId,
      requestId: request._id,
      actorId,
      entityType: 'request',
      eventType: 'request_ready_for_review',
      details: {
        field: 'request_status',
        fromLabel: request.status,
        toLabel: 'ready_for_review',
      },
      snapshot: { entityKey: request.key, entityName: request.title },
    });
    const organization = await ctx.db.get(
      'organizations',
      request.organizationId,
    );
    const recipients = new Set<Id<'users'>>();
    if (request.requesterId) recipients.add(request.requesterId);
    if (request.createdBy) recipients.add(request.createdBy);
    await createNotificationEvent(ctx, {
      type: 'request_ready_for_review',
      actorId,
      organizationId: request.organizationId,
      requestId: request._id,
      payload: {
        requestKey: request.key,
        requestTitle: request.title,
        href: organization
          ? requestHref(organization.slug, request.key)
          : undefined,
      },
      recipients: Array.from(recipients).map(userId => ({ userId })),
      dedupeKey: `request-ready:${request._id}:${request.updatedAt}`,
    });
    return;
  }

  if (request.status === 'changes_requested') return;
  const nextStatus = work.some(item => item.startedAt)
    ? 'in_delivery'
    : 'planned';
  await ctx.db.patch('requests', request._id, {
    status: nextStatus,
    focusRank: requestFocusRank(nextStatus),
    readyForReviewAt: undefined,
    updatedAt: now,
  });
}

export const create = mutation({
  args: {
    orgSlug: v.string(),
    data: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      expectedOutput: v.string(),
      reviewGuidance: v.optional(v.string()),
      recipientIds: v.optional(v.array(v.id('users'))),
      routedTeamId: v.optional(v.id('teams')),
      priorityId: v.optional(v.id('issuePriorities')),
      projectId: v.optional(v.id('projects')),
      dueDate: v.optional(v.string()),
      visibility: v.optional(visibilityValidator),
      clientRequestId: v.optional(v.string()),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const organization = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrganizationMember(ctx, organization._id, userId);
    await requirePermission(ctx, organization._id, PERMISSIONS.ISSUE_CREATE);
    const clientRequestId = args.data.clientRequestId?.trim();
    if (clientRequestId) {
      if (clientRequestId.length > 100)
        throw new ConvexError('INVALID_CLIENT_REQUEST_ID');
      const existing = await ctx.db
        .query('requests')
        .withIndex('by_org_creator_client_request', q =>
          q
            .eq('organizationId', organization._id)
            .eq('createdBy', userId)
            .eq('clientRequestId', clientRequestId),
        )
        .unique();
      if (existing) {
        const recipients = await ctx.db
          .query('requestRecipients')
          .withIndex('by_request', q => q.eq('requestId', existing._id))
          .collect();
        return {
          requestId: existing._id,
          requestKey: existing.key,
          recipientIds: recipients.map(recipient => recipient.userId),
        };
      }
    }
    const result = await insertRequest(ctx, {
      organizationId: organization._id,
      ...args.data,
      clientRequestId,
      source: 'workspace',
      requesterId: userId,
      createdBy: userId,
      visibility: args.data.visibility ?? 'organization',
    });
    if (result.recipientIds.length > 0)
      await createNotificationEvent(ctx, {
        type: 'request_routed',
        actorId: userId,
        organizationId: organization._id,
        requestId: result.requestId,
        payload: {
          requestKey: result.requestKey,
          requestTitle: args.data.title.trim(),
          href: requestHref(organization.slug, result.requestKey),
        },
        recipients: result.recipientIds.map(id => ({ userId: id })),
        dedupeKey: `request-routed:${result.requestId}:created`,
      });
    return result;
  },
});

export const createPublic = mutation({
  args: {
    orgSlug: v.string(),
    title: v.string(),
    description: v.optional(v.string()),
    expectedOutput: v.string(),
    reviewGuidance: v.optional(v.string()),
    requesterName: v.string(),
    requesterEmail: v.string(),
  },
  handler: async (ctx, args) => {
    const organization = await getOrganizationBySlug(ctx, args.orgSlug);
    if (!organization.publicIssueSubmissionEnabled)
      throw new ConvexError('PUBLIC_REQUESTS_DISABLED');
    const project = organization.publicIssueProjectId
      ? await ctx.db.get('projects', organization.publicIssueProjectId)
      : null;
    if (organization.publicIssueProjectId && !project)
      throw new ConvexError('PUBLIC_SUBMISSION_PROJECT_MISSING');
    const requesterName = args.requesterName.trim();
    const requesterEmail = args.requesterEmail.trim().toLowerCase();
    if (requesterName.length > 120 || requesterEmail.length > 320)
      throw new ConvexError('INVALID_REQUESTER');
    if (requesterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requesterEmail))
      throw new ConvexError('INVALID_REQUESTER_EMAIL');
    await consumePublicRequestQuota(ctx, organization._id, requesterEmail);
    const result = await insertRequest(ctx, {
      organizationId: organization._id,
      title: args.title,
      description: args.description,
      expectedOutput: args.expectedOutput,
      reviewGuidance: args.reviewGuidance,
      source: 'public',
      requesterName,
      requesterEmail,
      projectId: project?._id,
      routedTeamId: project?.teamId,
      visibility: 'organization',
    });
    const recipients = new Set<Id<'users'>>();
    if (project?.leadId) recipients.add(project.leadId);
    if (project?.createdBy) recipients.add(project.createdBy);
    if (project?.teamId) {
      const team = await ctx.db.get('teams', project.teamId);
      if (team?.leadId) recipients.add(team.leadId);
    }
    if (recipients.size > 0) {
      await createNotificationEvent(ctx, {
        type: 'request_routing_needed',
        organizationId: organization._id,
        requestId: result.requestId,
        payload: {
          requestKey: result.requestKey,
          requestTitle: args.title.trim(),
          href: requestHref(organization.slug, result.requestKey),
        },
        recipients: Array.from(recipients).map(userId => ({ userId })),
        dedupeKey: `request-routing-needed:${result.requestId}`,
      });
    }
    return { requestKey: result.requestKey };
  },
});

export const updateDetails = mutation({
  args: {
    requestId: v.id('requests'),
    description: v.optional(v.string()),
    expectedOutput: v.optional(v.string()),
    dueDate: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const request = await requireRequest(ctx, args.requestId, 'edit');
    const description = args.description?.trim() || undefined;
    const expectedOutput = args.expectedOutput?.trim();
    const dueDate = args.dueDate?.trim() || undefined;

    if (args.description !== undefined && args.description.length > 20_000)
      throw new ConvexError('DESCRIPTION_TOO_LONG');
    if (
      args.expectedOutput !== undefined &&
      (!expectedOutput || args.expectedOutput.length > 10_000)
    )
      throw new ConvexError('EXPECTED_OUTPUT_REQUIRED');
    if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate))
      throw new ConvexError('INVALID_DUE_DATE');

    const nextDescription =
      args.description === undefined ? request.description : description;
    const nextExpectedOutput = expectedOutput ?? request.expectedOutput;

    const nextDueDate = args.dueDate === undefined ? request.dueDate : dueDate;
    await ctx.db.patch('requests', request._id, {
      description: nextDescription,
      expectedOutput: nextExpectedOutput,
      dueDate: nextDueDate,
      searchText: requestSearchText({
        key: request.key,
        title: request.title,
        description: nextDescription,
        expectedOutput: nextExpectedOutput,
      }),
      updatedAt: Date.now(),
    });

    const activityBase = {
      organizationId: request.organizationId,
      requestId: request._id,
      actorId,
      entityType: 'request' as const,
      snapshot: { entityKey: request.key, entityName: request.title },
    };
    if (
      args.description !== undefined &&
      nextDescription !== request.description
    )
      await recordActivity(ctx, {
        ...activityBase,
        eventType: 'request_description_changed',
        details: { field: 'description' },
      });
    if (
      args.expectedOutput !== undefined &&
      nextExpectedOutput !== request.expectedOutput
    )
      await recordActivity(ctx, {
        ...activityBase,
        eventType: 'request_expected_output_changed',
        details: { field: 'expected_output' },
      });
    if (args.dueDate !== undefined && nextDueDate !== request.dueDate)
      await recordActivity(ctx, {
        ...activityBase,
        eventType: 'request_due_date_changed',
        details: {
          field: 'due_date',
          fromLabel: request.dueDate ?? 'None',
          toLabel: nextDueDate ?? 'None',
        },
      });
    return { success: true } as const;
  },
});

export const addComment = mutation({
  args: {
    requestId: v.id('requests'),
    body: v.string(),
    parentId: v.optional(v.id('comments')),
  },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const request = await requireRequest(ctx, args.requestId, 'view');
    const body = args.body.trim();
    if (!body || body.length > 20_000) throw new ConvexError('INVALID_COMMENT');

    if (args.parentId) {
      const parent = await ctx.db.get('comments', args.parentId);
      if (
        !parent ||
        parent.deleted ||
        parent.parentId ||
        parent.requestId !== request._id
      )
        throw new ConvexError('INVALID_PARENT_COMMENT');
    }

    const commentId = await ctx.db.insert('comments', {
      requestId: request._id,
      authorId: actorId,
      body,
      deleted: false,
      parentId: args.parentId,
    });
    await recordActivity(ctx, {
      organizationId: request.organizationId,
      requestId: request._id,
      actorId,
      entityType: 'request',
      eventType: 'request_comment_added',
      details: {
        commentId,
        commentPreview: getCommentPreview(body),
      },
      snapshot: { entityKey: request.key, entityName: request.title },
    });
    return { commentId } as const;
  },
});

export const editComment = mutation({
  args: { commentId: v.id('comments'), body: v.string() },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const comment = await ctx.db.get('comments', args.commentId);
    if (!comment?.requestId || comment.deleted)
      throw new ConvexError('COMMENT_NOT_FOUND');
    await requireRequest(ctx, comment.requestId, 'view');
    if (comment.authorId !== actorId) throw new ConvexError('FORBIDDEN');
    const body = args.body.trim();
    if (!body || body.length > 20_000) throw new ConvexError('INVALID_COMMENT');
    await ctx.db.patch('comments', comment._id, { body });
    return { success: true } as const;
  },
});

export const deleteComment = mutation({
  args: { commentId: v.id('comments') },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const comment = await ctx.db.get('comments', args.commentId);
    if (!comment?.requestId || comment.deleted)
      throw new ConvexError('COMMENT_NOT_FOUND');
    await requireRequest(ctx, comment.requestId, 'view');
    if (comment.authorId !== actorId) throw new ConvexError('FORBIDDEN');
    await ctx.db.patch('comments', comment._id, { deleted: true });
    return { success: true } as const;
  },
});

export const route = mutation({
  args: {
    requestId: v.id('requests'),
    recipientIds: v.array(v.id('users')),
    routedTeamId: v.optional(v.id('teams')),
  },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const request = await requireRequest(ctx, args.requestId, 'edit');
    if (['completed', 'declined', 'duplicate'].includes(request.status))
      throw new ConvexError('REQUEST_TERMINAL');
    const recipients = Array.from(new Set(args.recipientIds));
    for (const id of recipients)
      await assertOrganizationUser(ctx, request.organizationId, id);
    if (args.routedTeamId) {
      const team = await ctx.db.get('teams', args.routedTeamId);
      if (!team || team.organizationId !== request.organizationId)
        throw new ConvexError('TEAM_NOT_FOUND');
    }
    const existing = await ctx.db
      .query('requestRecipients')
      .withIndex('by_request', q => q.eq('requestId', request._id))
      .collect();
    for (const row of existing.filter(row => row.role === 'recipient'))
      await ctx.db.delete('requestRecipients', row._id);
    const now = Date.now();
    for (const id of recipients)
      await ctx.db.insert('requestRecipients', {
        requestId: request._id,
        userId: id,
        role: 'recipient',
        assignedBy: actorId,
        assignedAt: now,
      });
    const routingStatus =
      recipients.length || args.routedTeamId ? 'routed' : 'new';
    const nextStatus = ['new', 'routed'].includes(request.status)
      ? routingStatus
      : request.status;
    await ctx.db.patch('requests', request._id, {
      ownerId:
        recipients.length === 1
          ? recipients[0]
          : ['new', 'routed'].includes(request.status)
            ? undefined
            : request.ownerId,
      routedTeamId: args.routedTeamId,
      status: nextStatus,
      focusRank: requestFocusRank(nextStatus),
      updatedAt: now,
    });
    await recordActivity(ctx, {
      organizationId: request.organizationId,
      requestId: request._id,
      actorId,
      entityType: 'request',
      eventType: 'request_routed',
      details: {
        field: 'request_status',
        fromLabel: request.status,
        toLabel: nextStatus,
      },
      snapshot: { entityKey: request.key, entityName: request.title },
    });
    const org = await ctx.db.get('organizations', request.organizationId);
    if (recipients.length)
      await createNotificationEvent(ctx, {
        type: 'request_routed',
        actorId,
        organizationId: request.organizationId,
        requestId: request._id,
        payload: {
          requestKey: request.key,
          requestTitle: request.title,
          href: org ? requestHref(org.slug, request.key) : undefined,
        },
        recipients: recipients.map(userId => ({ userId })),
        dedupeKey: `request-routed:${request._id}:${recipients
          .map(String)
          .sort()
          .join(',')}:${args.routedTeamId ?? 'none'}:${request.status}`,
      });
    return { success: true } as const;
  },
});

export const claim = mutation({
  args: { requestId: v.id('requests') },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const request = await requireRequest(ctx, args.requestId, 'view');
    if (
      !['new', 'routed', 'ready_for_review', 'changes_requested'].includes(
        request.status,
      )
    )
      throw new ConvexError('REQUEST_NOT_IN_REVIEW');
    if (request.ownerId && request.ownerId !== userId)
      throw new ConvexError('REQUEST_ALREADY_OWNED');
    await requireOrganizationMember(ctx, request.organizationId, userId);
    const nextStatus = ['new', 'routed'].includes(request.status)
      ? 'planned'
      : request.status;
    await ctx.db.patch('requests', request._id, {
      ownerId: userId,
      status: nextStatus,
      focusRank: requestFocusRank(nextStatus),
      updatedAt: Date.now(),
    });
    const recipient = await ctx.db
      .query('requestRecipients')
      .withIndex('by_request_user', q =>
        q.eq('requestId', request._id).eq('userId', userId),
      )
      .first();
    if (!recipient)
      await ctx.db.insert('requestRecipients', {
        requestId: request._id,
        userId,
        role: 'recipient',
        assignedBy: userId,
        assignedAt: Date.now(),
      });
    await recordActivity(ctx, {
      organizationId: request.organizationId,
      requestId: request._id,
      actorId: userId,
      entityType: 'request',
      eventType: 'request_claimed',
      details: {
        field: 'owner',
        fromId: request.ownerId ?? null,
        toId: userId,
      },
      snapshot: { entityKey: request.key, entityName: request.title },
    });
    return { success: true } as const;
  },
});

export const linkWork = mutation({
  args: {
    requestId: v.id('requests'),
    workId: v.id('issues'),
    relation: v.optional(requestWorkRelationValidator),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const request = await requireRequest(ctx, args.requestId, 'edit');
    const work = await requireWork(ctx, args.workId, 'edit');
    if (request.organizationId !== work.organizationId)
      throw new ConvexError('CROSS_ORGANIZATION_LINK');
    const existing = await ctx.db
      .query('requestWorkLinks')
      .withIndex('by_request_work', q =>
        q.eq('requestId', request._id).eq('workId', work._id),
      )
      .first();
    const relation = args.relation ?? 'fulfills';
    if (!existing)
      await ctx.db.insert('requestWorkLinks', {
        requestId: request._id,
        workId: work._id,
        relation,
        createdBy: userId,
        createdAt: Date.now(),
      });
    else if (existing.relation !== relation)
      await ctx.db.patch('requestWorkLinks', existing._id, { relation });
    if (!existing || existing.relation !== relation)
      await recordActivity(ctx, {
        organizationId: request.organizationId,
        requestId: request._id,
        actorId: userId,
        entityType: 'request',
        eventType: 'request_linked_to_work',
        details: { field: 'content' },
        snapshot: { entityKey: request.key, entityName: request.title },
      });
    if (relation === 'fulfills' || existing?.relation === 'fulfills')
      await reconcileRequestAfterWorkLink(ctx, request, userId);
    return { success: true } as const;
  },
});

export const requestChanges = mutation({
  args: { requestId: v.id('requests'), note: v.string() },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const request = await requireRequest(ctx, args.requestId, 'view');
    if (
      request.requesterId !== userId &&
      request.createdBy !== userId &&
      !(await canEditRequest(ctx, request))
    )
      throw new ConvexError('FORBIDDEN');
    const note = args.note.trim();
    if (!note) throw new ConvexError('REVIEW_NOTE_REQUIRED');
    await ctx.db.patch('requests', request._id, {
      status: 'changes_requested',
      focusRank: requestFocusRank('changes_requested'),
      latestReviewNote: note,
      readyForReviewAt: undefined,
      reviewedAt: Date.now(),
      reviewedBy: userId,
      updatedAt: Date.now(),
    });
    await recordActivity(ctx, {
      organizationId: request.organizationId,
      requestId: request._id,
      actorId: userId,
      entityType: 'request',
      eventType: 'request_changes_requested',
      details: {
        field: 'request_status',
        fromLabel: request.status,
        toLabel: 'changes_requested',
        commentPreview: note,
      },
      snapshot: { entityKey: request.key, entityName: request.title },
    });
    const links = await ctx.db
      .query('requestWorkLinks')
      .withIndex('by_request', q => q.eq('requestId', request._id))
      .collect();
    const recipients = new Set<Id<'users'>>();
    if (request.ownerId) recipients.add(request.ownerId);
    for (const link of links) {
      if (link.relation !== 'fulfills') continue;
      const work = await ctx.db.get('issues', link.workId);
      if (!work) continue;
      if (work.ownerId) recipients.add(work.ownerId);
      if (work.workStatus === 'ready_for_review') {
        const activeState = await workflowStateForWorkStatus(
          ctx,
          work.organizationId,
          'active',
        );
        await touchMeaningfulWork(ctx, work._id, {
          workStatus: 'active',
          focusRank: workFocusRank('active', work.effort ?? 'unknown'),
          workflowStateId: activeState?._id ?? work.workflowStateId,
          readyForReviewAt: undefined,
          lastActivityEventType: 'request_changes_requested',
        });
        await recordActivity(ctx, {
          scope: { ...resolveIssueScope(work), requestId: request._id },
          actorId: userId,
          entityType: 'work',
          eventType: 'request_changes_requested',
          details: {
            field: 'status',
            fromLabel: work.workStatus,
            toLabel: 'active',
            commentPreview: note,
          },
          snapshot: snapshotForIssue({ ...work, workStatus: 'active' }),
        });
      }
    }
    const org = await ctx.db.get('organizations', request.organizationId);
    await createNotificationEvent(ctx, {
      type: 'request_changes_requested',
      actorId: userId,
      organizationId: request.organizationId,
      requestId: request._id,
      payload: {
        requestKey: request.key,
        requestTitle: request.title,
        href: org ? requestHref(org.slug, request.key) : undefined,
      },
      recipients: Array.from(recipients).map(id => ({ userId: id })),
      dedupeKey: `request-changes:${request._id}:${request.updatedAt}`,
    });
    return { success: true } as const;
  },
});

export const complete = mutation({
  args: { requestId: v.id('requests'), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const request = await requireRequest(ctx, args.requestId, 'view');
    if (request.status === 'completed') return { success: true } as const;
    if (
      request.requesterId !== userId &&
      request.createdBy !== userId &&
      !(await canEditRequest(ctx, request))
    )
      throw new ConvexError('FORBIDDEN');
    const now = Date.now();
    await ctx.db.patch('requests', request._id, {
      status: 'completed',
      focusRank: requestFocusRank('completed'),
      latestReviewNote: args.note?.trim() || request.latestReviewNote,
      reviewedAt: now,
      reviewedBy: userId,
      completedAt: now,
      completedBy: userId,
      updatedAt: now,
    });
    await recordActivity(ctx, {
      organizationId: request.organizationId,
      requestId: request._id,
      actorId: userId,
      entityType: 'request',
      eventType: 'request_completed',
      details: {
        field: 'request_status',
        fromLabel: request.status,
        toLabel: 'completed',
        commentPreview: args.note?.trim() || undefined,
      },
      snapshot: { entityKey: request.key, entityName: request.title },
    });
    const recipients = new Set<Id<'users'>>();
    if (request.ownerId && request.ownerId !== userId)
      recipients.add(request.ownerId);
    const recipientRows = await ctx.db
      .query('requestRecipients')
      .withIndex('by_request', query => query.eq('requestId', request._id))
      .collect();
    for (const row of recipientRows) {
      if (row.userId !== userId) recipients.add(row.userId);
    }
    const links = await ctx.db
      .query('requestWorkLinks')
      .withIndex('by_request', query => query.eq('requestId', request._id))
      .collect();
    for (const link of links) {
      const work = await ctx.db.get('issues', link.workId);
      if (!work) continue;
      if (work.ownerId && work.ownerId !== userId) recipients.add(work.ownerId);
      if (
        link.relation !== 'fulfills' ||
        work.workStatus !== 'ready_for_review'
      )
        continue;
      const workLinks = await ctx.db
        .query('requestWorkLinks')
        .withIndex('by_work', query => query.eq('workId', work._id))
        .collect();
      const fulfillingRequests = await Promise.all(
        workLinks
          .filter(row => row.relation === 'fulfills')
          .map(row => ctx.db.get('requests', row.requestId)),
      );
      const allAccepted = fulfillingRequests.every(
        linkedRequest =>
          linkedRequest &&
          (linkedRequest._id === request._id ||
            ['completed', 'declined', 'duplicate'].includes(
              linkedRequest.status,
            )),
      );
      if (!allAccepted) continue;
      const completedState = await workflowStateForWorkStatus(
        ctx,
        work.organizationId,
        'completed',
      );
      await touchMeaningfulWork(ctx, work._id, {
        workStatus: 'completed',
        focusRank: workFocusRank('completed', work.effort ?? 'unknown'),
        workflowStateId: completedState?._id ?? work.workflowStateId,
        closedAt: now,
        lastActivityEventType: 'work_completed',
      });
      await cancelPendingHandoffs(ctx, work._id, userId);
      await recordActivity(ctx, {
        scope: { ...resolveIssueScope(work), requestId: request._id },
        actorId: userId,
        entityType: 'work',
        eventType: 'work_completed',
        details: {
          field: 'status',
          fromLabel: work.workStatus,
          toLabel: 'completed',
        },
        snapshot: snapshotForIssue({ ...work, workStatus: 'completed' }),
      });
    }
    const org = await ctx.db.get('organizations', request.organizationId);
    if (recipients.size > 0) {
      await createNotificationEvent(ctx, {
        type: 'request_completed',
        actorId: userId,
        organizationId: request.organizationId,
        requestId: request._id,
        payload: {
          requestKey: request.key,
          requestTitle: request.title,
          href: org ? requestHref(org.slug, request.key) : undefined,
        },
        recipients: Array.from(recipients).map(recipientId => ({
          userId: recipientId,
        })),
        dedupeKey: `request-completed:${request._id}:${request.readyForReviewAt ?? request.reviewedAt ?? request.updatedAt}`,
      });
    }
    return { success: true } as const;
  },
});
