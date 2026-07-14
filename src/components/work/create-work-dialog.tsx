'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Plus } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { api, useMutation } from '@/lib/convex';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';
import { MemberPicker } from './member-picker';

export function CreateWorkDialog({
  orgSlug,
  requestId,
  projectId,
  teamId,
  defaultTitle = '',
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  orgSlug: string;
  requestId?: Id<'requests'>;
  projectId?: Id<'projects'>;
  teamId?: Id<'teams'>;
  defaultTitle?: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [title, setTitle] = useState(defaultTitle);
  const [workpad, setWorkpad] = useState('');
  const [owners, setOwners] = useState<Id<'users'>[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const createWork = useMutation(api.work.mutations.create);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    try {
      const result = await createWork({
        orgSlug,
        data: {
          title,
          description: workpad || undefined,
          ownerId: owners[0],
          projectId,
          teamId,
          requestIds: requestId ? [requestId] : undefined,
        },
      });
      toast.success(
        <Link href={`/${orgSlug}/work/${result.workKey}`}>
          Work {result.workKey} created
        </Link>,
      );
      setOpen(false);
      setTitle(defaultTitle);
      setWorkpad('');
      setOwners([]);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not create Work',
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' className='h-7 gap-1.5 px-2 text-xs'>
            <Plus className='size-3.5' />
            Work
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className='max-w-lg p-0'>
        <ResponsiveDialogHeader className='border-b px-4 py-3'>
          <ResponsiveDialogTitle className='text-sm'>
            Create Work
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='text-xs'>
            Create an outcome container. The owner starts it intentionally when
            ready.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={submit} className='space-y-4 p-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='work-title' className='text-xs'>
              Outcome
            </Label>
            <Input
              id='work-title'
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder='What outcome will this Work deliver?'
              className='h-8 text-sm'
              autoFocus
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='workpad' className='text-xs'>
              Initial workpad
            </Label>
            <Textarea
              id='workpad'
              value={workpad}
              onChange={event => setWorkpad(event.target.value)}
              placeholder='Notes, early approach, or context'
              className='min-h-24 resize-y text-sm'
            />
          </div>
          <div className='flex items-center justify-between gap-3 border-t pt-3'>
            <MemberPicker
              orgSlug={orgSlug}
              value={owners}
              onChange={setOwners}
              placeholder='No owner yet'
            />
            <div className='flex items-center gap-2'>
              <Button
                type='button'
                variant='ghost'
                size='sm'
                className='h-7 text-xs'
                onClick={() => setOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type='submit'
                size='sm'
                className='h-7 text-xs'
                disabled={submitting || !title.trim()}
              >
                Create Work
              </Button>
            </div>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
