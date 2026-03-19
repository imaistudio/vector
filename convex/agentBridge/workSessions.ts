import { ConvexError } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
import { getAuthUserId } from '../authUtils';
import { canViewIssue } from '../access';

type Ctx = QueryCtx | MutationCtx;

async function resolveWorkSessionAccess(
  ctx: Ctx,
  workSession: Doc<'workSessions'>,
): Promise<{
  userId: Id<'users'>;
  canView: boolean;
  canInteract: boolean;
  canManage: boolean;
  shareAccessLevel: 'viewer' | 'controller' | null;
}> {
  const userId = await getAuthUserId(ctx);
  if (!userId) {
    throw new ConvexError('AUTH_REQUIRED');
  }

  const issue = await ctx.db.get('issues', workSession.issueId);
  if (!issue || !(await canViewIssue(ctx, issue))) {
    throw new ConvexError('FORBIDDEN');
  }

  const device = await ctx.db.get('agentDevices', workSession.deviceId);
  const isOwner = device?.userId === userId;
  const share = await ctx.db
    .query('workSessionShares')
    .withIndex('by_work_session_user', q =>
      q.eq('workSessionId', workSession._id).eq('userId', userId),
    )
    .first();

  return {
    userId,
    canView: isOwner || Boolean(share),
    canInteract: isOwner || share?.accessLevel === 'controller',
    canManage: isOwner,
    shareAccessLevel: share?.accessLevel ?? null,
  };
}

export async function requireWorkSessionViewer(
  ctx: Ctx,
  workSession: Doc<'workSessions'>,
): Promise<{
  userId: Id<'users'>;
  canInteract: boolean;
  canManage: boolean;
  shareAccessLevel: 'viewer' | 'controller' | null;
}> {
  const access = await resolveWorkSessionAccess(ctx, workSession);
  if (!access.canView) {
    throw new ConvexError('FORBIDDEN');
  }

  return {
    userId: access.userId,
    canInteract: access.canInteract,
    canManage: access.canManage,
    shareAccessLevel: access.shareAccessLevel,
  };
}

export async function getWorkSessionAccess(
  ctx: Ctx,
  workSessionId: Id<'workSessions'> | undefined,
): Promise<{
  workSession: Doc<'workSessions'> | null;
  canInteract: boolean;
  canManage: boolean;
  shareAccessLevel: 'viewer' | 'controller' | null;
}> {
  if (!workSessionId) {
    return {
      workSession: null,
      canInteract: false,
      canManage: false,
      shareAccessLevel: null,
    };
  }

  const workSession = await ctx.db.get('workSessions', workSessionId);
  if (!workSession) {
    return {
      workSession: null,
      canInteract: false,
      canManage: false,
      shareAccessLevel: null,
    };
  }

  const access = await resolveWorkSessionAccess(ctx, workSession);
  return {
    workSession: access.canView ? workSession : null,
    canInteract: access.canInteract,
    canManage: access.canManage,
    shareAccessLevel: access.shareAccessLevel,
  };
}
