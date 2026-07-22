import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { hasPermission } from '../access';
import { getAuthUserId } from '../authUtils';
import { PERMISSIONS } from '../permissions/utils';
import type { RequestStatus } from '../_shared/work';

const REQUEST_FOCUS_RANK: Record<RequestStatus, number> = {
  ready_for_review: 0,
  changes_requested: 10,
  new: 20,
  routed: 30,
  in_delivery: 40,
  planned: 50,
  completed: 70,
  declined: 80,
  duplicate: 90,
};

export function requestFocusRank(status: RequestStatus) {
  return REQUEST_FOCUS_RANK[status];
}

export async function canViewRequest(
  ctx: QueryCtx | MutationCtx,
  request: Doc<'requests'>,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (
    request.requesterId === userId ||
    request.createdBy === userId ||
    request.ownerId === userId
  )
    return true;
  const recipient = await ctx.db
    .query('requestRecipients')
    .withIndex('by_request_user', q =>
      q.eq('requestId', request._id).eq('userId', userId),
    )
    .first();
  if (recipient) return true;
  if (request.visibility === 'private') return false;
  return await hasPermission(
    ctx,
    {
      organizationId: request.organizationId,
      teamId: request.routedTeamId,
      projectId: request.projectId,
    },
    PERMISSIONS.ISSUE_VIEW,
  );
}

export async function canEditRequest(
  ctx: QueryCtx | MutationCtx,
  request: Doc<'requests'>,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (
    request.requesterId === userId ||
    request.createdBy === userId ||
    request.ownerId === userId
  )
    return true;
  return await hasPermission(
    ctx,
    {
      organizationId: request.organizationId,
      teamId: request.routedTeamId,
      projectId: request.projectId,
    },
    PERMISSIONS.ISSUE_EDIT,
  );
}

export async function canDeleteRequest(
  ctx: QueryCtx | MutationCtx,
  request: Doc<'requests'>,
) {
  const userId = await getAuthUserId(ctx);
  if (!userId) return false;
  if (request.requesterId === userId || request.createdBy === userId) {
    return true;
  }
  return await hasPermission(
    ctx,
    {
      organizationId: request.organizationId,
      teamId: request.routedTeamId,
      projectId: request.projectId,
    },
    PERMISSIONS.ISSUE_DELETE,
  );
}

export async function requireRequest(
  ctx: QueryCtx | MutationCtx,
  requestId: Id<'requests'>,
  access: 'view' | 'edit' = 'view',
) {
  const request = await ctx.db.get('requests', requestId);
  if (!request) throw new ConvexError('REQUEST_NOT_FOUND');
  const allowed =
    access === 'edit'
      ? await canEditRequest(ctx, request)
      : await canViewRequest(ctx, request);
  if (!allowed) throw new ConvexError('FORBIDDEN');
  return request;
}

export async function nextRequestKey(
  ctx: MutationCtx,
  organization: Doc<'organizations'>,
) {
  const counter = await ctx.db
    .query('organizationSequences')
    .withIndex('by_org_namespace', q =>
      q.eq('organizationId', organization._id).eq('namespace', 'request'),
    )
    .unique();
  const next = (counter?.value ?? 0) + 1;
  if (counter) {
    await ctx.db.patch('organizationSequences', counter._id, {
      value: next,
      updatedAt: Date.now(),
    });
  } else {
    await ctx.db.insert('organizationSequences', {
      organizationId: organization._id,
      namespace: 'request',
      value: next,
      updatedAt: Date.now(),
    });
  }
  return { key: `REQ-${next}`, sequenceNumber: next };
}

export function requestSearchText(input: {
  key: string;
  title: string;
  description?: string;
  expectedOutput: string;
}) {
  return [input.key, input.title, input.description, input.expectedOutput]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

export function requestHref(orgSlug: string, requestKey: string) {
  return `/${orgSlug}/requests/${requestKey}`;
}
