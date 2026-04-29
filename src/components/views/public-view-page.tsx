'use client';

import Link from 'next/link';
import { api, useCachedQuery } from '@/lib/convex';
import {
  ChevronLeft,
  ChevronRight,
  Clock3,
  ExternalLink,
  Lock,
  Map,
} from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Button, buttonVariants } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { useState } from 'react';
import Markdown from 'react-markdown';
import { formatDateHuman } from '@/lib/date';
import { cn } from '@/lib/utils';
import { useDocumentTitle } from '@/hooks/use-document-title';
import {
  PublicKanbanView,
  PublicListView,
} from '@/components/views/public-issues';
import { PublicSubmitIssueDialog } from '@/components/views/public-submit-issue-dialog';

interface PublicViewPageProps {
  orgSlug: string;
  viewId: string;
}

const PAGE_SIZE = 50;

function PublicViewSkeleton() {
  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8'>
      <div className='space-y-4'>
        <div className='flex items-center justify-between gap-3'>
          <div className='flex items-center gap-2'>
            <Skeleton className='size-6 rounded-full' />
            <Skeleton className='h-4 w-40' />
          </div>
          <Skeleton className='h-6 w-16 rounded-full' />
        </div>
        <div className='space-y-2'>
          <Skeleton className='h-8 w-64' />
          <Skeleton className='h-4 w-full max-w-md' />
        </div>
      </div>

      <div className='grid gap-3 md:grid-cols-2 xl:grid-cols-5'>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className='space-y-2'>
            <div className='flex h-7 items-center gap-2'>
              <Skeleton className='size-3.5 rounded-sm' />
              <Skeleton className='h-4 w-24' />
            </div>
            <Skeleton className='h-20 w-full rounded-lg' />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PublicViewPage({ orgSlug, viewId }: PublicViewPageProps) {
  const [page, setPage] = useState(1);

  const view = useCachedQuery(api.views.queries.getPublicView, {
    orgSlug,
    viewId,
  });
  const publicProfile = useCachedQuery(
    api.organizations.queries.getPublicProfileBySlug,
    { orgSlug },
  );
  useDocumentTitle(
    view && view !== null
      ? view.name
      : publicProfile?.name
        ? `${publicProfile.name} public view`
        : null,
  );

  const issuesData = useCachedQuery(
    api.views.queries.listPublicViewIssues,
    view ? { viewId, page, pageSize: PAGE_SIZE } : 'skip',
  );

  if (view === undefined) {
    return <PublicViewSkeleton />;
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
  const submissionsEnabled =
    publicProfile?.publicIssueSubmissionEnabled === true;
  const publicIssueViewId = publicProfile?.publicIssueViewId ?? null;
  const publicLandingViewId = publicProfile?.publicLandingViewId ?? null;
  const isRequestsView = publicIssueViewId === viewId;
  const showRoadmapLink = isRequestsView && publicLandingViewId;
  const showRequestsLink = !isRequestsView && publicIssueViewId;
  const hasHeaderActions =
    Boolean(showRoadmapLink || showRequestsLink) || submissionsEnabled;

  return (
    <div className='mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8'>
      <header className='space-y-5'>
        <div className='flex flex-col gap-3 border-b pb-4 sm:flex-row sm:items-start sm:justify-between'>
          <div className='min-w-0 space-y-3'>
            <div className='text-muted-foreground flex min-w-0 flex-wrap items-center gap-2 text-xs'>
              {view.orgLogo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={view.orgLogo}
                  alt={view.orgName}
                  className='size-5 flex-shrink-0 rounded-full object-cover'
                />
              ) : (
                <div className='bg-muted flex size-5 flex-shrink-0 items-center justify-center rounded-full text-[10px] font-semibold uppercase'>
                  {view.orgName?.charAt(0)}
                </div>
              )}
              <span className='text-foreground font-medium'>
                {view.orgName}
              </span>
              <span>/</span>
              <span className='min-w-0 truncate'>{view.name}</span>
            </div>

            <div className='space-y-2'>
              <h1 className='text-2xl leading-tight font-semibold tracking-tight sm:text-3xl'>
                {view.name}
              </h1>
              {view.description ? (
                <div className='prose prose-sm dark:prose-invert text-muted-foreground max-w-2xl'>
                  <Markdown>{view.description}</Markdown>
                </div>
              ) : null}
            </div>
          </div>

          <div className='flex flex-col items-start gap-2 sm:items-end'>
            {view.updatedAt ? (
              <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
                <div className='text-muted-foreground flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs'>
                  <Clock3 className='size-3.5' />
                  Updated {formatDateHuman(new Date(view.updatedAt))}
                </div>
              </div>
            ) : null}

            {hasHeaderActions ? (
              <div className='flex flex-wrap items-center gap-2 sm:justify-end'>
                {showRoadmapLink ? (
                  <Link
                    href={`/${orgSlug}`}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'h-8 gap-1.5',
                    )}
                  >
                    <Map className='size-3.5' />
                    Roadmap
                  </Link>
                ) : null}
                {showRequestsLink ? (
                  <Link
                    href={`/${orgSlug}/views/${publicIssueViewId}/public`}
                    className={cn(
                      buttonVariants({ variant: 'outline', size: 'sm' }),
                      'h-8 gap-1.5',
                    )}
                  >
                    <ExternalLink className='size-3.5' />
                    View requests
                  </Link>
                ) : null}
                {submissionsEnabled ? (
                  <PublicSubmitIssueDialog
                    orgSlug={orgSlug}
                    orgName={publicProfile?.name ?? view.orgName ?? orgSlug}
                    publicIssueViewId={publicIssueViewId}
                  />
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {view.creator ? (
          <div className='text-muted-foreground flex items-center gap-2 text-xs'>
            <span>by</span>
            <UserAvatar
              name={view.creator.name}
              email={view.creator.email}
              image={view.creator.image}
              size='sm'
            />
            <span className='min-w-0 truncate'>
              {view.creator.name ?? view.creator.email}
            </span>
          </div>
        ) : null}
      </header>

      {/* ── Issues ─────────────────────────────────────────────────── */}
      {!issuesData ? (
        <div
          className={
            viewLayout === 'kanban' ? 'grid gap-3 xl:grid-cols-5' : 'space-y-2'
          }
        >
          {viewLayout === 'kanban'
            ? Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className='space-y-2'>
                  <Skeleton className='h-5 w-24' />
                  <Skeleton className='h-20 w-full rounded-lg' />
                </div>
              ))
            : Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className='h-10 w-full' />
              ))}
        </div>
      ) : viewLayout === 'kanban' ? (
        <PublicKanbanView
          issues={issues}
          orgSlug={orgSlug}
          groupBy={viewGroupBy}
          allStatuses={view.allStatuses}
        />
      ) : (
        <div className='w-full max-w-3xl'>
          {issues.length === 0 ? (
            <div className='border-border text-muted-foreground rounded-lg border border-dashed py-16 text-center text-sm'>
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
        <div className='w-full max-w-3xl'>
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
              <span className='text-muted-foreground text-xs tabular-nums'>
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
