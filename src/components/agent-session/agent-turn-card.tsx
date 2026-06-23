'use client';

import { useMemo, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  Copy,
  FileText,
  MessageCircleDashed,
  TriangleAlert,
} from 'lucide-react';
import { AgentMarkdown } from './agent-markdown';
import { LoadingIndicator, Spinner } from './agent-loading-indicator';
import type {
  AgentSessionMessage,
  LocalAgentProvider,
} from '@/lib/local-agents/types';
import { ScrollArea } from '@/components/ui/scroll-area';

export function AgentTurnCard({
  activities,
  responses,
  changedFilesActivities,
  leadText,
  leadResponses,
  agent,
  isStreaming,
}: {
  activities: AgentSessionMessage[];
  responses: AgentSessionMessage[];
  changedFilesActivities?: AgentSessionMessage[];
  leadText?: string;
  leadResponses?: AgentSessionMessage[];
  agent: LocalAgentProvider;
  isStreaming: boolean;
}) {
  const visibleResponses = responses.filter(
    response => response.text.trim().length > 0,
  );

  return (
    <div className='min-w-0 space-y-2'>
      {leadText ? (
        <div className='text-muted-foreground/90 px-1 text-[13px] leading-relaxed whitespace-pre-wrap'>
          {leadText}
        </div>
      ) : null}
      {activities.length > 0 ? (
        <ActivityStripe
          activities={activities}
          changedFilesActivities={changedFilesActivities}
          agent={agent}
          isStreaming={isStreaming}
        />
      ) : null}
      {leadResponses && leadResponses.length > 0 ? (
        <div className='sr-only'>
          {leadResponses.map(response => response.text).join('\n')}
        </div>
      ) : null}
      {visibleResponses.map(response => (
        <ResponseCard
          key={response.id}
          message={response}
          isStreaming={isStreaming && response.status === 'in_progress'}
        />
      ))}
      {activities.length > 0 && visibleResponses.length === 0 && isStreaming ? (
        <LoadingIndicator
          label={`${getAgentDisplayName(agent)} is working`}
          showElapsed
          className='text-muted-foreground py-1.5 pr-3 text-[13px]'
          spinnerClassName='text-[11px] text-muted-foreground/80'
        />
      ) : null}
    </div>
  );
}

export function ErrorBubble({ message }: { message: AgentSessionMessage }) {
  return (
    <div className='border-destructive/25 bg-destructive/8 text-destructive-foreground rounded-[10px] border px-3 py-2 shadow-sm'>
      <div className='text-destructive mb-1 flex items-center gap-2 text-[13px] font-medium'>
        <TriangleAlert className='size-4' />
        {message.title ?? 'Agent error'}
      </div>
      <pre className='text-destructive/90 text-[12px] whitespace-pre-wrap'>
        {message.text}
      </pre>
    </div>
  );
}

export function SystemLine({
  message,
  kind = 'system',
}: {
  message: AgentSessionMessage;
  kind?: 'system' | 'compaction' | 'status';
}) {
  const isRunning = message.status === 'in_progress';
  if (kind === 'compaction') {
    return (
      <div className='text-muted-foreground/55 flex items-center gap-2 px-3 py-1 text-[12px] select-none'>
        <span className='bg-border/30 h-px flex-1' />
        <span className='flex shrink-0 items-center gap-1.5'>
          {isRunning ? (
            <Spinner className='text-muted-foreground/45 text-[10px]' />
          ) : (
            <MessageCircleDashed className='text-muted-foreground/45 size-3' />
          )}
          <span>{message.text}</span>
        </span>
        <span className='bg-border/30 h-px flex-1' />
      </div>
    );
  }

  return (
    <div className='text-muted-foreground flex items-center gap-2 px-3 py-0.5 text-[12px] select-none'>
      <span className='bg-border/40 h-px flex-1' />
      <span className='shrink-0'>{message.text}</span>
      <span className='bg-border/40 h-px flex-1' />
    </div>
  );
}

function ResponseCard({
  message,
  isStreaming,
}: {
  message: AgentSessionMessage;
  isStreaming: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'rendered' | 'source'>('rendered');
  const visible = useMemo(() => [message], [message]);
  const combinedText = message.text;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(combinedText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1400);
    } catch {
      // Clipboard access can be denied by the browser; keep the transcript quiet.
    }
  };

  return (
    <div className='group relative overflow-visible rounded-[12px]'>
      <div
        aria-hidden
        className='shadow-minimal pointer-events-none absolute inset-0 rounded-[12px]'
        style={{ backgroundColor: 'var(--elevated-surface)' }}
      />
      <ScrollArea
        className='relative max-h-[520px]'
        viewportClassName='max-h-[520px] px-4 pt-1 text-sm select-text text-foreground/90'
        scrollbars='vertical'
      >
        {message.title ? (
          <div className='text-muted-foreground mb-2 flex items-center gap-2 text-[12px]'>
            <FileText className='size-3.5' />
            <span className='truncate'>{message.title}</span>
          </div>
        ) : null}
        {visible.map(response => (
          <div key={response.id}>
            {viewMode === 'source' ? (
              <pre className='py-2 font-sans break-words whitespace-pre-wrap'>
                {response.text}
              </pre>
            ) : (
              <AgentMarkdown className='text-[14px]'>
                {response.text}
              </AgentMarkdown>
            )}
          </div>
        ))}
      </ScrollArea>
      <div className='relative flex items-center gap-3 px-4 py-2 text-[13px]'>
        {isStreaming ? (
          <div className='text-muted-foreground flex items-center gap-1.5'>
            <Spinner className='text-[10px]' />
            <span>Streaming...</span>
          </div>
        ) : (
          <>
            <button
              type='button'
              onClick={handleCopy}
              className='text-foreground/40 hover:text-foreground/80 flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:underline'
            >
              {copied ? (
                <>
                  <CheckCircle2 className='size-3' />
                  <span>Copied</span>
                </>
              ) : (
                <>
                  <Copy className='size-3' />
                  <span>Copy</span>
                </>
              )}
            </button>
            <button
              type='button'
              onClick={() =>
                setViewMode(current =>
                  current === 'source' ? 'rendered' : 'source',
                )
              }
              className='text-foreground/40 hover:text-foreground/80 flex items-center gap-1.5 transition-colors focus:outline-none focus-visible:underline'
              title={
                viewMode === 'source' ? 'Show rendered' : 'Show raw markdown'
              }
            >
              <FileText className='size-3' />
              <span>Markdown</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}

function ActivityStripe({
  activities,
  changedFilesActivities,
  agent,
  isStreaming,
}: {
  activities: AgentSessionMessage[];
  changedFilesActivities?: AgentSessionMessage[];
  agent: LocalAgentProvider;
  isStreaming: boolean;
}) {
  const primary = activities[0];
  const visibleActivities = changedFilesActivities ?? activities;
  const completed = activities.every(
    activity => activity.status === 'completed',
  );
  const failed = activities.some(activity => activity.status === 'failed');

  return (
    <div className='shadow-minimal bg-foreground/[0.035] rounded-[10px] px-2 py-1.5 select-none'>
      <div className='flex min-w-0 items-center gap-2'>
        <ActivityStateIcon
          failed={failed}
          completed={completed}
          running={
            isStreaming || activities.some(a => a.status === 'in_progress')
          }
        />
        <span className='text-foreground/90 min-w-0 flex-1 truncate text-[12px] font-medium'>
          {primary?.title || getAgentActivityLabel(agent)}
        </span>
        {visibleActivities.length > 1 ? (
          <span className='text-muted-foreground/70 bg-background/60 rounded px-1.5 py-0.5 text-[10px]'>
            {visibleActivities.length}
          </span>
        ) : null}
        <ChevronRight className='text-muted-foreground/50 size-3.5' />
      </div>
      <div className='mt-1 space-y-1 pl-6'>
        {visibleActivities.slice(0, 4).map(activity => (
          <div
            key={activity.id}
            className='text-muted-foreground/75 flex min-w-0 items-start gap-2 text-[11.5px]'
          >
            <Code2 className='mt-0.5 size-3 shrink-0' />
            <span className='min-w-0 flex-1 truncate'>
              {activity.title ? `${activity.title}: ` : null}
              {activity.text || activity.metadata || activity.role}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ActivityStateIcon({
  failed,
  completed,
  running,
}: {
  failed: boolean;
  completed: boolean;
  running: boolean;
}) {
  if (failed) return <TriangleAlert className='text-destructive size-4' />;
  if (running)
    return <Spinner className='text-muted-foreground size-4 text-[13px]' />;
  if (completed) return <CheckCircle2 className='size-4 text-emerald-500' />;
  return <Circle className='text-muted-foreground size-4' />;
}

function getAgentActivityLabel(agent: LocalAgentProvider) {
  return `${getAgentDisplayName(agent)} activity`;
}

function getAgentDisplayName(agent: LocalAgentProvider) {
  if (agent === 'claude_code') return 'Claude Code';
  if (agent === 'cursor') return 'Cursor';
  if (agent === 'copilot') return 'GitHub Copilot';
  if (agent === 'opencode') return 'OpenCode';
  if (agent === 'pi') return 'Pi';
  return 'Codex';
}
