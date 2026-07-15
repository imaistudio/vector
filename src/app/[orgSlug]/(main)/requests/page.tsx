'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowUpRight,
  CircleDot,
  Inbox,
  Network,
  UserRound,
} from 'lucide-react';
import { api, useCachedPaginatedQuery } from '@/lib/convex';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { AutoLoadMore } from '@/components/ui/auto-load-more';
import { CreateRequestDialog } from '@/components/requests/create-request-dialog';

const scopes = [
  { value: 'inbox', label: 'Inbox' },
  { value: 'mine', label: 'Routed to me' },
  { value: 'requested', label: 'Requested by me' },
  { value: 'all', label: 'All' },
] as const;

const statusLabel: Record<string, string> = {
  new: 'Needs routing',
  routed: 'Routed',
  planned: 'Planned',
  in_delivery: 'In delivery',
  ready_for_review: 'Ready for review',
  changes_requested: 'Changes requested',
  completed: 'Completed',
  declined: 'Declined',
  duplicate: 'Duplicate',
};

export default function RequestsPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [scope, setScope] = useState<(typeof scopes)[number]['value']>('inbox');
  const [currentTime] = useState(Date.now);
  const result = useCachedPaginatedQuery(
    api.requests.queries.list,
    { orgSlug, scope },
    { initialNumItems: 40 },
  );
  return (
    <div className='flex min-h-full flex-col'>
      <header className='flex h-12 shrink-0 items-center justify-between border-b px-4'>
        <div className='flex items-baseline gap-2'>
          <h1 className='text-sm font-semibold'>Requests</h1>
          <span className='text-muted-foreground text-xs'>
            intake and review
          </span>
        </div>
        <CreateRequestDialog orgSlug={orgSlug} />
      </header>
      <div className='flex h-10 items-center gap-1 overflow-x-auto border-b px-3'>
        {scopes.map(item => (
          <Button
            key={item.value}
            variant='ghost'
            size='sm'
            className={cn(
              'h-7 shrink-0 px-2 text-xs',
              scope === item.value && 'bg-muted',
            )}
            onClick={() => setScope(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      {result.status === 'LoadingFirstPage' ? (
        <div>
          {Array.from({ length: 8 }).map((_, index) => (
            <div
              key={index}
              className='flex h-12 items-center gap-3 border-b px-4'
            >
              <Skeleton className='size-3 rounded-full' />
              <Skeleton className='h-3 w-16' />
              <Skeleton className='h-3 max-w-96 flex-1' />
              <Skeleton className='h-5 w-24 rounded-full' />
            </div>
          ))}
        </div>
      ) : result.results.length === 0 && result.status === 'Exhausted' ? (
        <div className='text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-2 text-center'>
          <Inbox className='size-7 opacity-40' />
          <p className='text-sm'>
            {scope === 'inbox'
              ? 'The request inbox is clear'
              : scope === 'mine'
                ? 'Nothing is routed to you'
                : scope === 'requested'
                  ? 'You have not made any requests'
                  : 'No requests yet'}
          </p>
          <p className='max-w-sm text-xs'>
            {scope === 'inbox'
              ? 'New requests stay visible here until they are routed, planned, or reviewed.'
              : scope === 'mine'
                ? 'Requests assigned directly to you will appear here.'
                : scope === 'requested'
                  ? 'Requests you create will stay visible here through delivery and review.'
                  : 'Create a request to define an expected output and route it into Work.'}
          </p>
        </div>
      ) : (
        <div>
          {result.results.map(request => {
            const ageDays = Math.floor(
              (currentTime - request.createdAt) / (24 * 60 * 60 * 1000),
            );
            return (
              <Link
                key={request._id}
                href={`/${orgSlug}/requests/${request.key}`}
                className='hover:bg-muted/35 flex min-h-12 items-center gap-3 border-b px-4 transition-colors'
              >
                <CircleDot
                  className={cn(
                    'size-3.5 shrink-0',
                    request.status === 'ready_for_review'
                      ? 'text-violet-500'
                      : request.status === 'changes_requested'
                        ? 'text-amber-500'
                        : request.status === 'completed'
                          ? 'text-emerald-500'
                          : 'text-muted-foreground',
                  )}
                />
                <span className='text-muted-foreground w-16 shrink-0 font-mono text-[11px]'>
                  {request.key}
                </span>
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-sm font-medium'>
                    {request.title}
                  </div>
                  <div className='text-muted-foreground truncate text-[11px]'>
                    {request.expectedOutput}
                  </div>
                </div>
                <Badge
                  variant='outline'
                  className='hidden h-5 px-1.5 text-[10px] sm:inline-flex'
                >
                  {statusLabel[request.status] ?? request.status}
                </Badge>
                {ageDays >= 3 && ['new', 'routed'].includes(request.status) && (
                  <Badge variant='secondary' className='h-5 px-1.5 text-[10px]'>
                    {ageDays}d waiting
                  </Badge>
                )}
                {request.linkedWorkCount > 0 && (
                  <span className='text-muted-foreground hidden items-center gap-1 text-[11px] md:flex'>
                    <Network className='size-3.5' />
                    {request.linkedWorkCount}
                  </span>
                )}
                <span className='text-muted-foreground flex w-24 shrink-0 items-center justify-end gap-1 text-[11px]'>
                  {request.owner ? (
                    <>
                      <UserRound className='size-3.5' />
                      <span className='truncate'>
                        {request.owner.name ??
                          request.owner.username ??
                          'Owner'}
                      </span>
                    </>
                  ) : (
                    <>
                      <ArrowUpRight className='size-3.5' />
                      Route
                    </>
                  )}
                </span>
              </Link>
            );
          })}
          <AutoLoadMore
            status={result.status}
            loadMore={() => result.loadMore(40)}
          />
        </div>
      )}
    </div>
  );
}
