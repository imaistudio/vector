'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { api, useCachedQuery, useMutation, useAction } from '@/lib/convex';
import { Button } from '@/components/ui/button';
import {
  Globe,
  Building,
  Loader2,
  Lock,
  MessageSquare,
  Plus,
  Trash2,
} from 'lucide-react';
import Avvvatars from 'avvvatars-react';
import { formatDateHuman } from '@/lib/date';
import { useConfirm } from '@/hooks/use-confirm';
import { toast } from 'sonner';

export function ThreadsListPage() {
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const router = useRouter();
  const [confirmAction, ConfirmDialog] = useConfirm();

  const threads = useCachedQuery(api.ai.queries.listMyThreads, { orgSlug });
  const createThread = useMutation(api.ai.mutations.createThread);
  const clearThread = useAction(api.ai.actions.clearThreadHistory);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const displayThreads = threads ?? [];

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const thread = await createThread({ orgSlug });
      if (thread?._id) {
        router.push(`/${orgSlug}/threads/${thread._id}`);
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to create thread',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const handleDelete = async (threadId: any) => {
    const ok = await confirmAction({
      title: 'Delete thread',
      description:
        'This will permanently delete this thread and all its messages.',
      confirmLabel: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;

    setDeletingId(threadId);
    try {
      await clearThread({ orgSlug, threadId });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to delete thread',
      );
    } finally {
      setDeletingId(null);
    }
  };

  const VisibilityIcon = ({ visibility }: { visibility?: string | null }) => {
    switch (visibility) {
      case 'public':
        return <Globe className='size-3 text-emerald-500' />;
      case 'organization':
        return <Building className='size-3 text-blue-500' />;
      default:
        return <Lock className='size-3 text-purple-500' />;
    }
  };

  return (
    <div className='flex h-full w-full min-w-0 flex-col'>
      {/* Header */}
      <div className='border-border flex items-center justify-between border-b px-6 py-4'>
        <div>
          <h1 className='text-lg font-semibold'>Threads</h1>
          <p className='text-muted-foreground text-sm'>
            Your assistant conversations
          </p>
        </div>
        <Button onClick={handleCreate} disabled={isCreating} size='sm'>
          {isCreating ? (
            <Loader2 className='mr-1.5 size-3.5 animate-spin' />
          ) : (
            <Plus className='mr-1.5 size-3.5' />
          )}
          New Thread
        </Button>
      </div>

      {/* Thread list */}
      <div className='min-w-0 flex-1 overflow-x-hidden overflow-y-auto'>
        {!threads ? (
          <div className='flex items-center justify-center py-12'>
            <Loader2 className='text-muted-foreground size-5 animate-spin' />
          </div>
        ) : displayThreads.length === 0 ? (
          <div className='text-muted-foreground flex flex-col items-center justify-center gap-2 py-12 text-sm'>
            <MessageSquare className='size-8 opacity-40' />
            <span>No threads yet. Start a new conversation.</span>
          </div>
        ) : (
          <div className='divide-border w-full max-w-full min-w-0 divide-y overflow-x-hidden'>
            {displayThreads.map(thread => (
              <div
                key={thread._id}
                className='hover:bg-muted/50 group flex w-full max-w-full min-w-0 items-center gap-3 px-6 py-3 transition-colors'
              >
                <Link
                  href={`/${orgSlug}/threads/${thread._id}`}
                  className='flex min-w-0 flex-1 items-center gap-3'
                >
                  <span className='flex size-[22px] shrink-0 items-center justify-center'>
                    <Avvvatars
                      value={`thread-${thread._id}`.toLowerCase()}
                      style='shape'
                      size={22}
                      shadow={false}
                      radius={999}
                    />
                  </span>
                  <div className='min-w-0 flex-1'>
                    <div className='flex min-w-0 items-center gap-2'>
                      <span className='min-w-0 flex-1 truncate text-sm font-medium'>
                        {thread.title || 'Untitled Thread'}
                      </span>
                      <VisibilityIcon visibility={thread.visibility} />
                    </div>
                    <span className='text-muted-foreground text-xs'>
                      {formatDateHuman(new Date(thread.updatedAt))}
                    </span>
                  </div>
                </Link>
                <button
                  type='button'
                  onClick={() => void handleDelete(thread._id)}
                  disabled={deletingId === thread._id}
                  className='text-muted-foreground hover:text-destructive flex size-7 shrink-0 items-center justify-center rounded opacity-0 transition-all group-hover:opacity-100 disabled:opacity-50'
                  aria-label='Delete thread'
                >
                  {deletingId === thread._id ? (
                    <Loader2 className='size-3.5 animate-spin' />
                  ) : (
                    <Trash2 className='size-3.5' />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog />
    </div>
  );
}
