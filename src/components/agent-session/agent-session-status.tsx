'use client';

import { Circle, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AgentSessionSnapshot } from '@/lib/local-agents/types';
import { cn } from '@/lib/utils';

export function AgentSessionStatus({
  snapshot,
  onStop,
  onResume,
}: {
  snapshot: AgentSessionSnapshot;
  onStop: () => void;
  onResume: () => void;
}) {
  const terminal = ['completed', 'failed', 'canceled', 'disconnected'].includes(
    snapshot.status,
  );
  return (
    <div className='flex items-center gap-2 border-b px-3 py-1.5 text-xs'>
      <Circle
        className={cn(
          'size-2.5 fill-current',
          snapshot.status === 'active'
            ? 'text-green-500'
            : snapshot.status === 'failed'
              ? 'text-destructive'
              : 'text-muted-foreground',
        )}
      />
      <span className='text-muted-foreground min-w-0 flex-1 truncate'>
        {snapshot.title}
      </span>
      <span className='text-muted-foreground shrink-0'>{snapshot.status}</span>
      {!terminal ? (
        <Button size='xs' variant='ghost' className='h-6' onClick={onStop}>
          <Square className='size-3' />
          Stop
        </Button>
      ) : (
        <Button size='xs' variant='ghost' className='h-6' onClick={onResume}>
          Resume
        </Button>
      )}
    </div>
  );
}
