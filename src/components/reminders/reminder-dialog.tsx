'use client';

import { useMemo, useState } from 'react';
import { BellPlus, Check, ChevronDown } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { api, useMutation } from '@/lib/convex';
import { toast } from 'sonner';
import { BarsSpinner } from '@/components/bars-spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';

const cadences = [
  { value: 'once', label: 'Once' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekly', label: 'Weekly' },
] as const;

function tomorrowLocalValue() {
  const next = new Date(Date.now() + 24 * 60 * 60 * 1000);
  next.setSeconds(0, 0);
  const offset = next.getTimezoneOffset() * 60_000;
  return new Date(next.getTime() - offset).toISOString().slice(0, 16);
}

export function ReminderDialog({
  orgSlug,
  requestId,
  workId,
  taskId,
}: {
  orgSlug: string;
  requestId?: Id<'requests'>;
  workId?: Id<'issues'>;
  taskId?: Id<'tasks'>;
}) {
  const targetType = requestId ? 'request' : taskId ? 'task' : 'work';
  const [open, setOpen] = useState(false);
  const [cadenceOpen, setCadenceOpen] = useState(false);
  const [cadence, setCadence] =
    useState<(typeof cadences)[number]['value']>('weekly');
  const [when, setWhen] = useState(tomorrowLocalValue);
  const [inactivity, setInactivity] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const createReminder = useMutation(api.reminders.create);
  const selectedCadence = cadences.find(item => item.value === cadence)!;
  const recipientPolicies = useMemo(
    () =>
      targetType === 'request'
        ? (['requester', 'request_owner'] as const)
        : targetType === 'task'
          ? (['task_assignee', 'work_owner'] as const)
          : (['work_owner', 'work_creator'] as const),
    [targetType],
  );
  const submit = () => {
    if (submitting) return;
    const firstFireAt = new Date(when).getTime();
    if (!Number.isFinite(firstFireAt)) {
      toast.error('Choose a reminder time');
      return;
    }
    setSubmitting(true);
    void createReminder({
      orgSlug,
      targetType,
      requestId,
      workId,
      taskId,
      recipientPolicies: [...recipientPolicies],
      cadence,
      localTime: when.split('T')[1] ?? '09:00',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      inactivityHours: inactivity ? Number(inactivity) : undefined,
      firstFireAt,
    })
      .then(() => {
        toast.success('Reminder scheduled');
        setOpen(false);
      })
      .catch(error =>
        toast.error(
          error instanceof Error ? error.message : 'Could not create reminder',
        ),
      )
      .finally(() => setSubmitting(false));
  };
  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        <Button
          variant='outline'
          size='sm'
          className='h-7 gap-1.5 px-2 text-xs'
        >
          <BellPlus className='size-3.5' />
          Reminder
        </Button>
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent
        showCloseButton={false}
        className='gap-2 p-2 sm:max-w-2xl'
      >
        <ResponsiveDialogHeader className='sr-only'>
          <ResponsiveDialogTitle>
            Set responsibility reminder
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form className='space-y-2'>
          <div className='grid grid-cols-2 gap-2'>
            <div className='space-y-1.5'>
              <Label className='text-xs'>Cadence</Label>
              <Popover open={cadenceOpen} onOpenChange={setCadenceOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-8 w-full justify-between text-xs font-normal'
                    disabled={submitting}
                  >
                    {selectedCadence.label}
                    <ChevronDown className='size-3.5' />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className='w-44 p-0'>
                  <Command>
                    <CommandList>
                      <CommandGroup>
                        {cadences.map(item => (
                          <CommandItem
                            key={item.value}
                            data-checked={item.value === cadence}
                            onSelect={() => {
                              setCadence(item.value);
                              setCadenceOpen(false);
                            }}
                          >
                            {item.label}
                            {item.value === cadence && (
                              <Check className='ml-auto size-3.5' />
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div className='space-y-1.5'>
              <Label htmlFor='reminder-when' className='text-xs'>
                First reminder
              </Label>
              <Input
                id='reminder-when'
                type='datetime-local'
                value={when}
                onChange={event => setWhen(event.target.value)}
                className='h-8 text-xs'
                disabled={submitting}
              />
            </div>
          </div>
          <div className='space-y-1.5'>
            <Label htmlFor='reminder-inactivity' className='text-xs'>
              Only after inactivity{' '}
              <span className='text-muted-foreground font-normal'>
                (hours, optional)
              </span>
            </Label>
            <Input
              id='reminder-inactivity'
              type='number'
              min='1'
              value={inactivity}
              onChange={event => setInactivity(event.target.value)}
              placeholder='e.g. 48'
              className='h-8 text-xs'
              disabled={submitting}
            />
          </div>
          <p className='text-muted-foreground text-[11px]'>
            Recipients:{' '}
            {recipientPolicies
              .map(value => value.replaceAll('_', ' '))
              .join(' and ')}
            .
          </p>
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
          <Button size='sm' disabled={submitting} onClick={submit}>
            {submitting ? <BarsSpinner size={14} /> : 'Schedule reminder'}
          </Button>
        </div>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
