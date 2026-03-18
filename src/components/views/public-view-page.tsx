'use client';

import { api, useCachedQuery } from '@/lib/convex';
import { Lock, ChevronLeft, ChevronRight, Globe } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { useState } from 'react';
import Markdown from 'react-markdown';
import { formatDateHuman } from '@/lib/date';
import {
  PublicKanbanView,
  PublicListView,
} from '@/components/views/public-issues';

interface PublicViewPageProps {
  orgSlug: string;
  viewId: string;
}

const PAGE_SIZE = 50;

export function PublicViewPage({ orgSlug, viewId }: PublicViewPageProps) {
  const [page, setPage] = useState(1);

  const view = useCachedQuery(api.views.queries.getPublicView, {
    orgSlug,
    viewId,
  });

  const issuesData = useCachedQuery(
    api.views.queries.listPublicViewIssues,
    view ? { viewId, page, pageSize: PAGE_SIZE } : 'skip',
  );

  if (view === undefined) {
    return (
      <>
        {/* Skeleton navbar */}
        <div className='border-b px-4 py-2'>
          <div className='flex items-center gap-2'>
            <Skeleton className='size-5 rounded' />
            <Skeleton className='h-4 w-24' />
          </div>
        </div>
        <div className='mx-auto max-w-3xl space-y-4 px-4 py-10'>
          <Skeleton className='h-7 w-48' />
          <Skeleton className='h-4 w-72' />
          <div className='mt-6 space-y-2'>
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </div>
        </div>
      </>
    );
  }

  if (view === null) {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center gap-2'>
        <Lock className='text-muted-foreground size-10 opacity-30' />
        <p className='text-muted-foreground text-sm'>
          This view is not available or is private.
        </p>
      </div>
    );
  }

  const { issues = [], total = 0 } = issuesData ?? {};
  const totalPages = Math.ceil(total / PAGE_SIZE);
  const viewLayout = view.layout?.viewMode ?? 'table';
  const viewGroupBy = view.layout?.groupBy ?? 'none';

  return (
    <div className='flex min-h-screen flex-col'>
      {/* ── Top navbar ────────────────────────────────────────────── */}
      <header className='bg-background/95 supports-[backdrop-filter]:bg-background/60 sticky top-0 z-10 border-b backdrop-blur'>
        <div className='flex flex-col gap-1 px-4 py-2'>
          {/* Row 1: org breadcrumb (left) + Public badge (right) */}
          <div className='flex items-center justify-between gap-2'>
            <div className='flex min-w-0 items-center gap-2'>
              {view.orgLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={view.orgLogo}
                  alt={view.orgName}
                  className='size-5 flex-shrink-0 rounded-full object-cover'
                />
              ) : (
                <div className='bg-muted flex size-5 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold'>
                  {view.orgName?.charAt(0).toUpperCase()}
                </div>
              )}
              <span className='flex-shrink-0 text-sm font-medium'>
                {view.orgName}
              </span>
              <span className='text-muted-foreground flex-shrink-0 text-xs'>
                /
              </span>
              <span className='text-muted-foreground min-w-0 truncate text-xs'>
                {view.name}
              </span>
            </div>
            <div className='flex flex-shrink-0 items-center gap-1 rounded-full border px-2 py-0.5'>
              <Globe className='size-3 text-emerald-500' />
              <span className='text-xs text-emerald-600 dark:text-emerald-400'>
                Public
              </span>
            </div>
          </div>

          {/* Row 2: creator (left) + updated (right) */}
          <div className='flex items-center justify-between gap-2'>
            {view.creator ? (
              <div className='flex items-center gap-1.5'>
                <span className='text-muted-foreground text-xs'>by</span>
                <UserAvatar
                  name={view.creator.name}
                  email={view.creator.email}
                  image={view.creator.image}
                  size='sm'
                />
                <span className='text-muted-foreground text-xs'>
                  {view.creator.name ?? view.creator.email}
                </span>
              </div>
            ) : (
              <span />
            )}
            {view.updatedAt && (
              <span className='text-muted-foreground flex-shrink-0 text-xs'>
                Updated {formatDateHuman(new Date(view.updatedAt))}
              </span>
            )}
          </div>
        </div>
      </header>

      {/* ── Header content ─────────────────────────────────────────── */}
      <div className='mx-auto w-full max-w-3xl px-4 py-8'>
        <h1 className='text-2xl font-semibold tracking-tight'>{view.name}</h1>
        {view.description && (
          <div className='prose prose-sm dark:prose-invert text-muted-foreground mt-2 max-w-none'>
            <Markdown>{view.description}</Markdown>
          </div>
        )}
      </div>

      {/* ── Issues ─────────────────────────────────────────────────── */}
      {!issuesData ? (
        <div className='mx-auto w-full max-w-3xl px-4'>
          <div className='space-y-2'>
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className='h-10 w-full' />
            ))}
          </div>
        </div>
      ) : viewLayout === 'kanban' ? (
        <PublicKanbanView
          issues={issues}
          orgSlug={orgSlug}
          groupBy={viewGroupBy}
          allStatuses={view.allStatuses}
        />
      ) : (
        <div className='mx-auto w-full max-w-3xl px-4'>
          {issues.length === 0 ? (
            <div className='text-muted-foreground py-20 text-center text-sm'>
              No issues to show.
            </div>
          ) : (
            <PublicListView
              issues={issues}
              orgSlug={orgSlug}
              groupBy={viewGroupBy}
            />
          )}
        </div>
      )}

      {/* ── Pagination ─────────────────────────────────────────────── */}
      {totalPages > 1 && (
        <div className='mx-auto mt-6 w-full max-w-3xl px-4'>
          <div className='flex items-center justify-between'>
            <span className='text-muted-foreground text-xs'>
              {total} issue{total !== 1 ? 's' : ''}
            </span>
            <div className='flex items-center gap-2'>
              <Button
                variant='outline'
                size='sm'
                className='h-7'
                disabled={page <= 1}
                onClick={() => setPage(p => p - 1)}
              >
                <ChevronLeft className='size-3.5' />
                Prev
              </Button>
              <span className='text-muted-foreground text-xs'>
                {page} / {totalPages}
              </span>
              <Button
                variant='outline'
                size='sm'
                className='h-7'
                disabled={page >= totalPages}
                onClick={() => setPage(p => p + 1)}
              >
                Next
                <ChevronRight className='size-3.5' />
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
