'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Circle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { formatDateHuman } from '@/lib/date';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';

import { Plus } from 'lucide-react';
import type {
  State,
  Priority,
  Team,
  Project,
} from '@/components/issues/issue-selectors';
import {
  PrioritySelector,
  MultiAssigneeSelector,
} from '@/components/issues/issue-selectors';
import type { IssueRowData } from './issues-table';
import { CreateIssueDialog } from './create-issue-dialog';

export interface IssuesKanbanProps {
  orgSlug: string;
  issues: ReadonlyArray<IssueRowData>;
  states: ReadonlyArray<State>;
  priorities: ReadonlyArray<Priority>;
  teams?: ReadonlyArray<Team>;
  projects?: ReadonlyArray<Project>;
  currentUserId: string;
  /** Called when an issue card is dropped on a different state column */
  onStateChange?: (
    issueId: string,
    assignmentId: string,
    newStateId: string,
  ) => void;
  onPriorityChange?: (issueId: string, priorityId: string) => void;
  onAssigneesChange?: (issueId: string, assigneeIds: string[]) => void;
  /** Extra defaults passed to the create-issue dialog (e.g. projectId) */
  createDefaults?: Record<string, unknown>;
}

interface GroupedIssue {
  id: string;
  key: string;
  title: string;
  priorityId: string | null;
  priorityIcon: string | null;
  priorityColor: string | null;
  priorityName: string | null;
  assignees: Array<{
    id: string;
    name: string | null;
    email: string | null;
  }>;
  assigneeIds: string[];
  assignments: Array<{
    assignmentId: string;
    assigneeId: string | null;
    assigneeName: string | null;
    assigneeEmail: string | null;
    stateId: string | null;
    stateIcon: string | null;
    stateColor: string | null;
    stateName: string | null;
    stateType: string | null;
  }>;
  /** The assignment ID for the current user (used for state changes) */
  assignmentId: string | null;
  stateType: string | null;
  updatedAt: number;
}

function getInitials(name?: string | null, email?: string | null) {
  const display = name || email;
  if (!display) return '?';
  return display
    .split(' ')
    .map(p => p.charAt(0))
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function IssuesKanban({
  orgSlug,
  issues,
  states,
  priorities,
  currentUserId,
  onStateChange,
  onPriorityChange,
  onAssigneesChange,
  createDefaults,
}: IssuesKanbanProps) {
  const [activeId, setActiveId] = useState<string | null>(null);
  // Optimistic overrides: issueId -> new stateType
  const [optimisticMoves, setOptimisticMoves] = useState<Map<string, string>>(
    new Map(),
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  // Deduplicate issues and determine primary state
  const groupedIssues = React.useMemo(() => {
    const map = new Map<string, GroupedIssue>();

    for (const row of issues) {
      if (row.id === 'unassigned') continue;
      const existing = map.get(row.id);

      const assignment = {
        assignmentId: row.assignmentId ?? '',
        assigneeId: row.assigneeId ?? null,
        assigneeName: row.assigneeName ?? null,
        assigneeEmail: row.assigneeEmail ?? null,
        stateId: row.stateId ?? null,
        stateIcon: row.stateIcon ?? null,
        stateColor: row.stateColor ?? null,
        stateName: row.stateName ?? null,
        stateType: row.stateType ?? null,
      };

      if (existing) {
        if (
          row.assigneeId &&
          !existing.assignees.some(a => a.id === row.assigneeId)
        ) {
          existing.assignees.push({
            id: row.assigneeId,
            name: row.assigneeName ?? null,
            email: row.assigneeEmail ?? null,
          });
          existing.assigneeIds.push(row.assigneeId);
        }
        existing.assignments.push(assignment);
        // Prefer the current user's state type and assignment
        if (row.assigneeId === currentUserId && row.stateType) {
          existing.stateType = row.stateType;
          existing.assignmentId = row.assignmentId ?? null;
        }
      } else {
        map.set(row.id, {
          id: row.id,
          key: row.key,
          title: row.title,
          priorityId: row.priorityId ?? null,
          priorityIcon: row.priorityIcon ?? null,
          priorityColor: row.priorityColor ?? null,
          priorityName: row.priorityName ?? null,
          assignees: row.assigneeId
            ? [
                {
                  id: row.assigneeId,
                  name: row.assigneeName ?? null,
                  email: row.assigneeEmail ?? null,
                },
              ]
            : [],
          assigneeIds: row.assigneeId ? [row.assigneeId] : [],
          assignments: [assignment],
          assignmentId: row.assignmentId ?? null,
          stateType: row.stateType ?? null,
          updatedAt: row.updatedAt ?? 0,
        });
      }
    }

    return [...map.values()];
  }, [issues, currentUserId]);

  // Clear optimistic moves when server data catches up
  React.useEffect(() => {
    if (optimisticMoves.size === 0) return;
    setOptimisticMoves(prev => {
      const next = new Map(prev);
      for (const [issueId, targetType] of prev) {
        const issue = groupedIssues.find(i => i.id === issueId);
        if (issue && issue.stateType === targetType) {
          next.delete(issueId);
        }
      }
      return next.size === prev.size ? prev : next;
    });
  }, [groupedIssues, optimisticMoves]);

  // Apply optimistic overrides
  const displayIssues = React.useMemo(() => {
    if (optimisticMoves.size === 0) return groupedIssues;
    return groupedIssues.map(issue => {
      const override = optimisticMoves.get(issue.id);
      if (override && override !== issue.stateType) {
        return { ...issue, stateType: override };
      }
      return issue;
    });
  }, [groupedIssues, optimisticMoves]);

  // Sort states by position
  const sortedStates = React.useMemo(
    () => [...states].sort((a, b) => a.position - b.position),
    [states],
  );

  // Group issues by state type
  const columns = React.useMemo(() => {
    return sortedStates.map(state => ({
      state,
      issues: displayIssues.filter(issue => issue.stateType === state.type),
    }));
  }, [sortedStates, displayIssues]);

  const activeIssue = activeId
    ? (displayIssues.find(i => i.id === activeId) ?? null)
    : null;

  function handleDragStart(event: DragStartEvent) {
    setActiveId(event.active.id as string);
  }

  function handleDragEnd(event: DragEndEvent) {
    setActiveId(null);
    const { active, over } = event;
    if (!over || !onStateChange) return;

    const issueId = active.id as string;
    const targetStateId = over.id as string;
    const issue = groupedIssues.find(i => i.id === issueId);
    if (!issue || !issue.assignmentId) return;

    // Find the target state and check if it's different
    const targetState = sortedStates.find(s => s._id === targetStateId);
    if (!targetState || targetState.type === issue.stateType) return;

    // Optimistically move the card
    setOptimisticMoves(prev => new Map(prev).set(issueId, targetState.type));

    onStateChange(issueId, issue.assignmentId, targetStateId);
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className='flex h-full gap-3 overflow-x-auto p-3'>
        {columns.map(({ state, issues: columnIssues }) => (
          <KanbanColumn
            key={state._id}
            state={state}
            issues={columnIssues}
            orgSlug={orgSlug}
            activeId={activeId}
            priorities={priorities}
            currentUserId={currentUserId}
            onPriorityChange={onPriorityChange}
            onAssigneesChange={onAssigneesChange}
            createDefaults={createDefaults}
          />
        ))}
      </div>

      <DragOverlay
        dropAnimation={{
          duration: 200,
          easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)',
        }}
      >
        {activeIssue ? (
          <div className='animate-tilt w-72'>
            <KanbanCardContent
              issue={activeIssue}
              orgSlug={orgSlug}
              isDragging
            />
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  state,
  issues,
  orgSlug,
  activeId,
  priorities,
  currentUserId,
  onPriorityChange,
  onAssigneesChange,
  createDefaults,
}: {
  state: State;
  issues: GroupedIssue[];
  orgSlug: string;
  activeId: string | null;
  priorities: ReadonlyArray<Priority>;
  currentUserId: string;
  onPriorityChange?: (issueId: string, priorityId: string) => void;
  onAssigneesChange?: (issueId: string, assigneeIds: string[]) => void;
  createDefaults?: Record<string, unknown>;
}) {
  const { isOver, setNodeRef } = useDroppable({ id: state._id });
  const count = issues.length;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'flex w-72 flex-shrink-0 flex-col rounded-lg transition-colors',
        isOver && 'bg-muted/50',
      )}
    >
      {/* Column header */}
      <div className='mb-2 flex items-center gap-2 px-1'>
        <DynamicIcon
          name={state.icon}
          className='size-3.5'
          style={{ color: state.color || '#6b7280' }}
          fallback={Circle}
        />
        <span className='text-sm font-medium'>{state.name}</span>
        <span className='text-muted-foreground text-xs'>{count}</span>
      </div>

      {/* Column body */}
      <div className='min-h-[80px] flex-1 space-y-2 overflow-y-auto rounded-lg'>
        {issues.length === 0 ? (
          <div
            className={cn(
              'text-muted-foreground rounded-lg border border-dashed px-3 py-6 text-center text-xs',
              isOver && 'border-primary/50 bg-primary/5',
            )}
          >
            {isOver ? 'Drop here' : 'No issues'}
          </div>
        ) : (
          issues.map(issue => (
            <KanbanCard
              key={issue.id}
              issue={issue}
              orgSlug={orgSlug}
              isHidden={issue.id === activeId}
              priorities={priorities}
              currentUserId={currentUserId}
              onPriorityChange={onPriorityChange}
              onAssigneesChange={onAssigneesChange}
            />
          ))
        )}

        {/* Add issue button */}
        <CreateIssueDialog
          orgSlug={orgSlug}
          variant='default'
          defaultStates={{ stateId: state._id, ...createDefaults }}
          className='text-muted-foreground hover:text-foreground hover:bg-muted/50 w-full border-dashed'
        />
      </div>
    </div>
  );
}

function KanbanCard({
  issue,
  orgSlug,
  isHidden,
  priorities,
  currentUserId,
  onPriorityChange,
  onAssigneesChange,
}: {
  issue: GroupedIssue;
  orgSlug: string;
  isHidden?: boolean;
  priorities: ReadonlyArray<Priority>;
  currentUserId: string;
  onPriorityChange?: (issueId: string, priorityId: string) => void;
  onAssigneesChange?: (issueId: string, assigneeIds: string[]) => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: issue.id,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'transition-all duration-200',
        isHidden && 'scale-95 opacity-30',
      )}
    >
      <KanbanCardContent
        issue={issue}
        orgSlug={orgSlug}
        isDragging={isDragging}
        priorities={priorities}
        currentUserId={currentUserId}
        onPriorityChange={onPriorityChange}
        onAssigneesChange={onAssigneesChange}
      />
    </div>
  );
}

function KanbanCardContent({
  issue,
  orgSlug,
  isDragging,
  priorities,
  currentUserId,
  onPriorityChange,
  onAssigneesChange,
}: {
  issue: GroupedIssue;
  orgSlug: string;
  isDragging?: boolean;
  priorities?: ReadonlyArray<Priority>;
  currentUserId?: string;
  onPriorityChange?: (issueId: string, priorityId: string) => void;
  onAssigneesChange?: (issueId: string, assigneeIds: string[]) => void;
}) {
  return (
    <div
      className={cn(
        'bg-card block rounded-lg border p-3 shadow-xs transition-colors',
        isDragging
          ? 'ring-primary/30 shadow-lg ring-2'
          : 'hover:border-border/80 hover:shadow-sm',
      )}
    >
      {/* Issue key + priority */}
      <div className='mb-1.5 flex items-center gap-2'>
        {onPriorityChange && priorities ? (
          <div onClick={e => e.stopPropagation()}>
            <PrioritySelector
              priorities={priorities as Priority[]}
              selectedPriority={issue.priorityId || ''}
              onPrioritySelect={pid => onPriorityChange(issue.id, pid)}
              displayMode='labelOnly'
              trigger={
                <div className='flex-shrink-0 cursor-pointer'>
                  <DynamicIcon
                    name={issue.priorityIcon}
                    className='size-3'
                    style={{ color: issue.priorityColor || '#94a3b8' }}
                    fallback={Circle}
                  />
                </div>
              }
              className='border-none bg-transparent p-0 shadow-none'
            />
          </div>
        ) : (
          issue.priorityIcon && (
            <DynamicIcon
              name={issue.priorityIcon}
              className='size-3'
              style={{ color: issue.priorityColor || '#94a3b8' }}
            />
          )
        )}
        <Link
          href={`/${orgSlug}/issues/${issue.key}`}
          onClick={e => {
            if (isDragging) e.preventDefault();
          }}
          className='text-muted-foreground hover:text-foreground font-mono text-[11px] transition-colors'
        >
          {issue.key}
        </Link>
      </div>

      {/* Title */}
      <Link
        href={`/${orgSlug}/issues/${issue.key}`}
        onClick={e => {
          if (isDragging) e.preventDefault();
        }}
        className='hover:text-primary transition-colors'
      >
        <p className='line-clamp-2 text-sm leading-snug font-medium'>
          {issue.title}
        </p>
      </Link>

      {/* Bottom row: assignees + date */}
      <div className='mt-2 flex items-center justify-between'>
        {/* Assignee selector */}
        {onAssigneesChange && currentUserId ? (
          <div onClick={e => e.stopPropagation()}>
            <MultiAssigneeSelector
              orgSlug={orgSlug}
              selectedAssigneeIds={issue.assigneeIds}
              onAssigneesChange={ids => onAssigneesChange(issue.id, ids)}
              assignments={issue.assignments}
              activeFilter='all'
              currentUserId={currentUserId}
              canManageAll={false}
            />
          </div>
        ) : (
          <div className='flex -space-x-1.5'>
            {issue.assignees.slice(0, 3).map(assignee => (
              <Avatar key={assignee.id} className='ring-card size-5 ring-2'>
                <AvatarFallback className='text-[9px]'>
                  {getInitials(assignee.name, assignee.email)}
                </AvatarFallback>
              </Avatar>
            ))}
            {issue.assignees.length > 3 && (
              <div className='ring-card bg-muted text-muted-foreground flex size-5 items-center justify-center rounded-full text-[9px] ring-2'>
                +{issue.assignees.length - 3}
              </div>
            )}
          </div>
        )}

        <span className='text-muted-foreground text-[11px]'>
          {formatDateHuman(new Date(issue.updatedAt))}
        </span>
      </div>
    </div>
  );
}
