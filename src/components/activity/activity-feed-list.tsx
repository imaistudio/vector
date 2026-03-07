'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { format, isToday, isYesterday } from 'date-fns';
import { FolderOpen, MessageSquare, Target, Users } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateHuman } from '@/lib/date';
import { cn } from '@/lib/utils';

type ActivityStatus =
  | 'LoadingFirstPage'
  | 'LoadingMore'
  | 'CanLoadMore'
  | 'Exhausted';

export interface ActivityFeedItem {
  _id: string;
  createdAt: number;
  entityType: 'issue' | 'project' | 'team';
  eventType: string;
  actor: {
    _id: string;
    name: string;
    email: string | null;
    image: string | null;
  } | null;
  subjectUser: {
    _id: string;
    name: string;
    email: string | null;
    image: string | null;
  } | null;
  target: {
    type: 'issue' | 'project' | 'team';
    id: string | null;
    key: string | null;
    name: string | null;
  };
  details: {
    field: string | null;
    fromLabel: string | null;
    toLabel: string | null;
    roleName: string | null;
    commentPreview: string | null;
    addedUserNames: string[];
    removedUserNames: string[];
  };
}

interface ActivityFeedListProps {
  items: ActivityFeedItem[];
  orgSlug: string;
  status: ActivityStatus;
  loadMore: (count: number) => void;
  emptyMessage: string;
  className?: string;
}

function getInitials(name?: string | null) {
  if (!name) return '?';
  return name
    .split(' ')
    .map(part => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function getTargetHref(orgSlug: string, target: ActivityFeedItem['target']) {
  if (!target.key) return null;
  if (target.type === 'issue') return `/${orgSlug}/issues/${target.key}`;
  if (target.type === 'project') return `/${orgSlug}/projects/${target.key}`;
  return `/${orgSlug}/teams/${target.key}`;
}

function ActivityTarget({
  orgSlug,
  target,
  className,
}: {
  orgSlug: string;
  target: ActivityFeedItem['target'];
  className?: string;
}) {
  const label = target.key ?? target.name ?? 'unknown';
  const href = getTargetHref(orgSlug, target);

  if (!href) {
    return <span className={cn('font-medium', className)}>{label}</span>;
  }

  return (
    <Link
      href={href}
      className={cn(
        'hover:text-foreground text-foreground/90 font-medium transition-colors',
        className,
      )}
    >
      {label}
    </Link>
  );
}

function renderUsers(names: string[]) {
  return names.filter(Boolean).join(', ');
}

function renderActivityDescription(
  item: ActivityFeedItem,
  orgSlug: string,
): ReactNode {
  const { details, eventType, subjectUser } = item;
  const subjectName = subjectUser?.name ?? details.toLabel ?? details.fromLabel;

  switch (eventType) {
    case 'project_created':
    case 'team_created':
    case 'issue_created':
      return (
        <>
          created <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'project_name_changed':
    case 'team_name_changed':
    case 'issue_title_changed':
      return (
        <>
          renamed <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>{details.fromLabel ?? '—'}</span>{' '}
          to{' '}
          <span className='text-foreground/75'>{details.toLabel ?? '—'}</span>
        </>
      );
    case 'project_description_changed':
    case 'team_description_changed':
    case 'issue_description_changed':
      return (
        <>
          updated the description on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'project_status_changed':
      return (
        <>
          changed the status on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'project_team_changed':
    case 'issue_team_changed':
      return (
        <>
          changed the team on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'project_team_added':
    case 'issue_team_added':
      return (
        <>
          linked <ActivityTarget orgSlug={orgSlug} target={item.target} /> to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'a team'}
          </span>
        </>
      );
    case 'project_team_removed':
    case 'issue_team_removed':
      return (
        <>
          removed <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'a team'}
          </span>
        </>
      );
    case 'project_lead_changed':
    case 'team_lead_changed':
      return (
        <>
          changed the lead on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'project_visibility_changed':
    case 'team_visibility_changed':
    case 'issue_visibility_changed':
      return (
        <>
          changed visibility on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'project_member_added':
    case 'team_member_added':
      return (
        <>
          added{' '}
          <span className='text-foreground/75'>
            {subjectName ?? 'a member'}
          </span>{' '}
          to <ActivityTarget orgSlug={orgSlug} target={item.target} />
          {details.toLabel ? (
            <>
              {' '}
              as <span className='text-foreground/75'>{details.toLabel}</span>
            </>
          ) : null}
        </>
      );
    case 'project_member_removed':
    case 'team_member_removed':
      return (
        <>
          removed{' '}
          <span className='text-foreground/75'>
            {subjectName ?? 'a member'}
          </span>{' '}
          from <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'project_role_assigned':
    case 'team_role_assigned':
      return (
        <>
          assigned{' '}
          <span className='text-foreground/75'>
            {details.roleName ?? 'a role'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {subjectName ?? 'a member'}
          </span>{' '}
          on <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'issue_priority_changed':
      return (
        <>
          changed priority on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'issue_assignment_state_changed':
      return (
        <>
          moved{' '}
          <span className='text-foreground/75'>
            {subjectName ?? 'an assignee'}
          </span>{' '}
          on <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'issue_assignees_changed': {
      const added = renderUsers(details.addedUserNames);
      const removed = renderUsers(details.removedUserNames);
      if (added && removed) {
        return (
          <>
            updated assignees on{' '}
            <ActivityTarget orgSlug={orgSlug} target={item.target} /> by adding{' '}
            <span className='text-foreground/75'>{added}</span> and removing{' '}
            <span className='text-foreground/75'>{removed}</span>
          </>
        );
      }
      if (added) {
        return (
          <>
            assigned <span className='text-foreground/75'>{added}</span> to{' '}
            <ActivityTarget orgSlug={orgSlug} target={item.target} />
          </>
        );
      }
      return (
        <>
          unassigned{' '}
          <span className='text-foreground/75'>{removed || 'a member'}</span>{' '}
          from <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    }
    case 'issue_project_changed':
      return (
        <>
          changed the project on{' '}
          <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'Unset'}
          </span>{' '}
          to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'Unset'}
          </span>
        </>
      );
    case 'issue_project_added':
      return (
        <>
          linked <ActivityTarget orgSlug={orgSlug} target={item.target} /> to{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? 'a project'}
          </span>
        </>
      );
    case 'issue_project_removed':
      return (
        <>
          removed <ActivityTarget orgSlug={orgSlug} target={item.target} /> from{' '}
          <span className='text-foreground/75'>
            {details.fromLabel ?? 'a project'}
          </span>
        </>
      );
    case 'issue_comment_added':
      return (
        <>
          commented on <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
    case 'issue_sub_issue_created':
      return (
        <>
          created sub-issue{' '}
          <span className='text-foreground/75'>
            {details.toLabel ?? item.target.key ?? 'issue'}
          </span>
        </>
      );
    default:
      return (
        <>
          updated <ActivityTarget orgSlug={orgSlug} target={item.target} />
        </>
      );
  }
}

function getDayLabel(date: Date) {
  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';
  return format(date, 'MMM d, yyyy');
}

function groupByDay(items: ActivityFeedItem[]) {
  const groups = new Map<string, ActivityFeedItem[]>();

  for (const item of items) {
    const key = format(new Date(item.createdAt), 'yyyy-MM-dd');
    const existing = groups.get(key);
    if (existing) {
      existing.push(item);
      continue;
    }
    groups.set(key, [item]);
  }

  return [...groups.entries()].map(([dateKey, dayItems]) => ({
    dateKey,
    label: getDayLabel(new Date(dayItems[0].createdAt)),
    items: dayItems,
  }));
}

function ActivityRow({
  item,
  orgSlug,
}: {
  item: ActivityFeedItem;
  orgSlug: string;
}) {
  const actorName = item.actor?.name ?? 'Unknown user';

  return (
    <div className='hover:bg-muted/40 flex items-start gap-3 px-3 py-2 transition-colors'>
      <Avatar className='mt-0.5 size-6 shrink-0'>
        <AvatarFallback className='text-[10px]'>
          {getInitials(actorName)}
        </AvatarFallback>
      </Avatar>

      <div className='min-w-0 flex-1 space-y-1'>
        <div className='flex flex-wrap items-center gap-1 text-sm leading-5'>
          <span className='font-medium'>{actorName}</span>
          <span className='text-muted-foreground'>
            {renderActivityDescription(item, orgSlug)}
          </span>
        </div>

        {item.details.commentPreview ? (
          <div className='border-border/60 text-muted-foreground rounded-md border bg-transparent px-2 py-1 text-xs leading-5'>
            {item.details.commentPreview}
          </div>
        ) : null}
      </div>

      <div className='flex shrink-0 items-center gap-2 pl-2'>
        <div className='text-muted-foreground flex size-6 items-center justify-center rounded-md border'>
          {item.eventType.includes('comment') ? (
            <MessageSquare className='size-3.5' />
          ) : item.entityType === 'project' ? (
            <FolderOpen className='size-3.5' />
          ) : item.entityType === 'team' ? (
            <Users className='size-3.5' />
          ) : (
            <Target className='size-3.5' />
          )}
        </div>
        <span className='text-muted-foreground min-w-[88px] text-right text-xs'>
          {formatDateHuman(new Date(item.createdAt))}
        </span>
      </div>
    </div>
  );
}

export function ActivityFeedSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className='rounded-lg border'>
      <div className='space-y-0'>
        {Array.from({ length: rows }).map((_, index) => (
          <div
            key={index}
            className={cn(
              'flex items-start gap-3 px-3 py-2',
              index > 0 && 'border-t',
            )}
          >
            <Skeleton className='size-6 rounded-full' />
            <div className='min-w-0 flex-1 space-y-2 py-0.5'>
              <Skeleton className='h-3.5 w-3/5' />
              <Skeleton className='h-3.5 w-2/5' />
            </div>
            <Skeleton className='h-3.5 w-16' />
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityFeedList({
  items,
  orgSlug,
  status,
  loadMore,
  emptyMessage,
  className,
}: ActivityFeedListProps) {
  if (status === 'LoadingFirstPage') {
    return <ActivityFeedSkeleton />;
  }

  if (items.length === 0) {
    return (
      <div className={cn('rounded-lg border px-3 py-8 text-center', className)}>
        <div className='text-muted-foreground text-sm'>{emptyMessage}</div>
      </div>
    );
  }

  const groups = groupByDay(items);

  return (
    <div className={cn('space-y-3', className)}>
      <div className='rounded-lg border'>
        {groups.map((group, groupIndex) => (
          <div key={group.dateKey}>
            <div
              className={cn(
                'bg-background/95 text-muted-foreground sticky top-0 z-10 border-b px-3 py-1.5 text-[11px] font-medium tracking-wide uppercase backdrop-blur',
                groupIndex === 0 && 'rounded-t-lg',
              )}
            >
              {group.label}
            </div>
            {group.items.map(item => (
              <ActivityRow key={item._id} item={item} orgSlug={orgSlug} />
            ))}
          </div>
        ))}
      </div>

      {status !== 'Exhausted' ? (
        <div className='flex justify-center'>
          <Button
            type='button'
            variant='outline'
            size='sm'
            className='h-8 px-3 text-xs'
            onClick={() => loadMore(20)}
            disabled={status === 'LoadingMore'}
          >
            {status === 'LoadingMore' ? 'Fetching more' : 'Load more'}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
