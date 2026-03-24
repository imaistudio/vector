'use client';
import React from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { usePermission } from './use-permissions';
import { Skeleton } from '@/components/ui/skeleton';
import type { Permission } from '@/convex/_shared/permissions';

/**
 * Hook that enforces a permission requirement by redirecting to 403 if denied.
 * Use this for pages that require specific permissions.
 */
export function useRequirePermission(orgSlug: string, permission: Permission) {
  const { hasPermission, isLoading } = usePermission(orgSlug, permission);
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !hasPermission) {
      // Redirect to 403 page using Next.js router
      router.push('/403');
    }
  }, [hasPermission, isLoading, router]);

  return { hasPermission, isLoading };
}

/**
 * Component that wraps pages requiring specific permissions.
 * Shows loading state while checking permissions, redirects to 403 if denied.
 */
interface PermissionBoundaryProps {
  orgSlug: string;
  permission: Permission;
  children: React.ReactNode;
  loadingComponent?: React.ReactNode;
}

export function PermissionBoundary({
  orgSlug,
  permission,
  children,
  loadingComponent,
}: PermissionBoundaryProps) {
  const { hasPermission, isLoading } = usePermission(orgSlug, permission);
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !hasPermission) {
      // Redirect to 403 page using Next.js router
      router.push('/403');
    }
  }, [hasPermission, isLoading, router]);

  if (isLoading) {
    return (
      loadingComponent || (
        <div className='flex h-screen w-full items-center justify-center'>
          <div className='flex flex-col items-center gap-3'>
            <Skeleton className='size-10 rounded-lg' />
            <Skeleton className='h-4 w-32' />
          </div>
        </div>
      )
    );
  }

  if (!hasPermission) {
    // This should not render as the redirect should happen in useEffect
    return null;
  }

  return <>{children}</>;
}
