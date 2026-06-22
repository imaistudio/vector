import { query } from '../_generated/server';
import { v } from 'convex/values';
import {
  ensureScopeMatchesOrganization,
  getEffectivePermissions,
  getOrganizationBySlug,
  getPermissionMap,
  hasScopedPermission,
  permissionValidator,
} from '../authz';
import { getAuthUserId } from '../authUtils';
import { PERMISSION_VALUES } from '../_shared/permissions';

export { hasScopedPermission, requireScopedPermission } from '../authz';
export { PERMISSIONS, type Permission } from '../_shared/permissions';
export {
  type PermissionScope,
  type VisibilityState,
  requireOrgPermission as requirePermission,
} from '../authz';

/**
 * The caller's full effective permission set for a scope, as a plain string
 * array (wildcards like `*` / `issue:*` included verbatim).
 *
 * This is the primary client permission primitive: the UI subscribes to ONE
 * `effective` query per (org, team, project) scope and evaluates individual
 * permission checks locally with `permissionMatches`. Compared to the legacy
 * per-permission `has` query this collapses dozens of reactive subscriptions
 * per page — each of which re-ran the full role cascade server-side — into a
 * single cached one, while staying fully reactive to role changes.
 */
export const effective = query({
  args: {
    orgSlug: v.string(),
    teamId: v.optional(v.id('teams')),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, args): Promise<string[]> => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    const scope = {
      organizationId: org._id,
      teamId: args.teamId,
      projectId: args.projectId,
    };
    // Deny scopes whose team/project belongs to a different org — prevents
    // cross-org probing with guessed ids. Resolves to "no permissions" rather
    // than throwing so UI subscriptions degrade gracefully.
    try {
      await ensureScopeMatchesOrganization(ctx, scope);
    } catch {
      return [];
    }

    const permissions = await getEffectivePermissions(ctx, scope, userId);
    return Array.from(permissions).sort();
  },
});

export const has = query({
  args: {
    orgSlug: v.string(),
    permission: permissionValidator,
    teamId: v.optional(v.id('teams')),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return false;

    const org = await getOrganizationBySlug(ctx, args.orgSlug);

    return hasScopedPermission(
      ctx,
      {
        organizationId: org._id,
        teamId: args.teamId,
        projectId: args.projectId,
      },
      userId,
      args.permission,
    );
  },
});

export const hasMultiple = query({
  args: {
    orgSlug: v.string(),
    permissions: v.array(
      v.union(...PERMISSION_VALUES.map(permission => v.literal(permission))),
    ),
    teamId: v.optional(v.id('teams')),
    projectId: v.optional(v.id('projects')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    const results: Record<string, boolean> = {};

    if (!userId) {
      for (const permission of args.permissions) {
        results[permission] = false;
      }
      return results;
    }

    const org = await getOrganizationBySlug(ctx, args.orgSlug);

    return getPermissionMap(
      ctx,
      {
        organizationId: org._id,
        teamId: args.teamId,
        projectId: args.projectId,
      },
      userId,
      args.permissions,
    );
  },
});
