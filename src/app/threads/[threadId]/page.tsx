'use client';

import { useParams } from 'next/navigation';
import { useMemo } from 'react';
import { useQuery } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { type UIMessage, useUIMessages } from '@convex-dev/agent/react';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ProgressiveBlur } from '@/components/ui/progressive-blur';
import { Skeleton } from '@/components/ui/skeleton';
import { AssistantDockMessage } from '@/components/assistant/assistant-message-renderer';
import { Loader2, Lock } from 'lucide-react';
import Avvvatars from 'avvvatars-react';
import { useBranding } from '@/hooks/use-branding';

export default function PublicThreadPage() {
  const { threadId: threadIdParam } = useParams<{ threadId: string }>();
  const assistantThreadId = threadIdParam as Id<'assistantThreads'>;
  const branding = useBranding();

  const threadQuery = useQuery(api.ai.queries.getPublicThread, {
    threadId: assistantThreadId,
  });
  const threadRow = threadQuery.data;

  const agentThreadId = threadRow?.threadId;
  const uiMessages = useUIMessages(
    api.ai.queries.listPublicThreadMessages,
    agentThreadId ? { threadId: agentThreadId } : 'skip',
    { initialNumItems: 40, stream: false },
  );
  const messages = useMemo(
    () => (uiMessages.results ?? []) as UIMessage[],
    [uiMessages.results],
  );

  if (threadQuery.isPending) {
    return (
      <div className='bg-background flex h-dvh items-center justify-center'>
        <Loader2 className='text-muted-foreground size-5 animate-spin' />
      </div>
    );
  }

  if (!threadRow) {
    return (
      <div className='bg-background flex h-dvh flex-col items-center justify-center gap-3'>
        <Lock className='text-muted-foreground size-8 opacity-40' />
        <p className='text-muted-foreground text-sm'>
          This thread is private or does not exist.
        </p>
      </div>
    );
  }

  return (
    <div className='bg-background relative flex h-dvh min-h-0 flex-col overflow-hidden'>
      {/* Header */}
      <div className='absolute top-0 right-0 left-0 z-50 p-2 px-3'>
        <ProgressiveBlur
          direction='top'
          blurLayers={10}
          blurIntensity={0.8}
          bgGradient
          className='pointer-events-none absolute inset-0 h-20'
        />
        <div className='relative z-[100] flex items-center gap-2'>
          <Avvvatars
            value={`thread-${assistantThreadId}`.toLowerCase()}
            style='shape'
            size={22}
            shadow={false}
            radius={999}
          />
          <span className='truncate text-sm font-medium'>
            {threadRow.title || 'Untitled Thread'}
          </span>
          <span className='text-muted-foreground ml-auto text-xs'>
            {branding.name}
          </span>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className='h-full w-full flex-1'>
        <div className='mx-auto max-w-[700px] space-y-3 px-4 pt-16 pb-8'>
          {uiMessages.status === 'CanLoadMore' && (
            <div className='flex justify-center py-2'>
              <Button
                variant='ghost'
                size='sm'
                className='text-muted-foreground h-7 text-xs'
                onClick={() => uiMessages.loadMore(40)}
              >
                Load older messages
              </Button>
            </div>
          )}
          {uiMessages.status === 'LoadingMore' && (
            <div className='flex justify-center py-2'>
              <Loader2 className='text-muted-foreground size-4 animate-spin' />
            </div>
          )}
          {messages.length === 0 && !threadQuery.isPending && (
            <div className='text-muted-foreground flex items-center justify-center py-20 text-sm'>
              No messages in this thread.
            </div>
          )}
          {messages.map(message => (
            <div
              key={`${message.role}-${message.id ?? `${message.order}-${message.stepOrder}`}`}
              data-message-role={message.role}
            >
              <AssistantDockMessage message={message} />
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}
