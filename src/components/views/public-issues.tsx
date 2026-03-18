'use client';

import Link from 'next/link';
import { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Lock } from 'lucide-react';
import Markdown from 'react-markdown';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { Button } from '@/components/ui/button';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';

export interface PublicIssueData {
  _id: string;
  key: string;
  title: string;
  isPublic: boolean;
  description?: string | null;
  status: {
    name: string;
    color: string | null;
    type: string;
    icon: string | null;
  } | null;
  priority?: {
    name: string;
    color: string | null;
    icon: string | null;
  } | null;
  assignees?: Array<{ name?: string; image?: string }>;
  project?: { name: string; key: string } | null;
  team?: { name: string; key: string } | null;
  startDate?: string | null;
  dueDate?: string | null;
}

export interface PublicStatusData {
  _id: string;
  name: string;
  color: string | null;
  icon: string | null;
  type: string;
}

interface IssueGroup {
  key: string;
  label: string;
  color: string | null;
  icon: string | null;
  items: PublicIssueData[];
}

export function groupIssues(
  issues: PublicIssueData[],
  groupBy: string,
  allStatuses?: PublicStatusData[],
): IssueGroup[] {
  if (groupBy === 'none' || !groupBy) {
    return [{ key: 'all', label: '', color: null, icon: null, items: issues }];
  }

  const groups = new Map<string, IssueGroup>();

  if (groupBy === 'status' && allStatuses?.length) {
    for (const status of allStatuses) {
      groups.set(status.name, {
        key: status.name,
        label: status.name,
        color: status.color,
        icon: status.icon,
        items: [],
      });
    }
  }

  for (const issue of issues) {
    let key: string;
    let label: string;
    let color: string | null = null;
    let icon: string | null = null;

    switch (groupBy) {
      case 'status':
        key = issue.status?.name ?? 'No Status';
        label = key;
        color = issue.status?.color ?? null;
        icon = issue.status?.icon ?? null;
        break;
      case 'priority':
        key = issue.priority?.name ?? 'No Priority';
        label = key;
        color = issue.priority?.color ?? null;
        icon = issue.priority?.icon ?? null;
        break;
      case 'project':
        key = issue.project?.name ?? 'No Project';
        label = key;
        break;
      case 'team':
        key = issue.team?.name ?? 'No Team';
        label = key;
        break;
      default:
        key = 'all';
        label = '';
    }

    if (!groups.has(key)) {
      groups.set(key, { key, label, color, icon, items: [] });
    }
    groups.get(key)!.items.push(issue);
  }

  return Array.from(groups.values());
}

export function PublicListView({
  issues,
  orgSlug,
  groupBy,
}: {
  issues: PublicIssueData[];
  orgSlug: string;
  groupBy: string;
}) {
  const groups = groupIssues(issues, groupBy);

  return (
    <div className='space-y-6'>
      {groups.map(group => (
        <div key={group.key}>
          {group.label && (
            <div className='mb-2 flex items-center gap-1.5'>
              {group.icon && (
                <DynamicIcon
                  name={group.icon}
                  className='size-3.5'
                  style={{ color: group.color ?? undefined }}
                />
              )}
              <span className='text-sm font-medium'>{group.label}</span>
              <span className='text-muted-foreground text-xs'>
                {group.items.length}
              </span>
            </div>
          )}
          <div className='space-y-1'>
            {group.items.map(issue => (
              <PublicIssueCard
                key={issue._id}
                issue={issue}
                orgSlug={orgSlug}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function PublicKanbanView({
  issues,
  orgSlug,
  groupBy,
  allStatuses,
}: {
  issues: PublicIssueData[];
  orgSlug: string;
  groupBy: string;
  allStatuses?: PublicStatusData[];
}) {
  const effectiveGroupBy = groupBy === 'none' ? 'status' : groupBy;
  const groups = groupIssues(
    issues,
    effectiveGroupBy,
    effectiveGroupBy === 'status' ? allStatuses : undefined,
  );

  return (
    <ScrollArea className='w-full' type='scroll'>
      <div className='flex min-h-[50vh] gap-3 px-4 pb-16'>
        {groups.map(group => (
          <div key={group.key} className='min-w-[260px] flex-shrink-0'>
            <div className='mb-2 flex items-center gap-1.5'>
              {group.icon && (
                <DynamicIcon
                  name={group.icon}
                  className='size-3.5'
                  style={{ color: group.color ?? undefined }}
                />
              )}
              <span className='text-sm font-medium'>{group.label}</span>
              <span className='text-muted-foreground text-xs'>
                {group.items.length}
              </span>
            </div>
            <div className='space-y-1.5'>
              {group.items.length === 0 ? (
                <div className='border-border text-muted-foreground rounded-md border border-dashed py-6 text-center text-xs'>
                  No issues
                </div>
              ) : (
                group.items.map(issue => (
                  <PublicIssueCard
                    key={issue._id}
                    issue={issue}
                    orgSlug={orgSlug}
                    compact
                  />
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      <ScrollBar orientation='horizontal' />
    </ScrollArea>
  );
}

export function PublicIssueCard({
  issue,
  orgSlug,
  compact,
}: {
  issue: PublicIssueData;
  orgSlug: string;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className={`border-border hover:bg-muted/50 group cursor-pointer rounded-md border transition-colors ${
        compact ? 'p-2' : 'px-3 py-2.5'
      }`}
      onClick={() => setExpanded(!expanded)}
    >
      <div className='flex items-center gap-2'>
        {issue.status && (
          <div
            className='flex size-4 flex-shrink-0 items-center justify-center'
            style={{ color: issue.status.color ?? undefined }}
          >
            {issue.status.icon ? (
              <DynamicIcon name={issue.status.icon} className='size-4' />
            ) : (
              <div
                className='size-2.5 rounded-full border-2'
                style={{ borderColor: issue.status.color ?? '#888' }}
              />
            )}
          </div>
        )}

        <span className='text-muted-foreground flex-shrink-0 text-xs'>
          {issue.key}
        </span>

        <span
          className={`min-w-0 flex-1 truncate ${compact ? 'text-xs' : 'text-sm'}`}
        >
          {issue.title}
        </span>

        <ChevronDown
          className={`text-muted-foreground size-3 flex-shrink-0 transition-transform ${
            expanded ? 'rotate-180' : ''
          }`}
        />
      </div>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className='overflow-hidden'
          >
            <div className='mt-2 max-w-sm space-y-2 border-t pt-2'>
              {issue.status && (
                <div className='flex items-center gap-2'>
                  <span className='text-muted-foreground text-xs'>Status</span>
                  <span
                    className='rounded px-1.5 py-0.5 text-xs font-medium'
                    style={{
                      color: issue.status.color ?? undefined,
                      backgroundColor: issue.status.color
                        ? `${issue.status.color}15`
                        : undefined,
                    }}
                  >
                    {issue.status.name}
                  </span>
                </div>
              )}

              {issue.description && (
                <div className='prose prose-sm dark:prose-invert text-muted-foreground max-w-none text-xs leading-relaxed break-words'>
                  <Markdown>{issue.description}</Markdown>
                </div>
              )}

              {issue.isPublic && issue.priority && (
                <div className='flex items-center gap-2'>
                  <span className='text-muted-foreground text-xs'>
                    Priority
                  </span>
                  <span
                    className='flex items-center gap-1 text-xs'
                    style={{ color: issue.priority.color ?? undefined }}
                  >
                    {issue.priority.icon && (
                      <DynamicIcon
                        name={issue.priority.icon}
                        className='size-3'
                      />
                    )}
                    {issue.priority.name}
                  </span>
                </div>
              )}

              {issue.isPublic ? (
                <div className='pt-1'>
                  <Button
                    variant='outline'
                    size='xs'
                    render={
                      <Link href={`/${orgSlug}/issues/${issue.key}/public`} />
                    }
                    onClick={event => event.stopPropagation()}
                  >
                    Open issue
                  </Button>
                </div>
              ) : (
                <p className='text-muted-foreground flex items-center gap-1 text-xs italic'>
                  <Lock className='size-3 opacity-50' />
                  Limited details — this issue is not public
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
