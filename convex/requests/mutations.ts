import { ConvexError, v } from 'convex/values';
import { mutation, type MutationCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import {
  recordActivity,
  resolveIssueScope,
  snapshotForIssue,
} from '../activities/lib';
import { getOrganizationBySlug, requireOrganizationMember } from '../authz';
import { createNotificationEvent } from '../notifications/lib';
import { PERMISSIONS, requirePermission } from '../permissions/utils';
import {
  requestSourceValidator,
  requestWorkRelationValidator,
} from '../_shared/work';
import {
  assertOrganizationUser,
  requireUser,
  requireWork,
  touchMeaningfulWork,
  workflowStateForWorkStatus,
} from '../work/lib';
import {
  canEditRequest,
  nextRequestKey,
  requestHref,
  requestSearchText,
  requireRequest,
} from './lib';

const visibilityValidator = v.union(
  v.literal('private'),
  v.literal('organization'),
  v.literal('public'),
);

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
  const recipientIds = Array.from(new Set(input.recipientIds ?? []));
  for (const recipientId of recipientIds)
    await assertOrganizationUser(ctx, input.organizationId, recipientId);
  if (input.routedTeamId) {
    const team = await ctx.db.get('teams', input.routedTeamId);
    if (!team || team.organizationId !== input.organizationId)
      throw new ConvexError('TEAM_NOT_FOUND');
  }
  if (input.projectId) {
    const project = await ctx.db.get('projects', input.projectId);
    if (!project || project.organizationId !== input.organizationId)
      throw new ConvexError('PROJECT_NOT_FOUND');
  }
  const next = await nextRequestKey(ctx, organization);
  const now = Date.now();
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
    status: recipientIds.length > 0 || input.routedTeamId ? 'routed' : 'new',
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
  return { requestId, requestKey: next.key, recipientIds };
}

export const create = mutation({
  args: {
    orgSlug: v.string(),
    data: v.object({
      title: v.string(),
      description: v.optional(v.string()),
      expectedOutput: v.string(),
      reviewGuidance: v.optional(v.string()),
      source: v.optional(requestSourceValidator),
      recipientIds: v.optional(v.array(v.id('users'))),
      routedTeamId: v.optional(v.id('teams')),
      priorityId: v.optional(v.id('issuePriorities')),
      projectId: v.optional(v.id('projects')),
      dueDate: v.optional(v.string()),
      visibility: v.optional(visibilityValidator),
    }),
  },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const organization = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrganizationMember(ctx, organization._id, userId);
    await requirePermission(ctx, organization._id, PERMISSIONS.ISSUE_CREATE);
    const result = await insertRequest(ctx, {
      organizationId: organization._id,
      ...args.data,
      source: args.data.source ?? 'workspace',
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
    const result = await insertRequest(ctx, {
      organizationId: organization._id,
      title: args.title,
      description: args.description,
      expectedOutput: args.expectedOutput,
      reviewGuidance: args.reviewGuidance,
      source: 'public',
      requesterName: args.requesterName,
      requesterEmail: args.requesterEmail,
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

export const route = mutation({
  args: {
    requestId: v.id('requests'),
    recipientIds: v.array(v.id('users')),
    routedTeamId: v.optional(v.id('teams')),
  },
  handler: async (ctx, args) => {
    const actorId = await requireUser(ctx);
    const request = await requireRequest(ctx, args.requestId, 'edit');
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
    await ctx.db.patch('requests', request._id, {
      ownerId: recipients.length === 1 ? recipients[0] : undefined,
      routedTeamId: args.routedTeamId,
      status: recipients.length || args.routedTeamId ? 'routed' : 'new',
      updatedAt: now,
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
        dedupeKey: `request-routed:${request._id}:${now}`,
      });
    return { success: true } as const;
  },
});

export const claim = mutation({
  args: { requestId: v.id('requests') },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const request = await requireRequest(ctx, args.requestId, 'view');
    if (request.ownerId && request.ownerId !== userId)
      throw new ConvexError('REQUEST_ALREADY_OWNED');
    await requireOrganizationMember(ctx, request.organizationId, userId);
    await ctx.db.patch('requests', request._id, {
      ownerId: userId,
      status: 'planned',
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
    if (!existing)
      await ctx.db.insert('requestWorkLinks', {
        requestId: request._id,
        workId: work._id,
        relation: args.relation ?? 'fulfills',
        createdBy: userId,
        createdAt: Date.now(),
      });
    if (
      (args.relation ?? 'fulfills') === 'fulfills' &&
      ['new', 'routed'].includes(request.status)
    )
      await ctx.db.patch('requests', request._id, {
        status: work.startedAt ? 'in_delivery' : 'planned',
        updatedAt: Date.now(),
      });
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
      latestReviewNote: note,
      reviewedAt: Date.now(),
      reviewedBy: userId,
      updatedAt: Date.now(),
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
        requestTitle: note,
        href: org ? requestHref(org.slug, request.key) : undefined,
      },
      recipients: Array.from(recipients).map(id => ({ userId: id })),
      dedupeKey: `request-changes:${request._id}:${Date.now()}`,
    });
    return { success: true } as const;
  },
});

export const complete = mutation({
  args: { requestId: v.id('requests'), note: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await requireUser(ctx);
    const request = await requireRequest(ctx, args.requestId, 'view');
    if (
      request.requesterId !== userId &&
      request.createdBy !== userId &&
      !(await canEditRequest(ctx, request))
    )
      throw new ConvexError('FORBIDDEN');
    const now = Date.now();
    await ctx.db.patch('requests', request._id, {
      status: 'completed',
      latestReviewNote: args.note?.trim() || request.latestReviewNote,
      reviewedAt: now,
      reviewedBy: userId,
      completedAt: now,
      completedBy: userId,
      updatedAt: now,
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
        workflowStateId: completedState?._id ?? work.workflowStateId,
        closedAt: now,
        lastActivityEventType: 'work_completed',
      });
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
        dedupeKey: `request-completed:${request._id}:${now}`,
      });
    }
    return { success: true } as const;
  },
});
