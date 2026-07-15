'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  CircleDot,
  Link2,
  Network,
  Plus,
  Route,
  Send,
  UserRound,
} from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import {
  api,
  useCachedPaginatedQuery,
  useCachedQuery,
  useMutation,
} from '@/lib/convex';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
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
import { CreateWorkDialog } from '@/components/work/create-work-dialog';
import { ReminderDialog } from '@/components/reminders/reminder-dialog';

function RouteDialog({
  orgSlug,
  requestId,
  currentRecipients,
  currentTeamId,
}: {
  orgSlug: string;
  requestId: Id<'requests'>;
  currentRecipients: Id<'users'>[];
  currentTeamId?: Id<'teams'>;
}) {
  const [open, setOpen] = useState(false);
  const [recipients, setRecipients] = useState(currentRecipients);
  const [routedTeamId, setRoutedTeamId] = useState<Id<'teams'> | undefined>(
    currentTeamId,
  );
  const [submitting, setSubmitting] = useState(false);
  const route = useMutation(api.requests.mutations.route);
  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setRecipients(currentRecipients);
      setRoutedTeamId(currentTeamId);
    }
    setOpen(nextOpen);
  };
  return (
    <ResponsiveDialog open={open} onOpenChange={handleOpenChange}>
      <ResponsiveDialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='h-7 gap-1.5 px-2 text-xs'
        >
          <Route className='size-3.5' />
          Route
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className='max-w-md p-0'>
        <ResponsiveDialogHeader className='border-b px-4 py-3'>
          <ResponsiveDialogTitle className='text-sm'>
            Route request
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='text-xs'>
            Route to one person, several people, a team, or leave it unowned.
            Routing never starts Work.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className='space-y-4 p-4'>
          <div className='flex flex-wrap items-center gap-2'>
            <MemberPicker
              orgSlug={orgSlug}
              value={recipients}
              onChange={setRecipients}
              multiple
              placeholder='Choose recipients'
            />
            <TeamPicker
              orgSlug={orgSlug}
              value={routedTeamId}
              onChange={setRoutedTeamId}
            />
          </div>
          <div className='flex justify-end gap-2'>
            <Button
              variant='ghost'
              size='sm'
              className='h-7 text-xs'
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size='sm'
              className='h-7 text-xs'
              disabled={submitting}
              onClick={() => {
                if (submitting) return;
                setSubmitting(true);
                void route({
                  requestId,
                  recipientIds: recipients,
                  routedTeamId,
                })
                  .then(() => {
                    toast.success('Request routed');
                    setOpen(false);
                  })
                  .catch(() => toast.error('Could not route request'))
                  .finally(() => setSubmitting(false));
              }}
            >
              Save routing
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function LinkWorkDialog({
  orgSlug,
  requestId,
}: {
  orgSlug: string;
  requestId: Id<'requests'>;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [linkingId, setLinkingId] = useState<Id<'issues'> | null>(null);
  const work = useCachedPaginatedQuery(
    api.work.queries.list,
    open ? { orgSlug, scope: 'all' } : 'skip',
    { initialNumItems: 100 },
  );
  const normalizedSearch = search.trim();
  const searchResults = useCachedQuery(
    api.search.queries.searchEntities,
    open && normalizedSearch
      ? { orgSlug, query: normalizedSearch, limit: 50 }
      : 'skip',
  );
  const linkWork = useMutation(api.requests.mutations.linkWork);
  const visible = normalizedSearch
    ? (searchResults?.issues ?? [])
    : work.results;
  const isLoading = normalizedSearch
    ? searchResults === undefined
    : work.status === 'LoadingFirstPage';
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='h-7 gap-1.5 px-2 text-xs'
        >
          <Link2 className='size-3.5' />
          Attach existing
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className='max-w-lg p-0'>
        <ResponsiveDialogHeader className='border-b px-4 py-3'>
          <ResponsiveDialogTitle className='text-sm'>
            Attach to existing Work
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='text-xs'>
            A Work record may fulfill several related Requests.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className='p-3'>
          <Input
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder='Search Work…'
            className='mb-2 h-8 text-sm'
          />
          <div className='max-h-72 overflow-y-auto rounded-md border'>
            {isLoading
              ? Array.from({ length: 5 }).map((_, index) => (
                  <div
                    key={index}
                    className='flex h-10 items-center gap-2 border-b px-3'
                  >
                    <Skeleton className='h-3 w-16' />
                    <Skeleton className='h-3 flex-1' />
                  </div>
                ))
              : visible.map(item => (
                  <button
                    type='button'
                    key={item._id}
                    disabled={linkingId !== null}
                    className='hover:bg-muted/40 flex h-10 w-full items-center gap-2 border-b px-3 text-left last:border-b-0'
                    onClick={() => {
                      if (linkingId) return;
                      setLinkingId(item._id);
                      void linkWork({
                        requestId,
                        workId: item._id,
                        relation: 'fulfills',
                      })
                        .then(() => {
                          toast.success(`Attached ${item.key}`);
                          setOpen(false);
                        })
                        .catch(() => toast.error('Could not attach Work'))
                        .finally(() => setLinkingId(null));
                    }}
                  >
                    <span className='text-muted-foreground font-mono text-[10px]'>
                      {item.key}
                    </span>
                    <span className='min-w-0 flex-1 truncate text-xs font-medium'>
                      {item.title}
                    </span>
                    <ArrowRight className='text-muted-foreground size-3.5' />
                  </button>
                ))}
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function ReviewDialog({
  requestId,
  mode,
}: {
  requestId: Id<'requests'>;
  mode: 'changes' | 'complete';
}) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const requestChanges = useMutation(api.requests.mutations.requestChanges);
  const complete = useMutation(api.requests.mutations.complete);
  const submit = () => {
    if (submitting) return;
    setSubmitting(true);
    const action =
      mode === 'changes'
        ? requestChanges({ requestId, note })
        : complete({ requestId, note: note || undefined });
    void action
      .then(() => {
        toast.success(
          mode === 'changes' ? 'Changes requested' : 'Request completed',
        );
        setOpen(false);
      })
      .catch(() => toast.error('Could not save review'))
      .finally(() => setSubmitting(false));
  };
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button
          variant={mode === 'complete' ? 'default' : 'outline'}
          size='sm'
          className='h-7 gap-1.5 px-2 text-xs'
        >
          {mode === 'complete' ? (
            <Check className='size-3.5' />
          ) : (
            <Send className='size-3.5' />
          )}
          {mode === 'complete' ? 'Accept result' : 'Request changes'}
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent className='max-w-md p-0'>
        <ResponsiveDialogHeader className='border-b px-4 py-3'>
          <ResponsiveDialogTitle className='text-sm'>
            {mode === 'complete'
              ? 'Accept this request?'
              : 'What needs to change?'}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className='text-xs'>
            {mode === 'complete'
              ? 'This closes the requester review loop.'
              : 'The owner and linked Work owners will be notified.'}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <div className='space-y-3 p-4'>
          <Textarea
            value={note}
            onChange={event => setNote(event.target.value)}
            placeholder={
              mode === 'complete'
                ? 'Optional review note'
                : 'Required change or missing outcome'
            }
            className='min-h-24 text-sm'
          />
          <div className='flex justify-end gap-2'>
            <Button
              variant='ghost'
              size='sm'
              className='h-7 text-xs'
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size='sm'
              className='h-7 text-xs'
              disabled={submitting || (mode === 'changes' && !note.trim())}
              onClick={submit}
            >
              Confirm
            </Button>
          </div>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default function RequestDetailPage() {
  const { orgSlug, requestKey } = useParams<{
    orgSlug: string;
    requestKey: string;
  }>();
  const request = useCachedQuery(api.requests.queries.getByKey, {
    orgSlug,
    requestKey,
  });
  const claim = useMutation(api.requests.mutations.claim);
  const [claiming, setClaiming] = useState(false);
  if (request === undefined)
    return (
      <div>
        <div className='flex h-12 items-center gap-3 border-b px-4'>
          <Skeleton className='size-7' />
          <Skeleton className='h-4 w-20' />
          <Skeleton className='h-4 max-w-sm flex-1' />
        </div>
        <div className='mx-auto max-w-4xl space-y-6 p-6'>
          <Skeleton className='h-36 w-full' />
          <Skeleton className='h-52 w-full' />
        </div>
      </div>
    );
  if (request === null)
    return (
      <div className='text-muted-foreground flex min-h-64 items-center justify-center text-sm'>
        Request not found
      </div>
    );
  const recipientIds = request.recipients
    .filter(row => row.role === 'recipient')
    .map(row => row.userId);
  const isTerminal = ['completed', 'declined', 'duplicate'].includes(
    request.status,
  );
  return (
    <div className='min-h-full'>
      <header className='bg-background/95 sticky top-0 z-20 flex min-h-12 items-center gap-2 border-b px-3 backdrop-blur'>
        <Link
          href={`/${orgSlug}/requests`}
          aria-label='Back to Requests'
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'size-7 p-0',
          )}
        >
          <ArrowLeft className='size-4' />
        </Link>
        <span className='text-muted-foreground font-mono text-[11px]'>
          {request.key}
        </span>
        <h1 className='min-w-0 flex-1 truncate text-sm font-semibold'>
          {request.title}
        </h1>
        <Badge variant='outline' className='h-5 px-1.5 text-[10px]'>
          {request.status.replaceAll('_', ' ')}
        </Badge>
        {!isTerminal && request.canEdit && (
          <RouteDialog
            orgSlug={orgSlug}
            requestId={request._id}
            currentRecipients={recipientIds}
            currentTeamId={request.routedTeamId}
          />
        )}
        {!isTerminal && !request.ownerId && (
          <Button
            size='sm'
            className='h-7 gap-1.5 px-2 text-xs'
            disabled={claiming}
            onClick={() => {
              if (claiming) return;
              setClaiming(true);
              void claim({ requestId: request._id })
                .catch(() => toast.error('Could not claim request'))
                .finally(() => setClaiming(false));
            }}
          >
            <UserRound className='size-3.5' />
            Take request
          </Button>
        )}
      </header>
      <div className='mx-auto grid max-w-5xl lg:grid-cols-[minmax(0,1fr)_250px]'>
        <main className='min-w-0 space-y-7 px-5 py-6 md:px-8'>
          <section>
            <div className='text-muted-foreground mb-2 text-[10px] font-medium tracking-wider uppercase'>
              Request context
            </div>
            <p className='text-sm leading-6 whitespace-pre-wrap'>
              {request.description || 'No additional context was provided.'}
            </p>
          </section>
          <section className='bg-muted/35 rounded-md border p-4'>
            <div className='mb-2 flex items-center gap-2'>
              <CircleDot className='size-4' />
              <h2 className='text-xs font-semibold'>Expected output</h2>
            </div>
            <p className='text-sm leading-6 whitespace-pre-wrap'>
              {request.expectedOutput}
            </p>
            {request.reviewGuidance && (
              <div className='text-muted-foreground mt-3 border-t pt-3 text-xs'>
                <span className='text-foreground font-medium'>
                  Review guidance:
                </span>{' '}
                {request.reviewGuidance}
              </div>
            )}
          </section>
          {request.latestReviewNote && (
            <section className='border-l-2 border-amber-500 pl-3'>
              <div className='text-[10px] font-medium tracking-wider text-amber-600 uppercase'>
                Latest review
              </div>
              <p className='mt-1 text-sm'>{request.latestReviewNote}</p>
            </section>
          )}
          <section>
            <div className='mb-2 flex items-center justify-between gap-3'>
              <div className='flex items-center gap-2'>
                <Network className='size-3.5' />
                <h2 className='text-xs font-semibold'>
                  Work delivering this request
                </h2>
              </div>
              <div className='flex items-center gap-2'>
                {!isTerminal && request.canEdit && (
                  <>
                    <LinkWorkDialog orgSlug={orgSlug} requestId={request._id} />
                    <CreateWorkDialog
                      orgSlug={orgSlug}
                      requestId={request._id}
                      defaultTitle={request.title}
                      trigger={
                        <Button size='sm' className='h-7 gap-1.5 px-2 text-xs'>
                          <Plus className='size-3.5' />
                          New Work
                        </Button>
                      }
                    />
                  </>
                )}
              </div>
            </div>
            {request.linkedWork.length === 0 ? (
              <div className='text-muted-foreground rounded-md border border-dashed p-5 text-center text-xs'>
                No Work is attached yet. The recipient can create a new outcome
                or attach this Request to existing Work.
              </div>
            ) : (
              <div className='overflow-hidden rounded-md border'>
                {request.linkedWork.map(
                  work =>
                    work && (
                      <Link
                        key={work._id}
                        href={`/${orgSlug}/work/${work.key}`}
                        className='hover:bg-muted/35 flex min-h-11 items-center gap-3 border-b px-3 last:border-b-0'
                      >
                        <span className='text-muted-foreground font-mono text-[10px]'>
                          {work.key}
                        </span>
                        <span className='min-w-0 flex-1 truncate text-xs font-medium'>
                          {work.title}
                        </span>
                        <Badge variant='outline' className='h-5 text-[10px]'>
                          {work.workStatus ?? 'planned'}
                        </Badge>
                        <ArrowRight className='text-muted-foreground size-3.5' />
                      </Link>
                    ),
                )}
              </div>
            )}
          </section>
          {['ready_for_review', 'changes_requested'].includes(
            request.status,
          ) && (
            <section className='flex items-center justify-between gap-4 rounded-md border border-violet-500/25 bg-violet-500/5 p-3'>
              <div>
                <div className='flex items-center gap-1.5 text-xs font-medium'>
                  <CheckCircle2 className='size-4 text-violet-500' />
                  {request.status === 'ready_for_review'
                    ? 'Ready for your review'
                    : 'Review changes are still open'}
                </div>
                <p className='text-muted-foreground mt-1 text-[11px]'>
                  {request.status === 'ready_for_review'
                    ? 'Check the expected output against the linked Work, then accept it or request a change.'
                    : 'If the current result is acceptable after all, you can close the Request now.'}
                </p>
              </div>
              <div className='flex shrink-0 items-center gap-2'>
                {request.canEdit && (
                  <>
                    {request.status === 'ready_for_review' && (
                      <ReviewDialog requestId={request._id} mode='changes' />
                    )}
                    <ReviewDialog requestId={request._id} mode='complete' />
                  </>
                )}
              </div>
            </section>
          )}
        </main>
        <aside className='border-t p-4 lg:border-t-0 lg:border-l'>
          <div className='space-y-4 lg:sticky lg:top-16'>
            <div>
              <div className='text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wider uppercase'>
                Requester
              </div>
              <div className='flex items-center gap-2 text-xs'>
                <UserRound className='size-3.5' />
                {request.requester?.name ??
                  request.requesterName ??
                  request.requesterEmail ??
                  'Unknown'}
              </div>
            </div>
            <div>
              <div className='text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wider uppercase'>
                Routing
              </div>
              <div className='space-y-1'>
                {request.recipients
                  .filter(row => row.role === 'recipient')
                  .map(row => (
                    <div
                      key={row._id}
                      className='flex items-center gap-2 text-xs'
                    >
                      <span className='bg-muted flex size-5 items-center justify-center rounded-full text-[8px]'>
                        {(row.user?.name ?? row.user?.email ?? '?')
                          .slice(0, 2)
                          .toUpperCase()}
                      </span>
                      <span className='truncate'>
                        {row.user?.name ?? row.user?.email}
                      </span>
                    </div>
                  ))}
                {!request.recipients.some(row => row.role === 'recipient') && (
                  <span className='text-muted-foreground text-xs'>
                    Not routed
                  </span>
                )}
              </div>
            </div>
            {request.canEdit && (
              <ReminderDialog orgSlug={orgSlug} requestId={request._id} />
            )}
            <div className='grid gap-2 text-xs'>
              <div className='flex justify-between gap-2'>
                <span className='text-muted-foreground'>Source</span>
                <span>{request.source}</span>
              </div>
              <div className='flex justify-between gap-2'>
                <span className='text-muted-foreground'>Due</span>
                <span>{request.dueDate ?? 'None'}</span>
              </div>
              <div className='flex justify-between gap-2'>
                <span className='text-muted-foreground'>Created</span>
                <span>{new Date(request.createdAt).toLocaleDateString()}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
