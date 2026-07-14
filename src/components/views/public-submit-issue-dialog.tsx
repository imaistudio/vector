'use client';

import Link from 'next/link';
import { useId, useState } from 'react';
import { api, useMutation } from '@/lib/convex';
import { toast } from 'sonner';
import { AlertCircle, ArrowRight, CheckCircle2, Send } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { BarsSpinner } from '@/components/bars-spinner';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogDescription,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';

interface PublicSubmitIssueDialogProps {
  orgSlug: string;
  orgName: string;
  publicIssueViewId?: string | null;
  trigger?: React.ReactNode;
}

type FieldErrors = Partial<{
  title: string;
  description: string;
  expectedOutput: string;
  name: string;
  email: string;
  form: string;
}>;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Map raw Convex / server error tokens to friendlier field-scoped messages.
function mapServerError(message: string): FieldErrors {
  const lower = message.toLowerCase();
  if (lower.includes('invalid_email')) {
    return { email: 'Enter a valid email address.' };
  }
  if (lower.includes('public_requests_disabled')) {
    return { form: 'Public submissions are no longer enabled here.' };
  }
  if (lower.includes('public_submission_project_missing')) {
    return {
      form: 'The configured destination project is missing. Please contact the workspace admin.',
    };
  }
  if (lower.includes('organization_not_found')) {
    return { form: 'Workspace not found.' };
  }
  if (lower.includes('invalid_input')) {
    return {
      form: 'One or more fields are invalid. Please double-check your input.',
    };
  }
  return { form: 'Something went wrong. Please try again.' };
}

export function PublicSubmitIssueDialog({
  orgSlug,
  orgName,
  publicIssueViewId,
  trigger,
}: PublicSubmitIssueDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [expectedOutput, setExpectedOutput] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedKey, setSubmittedKey] = useState<string | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const titleId = useId();
  const descriptionId = useId();
  const expectedOutputId = useId();
  const nameId = useId();
  const emailId = useId();

  const submit = useMutation(api.requests.mutations.createPublic);

  const resetForm = () => {
    setTitle('');
    setDescription('');
    setExpectedOutput('');
    setName('');
    setEmail('');
    setSubmittedKey(null);
    setErrors({});
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      // Defer reset so the success state is visible until the dialog
      // fully closes, matching the pattern used in other Vector dialogs.
      setTimeout(resetForm, 200);
    }
  };

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      next.title = 'Please enter a title.';
    } else if (trimmedTitle.length > 200) {
      next.title = 'Title is too long (200 characters max).';
    }
    if (description.trim().length > 10_000) {
      next.description = 'Description is too long (10,000 characters max).';
    }
    if (!expectedOutput.trim()) {
      next.expectedOutput = 'Describe the output you expect.';
    } else if (expectedOutput.trim().length > 10_000) {
      next.expectedOutput =
        'Expected output is too long (10,000 characters max).';
    }
    if (name.trim().length > 120) {
      next.name = 'Name is too long (120 characters max).';
    }
    const trimmedEmail = email.trim();
    if (trimmedEmail && !EMAIL_REGEX.test(trimmedEmail)) {
      next.email = 'Enter a valid email address.';
    }
    if (trimmedEmail.length > 200) {
      next.email = 'Email is too long (200 characters max).';
    }
    return next;
  };

  const handleSubmit = async () => {
    const localErrors = validate();
    if (Object.keys(localErrors).length > 0) {
      setErrors(localErrors);
      return;
    }
    setErrors({});

    setIsSubmitting(true);
    try {
      const result = await submit({
        orgSlug,
        title: title.trim(),
        description: description.trim() || undefined,
        expectedOutput: expectedOutput.trim(),
        requesterName: name.trim(),
        requesterEmail: email.trim(),
      });
      setSubmittedKey(result.requestKey);
      toast.success('Request submitted');
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to submit request';
      setErrors(mapServerError(message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' className='h-8 gap-1.5'>
            <Send className='size-3.5' />
            Submit a request
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className='gap-0 overflow-hidden p-0 sm:max-w-xl'>
        <ResponsiveDialogHeader className='border-border/70 border-b px-4 py-3 text-left'>
          <ResponsiveDialogTitle className='flex items-center gap-2 text-base'>
            <span className='bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md border'>
              {submittedKey ? (
                <CheckCircle2 className='size-3.5 text-emerald-500' />
              ) : (
                <Send className='size-3.5' />
              )}
            </span>
            {submittedKey
              ? 'Request submitted'
              : `Submit a request to ${orgName}`}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='max-w-md text-xs leading-5'>
            {submittedKey
              ? 'Your request is now visible to the workspace.'
              : 'Share the request publicly. Add contact details only if you want a reply.'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {submittedKey ? (
          <div className='px-4 py-4'>
            <div className='border-border bg-muted/20 flex items-start gap-3 rounded-lg border px-3 py-3'>
              <CheckCircle2 className='mt-0.5 size-5 shrink-0 text-emerald-500' />
              <div className='min-w-0 space-y-1'>
                <div className='text-sm font-medium'>Thanks, got it.</div>
                <div className='text-muted-foreground text-xs'>
                  Tracking ID:{' '}
                  <span className='font-mono tabular-nums'>{submittedKey}</span>
                </div>
              </div>
            </div>
            <div className='mt-4 flex flex-wrap items-center justify-between gap-2'>
              <Button
                type='button'
                size='sm'
                variant='ghost'
                className='h-8'
                onClick={() => {
                  resetForm();
                }}
              >
                Submit another
              </Button>
              {publicIssueViewId ? (
                <Link
                  href={`/${orgSlug}/views/${publicIssueViewId}/public`}
                  className={cn(buttonVariants({ size: 'sm' }), 'h-8 gap-1.5')}
                  onClick={() => handleOpenChange(false)}
                >
                  View all requests
                  <ArrowRight className='size-3.5' />
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <form
            className='space-y-3 px-4 py-3'
            onSubmit={event => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            {errors.form ? (
              <div className='border-destructive/30 bg-destructive/5 text-destructive flex items-start gap-2 rounded-md border px-2.5 py-1.5 text-[11px]'>
                <AlertCircle className='mt-0.5 size-3.5 shrink-0' />
                <span>{errors.form}</span>
              </div>
            ) : null}

            <div className='space-y-1'>
              <label htmlFor={titleId} className='sr-only'>
                Title
              </label>
              <div className='relative'>
                <Input
                  id={titleId}
                  value={title}
                  onChange={event => {
                    setTitle(event.target.value);
                    if (errors.title) {
                      setErrors(prev => ({ ...prev, title: undefined }));
                    }
                  }}
                  placeholder='Short summary of the request'
                  className={cn(
                    'h-9 pr-24 text-base md:text-sm',
                    errors.title &&
                      'border-destructive focus-visible:ring-destructive/30',
                  )}
                  aria-invalid={errors.title ? true : undefined}
                  maxLength={200}
                  disabled={isSubmitting}
                  autoFocus
                />
                <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
                  Title <span className='text-destructive'>*</span>
                </span>
              </div>
              {errors.title ? (
                <p className='text-destructive text-[11px]'>{errors.title}</p>
              ) : null}
            </div>

            <div className='space-y-1'>
              <label htmlFor={expectedOutputId} className='sr-only'>
                Expected output
              </label>
              <div className='relative'>
                <Textarea
                  id={expectedOutputId}
                  value={expectedOutput}
                  onChange={event => {
                    setExpectedOutput(event.target.value);
                    if (errors.expectedOutput)
                      setErrors(prev => ({
                        ...prev,
                        expectedOutput: undefined,
                      }));
                  }}
                  placeholder='What should be true when this request is delivered?'
                  className={cn(
                    'min-h-[96px] resize-none pb-8 text-base md:text-sm',
                    errors.expectedOutput &&
                      'border-destructive focus-visible:ring-destructive/30',
                  )}
                  aria-invalid={errors.expectedOutput ? true : undefined}
                  maxLength={10_000}
                  disabled={isSubmitting}
                />
                <span className='text-muted-foreground bg-background pointer-events-none absolute right-2 bottom-2 rounded px-2 py-0.5 text-xs'>
                  Expected output <span className='text-destructive'>*</span>
                </span>
              </div>
              {errors.expectedOutput ? (
                <p className='text-destructive text-[11px]'>
                  {errors.expectedOutput}
                </p>
              ) : null}
            </div>

            <div className='space-y-1'>
              <label htmlFor={descriptionId} className='sr-only'>
                Description
              </label>
              <div className='relative'>
                <Textarea
                  id={descriptionId}
                  value={description}
                  onChange={event => {
                    setDescription(event.target.value);
                    if (errors.description) {
                      setErrors(prev => ({
                        ...prev,
                        description: undefined,
                      }));
                    }
                  }}
                  placeholder='Context, expected behavior, screenshots...'
                  className={cn(
                    'min-h-[128px] resize-none pb-8 text-base md:text-sm',
                    errors.description &&
                      'border-destructive focus-visible:ring-destructive/30',
                  )}
                  aria-invalid={errors.description ? true : undefined}
                  maxLength={10_000}
                  disabled={isSubmitting}
                />
                <span className='text-muted-foreground bg-background pointer-events-none absolute right-2 bottom-2 rounded px-2 py-0.5 text-xs'>
                  Description
                </span>
              </div>
              {errors.description ? (
                <p className='text-destructive text-[11px]'>
                  {errors.description}
                </p>
              ) : null}
            </div>

            <div className='grid gap-2 sm:grid-cols-2'>
              <div className='space-y-1'>
                <label htmlFor={nameId} className='sr-only'>
                  Your name
                </label>
                <div className='relative'>
                  <Input
                    id={nameId}
                    value={name}
                    onChange={event => {
                      setName(event.target.value);
                      if (errors.name) {
                        setErrors(prev => ({ ...prev, name: undefined }));
                      }
                    }}
                    placeholder='Jane Doe'
                    className={cn(
                      'h-9 pr-24 text-base md:text-sm',
                      errors.name &&
                        'border-destructive focus-visible:ring-destructive/30',
                    )}
                    aria-invalid={errors.name ? true : undefined}
                    maxLength={120}
                    disabled={isSubmitting}
                  />
                  <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
                    Name
                  </span>
                </div>
                {errors.name ? (
                  <p className='text-destructive text-[11px]'>{errors.name}</p>
                ) : null}
              </div>
              <div className='space-y-1'>
                <label htmlFor={emailId} className='sr-only'>
                  Email
                </label>
                <div className='relative'>
                  <Input
                    id={emailId}
                    type='email'
                    value={email}
                    onChange={event => {
                      setEmail(event.target.value);
                      if (errors.email) {
                        setErrors(prev => ({ ...prev, email: undefined }));
                      }
                    }}
                    placeholder='you@example.com'
                    className={cn(
                      'h-9 pr-24 text-base md:text-sm',
                      errors.email &&
                        'border-destructive focus-visible:ring-destructive/30',
                    )}
                    aria-invalid={errors.email ? true : undefined}
                    maxLength={200}
                    disabled={isSubmitting}
                  />
                  <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
                    Email
                  </span>
                </div>
                {errors.email ? (
                  <p className='text-destructive text-[11px]'>{errors.email}</p>
                ) : null}
              </div>
            </div>

            <div className='border-border/70 -mx-4 mt-1 flex flex-col gap-2 border-t px-4 pt-3 sm:flex-row sm:items-center sm:justify-between'>
              <p className='text-muted-foreground min-w-0 text-xs'>
                Contact fields are optional.
              </p>
              <div className='flex shrink-0 items-center justify-end gap-2'>
                <Button
                  type='button'
                  variant='ghost'
                  size='sm'
                  className='h-8'
                  onClick={() => handleOpenChange(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type='submit'
                  size='sm'
                  className='h-8 gap-1.5'
                  disabled={isSubmitting || !title.trim()}
                >
                  {isSubmitting ? (
                    <BarsSpinner size={10} />
                  ) : (
                    <Send className='size-3.5' />
                  )}
                  Submit
                </Button>
              </div>
            </div>
          </form>
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
