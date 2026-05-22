'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function AgentLoadingIndicator() {
  return (
    <div className='space-y-0'>
      {[0, 1, 2].map(i => (
        <div
          key={i}
          className='flex items-start gap-3 border-b px-3 py-2 last:border-b-0'
        >
          <Skeleton className='size-6 rounded-full' />
          <div className='min-w-0 flex-1 space-y-2 py-0.5'>
            <Skeleton className='h-3.5 w-2/5' />
            <Skeleton className='h-3.5 w-full' />
          </div>
        </div>
      ))}
    </div>
  );
}
