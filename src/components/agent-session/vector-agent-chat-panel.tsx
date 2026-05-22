'use client';

import { useState } from 'react';
import { useCachedQuery, useMutation } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Button } from '@/components/ui/button';
import { UserAvatar } from '@/components/user-avatar';
import { ArrowUp } from 'lucide-react';
import { toast } from 'sonner';
import { formatDateHuman } from '@/lib/date';
import { cn } from '@/lib/utils';
import { AgentLoadingIndicator } from './agent-loading-indicator';
import { AgentTurnCard } from './agent-turn-card';
import { AgentAuthCard } from './agent-auth-card';
import { AgentQueueReporter } from './agent-queue-reporter';
import { AgentSessionStatus } from './agent-session-status';
import { AgentComposerToolbar } from './agent-composer-toolbar';
import { createQueuedMessageId } from '@/lib/local-agents/agent-session-queue';
import type {
  AgentSessionMessage,
  LocalAgentProvider,
} from '@/lib/local-agents/types';

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
  const [composerFocused, setComposerFocused] = useState(false);
  const [sending, setSending] = useState(false);

  if (snapshot === undefined) {
    return (
      <div className='rounded-lg border'>
        <AgentLoadingIndicator />
      </div>
    );
  }

  if (!snapshot) return null;

  const terminal = ['completed', 'failed', 'canceled', 'disconnected'].includes(
    snapshot.status,
  );
  const canSend = isOwner && !terminal;
  const running = snapshot.messages.some(
    message =>
      [
        'assistant',
        'reasoning',
        'tool',
        'system',
        'auth_request',
        'compaction',
      ].includes(message.role) && message.status === 'in_progress',
  );

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
      setComposerFocused(false);
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

  const workSessionId = snapshot.workSessionId;

  return (
    <div
      className={cn(
        'rounded-lg border',
        mode === 'expanded' &&
          'flex max-h-[calc(100vh-10rem)] min-h-[36rem] flex-col',
      )}
    >
      <AgentSessionStatus
        snapshot={snapshot}
        onStop={() => {
          if (workSessionId) void stopTurn({ workSessionId });
        }}
        onResume={() => {
          if (workSessionId) void resumeSession({ workSessionId });
        }}
      />
      <div className='min-h-0 flex-1 overflow-y-auto'>
        {snapshot.messages.length === 0 ? (
          <div className='text-muted-foreground px-3 py-4 text-center text-sm'>
            The local agent has not posted a message yet.
          </div>
        ) : (
          snapshot.messages.map((message, index) =>
            message.direction === 'vector_to_agent' ||
            message.role === 'user' ? (
              <UserMessage
                key={message.id}
                message={message}
                currentUser={currentUser}
                isFirst={index === 0}
              />
            ) : (
              <AgentTurnCard
                key={message.id}
                message={message}
                isFirst={index === 0}
              />
            ),
          )
        )}
      </div>
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
      {canSend ? (
        <div className='border-t'>
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
            onProviderChange={(provider: LocalAgentProvider) => {
              if (!snapshot.workSessionId || provider === 'vector_cli') return;
              toast.message(
                `Provider changes apply to new launches: ${provider}`,
              );
            }}
          />
          <textarea
            value={messageInput}
            onChange={event => setMessageInput(event.target.value)}
            onFocus={() => setComposerFocused(true)}
            onBlur={() => {
              if (!messageInput.trim()) setComposerFocused(false);
            }}
            onKeyDown={event => {
              if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
                event.preventDefault();
                if (running) void queue('after-turn');
                else void sendNow();
              }
            }}
            placeholder='Message the agent...'
            rows={composerFocused ? 2 : 1}
            className='placeholder:text-muted-foreground w-full resize-none bg-transparent px-3 py-2 text-sm outline-none'
            disabled={sending}
          />
          {(composerFocused || messageInput.trim()) && (
            <div className='flex items-center justify-between gap-2 px-2 pb-2'>
              <div className='flex items-center gap-1'>
                {running ? (
                  <>
                    <Button
                      size='xs'
                      variant='ghost'
                      onClick={() => void queue('after-turn')}
                    >
                      After turn
                    </Button>
                    <Button
                      size='xs'
                      variant='ghost'
                      onClick={() => void queue('after-tool')}
                    >
                      After tool
                    </Button>
                    <Button
                      size='xs'
                      variant='ghost'
                      onClick={() => void queue('stop')}
                    >
                      Stop then send
                    </Button>
                  </>
                ) : null}
              </div>
              <Button
                size='sm'
                className='size-7 cursor-pointer rounded-md p-0'
                disabled={sending || !messageInput.trim()}
                onClick={() => void sendNow()}
              >
                <ArrowUp className='size-4' />
              </Button>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function UserMessage({
  message,
  currentUser,
  isFirst,
}: {
  message: AgentSessionMessage;
  currentUser?: {
    name: string;
    email: string | null;
    image: string | null;
    _id: string;
  } | null;
  isFirst: boolean;
}) {
  return (
    <div className={cn('px-3 py-2', !isFirst && 'border-t')}>
      <div className='flex items-start gap-2'>
        <UserAvatar
          name={currentUser?.name ?? 'You'}
          email={currentUser?.email ?? null}
          image={currentUser?.image ?? null}
          userId={currentUser?._id}
          size='sm'
        />
        <div className='min-w-0 flex-1'>
          <div className='mb-1 flex items-center gap-2'>
            <span className='text-sm font-medium'>
              {currentUser?.name ?? 'You'}
            </span>
            <span className='text-muted-foreground text-xs'>
              {formatDateHuman(new Date(message.createdAt))}
            </span>
          </div>
          <div className='text-sm whitespace-pre-wrap'>{message.text}</div>
        </div>
      </div>
    </div>
  );
}
