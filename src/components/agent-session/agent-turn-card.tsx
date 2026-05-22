'use client';

import { Code2, Sparkles, TriangleAlert } from 'lucide-react';
import { AgentMarkdown } from './agent-markdown';
import { cn } from '@/lib/utils';
import { formatDateHuman } from '@/lib/date';
import type { AgentSessionMessage } from '@/lib/local-agents/types';

export function AgentTurnCard({
  message,
  isFirst,
}: {
  message: AgentSessionMessage;
  isFirst: boolean;
}) {
  if (message.role === 'status') {
    return (
      <div
        className={cn(
          'flex items-center gap-3 px-3 py-1.5',
          !isFirst && 'border-t',
        )}
      >
        <div className='bg-muted flex size-5 shrink-0 items-center justify-center rounded-full'>
          <Sparkles className='text-muted-foreground size-3' />
        </div>
        <span className='text-muted-foreground min-w-0 flex-1 text-xs italic'>
          {message.text}
        </span>
        <span className='text-muted-foreground shrink-0 text-xs'>
          {formatDateHuman(new Date(message.createdAt))}
        </span>
      </div>
    );
  }

  if (message.role === 'tool') {
    return (
      <div className={cn('px-3 py-2', !isFirst && 'border-t')}>
        <div className='bg-muted/40 rounded-md border px-2.5 py-2'>
          <div className='text-muted-foreground mb-1 flex items-center gap-2 font-mono text-xs'>
            <Code2 className='size-3.5' />
            <span className='min-w-0 truncate'>{message.title ?? 'Tool'}</span>
            {message.status ? (
              <span className='ml-auto shrink-0'>{message.status}</span>
            ) : null}
          </div>
          <pre className='max-h-48 overflow-auto font-mono text-xs whitespace-pre-wrap'>
            {message.text}
          </pre>
        </div>
      </div>
    );
  }

  if (message.role === 'error') {
    return (
      <div className={cn('px-3 py-2', !isFirst && 'border-t')}>
        <div className='border-destructive/30 bg-destructive/5 text-destructive rounded-md border px-2.5 py-2 text-sm'>
          <div className='mb-1 flex items-center gap-2 font-medium'>
            <TriangleAlert className='size-4' />
            {message.title ?? 'Agent error'}
          </div>
          <pre className='text-xs whitespace-pre-wrap'>{message.text}</pre>
        </div>
      </div>
    );
  }

  if (message.role === 'reasoning' || message.role === 'compaction') {
    return (
      <div className={cn('px-3 py-2', !isFirst && 'border-t')}>
        <div className='text-muted-foreground bg-muted/30 rounded-md px-2.5 py-2 text-xs leading-relaxed whitespace-pre-wrap italic'>
          {message.text}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('px-3 py-2', !isFirst && 'border-t')}>
      <div className='flex items-start justify-between gap-3'>
        <AgentMarkdown className='min-w-0 flex-1 text-sm'>
          {message.text}
        </AgentMarkdown>
        <span className='text-muted-foreground shrink-0 text-xs'>
          {formatDateHuman(new Date(message.createdAt))}
        </span>
      </div>
    </div>
  );
}
