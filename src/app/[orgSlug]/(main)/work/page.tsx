'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  AlertCircle,
  Bot,
  CalendarClock,
  CheckCircle2,
  Circle,
  ListChecks,
  Play,
  UserRound,
} from 'lucide-react';
import { api, useCachedPaginatedQuery } from '@/lib/convex';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { AutoLoadMore } from '@/components/ui/auto-load-more';
import { CreateWorkDialog } from '@/components/work/create-work-dialog';

const scopes = [
  { value: 'active', label: 'Active now' },
  { value: 'mine', label: 'My Work' },
  { value: 'attention', label: 'Needs attention' },
  { value: 'all', label: 'All Work' },
] as const;

const statusTone: Record<string, string> = {
  planned: 'bg-muted-foreground/50',
  active: 'bg-blue-500',
  waiting: 'bg-amber-500',
  blocked: 'bg-red-500',
  ready_for_review: 'bg-violet-500',
  completed: 'bg-emerald-500',
  canceled: 'bg-muted-foreground/40',
};

function WorkRowsSkeleton() {
  return (
    <div>
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className='flex h-11 items-center gap-3 border-b px-4'>
          <Skeleton className='size-2.5 rounded-full' />
          <Skeleton className='h-3 w-16' />
          <Skeleton className='h-3 max-w-80 flex-1' />
          <Skeleton className='h-5 w-20 rounded-full' />
          <Skeleton className='size-6 rounded-full' />
        </div>
      ))}
    </div>
  );
}

export default function WorkPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const [scope, setScope] =
    useState<(typeof scopes)[number]['value']>('active');
  const result = useCachedPaginatedQuery(
    api.work.queries.list,
    { orgSlug, scope },
    { initialNumItems: 40 },
  );

  return (
    <div className='flex min-h-full flex-col'>
      <header className='flex h-12 shrink-0 items-center justify-between border-b px-4'>
        <div className='flex items-baseline gap-2'>
          <h1 className='text-sm font-semibold'>Work</h1>
          <span className='text-muted-foreground text-xs'>
            outcomes in motion
          </span>
        </div>
        <CreateWorkDialog orgSlug={orgSlug} />
      </header>
      <div className='flex h-10 shrink-0 items-center gap-1 border-b px-3'>
        {scopes.map(item => (
          <Button
            key={item.value}
            variant='ghost'
            size='sm'
            className={cn(
              'h-7 px-2 text-xs',
              scope === item.value && 'bg-muted',
            )}
            onClick={() => setScope(item.value)}
          >
            {item.label}
          </Button>
        ))}
      </div>
      <div className='min-h-0 flex-1'>
        {result.status === 'LoadingFirstPage' ? (
          <WorkRowsSkeleton />
        ) : result.results.length === 0 && result.status === 'Exhausted' ? (
          <div className='text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-2 text-center'>
            <Circle className='size-7 opacity-40' />
            <p className='text-sm'>No Work in this view</p>
            <p className='max-w-sm text-xs'>
              Create Work directly, or turn a routed Request into Work when you
              understand the outcome.
            </p>
          </div>
        ) : (
          <div>
            {result.results.map(work => (
              <Link
                key={work._id}
                href={`/${orgSlug}/work/${work.key}`}
                className='hover:bg-muted/35 group flex min-h-11 items-center gap-3 border-b px-4 text-sm transition-colors'
              >
                <span
                  className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    statusTone[work.workStatus] ?? 'bg-muted-foreground/40',
                  )}
                />
                <span className='text-muted-foreground w-20 shrink-0 font-mono text-[11px]'>
                  {work.key}
                </span>
                <span className='min-w-0 flex-1 truncate font-medium'>
                  {work.title}
                </span>
                {work.effort && work.effort !== 'unknown' && (
                  <Badge
                    variant={work.effort === 'l' ? 'secondary' : 'outline'}
                    className='h-5 min-w-6 px-1.5 text-[10px] uppercase'
                  >
                    {work.effort}
                  </Badge>
                )}
                {work.openAttentionCount > 0 && (
                  <Badge
                    variant='destructive'
                    className='h-5 gap-1 px-1.5 text-[10px]'
                  >
                    <AlertCircle className='size-3' />
                    {work.openAttentionCount}
                  </Badge>
                )}
                {work.workStatus === 'active' && (
                  <Badge
                    variant='outline'
                    className='hidden h-5 gap-1 px-1.5 text-[10px] sm:inline-flex'
                  >
                    <Play className='size-3' />
                    Active
                  </Badge>
                )}
                {work.workStatus === 'ready_for_review' && (
                  <Badge
                    variant='outline'
                    className='hidden h-5 gap-1 px-1.5 text-[10px] sm:inline-flex'
                  >
                    <CheckCircle2 className='size-3' />
                    Review
                  </Badge>
                )}
                <span className='text-muted-foreground hidden items-center gap-1 text-[11px] md:flex'>
                  <ListChecks className='size-3.5' />
                  {work.taskProgress.done}/{work.taskProgress.total}
                </span>
                {work.activeExecutionCount > 0 && (
                  <span className='text-muted-foreground hidden items-center gap-1 text-[11px] md:flex'>
                    <Bot className='size-3.5' />
                    {work.activeExecutionCount}
                  </span>
                )}
                {work.dueDate && (
                  <span className='text-muted-foreground hidden items-center gap-1 text-[11px] lg:flex'>
                    <CalendarClock className='size-3.5' />
                    {work.dueDate}
                  </span>
                )}
                <span className='flex w-24 shrink-0 items-center justify-end gap-1.5 text-xs'>
                  {work.owner ? (
                    <>
                      <span className='truncate'>
                        {work.owner.name ?? work.owner.username ?? 'Owner'}
                      </span>
                      <span className='bg-muted flex size-5 items-center justify-center rounded-full text-[8px]'>
                        {(work.owner.name ?? work.owner.email ?? '?')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                    </>
                  ) : (
                    <span className='text-muted-foreground flex items-center gap-1'>
                      <UserRound className='size-3.5' />
                      Unowned
                    </span>
                  )}
                </span>
              </Link>
            ))}
            <AutoLoadMore
              status={result.status}
              loadMore={() => result.loadMore(40)}
            />
          </div>
        )}
      </div>
    </div>
  );
}
