'use client';
import React from 'react';
import { api, useCachedQuery } from '@/lib/convex';
import {
  hasPermissionInSet,
  type Permission,
} from '@/convex/_shared/permissions';
import type { Id } from '../../convex/_generated/dataModel';

// Permission scope for client-side permission checks
export interface PermissionScope {
  orgSlug: string;
  teamId?: Id<'teams'>;
  projectId?: Id<'projects'>;
}

/**
 * Subscribe to the caller's full effective permission set for a scope.
 *
 * Every permission hook below goes through this single query, so all gated
 * controls on a page share ONE reactive subscription per (org, team, project)
 * scope (deduped by the Convex client cache) instead of one server round-trip
 * per permission key. Individual checks are evaluated locally with the same
 * wildcard matching the server uses.
 */
export function useEffectivePermissions(scope: PermissionScope) {
  const isClient = typeof window !== 'undefined';

  const granted = useCachedQuery(
    api.permissions.queries.effective,
    scope.orgSlug && isClient
      ? {
          orgSlug: scope.orgSlug,
          teamId: scope.teamId,
          projectId: scope.projectId,
        }
      : 'skip',
  );

  return {
    granted: granted ?? null,
    isLoading: !isClient || granted === undefined,
  };
}

/**
 * React hook for checking user permissions with optional scope.
 * Returns a boolean indicating if the user has the requested permission.
 */
export function useScopedPermission(
  scope: PermissionScope,
  permission: Permission,
) {
  const { granted, isLoading } = useEffectivePermissions(scope);

  if (isLoading || granted === null) {
    return {
      hasPermission: false,
      isLoading: true,
    };
  }

  return {
    hasPermission: hasPermissionInSet(granted, permission),
    isLoading: false,
  };
}

/**
 * Legacy hook for backwards compatibility.
 */
export function usePermission(orgSlug: string, permission: Permission) {
  return useScopedPermission({ orgSlug }, permission);
}

/**
 * React hook for checking multiple permissions at once with optional scope.
 */
export function useScopedPermissions(
  scope: PermissionScope,
  permissions: Permission[],
) {
  const { granted, isLoading } = useEffectivePermissions(scope);

  // permissions is typically an inline array literal; key on its contents so
  // the map stays referentially stable across renders.
  const permissionsKey = permissions.join(',');
  const permissionMap = React.useMemo(() => {
    if (granted === null) return {};
    const map: Record<string, boolean> = {};
    for (const permission of permissionsKey.split(',')) {
      map[permission] = hasPermissionInSet(granted, permission as Permission);
    }
    return map;
  }, [granted, permissionsKey]);

  if (isLoading || granted === null) {
    return {
      permissions: {},
      isLoading: true,
    };
  }

  return {
    permissions: permissionMap,
    isLoading: false,
  };
}

/**
 * Legacy hook for backwards compatibility.
 */
export function usePermissions(orgSlug: string, permissions: Permission[]) {
  return useScopedPermissions({ orgSlug }, permissions);
}

/**
 * Higher-order component that conditionally renders children based on scoped permission.
 */
interface ScopedPermissionGateProps {
  scope: PermissionScope;
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function ScopedPermissionGate({
  scope,
  permission,
  children,
  fallback = null,
}: ScopedPermissionGateProps) {
  const { hasPermission, isLoading } = useScopedPermission(scope, permission);

  if (isLoading) return null;
  if (!hasPermission) return fallback;

  return <>{children}</>;
}

/**
 * Legacy component for backwards compatibility.
 */
interface PermissionGateProps {
  orgSlug: string;
  permission: Permission;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({
  orgSlug,
  permission,
  children,
  fallback = null,
}: PermissionGateProps) {
  return (
    <ScopedPermissionGate
      scope={{ orgSlug }}
      permission={permission}
      fallback={fallback}
    >
      {children}
    </ScopedPermissionGate>
  );
}

/**
 * Hook that returns a memoized scoped permission checker function.
 */
export function useScopedPermissionChecker(
  scope: PermissionScope,
  permissions: Permission[],
) {
  const { granted, isLoading } = useEffectivePermissions(scope);

  const checker = React.useCallback(
    (permission: Permission) => {
      if (granted === null) return false;
      return hasPermissionInSet(granted, permission);
    },
    [granted],
  );
  void permissions;

  return { can: checker, isLoading };
}

/**
 * Legacy hook for backwards compatibility.
 */
export function usePermissionChecker(
  orgSlug: string,
  permissions: Permission[],
) {
  return useScopedPermissionChecker({ orgSlug }, permissions);
}
