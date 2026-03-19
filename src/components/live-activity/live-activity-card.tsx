'use client';

import { useState } from 'react';
import { usePaginatedQuery } from 'convex/react';
import { useCachedQuery, useMutation } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import type { FunctionReturnType } from 'convex/server';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  ArrowUp,
  ChevronDown,
  ChevronUp,
  Eye,
  MessageSquare,
  Monitor,
  Share2,
  TerminalSquare,
  Unlink,
  UserRoundPlus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { formatDateHuman } from '@/lib/date';
import { toast } from 'sonner';
import { ProviderIcon } from './live-activity-section';
import { WorkSessionTerminal } from './work-session-terminal';
import type { LiveActivityStatus } from '@/convex/_shared/agentBridge';

type LiveActivity = FunctionReturnType<
  typeof api.agentBridge.queries.listIssueLiveActivities
>[number];

// ── Status Badge ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> =
  {
    active: {
      bg: 'bg-green-500/10',
      text: 'text-green-700 dark:text-green-400',
      dot: 'bg-green-500',
    },
    waiting_for_input: {
      bg: 'bg-yellow-500/10',
      text: 'text-yellow-700 dark:text-yellow-400',
      dot: 'bg-yellow-500',
    },
    paused: {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      dot: 'bg-muted-foreground',
    },
    completed: {
      bg: 'bg-blue-500/10',
      text: 'text-blue-700 dark:text-blue-400',
      dot: 'bg-blue-500',
    },
    failed: {
      bg: 'bg-red-500/10',
      text: 'text-red-700 dark:text-red-400',
      dot: 'bg-red-500',
    },
    canceled: {
      bg: 'bg-muted',
      text: 'text-muted-foreground',
      dot: 'bg-muted-foreground',
    },
    disconnected: {
      bg: 'bg-orange-500/10',
      text: 'text-orange-700 dark:text-orange-400',
      dot: 'bg-orange-500',
    },
  };

function StatusBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? STATUS_STYLES.paused;
  const label = status.replace(/_/g, ' ');

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] leading-none font-medium capitalize',
        style.bg,
        style.text,
      )}
    >
      <span
        className={cn(
          'size-1.5 rounded-full',
          style.dot,
          status === 'active' && 'animate-pulse',
        )}
      />
      {label}
    </span>
  );
}

// ── Unified Live Activity Card ──────────────────────────────────────────────

export function LiveActivityCard({
  activity,
  orgSlug,
  currentUser,
}: {
  activity: LiveActivity;
  orgSlug: string;
  currentUser?: {
    _id: string;
    name: string;
    email: string | null;
    image: string | null;
  } | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const updateStatus = useMutation(
    api.agentBridge.mutations.updateLiveActivityStatus,
  );
  const timeAgo = formatDistanceToNow(activity.lastEventAt, {
    addSuffix: true,
  });

  const isTerminal = [
    'completed',
    'failed',
    'canceled',
    'disconnected',
  ].includes(activity.status);

  const isOwner = currentUser?._id === activity.ownerUserId;
  const canInteract = activity.canInteract ?? isOwner;
  const canManageSession = activity.canManageSession ?? isOwner;
  const workSession = activity.workSession;
  const workspaceLabel =
    workSession?.repoRoot ??
    workSession?.workspacePath ??
    activity.workSession?.cwd ??
    activity.title;
  const workspaceName = workspaceLabel
    ? workspaceLabel.split('/').filter(Boolean).at(-1)
    : 'Session';
  const workSessionTitle =
    workSession?.title ??
    activity.title ??
    activity.latestSummary ??
    workspaceName;
  const issueLabel =
    workSession?.issueKey && workSession?.issueTitle
      ? `${workSession.issueKey} · ${workSession.issueTitle}`
      : null;
  const sessionKindLabel = workSession?.agentProvider
    ? activity.providerLabel
    : 'Shell';

  const toggleExpanded = () => {
    setExpanded(current => !current);
  };

  const handleDetach = async () => {
    try {
      await updateStatus({
        liveActivityId: activity._id,
        status: 'canceled',
      });
      toast.success('Process detached from issue');
    } catch {
      toast.error('Failed to detach process');
    }
  };

  return (
    <div className='rounded-lg border'>
      {/* Card header — main summary toggles, actions stay separately clickable */}
      <div className='flex items-start gap-2 px-3 py-3'>
        <button
          type='button'
          onClick={toggleExpanded}
          className='hover:bg-muted/40 -m-1 flex min-w-0 flex-1 items-start gap-3 rounded-md p-1 text-left transition-colors'
        >
          <ProviderIcon
            provider={workSession?.agentProvider ?? activity.provider}
            className='text-muted-foreground mt-0.5 shrink-0'
          />
          <div className='min-w-0 flex-1'>
            <div className='flex items-start gap-2'>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <span className='truncate text-sm font-medium'>
                    {workSessionTitle}
                  </span>
                  <span className='bg-muted text-muted-foreground inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium'>
                    {sessionKindLabel}
                  </span>
                </div>
                {issueLabel && (
                  <div className='text-muted-foreground mt-0.5 truncate text-xs'>
                    {issueLabel}
                  </div>
                )}
              </div>
              <StatusBadge status={activity.status} />
            </div>
            <div className='text-muted-foreground mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs'>
              <span className='truncate'>{workspaceName}</span>
              {workSession?.branch && (
                <>
                  <span>&middot;</span>
                  <span className='font-mono'>{workSession.branch}</span>
                </>
              )}
              <span>&middot;</span>
              <Monitor className='size-3 shrink-0' />
              <span className='truncate'>{activity.deviceName}</span>
              <span>&middot;</span>
              <span className='shrink-0'>{timeAgo}</span>
            </div>
            {workspaceLabel && (
              <div className='text-muted-foreground mt-1 truncate font-mono text-[11px]'>
                {workspaceLabel}
              </div>
            )}
            {!expanded && activity.latestSummary && (
              <div className='text-muted-foreground mt-1 truncate text-xs'>
                {activity.latestSummary}
              </div>
            )}
          </div>
        </button>
        <div className='flex shrink-0 items-center gap-1 pt-0.5'>
          {canManageSession && workSession && (
            <ShareWorkSessionPopover
              orgSlug={orgSlug}
              workSessionId={workSession._id}
              sharedMembers={workSession.sharedMembers ?? []}
            />
          )}
          {canManageSession && !isTerminal && (
            <button
              type='button'
              onClick={() => void handleDetach()}
              className='text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors'
              title='Detach process'
              aria-label='Detach process'
            >
              <Unlink className='size-3.5' />
            </button>
          )}
          <button
            type='button'
            onClick={toggleExpanded}
            className='text-muted-foreground hover:text-foreground rounded p-0.5 transition-colors'
            aria-label={
              expanded ? 'Collapse work session' : 'Expand work session'
            }
          >
            {expanded ? (
              <ChevronUp className='size-4' />
            ) : (
              <ChevronDown className='size-4' />
            )}
          </button>
        </div>
      </div>

      {/* Expanded: conversation */}
      {expanded && (
        <TranscriptBody
          activity={activity}
          orgSlug={orgSlug}
          liveActivityId={activity._id}
          canInteract={canInteract}
          status={activity.status as LiveActivityStatus}
          isTerminal={isTerminal}
          currentUser={currentUser}
        />
      )}
    </div>
  );
}

function ShareWorkSessionPopover({
  orgSlug,
  workSessionId,
  sharedMembers,
}: {
  orgSlug: string;
  workSessionId: Id<'workSessions'>;
  sharedMembers: Array<{
    userId: string;
    name: string;
    email?: string | null;
    image?: string | null;
    accessLevel: 'viewer' | 'controller';
  } | null>;
}) {
  const [open, setOpen] = useState(false);
  const members = useCachedQuery(
    api.organizations.queries.listMembers,
    open ? { orgSlug } : 'skip',
  );
  const shareMutation = useMutation(api.agentBridge.mutations.shareWorkSession);
  const revokeMutation = useMutation(
    api.agentBridge.mutations.revokeWorkSessionShare,
  );

  const resolvedSharedMembers = sharedMembers.filter(
    (
      member,
    ): member is {
      userId: string;
      name: string;
      email?: string | null;
      image?: string | null;
      accessLevel: 'viewer' | 'controller';
    } => Boolean(member),
  );

  const sharedUserIds = new Set(
    resolvedSharedMembers.map(member => member.userId),
  );
  const availableMembers = (members ?? []).flatMap(member =>
    member.user && !sharedUserIds.has(member.user._id)
      ? [{ ...member, user: member.user }]
      : [],
  );

  const handleShare = async (
    userId: Id<'users'>,
    accessLevel: 'viewer' | 'controller',
  ) => {
    try {
      await shareMutation({ workSessionId, userId, accessLevel });
      toast.success('Session access updated');
    } catch {
      toast.error('Failed to update session sharing');
    }
  };

  const handleRevoke = async (userId: Id<'users'>) => {
    try {
      await revokeMutation({ workSessionId, userId });
      toast.success('Session access removed');
    } catch {
      toast.error('Failed to revoke session access');
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='icon'
          className='text-muted-foreground hover:text-foreground size-6'
        >
          <Share2 className='size-3.5' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-80 p-0'>
        <Command>
          <CommandInput placeholder='Share with a teammate...' />
          <CommandList>
            <CommandEmpty>
              {members === undefined ? (
                <div className='space-y-2 p-2'>
                  <Skeleton className='h-8 w-full' />
                  <Skeleton className='h-8 w-full' />
                </div>
              ) : (
                'No members found'
              )}
            </CommandEmpty>
            {resolvedSharedMembers.length > 0 && (
              <CommandGroup heading='Shared'>
                {resolvedSharedMembers.map(member => (
                  <CommandItem
                    key={member.userId}
                    onSelect={() => handleRevoke(member.userId as Id<'users'>)}
                    className='gap-2'
                  >
                    <UserAvatar
                      name={member.name}
                      email={member.email ?? null}
                      image={member.image ?? null}
                      userId={member.userId}
                      size='sm'
                      className='size-5'
                    />
                    <div className='min-w-0 flex-1'>
                      <div className='truncate text-sm'>{member.name}</div>
                      <div className='text-muted-foreground text-xs'>
                        {member.accessLevel}
                      </div>
                    </div>
                    <span className='text-muted-foreground text-[11px]'>
                      Remove
                    </span>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
            <CommandGroup heading='Organization members'>
              {availableMembers.map(member => (
                <CommandItem
                  key={member.user._id}
                  onSelect={() => handleShare(member.user._id, 'controller')}
                  className='gap-2'
                >
                  <UserAvatar
                    name={member.user.name}
                    email={member.user.email}
                    image={member.user.image}
                    userId={member.user._id}
                    size='sm'
                    className='size-5'
                  />
                  <div className='min-w-0 flex-1'>
                    <div className='truncate text-sm'>
                      {member.user.name ?? member.user.email ?? 'Unknown'}
                    </div>
                    <div className='text-muted-foreground text-xs'>
                      Click to allow control
                    </div>
                  </div>
                  <UserRoundPlus className='text-muted-foreground size-3.5' />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

// ── Transcript Body (inside the card) ───────────────────────────────────────

function TranscriptBody({
  activity,
  orgSlug: _orgSlug,
  liveActivityId,
  canInteract,
  status,
  isTerminal,
  currentUser,
}: {
  activity: LiveActivity;
  orgSlug: string;
  liveActivityId: Id<'issueLiveActivities'>;
  canInteract: boolean;
  status: LiveActivityStatus;
  isTerminal: boolean;
  currentUser?: {
    _id: string;
    name: string;
    email: string | null;
    image: string | null;
  } | null;
}) {
  const {
    results,
    loadMore,
    status: loadStatus,
  } = usePaginatedQuery(
    api.agentBridge.queries.listLiveMessages,
    { liveActivityId },
    { initialNumItems: 20 },
  );
  const appendMessage = useMutation(
    api.agentBridge.mutations.appendLiveMessage,
  );
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [activeTab, setActiveTab] = useState<'activity' | 'terminal'>(
    'activity',
  );

  const canSendMessage = canInteract && !isTerminal;

  const handleSend = async () => {
    const body = messageInput.trim();
    if (!body) return;
    setSending(true);
    try {
      await appendMessage({
        liveActivityId,
        direction: 'vector_to_agent',
        role: 'user',
        body,
      });
      setMessageInput('');
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // Filter out status messages — they're shown in the card header summary
  const conversationMessages = results.filter(m => m.role !== 'status');
  const terminalSnapshot = activity.workSession?.terminalSnapshot?.trim() ?? '';
  const showTerminalTab =
    terminalSnapshot.length > 0 || Boolean(activity.workSession?.tmuxPaneId);

  return (
    <>
      <Tabs
        value={showTerminalTab ? activeTab : 'activity'}
        onValueChange={value =>
          setActiveTab(value === 'terminal' ? 'terminal' : 'activity')
        }
        className='border-t'
      >
        <div className='flex items-center justify-between border-b px-3 py-2'>
          <TabsList variant='line' className='h-7 gap-1 p-0'>
            <TabsTrigger value='activity' className='h-7 px-2 text-xs'>
              <MessageSquare className='size-3.5' />
              Activity
            </TabsTrigger>
            {showTerminalTab && (
              <TabsTrigger value='terminal' className='h-7 px-2 text-xs'>
                <TerminalSquare className='size-3.5' />
                Terminal
              </TabsTrigger>
            )}
          </TabsList>
          {!canSendMessage && (
            <div className='text-muted-foreground inline-flex items-center gap-1.5 text-[11px]'>
              <Eye className='size-3.5' />
              View only
            </div>
          )}
        </div>

        <TabsContent value='activity' className='m-0'>
          <div className='max-h-80 overflow-y-auto'>
            {loadStatus === 'LoadingFirstPage' && (
              <div className='space-y-0'>
                {[0, 1].map(i => (
                  <div
                    key={i}
                    className={cn(
                      'flex items-start gap-3 px-3 py-2',
                      i > 0 && 'border-t',
                    )}
                  >
                    <Skeleton className='size-6 rounded-full' />
                    <div className='min-w-0 flex-1 space-y-2 py-0.5'>
                      <Skeleton className='h-3.5 w-3/5' />
                      <Skeleton className='h-3.5 w-full' />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {conversationMessages.length === 0 &&
              loadStatus !== 'LoadingFirstPage' && (
                <div className='text-muted-foreground px-3 py-4 text-center text-sm'>
                  No messages yet
                </div>
              )}

            {loadStatus === 'CanLoadMore' && (
              <div className='border-b px-3 py-1'>
                <button
                  type='button'
                  onClick={() => loadMore(20)}
                  className='text-muted-foreground hover:text-foreground flex w-full items-center justify-center gap-1 text-xs transition-colors'
                >
                  <ChevronUp className='size-3' />
                  Load older
                </button>
              </div>
            )}

            {conversationMessages.map((msg, i) => {
              const isUser = msg.direction === 'vector_to_agent';

              if (isUser) {
                return (
                  <div
                    key={msg._id}
                    className={cn('px-3 py-2.5', i > 0 && 'border-t')}
                  >
                    <div className='flex items-center gap-2 pb-1'>
                      <UserAvatar
                        name={currentUser?.name}
                        email={currentUser?.email}
                        image={currentUser?.image}
                        userId={currentUser?._id}
                        size='sm'
                        className='size-5 shrink-0'
                      />
                      <span className='text-sm font-medium'>
                        {currentUser?.name ?? 'You'}
                      </span>
                      <span className='text-muted-foreground text-xs'>
                        {formatDateHuman(new Date(msg.createdAt))}
                      </span>
                    </div>
                    <p className='pl-7 text-sm leading-relaxed break-words whitespace-pre-wrap'>
                      {msg.body}
                    </p>
                  </div>
                );
              }

              // Agent message — just body, no avatar
              return (
                <div
                  key={msg._id}
                  className={cn('px-3 py-2.5', i > 0 && 'border-t')}
                >
                  <p className='text-sm leading-relaxed break-words whitespace-pre-wrap'>
                    {msg.body}
                  </p>
                  <span className='text-muted-foreground mt-1 block text-xs'>
                    {formatDateHuman(new Date(msg.createdAt))}
                  </span>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {showTerminalTab && (
          <TabsContent value='terminal' className='m-0'>
            <div className='p-3'>
              {terminalSnapshot || activity.workSession?.tmuxPaneId ? (
                <WorkSessionTerminal
                  snapshot={terminalSnapshot}
                  workspacePath={
                    activity.workSession?.repoRoot ??
                    activity.workSession?.cwd ??
                    activity.workSession?.workspacePath
                  }
                  paneId={activity.workSession?.tmuxPaneId}
                  branch={activity.workSession?.branch}
                  providerLabel={
                    activity.workSession?.agentProvider
                      ? activity.providerLabel
                      : undefined
                  }
                />
              ) : (
                <div className='text-muted-foreground bg-muted/20 rounded-lg border py-8 text-center text-sm'>
                  Terminal output will appear when the device syncs this pane.
                </div>
              )}
              <div className='text-muted-foreground pt-2 text-[11px]'>
                Snapshots refresh automatically from the device. Sending a
                message writes directly into the tmux pane.
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* Terminal status */}
      {isTerminal && (
        <div className='text-muted-foreground flex items-center gap-3 border-t px-3 py-1.5 text-xs'>
          <div className='bg-border h-px flex-1' />
          <span>Session {status}</span>
          <div className='bg-border h-px flex-1' />
        </div>
      )}

      {/* Composer */}
      {canSendMessage && (
        <div className='border-t'>
          <textarea
            value={messageInput}
            onChange={e => setMessageInput(e.target.value)}
            onFocus={() => setComposerFocused(true)}
            onBlur={() => {
              if (!messageInput.trim()) setComposerFocused(false);
            }}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void handleSend();
              }
            }}
            placeholder={
              activity.workSession?.tmuxPaneId
                ? 'Send input to this work session...'
                : 'Message the agent...'
            }
            rows={composerFocused ? 2 : 1}
            className='placeholder:text-muted-foreground w-full resize-none bg-transparent px-3 py-2 text-sm outline-none'
            disabled={sending}
          />
          {(composerFocused || messageInput.trim()) && (
            <div className='flex items-center justify-end px-2 pb-2'>
              <Button
                size='sm'
                className='size-7 cursor-pointer rounded-md p-0'
                disabled={sending || !messageInput.trim()}
                onClick={() => void handleSend()}
              >
                <ArrowUp className='size-4' />
              </Button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
