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
      <ResponsiveDialogContent className='max-w-xl p-0'>
        <ResponsiveDialogHeader className='border-b px-4 py-3'>
          <ResponsiveDialogTitle className='text-sm'>
            New request
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='text-xs'>
            Describe the outcome first. Routing does not start Work.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <form onSubmit={submit} className='space-y-4 p-4'>
          <div className='space-y-1.5'>
            <Label htmlFor='request-title' className='text-xs'>
              Request
            </Label>
            <Input
              id='request-title'
              value={title}
              onChange={event => setTitle(event.target.value)}
              placeholder='What do you need?'
              className='h-8 text-sm'
              autoFocus
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='request-context' className='text-xs'>
              Context
            </Label>
            <Textarea
              id='request-context'
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder='Background, constraints, links, or examples'
              className='min-h-20 resize-y text-sm'
            />
          </div>
          <div className='bg-muted/40 space-y-1.5 rounded-md border p-3'>
            <Label htmlFor='request-output' className='text-xs font-medium'>
              Expected output <span className='text-destructive'>*</span>
            </Label>
            <Textarea
              id='request-output'
              value={expectedOutput}
              onChange={event => setExpectedOutput(event.target.value)}
              placeholder='What should be true when this is delivered?'
              className='bg-background min-h-20 resize-y text-sm'
              required
            />
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='request-review' className='text-xs'>
              Review guidance{' '}
              <span className='text-muted-foreground font-normal'>
                (optional)
              </span>
            </Label>
            <Input
              id='request-review'
              value={reviewGuidance}
              onChange={event => setReviewGuidance(event.target.value)}
              placeholder='Anything the reviewer should verify'
              className='h-8 text-sm'
            />
          </div>
          <div className='flex flex-wrap items-center justify-between gap-3 border-t pt-3'>
            <div className='flex flex-wrap items-center gap-2'>
              <MemberPicker
                orgSlug={orgSlug}
                value={recipients}
                onChange={setRecipients}
                multiple
                placeholder='Route to people'
              />
              <TeamPicker
                orgSlug={orgSlug}
                value={routedTeamId}
                onChange={setRoutedTeamId}
              />
            </div>
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
                disabled={submitting || !title.trim() || !expectedOutput.trim()}
              >
                Create request
              </Button>
            </div>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
