'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { QueuedAgentMessage } from '@/lib/local-agents/types';

export function AgentQueueReporter({
  messages,
  onCancel,
  onClear,
}: {
  messages: QueuedAgentMessage[];
  onCancel: (id: string) => void;
  onClear: () => void;
}) {
  if (messages.length === 0) return null;

  return (
    <div className='border-t px-3 py-2'>
      <div className='mb-1 flex items-center justify-between gap-2'>
        <span className='text-muted-foreground text-xs'>
          Queued messages ({messages.length})
        </span>
        <Button size='xs' variant='ghost' onClick={onClear}>
          Clear
        </Button>
      </div>
      <div className='space-y-1'>
        {messages.map(message => (
          <div
            key={message.id}
            className='bg-muted/40 flex items-center gap-2 rounded-md px-2 py-1 text-xs'
          >
            <span className='text-muted-foreground shrink-0'>
              {message.mode}
            </span>
            <span className='min-w-0 flex-1 truncate'>{message.text}</span>
            <Button
              size='icon'
              variant='ghost'
              className='size-5'
              onClick={() => onCancel(message.id)}
            >
              <X className='size-3' />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
