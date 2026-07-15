'use client';

import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  Circle,
  CircleDot,
  Clock3,
  Hand,
  History,
  ListChecks,
  Play,
  Plus,
  Send,
  UserRound,
} from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { api, useCachedQuery, useMutation } from '@/lib/convex';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useOptimisticValue } from '@/hooks/use-optimistic';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { RichEditor } from '@/components/ui/rich-editor';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { PermissionAwareSelector } from '@/components/ui/permission-aware';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';
import { MemberPicker } from '@/components/work/member-picker';
import { ReminderDialog } from '@/components/reminders/reminder-dialog';
import { IssueDevelopmentSection } from '@/components/issues/issue-development-section';
import { IssueCommentsSection } from '@/components/comments/comments-section';
import { UserAvatar } from '@/components/user-avatar';
import { BarsSpinner } from '@/components/bars-spinner';

const taskStatuses = [
  { value: 'todo', label: 'Todo', icon: Circle },
  { value: 'in_progress', label: 'In progress', icon: Play },
  { value: 'waiting', label: 'Waiting', icon: Clock3 },
  { value: 'blocked', label: 'Blocked', icon: Hand },
  { value: 'done', label: 'Done', icon: CheckCircle2 },
  { value: 'canceled', label: 'Canceled', icon: CircleDot },
] as const;

function TaskStatus({
  taskId,
  serverStatus,
  disabled = false,
}: {
  taskId: Id<'tasks'>;
  serverStatus: (typeof taskStatuses)[number]['value'];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setOptimisticStatus] = useOptimisticValue(serverStatus);
  const setStatus = useMutation(api.tasks.mutations.setStatus);
  const current =
    taskStatuses.find(item => item.value === status) ?? taskStatuses[0];
  const Icon = current.icon;
  return (
    <Popover open={open} onOpenChange={next => !disabled && setOpen(next)}>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className={cn(
            'size-6 shrink-0 p-0',
            status === 'done' && 'text-emerald-500',
            status === 'blocked' && 'text-red-500',
            status === 'waiting' && 'text-amber-500',
          )}
          title={current.label}
          disabled={disabled}
        >
          <Icon className='size-4' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-44 p-0'>
        <Command>
          <CommandList>
            <CommandGroup>
              {taskStatuses.map(item => (
                <CommandItem
                  key={item.value}
                  data-checked={item.value === status}
                  onSelect={() => {
                    setOptimisticStatus(item.value);
                    setOpen(false);
                    void setStatus({ taskId, status: item.value }).catch(() =>
                      toast.error('Could not update Task'),
                    );
                  }}
                >
                  <item.icon className='size-3.5' />
                  {item.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TaskAssignee({
  orgSlug,
  taskId,
  serverAssigneeId,
  disabled = false,
}: {
  orgSlug: string;
  taskId: Id<'tasks'>;
  serverAssigneeId?: Id<'users'>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [assigneeId, setOptimisticAssigneeId] =
    useOptimisticValue(serverAssigneeId);
  const members = useCachedQuery(api.organizations.queries.listMembers, {
    orgSlug,
  });
  const assign = useMutation(api.tasks.mutations.assign);
  const selected = members?.find(member => member.userId === assigneeId);
  const name =
    selected?.user?.name ?? selected?.user?.username ?? selected?.user?.email;

  const choose = (nextAssigneeId?: Id<'users'>) => {
    setOptimisticAssigneeId(nextAssigneeId);
    setOpen(false);
    void assign({ taskId, assigneeId: nextAssigneeId }).catch(() =>
      toast.error('Could not assign Task'),
    );
  };

  return (
    <PermissionAwareSelector
      orgSlug={orgSlug}
      permission={PERMISSIONS.ISSUE_EDIT}
    >
      <Popover open={open} onOpenChange={next => !disabled && setOpen(next)}>
        <PopoverTrigger asChild>
          <Button
            variant='ghost'
            size='xs'
            className='text-muted-foreground hidden h-6 max-w-32 gap-1 px-1.5 font-normal sm:flex'
            disabled={disabled}
          >
            <UserRound className='size-3' />
            <span className='truncate'>{name ?? 'Assign'}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-60 p-0'>
          <Command>
            <CommandList>
              <CommandGroup>
                <CommandItem
                  data-checked={!assigneeId}
                  onSelect={() => choose()}
                >
                  <UserRound className='size-3.5' />
                  Unassigned
                </CommandItem>
                {(members ?? []).map(member => {
                  const memberName =
                    member.user?.name ??
                    member.user?.username ??
                    member.user?.email ??
                    'Unnamed';
                  return (
                    <CommandItem
                      key={member._id}
                      data-checked={member.userId === assigneeId}
                      value={`${memberName} ${member.user?.email ?? ''}`}
                      onSelect={() => choose(member.userId)}
                    >
                      <UserAvatar
                        name={member.user?.name ?? member.user?.username}
                        email={member.user?.email}
                        image={member.user?.image}
                        userId={member.userId}
                        size='sm'
                        className='size-5'
                      />
                      <span className='truncate'>{memberName}</span>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </PermissionAwareSelector>
  );
}

function WorkPropertySelector({
  orgSlug,
  label,
  serverValue,
  options,
  onUpdate,
  disabled = false,
}: {
  orgSlug: string;
  label: string;
  serverValue: string;
  options: readonly { value: string; label: string }[];
  onUpdate: (value: string) => Promise<unknown>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setOptimisticValue] = useOptimisticValue(serverValue);
  const selected = options.find(option => option.value === value);
  return (
    <div className='flex min-h-7 items-center justify-between gap-2'>
      <span className='text-muted-foreground'>{label}</span>
      <PermissionAwareSelector
        orgSlug={orgSlug}
        permission={PERMISSIONS.ISSUE_EDIT}
      >
        <Popover open={open} onOpenChange={next => !disabled && setOpen(next)}>
          <PopoverTrigger asChild>
            <Button
              variant='ghost'
              size='xs'
              className='h-6 gap-1 px-1.5 font-normal'
              disabled={disabled}
            >
              {selected?.label ?? value}
              <ChevronDown className='size-3' />
            </Button>
          </PopoverTrigger>
          <PopoverContent align='end' className='w-48 p-0'>
            <Command>
              <CommandList>
                <CommandGroup>
                  {options.map(option => (
                    <CommandItem
                      key={option.value}
                      data-checked={option.value === value}
                      onSelect={() => {
                        setOptimisticValue(option.value);
                        setOpen(false);
                        void onUpdate(option.value).catch(() =>
                          toast.error(
                            `Could not update ${label.toLowerCase()}`,
                          ),
                        );
                      }}
                    >
                      {option.label}
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </PermissionAwareSelector>
    </div>
  );
}

const workStatusOptions = [
  { value: 'planned', label: 'Planned' },
  { value: 'active', label: 'Active' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'blocked', label: 'Blocked' },
  { value: 'canceled', label: 'Canceled' },
] as const;

function WorkStatusSelector({
  orgSlug,
  workId,
  serverStatus,
  disabled = false,
}: {
  orgSlug: string;
  workId: Id<'issues'>;
  serverStatus: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [status, setOptimisticStatus] = useOptimisticValue(serverStatus);
  const setStatus = useMutation(api.work.mutations.setStatus);
  const start = useMutation(api.work.mutations.start);
  const selected = workStatusOptions.find(option => option.value === status);
  if (!selected || status === 'canceled') {
    return (
      <Badge
        variant='outline'
        className='hidden h-5 px-1.5 text-[10px] sm:inline-flex'
      >
        {status.replaceAll('_', ' ')}
      </Badge>
    );
  }
  return (
    <PermissionAwareSelector
      orgSlug={orgSlug}
      permission={PERMISSIONS.ISSUE_EDIT}
    >
      <Popover open={open} onOpenChange={next => !disabled && setOpen(next)}>
        <PopoverTrigger asChild>
          <Button
            variant='outline'
            size='xs'
            className='hidden h-5 gap-1 px-1.5 text-[10px] font-normal sm:flex'
            disabled={disabled}
          >
            {selected.label}
            <ChevronDown className='size-3' />
          </Button>
        </PopoverTrigger>
        <PopoverContent align='end' className='w-40 p-0'>
          <Command>
            <CommandList>
              <CommandGroup>
                {workStatusOptions.map(option => (
                  <CommandItem
                    key={option.value}
                    data-checked={option.value === status}
                    onSelect={() => {
                      setOptimisticStatus(option.value);
                      setOpen(false);
                      const update =
                        option.value === 'active'
                          ? start({ workId })
                          : setStatus({ workId, status: option.value });
                      void update.catch(() =>
                        toast.error('Could not update Work status'),
                      );
                    }}
                  >
                    {option.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </PermissionAwareSelector>
  );
}

function HandoffDialog({
  orgSlug,
  workId,
  ownerName,
}: {
  orgSlug: string;
  workId: Id<'issues'>;
  ownerName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [people, setPeople] = useState<Id<'users'>[]>([]);
  const [summary, setSummary] = useState('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const propose = useMutation(api.work.mutations.proposeHandoff);
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='h-7 gap-1.5 px-2 text-xs'
        >
          <ArrowRight className='size-3.5' />
          Handoff
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        showCloseButton={false}
        className='gap-2 p-2 sm:max-w-2xl'
      >
        <ResponsiveDialogHeader className='sr-only'>
          <ResponsiveDialogTitle>Propose handoff</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form className='space-y-2'>
          <div className='flex items-center gap-2'>
            <MemberPicker
              orgSlug={orgSlug}
              value={people}
              onChange={setPeople}
              disabled={submitting}
            />
            <span className='text-muted-foreground ml-auto text-xs'>
              {ownerName ?? 'Current owner'} remains accountable until accepted
            </span>
          </div>
          <div className='relative'>
            <Textarea
              value={summary}
              onChange={event => setSummary(event.target.value)}
              placeholder='What is complete, what remains, and where should they resume?'
              className='min-h-24 resize-none pr-28 pb-8 text-sm'
              disabled={submitting}
            />
            <span className='text-muted-foreground bg-background pointer-events-none absolute right-2 bottom-2 rounded px-2 py-0.5 text-xs'>
              Handoff summary
            </span>
          </div>
          <div className='relative'>
            <Input
              value={note}
              onChange={event => setNote(event.target.value)}
              placeholder='Optional private note'
              className='h-9 pr-28 text-sm'
              disabled={submitting}
            />
            <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
              Private note
            </span>
          </div>
        </form>
        <div className='flex w-full flex-row items-center justify-between gap-2'>
          <Button
            variant='ghost'
            size='sm'
            disabled={submitting}
            onClick={() => setOpen(false)}
          >
            Cancel
          </Button>
          <Button
            size='sm'
            disabled={submitting || !people[0] || !summary.trim()}
            onClick={() => {
              const person = people[0];
              if (!person || submitting) return;
              setSubmitting(true);
              void propose({
                workId,
                toOwnerId: person,
                summary,
                note: note || undefined,
              })
                .then(() => {
                  toast.success('Handoff proposed');
                  setOpen(false);
                  setSummary('');
                  setNote('');
                })
                .catch(() => toast.error('Could not propose handoff'))
                .finally(() => setSubmitting(false));
            }}
          >
            {submitting ? <BarsSpinner size={14} /> : 'Propose handoff'}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

function WorkSkeleton() {
  return (
    <div>
      <div className='flex h-10 items-center gap-2 border-b px-3'>
        <Skeleton className='size-7' />
        <Skeleton className='h-3 w-16' />
        <Skeleton className='h-3 max-w-md flex-1' />
      </div>
      <div className='grid lg:grid-cols-[minmax(0,1fr)_260px]'>
        <div className='space-y-4 p-4'>
          <Skeleton className='h-16 w-full' />
          <Skeleton className='h-28 w-full' />
          <Skeleton className='h-32 w-full' />
        </div>
        <div className='hidden space-y-2 border-l p-3 lg:block'>
          <Skeleton className='h-7 w-full' />
          <Skeleton className='h-7 w-full' />
          <Skeleton className='h-20 w-full' />
        </div>
      </div>
    </div>
  );
}

export default function WorkDetailPage() {
  const { orgSlug, workKey } = useParams<{
    orgSlug: string;
    workKey: string;
  }>();
  const work = useCachedQuery(api.work.queries.getByKey, { orgSlug, workKey });
  const currentUser = useCachedQuery(api.users.currentUser);
  const searchParams = useSearchParams();
  const focusedTaskId = searchParams.get('task');
  const updateDetails = useMutation(api.work.mutations.updateDetails);
  const startWork = useMutation(api.work.mutations.start);
  const readyForReview = useMutation(api.work.mutations.readyForReview);
  const completeWork = useMutation(api.work.mutations.complete);
  const createTask = useMutation(api.tasks.mutations.create);
  const respondHandoff = useMutation(api.work.mutations.respondToHandoff);
  const resolveAttention = useMutation(api.work.mutations.resolveAttention);
  const [workpad, setWorkpad] = useState('');
  const [loadedWorkId, setLoadedWorkId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState('');
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const lastScrolledTaskId = useRef<string | null>(null);
  const debouncedWorkpad = useDebouncedValue(workpad, 700);

  useEffect(() => {
    if (!work || loadedWorkId === String(work._id)) return;
    setWorkpad(work.description ?? '');
    setLoadedWorkId(String(work._id));
  }, [loadedWorkId, work]);

  useEffect(() => {
    if (
      !work ||
      !work.canEdit ||
      loadedWorkId !== String(work._id) ||
      debouncedWorkpad !== workpad ||
      debouncedWorkpad === (work.description ?? '')
    )
      return;
    void updateDetails({
      workId: work._id,
      description: debouncedWorkpad,
    }).catch(() => toast.error('Workpad changes could not be saved'));
  }, [debouncedWorkpad, loadedWorkId, updateDetails, work, workpad]);

  useEffect(() => {
    if (!work || !focusedTaskId) {
      lastScrolledTaskId.current = null;
      return;
    }
    if (lastScrolledTaskId.current === focusedTaskId) return;
    if (!work.tasks.some(task => String(task._id) === focusedTaskId)) return;
    requestAnimationFrame(() => {
      const element = document.getElementById(`task-${focusedTaskId}`);
      if (!element) return;
      lastScrolledTaskId.current = focusedTaskId;
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, [focusedTaskId, work]);

  if (work === undefined) return <WorkSkeleton />;
  if (work === null) {
    return (
      <div className='text-muted-foreground flex min-h-64 items-center justify-center text-sm'>
        Work not found
      </div>
    );
  }
  const pendingHandoff = work.handoffs.find(item => item.status === 'pending');
  const openAttention = work.attention.filter(item => item.status === 'open');
  const activeExecutions = work.executions.filter(item =>
    ['active', 'waiting_for_input', 'paused'].includes(item.status),
  );
  const ownerName =
    work.owner?.name ?? work.owner?.username ?? work.owner?.email;

  const addTask = () => {
    const title = newTask.trim();
    if (!title || pendingAction) return;
    setNewTask('');
    setPendingAction('create-task');
    void createTask({ workId: work._id, title })
      .catch(() => {
        setNewTask(title);
        toast.error('Could not create Task');
      })
      .finally(() => setPendingAction(null));
  };

  const runAction = (
    key: string,
    action: () => Promise<unknown>,
    errorMessage: string,
  ) => {
    if (pendingAction) return;
    setPendingAction(key);
    void action()
      .catch(error =>
        toast.error(error instanceof Error ? error.message : errorMessage),
      )
      .finally(() => setPendingAction(null));
  };

  return (
    <div className='min-h-full'>
      <header className='bg-background/95 sticky top-0 z-20 flex min-h-10 items-center gap-1.5 border-b pr-1.5 pl-1 backdrop-blur'>
        <Link
          href={`/${orgSlug}/work`}
          aria-label='Back to Work'
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'size-7 p-0',
          )}
        >
          <ArrowLeft className='size-4' />
        </Link>
        <span className='text-muted-foreground font-mono text-[11px]'>
          {work.key}
        </span>
        <h1 className='min-w-0 flex-1 truncate text-sm font-semibold'>
          {work.title}
        </h1>
        <WorkStatusSelector
          orgSlug={orgSlug}
          workId={work._id}
          serverStatus={work.workStatus}
          disabled={!work.canEdit}
        />
        {work.canEdit &&
          !work.ownerStartedAt &&
          ['planned', 'active', 'waiting', 'blocked'].includes(
            work.workStatus,
          ) && (
            <Button
              size='sm'
              className='h-7 gap-1.5 px-2 text-xs'
              disabled={pendingAction !== null}
              onClick={() =>
                runAction(
                  'start',
                  () => startWork({ workId: work._id }),
                  'Could not start Work',
                )
              }
            >
              <Play className='size-3.5' />
              Start Work
            </Button>
          )}
        {work.canEdit &&
          work.ownerStartedAt &&
          ['active', 'waiting', 'blocked'].includes(work.workStatus) && (
            <Button
              size='sm'
              variant='outline'
              className='h-7 gap-1.5 px-2 text-xs'
              disabled={pendingAction !== null}
              onClick={() =>
                runAction(
                  'review',
                  () => readyForReview({ workId: work._id }),
                  'Could not raise review',
                )
              }
            >
              <Send className='size-3.5' />
              Review
            </Button>
          )}
        {work.canEdit && work.workStatus === 'ready_for_review' && (
          <Button
            size='sm'
            className='h-7 gap-1.5 px-2 text-xs'
            disabled={pendingAction !== null}
            onClick={() =>
              runAction(
                'complete',
                () => completeWork({ workId: work._id }),
                'Could not complete Work',
              )
            }
          >
            <Check className='size-3.5' />
            Complete
          </Button>
        )}
      </header>

      {pendingHandoff && (
        <div className='flex min-h-10 items-center gap-2 border-b border-amber-500/20 bg-amber-500/8 px-4 text-xs'>
          <ArrowRight className='size-3.5 text-amber-600' />
          <span className='flex-1'>
            Handoff from{' '}
            {pendingHandoff.fromOwner?.name ??
              pendingHandoff.fromOwner?.email ??
              'the current owner'}{' '}
            to{' '}
            {pendingHandoff.toOwner?.name ??
              pendingHandoff.toOwner?.email ??
              'the next owner'}{' '}
            is waiting for acceptance. The current owner remains accountable.
          </span>
          {pendingHandoff.isRecipient && (
            <>
              <Button
                variant='outline'
                size='sm'
                className='h-6 text-[11px]'
                disabled={pendingAction !== null}
                onClick={() =>
                  runAction(
                    'accept-handoff',
                    () =>
                      respondHandoff({
                        handoffId: pendingHandoff._id,
                        accept: true,
                      }),
                    'Could not accept handoff',
                  )
                }
              >
                Accept
              </Button>
              <Button
                variant='ghost'
                size='sm'
                className='h-6 text-[11px]'
                disabled={pendingAction !== null}
                onClick={() =>
                  runAction(
                    'decline-handoff',
                    () =>
                      respondHandoff({
                        handoffId: pendingHandoff._id,
                        accept: false,
                      }),
                    'Could not decline handoff',
                  )
                }
              >
                Decline
              </Button>
            </>
          )}
        </div>
      )}
      {openAttention.length > 0 && (
        <div className='border-b border-red-500/15 bg-red-500/7 px-4 py-2'>
          {openAttention.map(item => (
            <div key={item._id} className='flex items-center gap-2 text-xs'>
              <Hand className='size-3.5 text-red-500' />
              <span className='font-medium'>{item.title}</span>
              {item.details && (
                <span className='text-muted-foreground min-w-0 flex-1 truncate'>
                  {item.details}
                </span>
              )}
              {work.canEdit && (
                <Button
                  variant='ghost'
                  size='sm'
                  className='h-6 text-[11px]'
                  disabled={pendingAction !== null}
                  onClick={() =>
                    runAction(
                      `attention:${item._id}`,
                      () => resolveAttention({ attentionId: item._id }),
                      'Could not resolve attention request',
                    )
                  }
                >
                  Resolve
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <div className='grid lg:grid-cols-[minmax(0,1fr)_260px]'>
        <main className='min-w-0 px-4 py-4 md:px-5'>
          {work.linkedRequests.length > 0 && (
            <section className='mb-4 rounded-md border'>
              <div className='text-muted-foreground flex h-7 items-center border-b px-2.5 text-[10px] font-medium tracking-wider uppercase'>
                Linked requests
              </div>
              {work.linkedRequests.map(
                request =>
                  request && (
                    <div key={request._id} className='border-b last:border-b-0'>
                      <Link
                        href={`/${orgSlug}/requests/${request.key}`}
                        className='hover:bg-muted/30 flex min-h-9 items-center gap-2 px-2.5 py-1.5'
                      >
                        <span className='text-muted-foreground font-mono text-[10px]'>
                          {request.key}
                        </span>
                        <div className='min-w-0 flex-1 truncate text-xs font-medium'>
                          {request.title}
                        </div>
                        <span className='text-muted-foreground hidden max-w-[42%] min-w-0 flex-1 truncate text-[11px] xl:block'>
                          {request.expectedOutput}
                        </span>
                        <ChevronDown className='text-muted-foreground size-3.5 -rotate-90' />
                      </Link>
                      {request.status === 'changes_requested' &&
                        request.latestReviewNote && (
                          <div className='border-t border-amber-500/20 bg-amber-500/8 px-3 py-2 text-[11px]'>
                            <div className='font-medium text-amber-700 dark:text-amber-300'>
                              Changes requested
                            </div>
                            <p className='text-muted-foreground mt-0.5'>
                              {request.latestReviewNote}
                            </p>
                          </div>
                        )}
                    </div>
                  ),
              )}
            </section>
          )}

          <section className='mb-4'>
            <div className='mb-1.5 flex items-center justify-between'>
              <h2 className='text-muted-foreground text-[10px] font-medium tracking-wider uppercase'>
                Workpad
              </h2>
              <span className='text-muted-foreground text-[10px]'>
                autosaved · supports live checklists
              </span>
            </div>
            <RichEditor
              value={workpad}
              onChange={setWorkpad}
              orgSlug={orgSlug}
              mode='full'
              disabled={!work.canEdit}
              borderless
              className='notion-editor document-prose [&_.tiptap]:min-h-28 [&_.tiptap]:text-[13px] [&_.tiptap]:leading-5'
              placeholder="Type notes or press '/' for commands. Use - [ ] for a checklist."
            />
          </section>

          <section className='mb-4'>
            <div className='mb-1.5 flex items-center gap-2'>
              <ListChecks className='size-3.5' />
              <h2 className='text-xs font-semibold'>Tasks</h2>
              <span className='text-muted-foreground text-[10px]'>
                {work.tasks.filter(task => task.status === 'done').length}/
                {work.tasks.length}
              </span>
            </div>
            <div className='overflow-hidden rounded-md border'>
              {work.tasks.map(task => (
                <div
                  key={task._id}
                  id={`task-${task._id}`}
                  className={cn(
                    'group flex min-h-8 scroll-m-20 items-center gap-2 border-b px-2 transition-colors last:border-b-0',
                    focusedTaskId === String(task._id) &&
                      'bg-primary/7 ring-primary/20 ring-1 ring-inset',
                  )}
                >
                  <TaskStatus
                    taskId={task._id}
                    serverStatus={task.status}
                    disabled={!task.canUpdateStatus}
                  />
                  <span className='text-muted-foreground w-7 shrink-0 font-mono text-[10px]'>
                    #{task.number}
                  </span>
                  <span
                    className={cn(
                      'min-w-0 flex-1 truncate text-xs',
                      task.status === 'done' &&
                        'text-muted-foreground line-through',
                    )}
                  >
                    {task.title}
                  </span>
                  {task.creationSource === 'agent' && (
                    <Bot className='text-muted-foreground size-3.5' />
                  )}
                  <TaskAssignee
                    orgSlug={orgSlug}
                    taskId={task._id}
                    serverAssigneeId={task.assigneeId}
                    disabled={!work.canEdit}
                  />
                </div>
              ))}
              {work.canEdit && (
                <div className='flex h-8 items-center gap-2 px-2'>
                  <Plus className='text-muted-foreground size-4' />
                  <Input
                    value={newTask}
                    disabled={pendingAction !== null}
                    onChange={event => setNewTask(event.target.value)}
                    onKeyDown={event => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addTask();
                      }
                    }}
                    placeholder='Add a Task…'
                    className='h-7 flex-1 border-0 bg-transparent px-0 text-xs shadow-none focus-visible:ring-0'
                  />
                  <span className='text-muted-foreground text-[10px]'>
                    Enter
                  </span>
                </div>
              )}
            </div>
          </section>

          <section className='mb-4'>
            <div className='mb-1.5 flex items-center gap-2'>
              <Bot className='size-3.5' />
              <h2 className='text-xs font-semibold'>Executions</h2>
              <span className='text-muted-foreground text-[10px]'>
                {activeExecutions.length} live
              </span>
            </div>
            {work.executions.length === 0 ? (
              <div className='text-muted-foreground rounded-md border border-dashed px-3 py-2 text-xs'>
                No agent executions attached yet. Starting an execution will not
                change the Work state.
              </div>
            ) : (
              <div className='overflow-hidden rounded-md border'>
                {work.executions.slice(0, 12).map(execution => (
                  <div
                    key={execution._id}
                    className='flex min-h-8 items-center gap-2 border-b px-2.5 last:border-b-0'
                  >
                    <span
                      className={cn(
                        'size-2 rounded-full',
                        execution.status === 'active'
                          ? 'bg-emerald-500'
                          : execution.status === 'waiting_for_input'
                            ? 'bg-red-500'
                            : execution.status === 'paused'
                              ? 'bg-amber-500'
                              : 'bg-muted-foreground/40',
                      )}
                    />
                    <span className='min-w-0 flex-1 truncate text-xs'>
                      {execution.title ?? `${execution.provider} execution`}
                    </span>
                    <Badge variant='outline' className='h-5 text-[10px]'>
                      {execution.status.replaceAll('_', ' ')}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </section>

          <IssueDevelopmentSection
            orgSlug={orgSlug}
            issueId={work._id}
            issueKey={work.key}
          />

          <section className='mt-4 border-t pt-4'>
            <IssueCommentsSection
              orgSlug={orgSlug}
              issueId={work._id}
              currentUser={
                currentUser
                  ? {
                      _id: currentUser._id,
                      name: currentUser.name ?? '',
                      email: currentUser.email ?? null,
                      image: currentUser.image ?? null,
                    }
                  : null
              }
            />
          </section>
        </main>

        <aside className='border-t p-3 lg:border-t-0 lg:border-l'>
          <div className='space-y-3 lg:sticky lg:top-12'>
            <div>
              <div className='text-muted-foreground mb-1.5 text-[10px] font-medium tracking-wider uppercase'>
                Accountability
              </div>
              <div className='flex items-center gap-2 text-xs'>
                {work.owner ? (
                  <UserAvatar
                    name={work.owner.name ?? work.owner.username}
                    email={work.owner.email}
                    image={work.owner.image}
                    userId={work.owner._id}
                    size='sm'
                  />
                ) : (
                  <span className='bg-muted flex size-6 items-center justify-center rounded-full'>
                    <UserRound className='size-3.5' />
                  </span>
                )}
                <span className='min-w-0 flex-1 truncate'>
                  {ownerName ?? 'No owner'}
                </span>
              </div>
              {work.canEdit && (
                <div className='mt-1.5 flex flex-wrap items-center gap-1.5'>
                  <HandoffDialog
                    orgSlug={orgSlug}
                    workId={work._id}
                    ownerName={ownerName}
                  />
                  <ReminderDialog orgSlug={orgSlug} workId={work._id} />
                </div>
              )}
            </div>
            <div className='grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs lg:grid-cols-1'>
              <WorkPropertySelector
                orgSlug={orgSlug}
                label='Effort'
                disabled={!work.canEdit}
                serverValue={work.effort ?? 'unknown'}
                options={[
                  { value: 'unknown', label: 'Unknown' },
                  { value: 'xs', label: 'XS' },
                  { value: 's', label: 'Small' },
                  { value: 'm', label: 'Medium' },
                  { value: 'l', label: 'Large' },
                ]}
                onUpdate={value =>
                  updateDetails({
                    workId: work._id,
                    effort: value as 'unknown' | 'xs' | 's' | 'm' | 'l',
                  })
                }
              />
              <div className='flex min-h-7 items-center justify-between gap-2'>
                <span className='text-muted-foreground'>Due</span>
                <span>{work.dueDate ?? 'None'}</span>
              </div>
              <WorkPropertySelector
                orgSlug={orgSlug}
                label='Agent Tasks'
                disabled={!work.canEdit}
                serverValue={work.agentTaskCreationPolicy ?? 'allow'}
                options={[
                  { value: 'allow', label: 'Allowed' },
                  { value: 'approval_required', label: 'Approval' },
                  { value: 'deny', label: 'Denied' },
                ]}
                onUpdate={value =>
                  updateDetails({
                    workId: work._id,
                    agentTaskCreationPolicy: value as
                      'allow' | 'approval_required' | 'deny',
                  })
                }
              />
              <WorkPropertySelector
                orgSlug={orgSlug}
                label='Completion'
                disabled={!work.canEdit}
                serverValue={work.completionPolicy ?? 'manual'}
                options={[
                  { value: 'manual', label: 'Human review' },
                  { value: 'tracked_work', label: 'Tracked Work' },
                  { value: 'github', label: 'GitHub' },
                ]}
                onUpdate={value =>
                  updateDetails({
                    workId: work._id,
                    completionPolicy: value as
                      'manual' | 'tracked_work' | 'github',
                  })
                }
              />
            </div>
            <p className='text-muted-foreground text-[10px] leading-3.5'>
              GitHub artifacts are evidence by default. Select GitHub completion
              only when this Work should opt into repository-driven state
              changes.
            </p>
            {work.ownershipPeriods.length > 0 && (
              <details>
                <summary className='text-muted-foreground flex cursor-pointer list-none items-center gap-1 text-[10px] font-medium tracking-wider uppercase'>
                  <History className='size-3' />
                  Ownership history
                </summary>
                <div className='mt-2 space-y-2'>
                  {work.ownershipPeriods.map(period => (
                    <div key={period._id} className='border-l pl-2 text-[11px]'>
                      <div>
                        {period.owner?.name ??
                          period.owner?.username ??
                          period.owner?.email ??
                          'Former owner'}
                      </div>
                      <div className='text-muted-foreground'>
                        {new Date(period.startedAt).toLocaleDateString()}{' '}
                        {period.endedAt
                          ? `– ${new Date(period.endedAt).toLocaleDateString()}`
                          : '– current'}
                      </div>
                      <div className='text-muted-foreground mt-0.5'>
                        {period.executionStartedAt
                          ? `Execution started ${new Date(period.executionStartedAt).toLocaleString()}`
                          : 'Ownership accepted · execution not started'}
                      </div>
                      {period.summary && (
                        <p className='text-muted-foreground mt-1 leading-4'>
                          {period.summary}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
