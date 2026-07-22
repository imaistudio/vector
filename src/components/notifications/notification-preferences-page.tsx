'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell, Laptop, Send, Smartphone } from 'lucide-react';
import { toast } from 'sonner';
import { BarsSpinner } from '@/components/bars-spinner';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { api, useCachedQuery, useMutation } from '@/lib/convex';
import {
  getCurrentBrowserPushEndpoint,
  isPushSupported,
  subscribeCurrentBrowserToPush,
  unsubscribeCurrentBrowserPush,
} from '@/lib/notifications';
import {
  updateNotificationPreference,
  updateQuery,
} from '@/lib/optimistic-updates';

type Preferences = NonNullable<
  ReturnType<
    typeof useCachedQuery<typeof api.notifications.queries.getPreferences>
  >
>;

type PushSubscription = NonNullable<
  ReturnType<
    typeof useCachedQuery<
      typeof api.notifications.queries.listPushSubscriptions
    >
  >
>[number];

const channelConfig = [
  { key: 'inAppEnabled', label: 'In-app', icon: Bell },
  { key: 'emailEnabled', label: 'Email', icon: Send },
  { key: 'pushEnabled', label: 'Push', icon: Smartphone },
] as const;

const categoryLabels: Record<string, { title: string; description: string }> = {
  invites: {
    title: 'Invitations',
    description: 'Organization invites and membership prompts.',
  },
  assignments: {
    title: 'Assignments',
    description: 'New Work and Task assignments or transfers.',
  },
  mentions: {
    title: 'Mentions',
    description: 'Comments that explicitly call you into the conversation.',
  },
  comments: {
    title: 'Comments',
    description: 'New comments on work already assigned to you.',
  },
  work_sessions: {
    title: 'Work sessions',
    description: 'Completed or failed agent executions on your Work.',
  },
  team_status_changes: {
    title: 'Team status changes',
    description: 'Shared-team users coming online or updating their status.',
  },
  requests: {
    title: 'Requests',
    description: 'Routing, intake, and requester updates.',
  },
  handoffs: {
    title: 'Handoffs',
    description: 'Ownership proposals, responses, and Task transfers.',
  },
  reviews: {
    title: 'Reviews',
    description: 'Work or Requests ready for review and requested changes.',
  },
  attention: {
    title: 'Human attention',
    description: 'Explicit agent attention and blocked Work.',
  },
  reminders: {
    title: 'Reminders',
    description: 'Scheduled and recurring responsibility reminders.',
  },
  github: {
    title: 'GitHub',
    description: 'Linked development evidence that needs a human action.',
  },
};

const browserMatchers = [
  { pattern: /Edg\/(\d+)/, label: 'Microsoft Edge' },
  { pattern: /(?:Firefox|FxiOS)\/(\d+)/, label: 'Firefox' },
  { pattern: /(?:Chrome|CriOS)\/(\d+)/, label: 'Chrome' },
  { pattern: /Version\/(\d+).+Safari/, label: 'Safari' },
] as const;

function getPlatformLabel(userAgent: string) {
  if (/iPhone|iPad/.test(userAgent)) return 'iOS';
  if (/Android/.test(userAgent)) return 'Android';
  if (/Windows/.test(userAgent)) return 'Windows';
  if (/Macintosh|Mac OS X/.test(userAgent)) return 'macOS';
  if (/Linux/.test(userAgent)) return 'Linux';
  return null;
}

function getBrowserLabel(userAgent?: string) {
  if (!userAgent) return null;

  let browser: string | null = null;
  for (const matcher of browserMatchers) {
    const version = userAgent.match(matcher.pattern)?.[1];
    if (version) {
      browser = `${matcher.label} ${version}`;
      break;
    }
  }

  const platform = getPlatformLabel(userAgent);

  if (browser && platform) return `${browser} on ${platform}`;
  if (browser) return browser;
  if (platform) return `Browser on ${platform}`;
  return null;
}

function getPushStatus(
  permission: NotificationPermission | 'unsupported',
  isEnabledOnCurrentBrowser: boolean,
) {
  if (permission === 'unsupported') {
    return {
      title: 'Push is not supported in this browser',
      description: 'Use a supported browser to receive push notifications.',
    };
  }
  if (permission === 'denied') {
    return {
      title: 'Push is blocked in this browser',
      description:
        'Allow notifications for imai.tech in your browser settings to enable it.',
    };
  }
  if (isEnabledOnCurrentBrowser) {
    return {
      title: 'Push is enabled on this browser',
      description: 'Enabled push events will be delivered to this device.',
    };
  }
  if (permission === 'granted') {
    return {
      title: 'This browser is ready for push',
      description: 'Enable it to receive push notifications on this device.',
    };
  }
  return {
    title: 'Enable browser push',
    description: 'Your browser will ask for notification permission once.',
  };
}

export function NotificationPreferencesPage() {
  const preferences = useCachedQuery(api.notifications.queries.getPreferences);
  const subscriptions = useCachedQuery(
    api.notifications.queries.listPushSubscriptions,
  );
  const updatePreferences = useMutation(
    api.notifications.mutations.updatePreferences,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(store, api.notifications.queries.getPreferences, {}, current =>
      updateNotificationPreference(current, args.category, preference => ({
        ...preference,
        inAppEnabled: args.inAppEnabled,
        emailEnabled: args.emailEnabled,
        pushEnabled: args.pushEnabled,
      })),
    );
  });
  const upsertPushSubscription = useMutation(
    api.notifications.mutations.upsertPushSubscription,
  );
  const removePushSubscription = useMutation(
    api.notifications.mutations.removePushSubscription,
  ).withOptimisticUpdate((store, args) => {
    updateQuery(
      store,
      api.notifications.queries.listPushSubscriptions,
      {},
      current =>
        current.filter(
          subscription => subscription._id !== args.subscriptionId,
        ),
    );
  });
  const displayPreferences = preferences ?? [];
  const [permission, setPermission] = useState<
    NotificationPermission | 'unsupported'
  >('unsupported');
  const [currentPushEndpoint, setCurrentPushEndpoint] = useState<
    string | null | undefined
  >(undefined);
  const [isSyncingPush, setIsSyncingPush] = useState(false);
  const [removingSubscriptionId, setRemovingSubscriptionId] = useState<
    PushSubscription['_id'] | null
  >(null);

  useEffect(() => {
    let cancelled = false;

    if (!isPushSupported()) {
      setPermission('unsupported');
      setCurrentPushEndpoint(null);
      return;
    }

    setPermission(Notification.permission);
    void getCurrentBrowserPushEndpoint()
      .then(endpoint => {
        if (!cancelled) setCurrentPushEndpoint(endpoint);
      })
      .catch(() => {
        if (!cancelled) setCurrentPushEndpoint(null);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const activeSubscriptions = useMemo(
    () => subscriptions?.filter(subscription => !subscription.disabledAt) ?? [],
    [subscriptions],
  );

  const currentSubscription = useMemo(
    () =>
      currentPushEndpoint
        ? activeSubscriptions.find(
            subscription => subscription.endpoint === currentPushEndpoint,
          )
        : undefined,
    [activeSubscriptions, currentPushEndpoint],
  );

  const handleToggle = async (
    category: Preferences[number]['category'],
    key: (typeof channelConfig)[number]['key'],
  ) => {
    const nextPreferences = displayPreferences.map(preference =>
      preference.category === category
        ? {
            ...preference,
            [key]: !preference[key],
          }
        : preference,
    );

    const next = nextPreferences.find(
      preference => preference.category === category,
    );
    if (!next) return;

    try {
      await updatePreferences({
        category,
        inAppEnabled: next.inAppEnabled,
        emailEnabled: next.emailEnabled,
        pushEnabled: next.pushEnabled,
      });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to update preference',
      );
    }
  };

  const handleEnablePush = async () => {
    try {
      setIsSyncingPush(true);
      const subscription = await subscribeCurrentBrowserToPush();
      const userAgent =
        typeof navigator !== 'undefined' ? navigator.userAgent : undefined;
      await upsertPushSubscription({
        ...subscription,
        deviceLabel: getBrowserLabel(userAgent) ?? 'Browser',
        userAgent,
      });
      setCurrentPushEndpoint(subscription.endpoint);
      setPermission(Notification.permission);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to enable push',
      );
    } finally {
      setIsSyncingPush(false);
    }
  };

  const handleDisableCurrentPush = async () => {
    try {
      setIsSyncingPush(true);
      const endpoint = await unsubscribeCurrentBrowserPush(
        currentPushEndpoint ?? undefined,
      );
      const current = activeSubscriptions.find(
        subscription => subscription.endpoint === endpoint,
      );
      if (current) {
        await removePushSubscription({ subscriptionId: current._id });
      }
      setCurrentPushEndpoint(null);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to disable push',
      );
    } finally {
      setIsSyncingPush(false);
    }
  };

  const handleRemoveSubscription = async (subscription: PushSubscription) => {
    try {
      setRemovingSubscriptionId(subscription._id);
      if (subscription.endpoint === currentPushEndpoint) {
        await unsubscribeCurrentBrowserPush(subscription.endpoint);
        setCurrentPushEndpoint(null);
      }
      await removePushSubscription({ subscriptionId: subscription._id });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Failed to remove browser',
      );
    } finally {
      setRemovingSubscriptionId(null);
    }
  };

  const pushStatus = getPushStatus(permission, Boolean(currentSubscription));

  if (preferences === undefined || subscriptions === undefined) {
    return (
      <div className='bg-background h-full'>
        <div className='border-b'>
          <div className='flex items-center gap-1.5 p-1 pl-8 lg:pl-1'>
            <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
              <Bell className='size-3.5' />
              Notifications
            </span>
          </div>
        </div>
        <div className='mx-auto flex w-full max-w-4xl flex-col gap-5 p-3 sm:p-5'>
          <div className='flex flex-col gap-1 px-1'>
            <Skeleton className='h-5 w-48' />
            <Skeleton className='h-3 w-72 max-w-full' />
          </div>
          <div className='flex flex-col gap-2'>
            <div className='flex flex-col gap-1 px-1'>
              <Skeleton className='h-4 w-32' />
              <Skeleton className='h-3 w-56 max-w-full' />
            </div>
            <div className='overflow-hidden rounded-md border'>
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className='flex items-center gap-3 border-b px-3 py-2 last:border-b-0'
                >
                  <div className='flex min-w-0 flex-1 flex-col gap-1'>
                    <Skeleton className='h-4 w-32' />
                    <Skeleton className='h-3 w-64 max-w-full' />
                  </div>
                  {Array.from({ length: 3 }).map((__, channelIndex) => (
                    <Skeleton key={channelIndex} className='size-4 shrink-0' />
                  ))}
                </div>
              ))}
            </div>
          </div>
          <Skeleton className='h-32 rounded-md' />
        </div>
      </div>
    );
  }

  const isCheckingCurrentPush = currentPushEndpoint === undefined;
  const canEnableCurrentPush =
    permission !== 'unsupported' && permission !== 'denied';

  return (
    <div className='bg-background h-full'>
      <div className='border-b'>
        <div className='flex items-center gap-1.5 p-1 pl-8 lg:pl-1'>
          <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
            <Bell className='size-3.5' />
            Notifications
          </span>
        </div>
      </div>

      <div className='mx-auto flex w-full max-w-4xl flex-col gap-5 p-3 sm:p-5'>
        <div className='flex flex-col gap-1 px-1'>
          <h1 className='text-base font-semibold'>Notification preferences</h1>
          <p className='text-muted-foreground text-xs'>
            Choose which updates reach you and where they are delivered.
          </p>
        </div>

        <section className='flex flex-col gap-2'>
          <div className='flex flex-col gap-0.5 px-1'>
            <h2 className='text-sm font-medium'>Delivery by activity</h2>
            <p className='text-muted-foreground text-xs'>
              Changes save instantly. Uncheck a channel to mute it for that
              activity.
            </p>
          </div>

          <div className='overflow-hidden rounded-md border'>
            <Table className='min-w-[34rem] table-fixed'>
              <TableHeader>
                <TableRow className='hover:bg-transparent'>
                  <TableHead className='h-9 px-3 text-xs'>Activity</TableHead>
                  {channelConfig.map(channel => {
                    const Icon = channel.icon;
                    return (
                      <TableHead
                        key={channel.key}
                        className='h-9 w-20 px-2 text-center text-xs'
                      >
                        <span className='inline-flex items-center justify-center gap-1.5'>
                          <Icon className='size-3.5' />
                          {channel.label}
                        </span>
                      </TableHead>
                    );
                  })}
                </TableRow>
              </TableHeader>
              <TableBody>
                {displayPreferences.map(preference => {
                  const category = categoryLabels[preference.category] ?? {
                    title: preference.category,
                    description: '',
                  };
                  return (
                    <TableRow key={preference.category}>
                      <TableCell className='px-3 py-2 whitespace-normal'>
                        <p className='text-sm font-medium'>{category.title}</p>
                        <p className='text-muted-foreground text-xs leading-4'>
                          {category.description}
                        </p>
                      </TableCell>
                      {channelConfig.map(channel => {
                        const enabled = preference[channel.key];
                        return (
                          <TableCell
                            key={channel.key}
                            className='w-20 px-2 py-2 text-center'
                          >
                            <span className='inline-flex justify-center'>
                              <Checkbox
                                checked={enabled}
                                aria-label={`${channel.label} notifications for ${category.title}`}
                                onCheckedChange={() =>
                                  void handleToggle(
                                    preference.category,
                                    channel.key,
                                  )
                                }
                              />
                            </span>
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </section>

        <section className='flex flex-col gap-2'>
          <div className='flex flex-col gap-0.5 px-1'>
            <h2 className='text-sm font-medium'>Browser push</h2>
            <p className='text-muted-foreground text-xs'>
              Manage permission for this browser and devices that can receive
              push notifications.
            </p>
          </div>

          <div className='overflow-hidden rounded-md border'>
            <div className='flex items-start justify-between gap-3 px-3 py-3'>
              {isCheckingCurrentPush ? (
                <>
                  <span className='sr-only'>Checking browser push status</span>
                  <div className='flex min-w-0 flex-1 items-center gap-2.5'>
                    <Skeleton className='size-8 shrink-0 rounded-md' />
                    <div className='flex min-w-0 flex-1 flex-col gap-1'>
                      <Skeleton className='h-4 w-48 max-w-full' />
                      <Skeleton className='h-3 w-64 max-w-full' />
                    </div>
                  </div>
                  <Skeleton className='h-7 w-28 shrink-0 rounded-md' />
                </>
              ) : (
                <>
                  <div className='flex min-w-0 flex-1 items-center gap-2.5'>
                    <span className='bg-muted text-muted-foreground flex size-8 shrink-0 items-center justify-center rounded-md'>
                      <Laptop className='size-4' />
                    </span>
                    <div className='min-w-0'>
                      <p className='text-sm font-medium'>{pushStatus.title}</p>
                      <p className='text-muted-foreground text-xs leading-4'>
                        {pushStatus.description}
                      </p>
                    </div>
                  </div>

                  {canEnableCurrentPush ? (
                    currentSubscription ? (
                      <Button
                        size='sm'
                        variant='outline'
                        className='shrink-0'
                        disabled={isSyncingPush}
                        aria-label={
                          isSyncingPush
                            ? 'Disabling push'
                            : 'Disable push on this browser'
                        }
                        onClick={() => void handleDisableCurrentPush()}
                      >
                        {isSyncingPush ? (
                          <BarsSpinner size={12} aria-hidden='true' />
                        ) : (
                          'Disable'
                        )}
                      </Button>
                    ) : (
                      <Button
                        size='sm'
                        className='shrink-0'
                        disabled={isSyncingPush}
                        aria-label={
                          isSyncingPush
                            ? 'Enabling push'
                            : 'Enable push on this browser'
                        }
                        onClick={() => void handleEnablePush()}
                      >
                        {isSyncingPush ? (
                          <BarsSpinner size={12} aria-hidden='true' />
                        ) : (
                          'Enable this browser'
                        )}
                      </Button>
                    )
                  ) : null}
                </>
              )}
            </div>

            <div className='border-t'>
              <div className='bg-muted/40 flex items-center justify-between gap-3 px-3 py-2'>
                <p className='text-xs font-medium'>Enabled browsers</p>
                <span className='text-muted-foreground text-xs tabular-nums'>
                  {activeSubscriptions.length}
                </span>
              </div>

              {activeSubscriptions.length === 0 ? (
                <div className='text-muted-foreground flex items-center gap-2 px-3 py-2.5 text-xs'>
                  <Laptop className='size-3.5' />
                  No browsers are enabled yet.
                </div>
              ) : (
                <div className='divide-y'>
                  {activeSubscriptions.map(subscription => {
                    const isCurrent =
                      subscription.endpoint === currentPushEndpoint;
                    const browserLabel =
                      getBrowserLabel(subscription.userAgent) ??
                      subscription.deviceLabel ??
                      'Browser';
                    const isRemoving =
                      removingSubscriptionId === subscription._id;
                    return (
                      <div
                        key={subscription._id}
                        className='flex min-w-0 items-center justify-between gap-3 px-3 py-2'
                      >
                        <div className='flex min-w-0 flex-1 items-center gap-2.5'>
                          <Laptop className='text-muted-foreground size-4 shrink-0' />
                          <div className='min-w-0 flex-1'>
                            <p className='truncate text-sm font-medium'>
                              {browserLabel}
                            </p>
                            <p className='text-muted-foreground truncate text-xs'>
                              {isCurrent ? 'This browser' : 'Push enabled'}
                            </p>
                          </div>
                        </div>
                        <Button
                          variant='ghost'
                          size='xs'
                          className='shrink-0'
                          disabled={isRemoving || isSyncingPush}
                          aria-label={
                            isRemoving
                              ? `Removing ${browserLabel}`
                              : `Remove ${browserLabel}`
                          }
                          onClick={() =>
                            void handleRemoveSubscription(subscription)
                          }
                        >
                          {isRemoving ? (
                            <BarsSpinner size={10} aria-hidden='true' />
                          ) : (
                            'Remove'
                          )}
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
