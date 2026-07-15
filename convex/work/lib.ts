import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { canEditIssue, canViewIssue } from '../access';
import { getOrganizationBySlug, requireOrganizationMember } from '../authz';
import { getAuthUserId } from '../authUtils';
import type { WorkEffort, WorkStatus } from '../_shared/work';

export function isCanonicalWork(work: Doc<'issues'>) {
  return work.kind === 'work' || (!work.kind && !work.parentIssueId);
}

export function workFocusRank(
  status: WorkStatus,
  effort: WorkEffort = 'unknown',
) {
  const statusRank: Record<WorkStatus, number> = {
    blocked: 0,
    ready_for_review: 10,
    active: 20,
    waiting: 30,
    planned: 40,
    completed: 60,
    canceled: 70,
  };
  const effortRank: Record<WorkEffort, number> = {
    l: 0,
    m: 1,
    s: 2,
    xs: 3,
    unknown: 4,
  };
  return statusRank[status] + effortRank[effort];
}

export async function requireUser(
  ctx: QueryCtx | MutationCtx,
): Promise<Id<'users'>> {
  const userId = await getAuthUserId(ctx);
  if (!userId) throw new ConvexError('UNAUTHORIZED');
  return userId;
}

export async function requireOrganization(
  ctx: QueryCtx | MutationCtx,
  orgSlug: string,
) {
  const userId = await requireUser(ctx);
  const organization = await getOrganizationBySlug(ctx, orgSlug);
  await requireOrganizationMember(ctx, organization._id, userId);
  return { organization, userId };
}

export async function requireWork(
  ctx: QueryCtx | MutationCtx,
  workId: Id<'issues'>,
  access: 'view' | 'edit' = 'view',
) {
  const work = await ctx.db.get('issues', workId);
  if (!work || !isCanonicalWork(work)) throw new ConvexError('WORK_NOT_FOUND');
  const allowed =
    access === 'edit'
      ? await canEditIssue(ctx, work)
      : await canViewIssue(ctx, work);
  if (!allowed) throw new ConvexError('FORBIDDEN');
  return work;
}

export async function requireWorkByKey(
  ctx: QueryCtx | MutationCtx,
  orgSlug: string,
  workKey: string,
  access: 'view' | 'edit' = 'view',
) {
  const { organization, userId } = await requireOrganization(ctx, orgSlug);
  const work = await ctx.db
    .query('issues')
    .withIndex('by_org_key', query =>
      query.eq('organizationId', organization._id).eq('key', workKey),
    )
    .first();
  if (!work || !isCanonicalWork(work)) throw new ConvexError('WORK_NOT_FOUND');
  const allowed =
    access === 'edit'
      ? await canEditIssue(ctx, work)
      : await canViewIssue(ctx, work);
  if (!allowed) throw new ConvexError('FORBIDDEN');
  return { organization, userId, work };
}

export async function assertOrganizationUser(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  userId: Id<'users'>,
) {
  const member = await ctx.db
    .query('members')
    .withIndex('by_org_user', query =>
      query.eq('organizationId', organizationId).eq('userId', userId),
    )
    .first();
  if (!member) throw new ConvexError('INVALID_ORGANIZATION_USER');
  return member;
}

export async function workflowStateForWorkStatus(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  status: WorkStatus,
) {
  const type =
    status === 'active' || status === 'blocked' || status === 'waiting'
      ? 'in_progress'
      : status === 'completed' || status === 'ready_for_review'
        ? 'done'
        : status === 'canceled'
          ? 'canceled'
          : 'todo';
  return await ctx.db
    .query('issueStates')
    .withIndex('by_org_type', query =>
      query.eq('organizationId', organizationId).eq('type', type),
    )
    .order('asc')
    .first();
}

export function statusFromLegacyState(
  state: Doc<'issueStates'> | null | undefined,
): WorkStatus {
  switch (state?.type) {
    case 'in_progress':
      return 'active';
    case 'done':
      return 'completed';
    case 'canceled':
      return 'canceled';
    case 'backlog':
    case 'todo':
    default:
      return 'planned';
  }
}

export async function touchMeaningfulWork(
  ctx: MutationCtx,
  workId: Id<'issues'>,
  patch: Partial<Doc<'issues'>> = {},
) {
  const now = Date.now();
  await ctx.db.patch('issues', workId, {
    ...patch,
    updatedAt: now,
    lastMeaningfulActivityAt: now,
  });
}

export function workHref(orgSlug: string, workKey: string) {
  return `/${orgSlug}/work/${workKey}`;
}
