'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useCachedQuery, useMutation } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AgentIcon } from '@/components/agent-icon';
import { ArrowUp, Clock, Square } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateHuman } from '@/lib/date';
import { cn } from '@/lib/utils';
import { BarsSpinner } from '@/components/bars-spinner';
import {
  AgentLoadingIndicator,
  LoadingIndicator,
} from './agent-loading-indicator';
import { AgentTurnCard, ErrorBubble, SystemLine } from './agent-turn-card';
import { AgentAuthCard } from './agent-auth-card';
import { AgentQueueReporter } from './agent-queue-reporter';
import { AgentComposerToolbar } from './agent-composer-toolbar';
import { createQueuedMessageId } from '@/lib/local-agents/agent-session-queue';
import type {
  AgentSessionMessage,
  LocalAgentProvider,
} from '@/lib/local-agents/types';

type ChatGroup =
  | { kind: 'user'; key: string; message: AgentSessionMessage }
  | {
      kind: 'turn';
      key: string;
      activities: AgentSessionMessage[];
      responses: AgentSessionMessage[];
      changedFilesActivities?: AgentSessionMessage[];
      leadText?: string;
      leadResponses?: AgentSessionMessage[];
    }
  | { kind: 'error'; key: string; message: AgentSessionMessage }
  | { kind: 'auth'; key: string; message: AgentSessionMessage }
  | { kind: 'system'; key: string; message: AgentSessionMessage }
  | { kind: 'compaction'; key: string; message: AgentSessionMessage }
  | { kind: 'status'; key: string; message: AgentSessionMessage };

export function VectorAgentChatPanel({
  liveActivityId,
  isOwner,
  currentUser,
  mode = 'embedded',
}: {
  liveActivityId: Id<'issueLiveActivities'>;
  isOwner: boolean;
  mode?: 'embedded' | 'expanded';
  currentUser?: {
    name: string;
    email: string | null;
    image: string | null;
    _id: string;
  } | null;
}) {
  const snapshot = useCachedQuery(
    api.agentBridge.queries.getAgentSessionSnapshot,
    {
      liveActivityId,
    },
  );
  const appendMessage = useMutation(
    api.agentBridge.mutations.appendLiveMessage,
  );
  const updateSettings = useMutation(
    api.agentBridge.mutations.updateAgentSettings,
  );
  const enqueueMessage = useMutation(
    api.agentBridge.mutations.enqueueAgentMessage,
  );
  const cancelQueued = useMutation(
    api.agentBridge.mutations.cancelQueuedAgentMessage,
  );
  const clearQueue = useMutation(api.agentBridge.mutations.clearAgentQueue);
  const respondApproval = useMutation(
    api.agentBridge.mutations.respondToApproval,
  );
  const stopTurn = useMutation(api.agentBridge.mutations.stopAgentTurn);
  const resumeSession = useMutation(
    api.agentBridge.mutations.resumeAgentSession,
  );
  const [messageInput, setMessageInput] = useState('');
  const [sending, setSending] = useState(false);
  const [pausing, setPausing] = useState(false);
  const [isComposerMultiline, setIsComposerMultiline] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const composerMultilineRef = useRef(false);
  const composerExpandedLockedRef = useRef(false);

  const groups = useMemo(
    () => groupMessages(snapshot?.messages ?? []),
    [snapshot?.messages],
  );

  useEffect(() => {
    composerMultilineRef.current = isComposerMultiline;
  }, [isComposerMultiline]);

  const updateComposerLayout = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const value = textarea.value;
    const hasText = value.trim().length > 0;
    if (!hasText) {
      composerExpandedLockedRef.current = false;
      setIsComposerMultiline(false);
      textarea.style.height = '36px';
      textarea.style.overflowY = 'hidden';
      return;
    }

    textarea.style.height = 'auto';
    const nextHeight = Math.min(textarea.scrollHeight, 168);
    const hasExplicitLineBreak = value.includes('\n');
    const hasWrappedLine = textarea.scrollHeight > 44;

    if (hasExplicitLineBreak || hasWrappedLine) {
      composerExpandedLockedRef.current = true;
      setIsComposerMultiline(true);
    } else if (!composerExpandedLockedRef.current) {
      setIsComposerMultiline(false);
    }

    const expanded =
      composerExpandedLockedRef.current || composerMultilineRef.current;
    textarea.style.height = expanded ? `${Math.max(36, nextHeight)}px` : '36px';
    textarea.style.overflowY = nextHeight >= 168 ? 'auto' : 'hidden';
  }, []);

  useLayoutEffect(() => {
    updateComposerLayout();
  }, [messageInput, isComposerMultiline, updateComposerLayout]);

  useEffect(() => {
    window.addEventListener('resize', updateComposerLayout);
    return () => window.removeEventListener('resize', updateComposerLayout);
  }, [updateComposerLayout]);

  if (snapshot === undefined) {
    return (
      <div className='border-border/55 rounded-[14px] border'>
        <AgentLoadingIndicator />
      </div>
    );
  }

  if (!snapshot) return null;

  const terminal = ['completed', 'failed', 'canceled', 'disconnected'].includes(
    snapshot.status,
  );
  const canSend = isOwner && !terminal;
  const running =
    snapshot.status === 'active' ||
    snapshot.messages.some(message => message.status === 'in_progress');
  const workSessionId = snapshot.workSessionId;
  const streamingTurnKey = findStreamingTurnKey(groups);
  const lastMessageAt = snapshot.messages.at(-1)?.createdAt ?? null;

  const sendNow = async () => {
    const body = messageInput.trim();
    if (!body) return;
    setSending(true);
    try {
      await appendMessage({
        liveActivityId,
        direction: 'vector_to_agent',
        role: 'user',
        body,
        queueMode: undefined,
        model: snapshot.model ?? undefined,
        permissionMode: snapshot.permissionMode ?? undefined,
        thinkingLevel: snapshot.thinkingLevel ?? undefined,
        fastMode: snapshot.fastMode ?? undefined,
      });
      setMessageInput('');
      textareaRef.current?.focus();
    } catch {
      toast.error('Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const queue = async (mode: 'after-turn' | 'after-tool' | 'stop') => {
    const text = messageInput.trim();
    if (!snapshot.workSessionId || !text) return;
    try {
      await enqueueMessage({
        workSessionId: snapshot.workSessionId,
        message: {
          id: createQueuedMessageId(),
          text,
          attachments: [],
          mode,
          model: snapshot.model ?? null,
          thinkingLevel: snapshot.thinkingLevel ?? null,
          permissionMode: snapshot.permissionMode ?? null,
          fastMode: snapshot.fastMode ?? null,
          replyTo: null,
        },
      });
      setMessageInput('');
    } catch {
      toast.error('Failed to queue message');
    }
  };

  const pauseSession = async () => {
    if (!workSessionId || pausing) return;
    setPausing(true);
    try {
      await stopTurn({ workSessionId });
    } catch {
      toast.error('Failed to pause agent');
    } finally {
      setPausing(false);
    }
  };

  return (
    <div
      className={cn(
        'agent-chat-panel border-border/55 bg-background/60 relative flex min-h-[34rem] flex-col overflow-hidden rounded-[14px] border',
        mode === 'expanded' && 'min-h-[42rem]',
      )}
    >
      <div className='pointer-events-none absolute top-2 left-3 z-10 hidden justify-start md:flex'>
        <div className='border-border/50 bg-background/82 text-muted-foreground/80 pointer-events-auto inline-flex h-6 min-w-[112px] items-center justify-center gap-1.5 rounded-[6px] border px-2 text-[11px] font-medium tabular-nums shadow-sm backdrop-blur-xl'>
          <Clock className='text-muted-foreground/70 size-3.5 shrink-0' />
          <span className='truncate'>
            {lastMessageAt
              ? `Updated ${formatDateHuman(new Date(lastMessageAt))}`
              : 'No updates yet'}
          </span>
        </div>
      </div>

      <div
        className='min-h-0 flex-1'
        style={{
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 28px, black calc(100% - 12px), transparent 100%)',
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 28px, black calc(100% - 12px), transparent 100%)',
        }}
      >
        <ScrollArea className='h-full min-w-0' viewportClassName='rounded-none'>
          <div
            className={cn(
              'mx-auto min-h-full w-[calc(100%-2rem)] px-0 pt-10 pb-36',
              mode === 'expanded' ? 'max-w-4xl' : 'max-w-3xl',
            )}
          >
            {groups.length === 0 ? (
              <EmptyAgentState
                agent={snapshot.agent}
                title={snapshot.title}
                cwd={snapshot.cwd}
                running={running}
              />
            ) : (
              <div className='space-y-3'>
                {groups.map(group => (
                  <MessageGroup
                    key={group.key}
                    group={group}
                    agent={snapshot.agent}
                    currentUser={currentUser}
                    isStreamingLastTurn={
                      group.kind === 'turn' && group.key === streamingTurnKey
                    }
                  />
                ))}
                {running && streamingTurnKey === null ? (
                  <PendingTurnIndicator agent={snapshot.agent} />
                ) : null}
              </div>
            )}
          </div>
        </ScrollArea>
      </div>

      <div className='pointer-events-none absolute inset-x-0 bottom-0 z-20 px-3 pb-3'>
        <div
          className={cn(
            'pointer-events-auto mx-auto',
            mode === 'expanded' ? 'max-w-4xl' : 'max-w-2xl',
          )}
        >
          {snapshot.pendingApproval ? (
            <AgentAuthCard
              approval={snapshot.pendingApproval}
              onApprove={approveForSession => {
                if (workSessionId) {
                  void respondApproval({
                    workSessionId,
                    approved: true,
                    approveForSession,
                  });
                }
              }}
              onDeny={() => {
                if (workSessionId) {
                  void respondApproval({ workSessionId, approved: false });
                }
              }}
            />
          ) : null}
          {workSessionId ? (
            <AgentQueueReporter
              messages={snapshot.queuedMessages}
              onCancel={messageId =>
                void cancelQueued({ workSessionId, messageId })
              }
              onClear={() => void clearQueue({ workSessionId })}
            />
          ) : null}
          <div
            data-agent-chat-input-multiline={
              isComposerMultiline ? 'true' : 'false'
            }
            className={cn(
              'group/composer bg-card relative overflow-visible shadow-[0_5px_16px_rgba(0,0,0,0.06),0_1px_2px_rgba(0,0,0,0.035),inset_0_0_0_1px_color-mix(in_oklch,var(--border)_58%,transparent)] backdrop-blur-xl transition-[border-radius,box-shadow,background-color,padding] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none dark:shadow-[0_8px_22px_rgba(0,0,0,0.24),0_1px_2px_rgba(0,0,0,0.18),inset_0_0_0_1px_color-mix(in_oklch,var(--border)_62%,transparent)]',
              isComposerMultiline
                ? 'rounded-[12px] py-[9px] pr-2 pl-[7px]'
                : 'rounded-[10px] px-[7px] py-[9px]',
            )}
            style={{
              backgroundColor: 'var(--elevated-surface, var(--popover))',
            }}
          >
            {canSend ? (
              <div
                className={cn(
                  'relative z-20 flex min-h-9 items-stretch gap-2 overflow-visible transition-[min-height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                  isComposerMultiline &&
                    'grid min-h-[116px] min-w-0 grid-cols-[minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 pb-0.5',
                )}
              >
                <div
                  className={cn(
                    'relative z-20 flex min-w-0 flex-1 flex-col overflow-visible',
                    isComposerMultiline && 'contents',
                  )}
                >
                  <div
                    className={
                      isComposerMultiline
                        ? 'contents'
                        : 'flex h-full items-stretch gap-1'
                    }
                  >
                    <div
                      className={cn(
                        'relative z-20 flex min-w-0 gap-1 overflow-visible',
                        isComposerMultiline
                          ? 'col-span-2 row-start-1 items-start'
                          : 'order-2 flex-1 items-center',
                      )}
                    >
                      <textarea
                        ref={textareaRef}
                        value={messageInput}
                        onChange={event => setMessageInput(event.target.value)}
                        onKeyDown={event => {
                          if (
                            event.nativeEvent.isComposing ||
                            event.nativeEvent.keyCode === 229 ||
                            event.shiftKey ||
                            event.key !== 'Enter'
                          ) {
                            return;
                          }

                          event.preventDefault();
                          if (running) void queue('after-turn');
                          else void sendNow();
                        }}
                        placeholder={getComposerPlaceholder(snapshot.agent)}
                        rows={1}
                        className={cn(
                          'placeholder:text-muted-foreground/60 text-foreground/95 max-h-[168px] min-h-9 w-full min-w-0 flex-1 resize-none bg-transparent text-[15px] leading-6 transition-[height] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] outline-none motion-reduce:transition-none',
                          isComposerMultiline
                            ? 'py-0 pr-2.5 pl-2.5'
                            : 'flex h-9 items-center pt-1.5 pr-2.5 pl-2.5',
                        )}
                        disabled={sending}
                      />
                    </div>
                    <div
                      className={cn(
                        'flex items-center',
                        isComposerMultiline
                          ? 'col-start-1 row-start-2 ml-0.5 items-end self-end'
                          : 'order-1 ml-0.5 self-center',
                      )}
                    >
                      <AgentComposerToolbar
                        provider={snapshot.agent}
                        model={snapshot.model}
                        permissionMode={snapshot.permissionMode}
                        thinkingLevel={snapshot.thinkingLevel}
                        fastMode={snapshot.fastMode}
                        contextLength={snapshot.contextLength}
                        onSettingsChange={patch => {
                          if (!snapshot.workSessionId) return;
                          void updateSettings({
                            workSessionId: snapshot.workSessionId,
                            model: patch.model,
                            permissionMode: patch.permissionMode,
                            thinkingLevel: patch.thinkingLevel,
                            fastMode: patch.fastMode,
                            contextLength: patch.contextLength,
                          });
                        }}
                      />
                    </div>
                  </div>
                </div>
                <div
                  className={cn(
                    'flex shrink-0 items-center gap-1',
                    isComposerMultiline
                      ? 'col-start-2 row-start-2 mr-0.5 self-end justify-self-end'
                      : 'mr-0.5 self-center',
                  )}
                >
                  {running && messageInput.trim() ? (
                    <div className='hidden items-center gap-1 sm:flex'>
                      <QueueButton
                        label='After turn'
                        onClick={() => void queue('after-turn')}
                      />
                      <QueueButton
                        label='After tool'
                        onClick={() => void queue('after-tool')}
                      />
                      <QueueButton
                        label='Pause then send'
                        onClick={() => void queue('stop')}
                      />
                    </div>
                  ) : null}
                  <Button
                    type='button'
                    variant={running ? 'secondary' : 'default'}
                    size='icon'
                    className={cn(
                      'size-9 shrink-0 rounded-md px-0 text-xs transition-colors',
                      running &&
                        'bg-foreground text-background hover:bg-foreground/90',
                    )}
                    disabled={
                      pausing || (!running && (sending || !messageInput.trim()))
                    }
                    onClick={() => {
                      if (running && messageInput.trim()) void queue('stop');
                      else if (running) void pauseSession();
                      else void sendNow();
                    }}
                    title={running ? 'Pause agent' : 'Send message'}
                    aria-label={running ? 'Pause agent' : 'Send message'}
                  >
                    {pausing ? (
                      <BarsSpinner size={14} />
                    ) : running ? (
                      <Square className='size-3.5 fill-current' />
                    ) : sending ? (
                      <BarsSpinner size={14} />
                    ) : (
                      <ArrowUp className='size-4' />
                    )}
                  </Button>
                </div>
              </div>
            ) : (
              <div className='flex items-center justify-between gap-3 px-3 py-2'>
                <span className='text-muted-foreground text-sm'>
                  Session {snapshot.status.replace(/_/g, ' ')}
                </span>
                {workSessionId ? (
                  <Button
                    size='sm'
                    variant='secondary'
                    onClick={() => void resumeSession({ workSessionId })}
                  >
                    Resume
                  </Button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageGroup({
  group,
  agent,
  currentUser,
  isStreamingLastTurn,
}: {
  group: ChatGroup;
  agent: LocalAgentProvider;
  currentUser?: {
    name: string;
    email: string | null;
    image: string | null;
    _id: string;
  } | null;
  isStreamingLastTurn: boolean;
}) {
  if (group.kind === 'user') {
    return <UserBubble message={group.message} currentUser={currentUser} />;
  }
  if (group.kind === 'turn') {
    return (
      <AgentTurnCard
        activities={group.activities}
        responses={group.responses}
        changedFilesActivities={group.changedFilesActivities}
        leadText={group.leadText}
        leadResponses={group.leadResponses}
        agent={agent}
        isStreaming={isStreamingLastTurn}
      />
    );
  }
  if (group.kind === 'error') return <ErrorBubble message={group.message} />;
  if (group.kind === 'auth') return <SystemLine message={group.message} />;
  if (group.kind === 'compaction') {
    return <SystemLine message={group.message} kind='compaction' />;
  }
  if (group.kind === 'status') {
    return <SystemLine message={group.message} kind='status' />;
  }
  return <SystemLine message={group.message} />;
}

function UserBubble({
  message,
  currentUser,
}: {
  message: AgentSessionMessage;
  currentUser?: {
    name: string;
    email: string | null;
    image: string | null;
    _id: string;
  } | null;
}) {
  return (
    <div className='flex w-full justify-end'>
      <div className='flex max-w-[78%] min-w-0 flex-col items-end gap-1.5'>
        <div className='text-muted-foreground/70 flex items-center gap-1.5 text-[11px]'>
          <span>{formatDateHuman(new Date(message.createdAt))}</span>
          <UserAvatar
            name={currentUser?.name ?? 'You'}
            email={currentUser?.email ?? null}
            image={currentUser?.image ?? null}
            userId={currentUser?._id}
            size='sm'
            className='size-5'
          />
        </div>
        <div className='bg-foreground text-background rounded-[12px] px-3.5 py-2 text-[14px] leading-relaxed shadow-sm'>
          <div className='whitespace-pre-wrap'>{message.text}</div>
        </div>
      </div>
    </div>
  );
}

function PendingTurnIndicator({ agent }: { agent: LocalAgentProvider }) {
  return (
    <LoadingIndicator
      label={`${getAgentDisplayName(agent)} is thinking`}
      showElapsed
      className='text-muted-foreground py-1.5 pr-2.5 pl-1.5 text-[12px]'
      spinnerClassName='text-[10px] text-muted-foreground/80'
    />
  );
}

function EmptyAgentState({
  agent,
  title,
  cwd,
  running,
}: {
  agent: LocalAgentProvider;
  title: string;
  cwd?: string | null;
  running: boolean;
}) {
  return (
    <div className='flex min-h-[300px] flex-col items-center justify-center gap-4 py-8 text-center'>
      <div className='border-border/60 bg-background/85 relative flex size-14 items-center justify-center rounded-[16px] border shadow-sm'>
        <AgentIcon agent={agent} className='size-7' size={28} />
        <span
          className={cn(
            'ring-background absolute -right-1 -bottom-1 size-3 rounded-full ring-2',
            running ? 'bg-emerald-400' : 'bg-muted-foreground/40',
          )}
        />
      </div>
      <div className='space-y-1.5'>
        <p className='text-foreground text-[15px] font-semibold tracking-tight'>
          {title || `New ${getAgentDisplayName(agent)} session`}
        </p>
        {cwd ? (
          <p className='text-muted-foreground max-w-md truncate text-[12px]'>
            {cwd}
          </p>
        ) : null}
      </div>
    </div>
  );
}

function QueueButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type='button'
      onClick={onClick}
      className='text-muted-foreground/75 hover:bg-foreground/8 hover:text-foreground h-7 rounded-[8px] px-2 text-[11.5px] transition-colors'
    >
      {label}
    </button>
  );
}

function groupMessages(messages: AgentSessionMessage[]): ChatGroup[] {
  const groups: ChatGroup[] = [];
  let pending: {
    activities: AgentSessionMessage[];
    responses: AgentSessionMessage[];
  } | null = null;
  let turnIndex = 0;

  const flushPending = () => {
    if (!pending) return;
    if (pending.activities.length > 0 || pending.responses.length > 0) {
      groups.push({
        kind: 'turn',
        key: `turn-${turnIndex}`,
        activities: pending.activities,
        responses: pending.responses,
      });
      turnIndex += 1;
    }
    pending = null;
  };

  for (const message of messages) {
    if (message.role === 'error' && getReconnectStatus(message.text)) {
      continue;
    }
    if (message.parentToolUseId) {
      if (message.role === 'user') continue;
      pending ??= { activities: [], responses: [] };
      pending.activities.push(message);
      continue;
    }

    if (message.role === 'user') {
      flushPending();
      groups.push({ kind: 'user', key: message.id, message });
      continue;
    }
    if (message.role === 'error') {
      flushPending();
      groups.push({ kind: 'error', key: message.id, message });
      continue;
    }
    if (message.role === 'auth_request') {
      flushPending();
      groups.push({ kind: 'auth', key: message.id, message });
      continue;
    }
    if (message.role === 'compaction') {
      flushPending();
      groups.push({ kind: 'compaction', key: message.id, message });
      continue;
    }
    if (message.role === 'status') {
      flushPending();
      groups.push({ kind: 'status', key: message.id, message });
      continue;
    }

    if (
      message.role !== 'assistant' &&
      pending &&
      pending.responses.length > 0
    ) {
      flushPending();
    }
    pending ??= { activities: [], responses: [] };
    if (message.role === 'assistant') {
      pending.responses.push(message);
    } else {
      pending.activities.push(message);
    }
  }
  flushPending();
  return finalizeTurnGroups(demoteInterimResponses(groups));
}

function turnHasVisibleResponse(group: Extract<ChatGroup, { kind: 'turn' }>) {
  return group.responses.some(response => response.text.trim().length > 0);
}

function finalizeTurnGroups(groups: ChatGroup[]): ChatGroup[] {
  const nextGroups = groups.slice();
  let runStart = 0;

  const finalizeRun = (start: number, endExclusive: number) => {
    if (start >= endExclusive) return;
    let anchorIndex = -1;
    let lastActivityIndex = -1;
    const aggregatedActivities: AgentSessionMessage[] = [];

    for (let index = start; index < endExclusive; index += 1) {
      const group = nextGroups[index];
      if (group.kind !== 'turn') return;
      aggregatedActivities.push(...group.activities);
      if (group.activities.length > 0) lastActivityIndex = index;
    }

    if (lastActivityIndex >= start) {
      for (let index = lastActivityIndex; index < endExclusive; index += 1) {
        const group = nextGroups[index];
        if (group.kind === 'turn' && turnHasVisibleResponse(group)) {
          anchorIndex = index;
        }
      }
    }

    for (let index = start; index < endExclusive; index += 1) {
      const group = nextGroups[index];
      if (group.kind !== 'turn') continue;
      const changedFilesActivities =
        index === anchorIndex ? aggregatedActivities : undefined;
      nextGroups[index] = { ...group, changedFilesActivities };
    }
  };

  for (let index = 0; index <= nextGroups.length; index += 1) {
    const group = nextGroups[index];
    if (group?.kind === 'turn') continue;
    finalizeRun(runStart, index);
    runStart = index + 1;
  }

  return nextGroups;
}

function demoteInterimResponses(groups: ChatGroup[]): ChatGroup[] {
  const result: ChatGroup[] = [];
  for (let index = 0; index < groups.length; index += 1) {
    const group = groups[index];
    const next = groups[index + 1];
    if (
      group.kind === 'turn' &&
      group.responses.length > 0 &&
      next?.kind === 'turn' &&
      next.activities.length > 0
    ) {
      const leadText = group.responses
        .map(response => response.text)
        .join('\n\n')
        .trim();
      groups[index + 1] = {
        ...next,
        key: group.activities.length > 0 ? next.key : group.key,
        leadText: leadText || next.leadText,
        leadResponses: group.responses,
      };
      if (group.activities.length > 0) {
        result.push({ ...group, responses: [] });
      }
      continue;
    }
    result.push(group);
  }
  return result;
}

function getReconnectStatus(text: string): 'stale' | 'expired' | null {
  const normalized = text.toLowerCase();
  if (normalized.includes('session has expired')) return 'expired';
  if (normalized.includes('session not found')) return 'stale';
  return null;
}

function findStreamingTurnKey(groups: ChatGroup[]) {
  for (let index = groups.length - 1; index >= 0; index -= 1) {
    const group = groups[index];
    if (
      group.kind === 'turn' &&
      [...group.activities, ...group.responses].some(
        message => message.status === 'in_progress',
      )
    ) {
      return group.key;
    }
  }
  return null;
}

function getComposerPlaceholder(agent: LocalAgentProvider) {
  return `Message ${getAgentDisplayName(agent)}...`;
}

function getAgentDisplayName(agent: LocalAgentProvider) {
  if (agent === 'claude_code') return 'Claude Code';
  if (agent === 'cursor') return 'Cursor';
  if (agent === 'copilot') return 'GitHub Copilot';
  if (agent === 'opencode') return 'OpenCode';
  if (agent === 'pi') return 'Pi';
  return 'Codex';
}
