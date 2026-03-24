'use client';

import type { ComponentProps } from 'react';
import Avvvatars from 'avvvatars-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import {
  StatusIndicator,
  type PresenceStatus,
} from '@/components/user-status-indicator';

const avatarPixels = {
  sm: 24,
  default: 32,
  lg: 40,
} as const;

type AvatarSize = keyof typeof avatarPixels;

interface UserAvatarProps
  extends Omit<ComponentProps<typeof Avatar>, 'children' | 'size'> {
  name?: string | null;
  email?: string | null;
  image?: string | null;
  userId?: string | null;
  size?: AvatarSize;
  fallbackClassName?: string;
  showStatus?: boolean;
  presence?: PresenceStatus | null;
}

export function UserAvatar({
  name,
  email,
  image,
  userId,
  size = 'default',
  className,
  fallbackClassName,
  showStatus = false,
  presence,
  ...props
}: UserAvatarProps) {
  const label = name?.trim() || email?.trim() || 'User avatar';
  const seed = email?.trim() || name?.trim() || userId?.trim() || 'user';
  const pixelSize = avatarPixels[size];

  return (
    <Avatar size={size} className={className} {...props}>
      {image ? <AvatarImage src={image} alt={label} /> : null}
      <AvatarFallback
        className={cn(
          'overflow-hidden bg-transparent p-0 text-transparent',
          fallbackClassName,
        )}
      >
        <div className='size-full [&>svg]:size-full'>
          <Avvvatars
            value={seed}
            style='shape'
            size={pixelSize}
            radius={pixelSize}
          />
        </div>
      </AvatarFallback>
      {showStatus && presence && (
        <StatusIndicator presence={presence} size={size} />
      )}
    </Avatar>
  );
}
