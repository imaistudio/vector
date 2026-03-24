'use client';

import { cn } from '@/lib/utils';

export type PresenceStatus =
  | 'online'
  | 'idle'
  | 'dnd'
  | 'invisible'
  | 'offline';

const presenceColors: Record<PresenceStatus, string> = {
  online: 'bg-emerald-500',
  idle: 'bg-amber-400',
  dnd: 'bg-red-500',
  invisible: 'bg-gray-400',
  offline: 'bg-gray-400',
};

const presenceLabels: Record<PresenceStatus, string> = {
  online: 'Online',
  idle: 'Idle',
  dnd: 'Do Not Disturb',
  invisible: 'Invisible',
  offline: 'Offline',
};

export function getPresenceColor(presence: PresenceStatus) {
  return presenceColors[presence];
}

export function getPresenceLabel(presence: PresenceStatus) {
  return presenceLabels[presence];
}

interface StatusIndicatorProps {
  presence: PresenceStatus;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

/**
 * Colored dot indicating user presence status.
 * Designed to overlay on avatars (positioned absolute).
 */
export function StatusIndicator({
  presence,
  size = 'default',
  className,
}: StatusIndicatorProps) {
  return (
    <span
      className={cn(
        'ring-background absolute right-0 bottom-0 z-10 block rounded-full ring-2',
        presenceColors[presence],
        // DND gets a horizontal line through it
        presence === 'dnd' &&
          'after:bg-background after:absolute after:top-1/2 after:left-1/2 after:h-[2px] after:w-1/2 after:-translate-x-1/2 after:-translate-y-1/2 after:rounded-full',
        size === 'sm' && 'size-2',
        size === 'default' && 'size-2.5',
        size === 'lg' && 'size-3',
        className,
      )}
      aria-label={presenceLabels[presence]}
    />
  );
}
