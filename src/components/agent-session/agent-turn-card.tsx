'use client';

import {
  CheckCircle2,
  ChevronRight,
  Circle,
  Code2,
  FileText,
  Loader2,
  MessageCircleDashed,
  Sparkles,
  TriangleAlert,
} from 'lucide-react';
import { AgentMarkdown } from './agent-markdown';
import type {
  AgentSessionMessage,
  LocalAgentProvider,
} from '@/lib/local-agents/types';

export function AgentTurnCard({
  activities,
  responses,
  leadText,
  agent,
  isStreaming,
}: {
  activities: AgentSessionMessage[];
  responses: AgentSessionMessage[];
  leadText?: string;
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
          agent={agent}
          isStreaming={isStreaming}
        />
      ) : null}
      {visibleResponses.map(response => (
        <ResponseCard
          key={response.id}
          message={response}
          isStreaming={isStreaming && response.status === 'in_progress'}
        />
      ))}
      {activities.length > 0 && visibleResponses.length === 0 && isStreaming ? (
        <div className='text-muted-foreground/80 flex items-center gap-2 px-1 py-1 text-[12px]'>
          <Loader2 className='size-3.5 animate-spin' />
          <span>{getAgentDisplayName(agent)} is working</span>
        </div>
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
  const Icon =
    kind === 'compaction'
      ? MessageCircleDashed
      : kind === 'status'
        ? Sparkles
        : Circle;
  return (
    <div className='text-muted-foreground/80 flex items-center gap-2 px-1 py-1.5 text-[12px]'>
      <span className='bg-foreground/6 flex size-6 shrink-0 items-center justify-center rounded-full'>
        <Icon className='size-3.5' />
      </span>
      <span className='min-w-0 flex-1 truncate italic'>{message.text}</span>
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
  return (
    <div className='bg-background/70 ring-border/45 rounded-[12px] px-4 py-3 shadow-sm ring-1'>
      {message.title ? (
        <div className='text-muted-foreground mb-2 flex items-center gap-2 text-[12px]'>
          <FileText className='size-3.5' />
          <span className='truncate'>{message.title}</span>
        </div>
      ) : null}
      <AgentMarkdown className='text-[14px]'>{message.text}</AgentMarkdown>
      {isStreaming ? (
        <div className='text-muted-foreground mt-2 inline-flex items-center gap-1.5 text-[11px]'>
          <Loader2 className='size-3 animate-spin' />
          streaming
        </div>
      ) : null}
    </div>
  );
}

function ActivityStripe({
  activities,
  agent,
  isStreaming,
}: {
  activities: AgentSessionMessage[];
  agent: LocalAgentProvider;
  isStreaming: boolean;
}) {
  const primary = activities[0];
  const completed = activities.every(
    activity => activity.status === 'completed',
  );
  const failed = activities.some(activity => activity.status === 'failed');

  return (
    <div className='bg-foreground/[0.035] ring-border/35 rounded-[10px] px-2 py-1.5 shadow-sm ring-1 select-none'>
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
        {activities.length > 1 ? (
          <span className='text-muted-foreground/70 bg-background/60 rounded px-1.5 py-0.5 text-[10px]'>
            {activities.length}
          </span>
        ) : null}
        <ChevronRight className='text-muted-foreground/50 size-3.5' />
      </div>
      {primary?.text ? (
        <div className='text-muted-foreground/75 mt-1 flex min-w-0 items-start gap-2 pl-6 text-[11.5px]'>
          <Code2 className='mt-0.5 size-3 shrink-0' />
          <span className='line-clamp-2 min-w-0 whitespace-pre-wrap'>
            {primary.text}
          </span>
        </div>
      ) : null}
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
    return <Loader2 className='text-muted-foreground size-4 animate-spin' />;
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
