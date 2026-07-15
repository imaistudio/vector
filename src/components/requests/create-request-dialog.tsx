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
import { BarsSpinner } from '@/components/bars-spinner';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';
import { MemberPicker } from '@/components/work/member-picker';
import { TeamPicker } from '@/components/work/team-picker';

export function CreateRequestDialog({
  orgSlug,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  orgSlug: string;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [reviewGuidance, setReviewGuidance] = useState('');
  const [recipients, setRecipients] = useState<Id<'users'>[]>([]);
  const [routedTeamId, setRoutedTeamId] = useState<Id<'teams'>>();
  const [submitting, setSubmitting] = useState(false);
  const createRequest = useMutation(api.requests.mutations.create);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!title.trim() || !expectedOutput.trim()) return;
    setSubmitting(true);
    try {
      const result = await createRequest({
        orgSlug,
        data: {
          title,
          description: description || undefined,
          expectedOutput,
          reviewGuidance: reviewGuidance || undefined,
          recipientIds: recipients,
          routedTeamId,
        },
      });
      toast.success(
        <Link href={`/${orgSlug}/requests/${result.requestKey}`}>
          Request {result.requestKey} created
        </Link>,
      );
      setTitle('');
      setDescription('');
      setExpectedOutput('');
      setReviewGuidance('');
      setRecipients([]);
      setRoutedTeamId(undefined);
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Could not create request',
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
            Request
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        showCloseButton={false}
        className='gap-2 p-2 sm:max-w-2xl'
      >
        <ResponsiveDialogHeader className='sr-only'>
          <ResponsiveDialogTitle>Create request</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={submit} className='space-y-2'>
          <div className='relative'>
            <Input
              id='request-title'
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder='What do you need?'
              className='h-9 pr-24 text-base'
              autoFocus
              disabled={submitting}
            />
            <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
              Request
            </span>
          </div>

          <div className='flex flex-wrap items-center gap-2'>
            <MemberPicker
              orgSlug={orgSlug}
              value={recipients}
              onChange={setRecipients}
              multiple
              placeholder='Route to people'
              disabled={submitting}
            />
            <TeamPicker
              orgSlug={orgSlug}
              value={routedTeamId}
              onChange={setRoutedTeamId}
              disabled={submitting}
            />
            <span className='text-muted-foreground ml-auto text-xs'>
              Routing does not start Work
            </span>
          </div>

          <div className='relative'>
            <Textarea
              id='request-context'
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder='Background, constraints, links, or examples'
              className='min-h-24 resize-none pr-24 pb-8 text-sm'
              disabled={submitting}
            />
            <span className='text-muted-foreground bg-background pointer-events-none absolute right-2 bottom-2 rounded px-2 py-0.5 text-xs'>
              Context
            </span>
          </div>

          <div className='relative'>
            <Textarea
              id='request-output'
              value={expectedOutput}
              onChange={event => setExpectedOutput(event.target.value)}
              placeholder='What should be true when this is delivered?'
              className='min-h-20 resize-none pr-32 pb-8 text-sm'
              required
              disabled={submitting}
            />
            <span className='text-muted-foreground bg-background pointer-events-none absolute right-2 bottom-2 rounded px-2 py-0.5 text-xs'>
              Expected output <span className='text-destructive'>*</span>
            </span>
          </div>

          <div className='relative'>
            <Input
              id='request-review'
              value={reviewGuidance}
              onChange={event => setReviewGuidance(event.target.value)}
              placeholder='Anything the reviewer should verify'
              className='h-9 pr-36 text-sm'
              disabled={submitting}
            />
            <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
              Review guidance
            </span>
          </div>
        </form>

        <div className='flex w-full flex-row items-center justify-between gap-2'>
          <Button
            type='button'
            variant='ghost'
            size='sm'
            disabled={submitting}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            type='button'
            size='sm'
            disabled={submitting || !title.trim() || !expectedOutput.trim()}
            onClick={submit}
          >
            {submitting ? <BarsSpinner size={14} /> : 'Create request'}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
