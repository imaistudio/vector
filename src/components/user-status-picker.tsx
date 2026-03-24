'use client';

import { useState } from 'react';
import { api, useCachedQuery } from '@/lib/convex';
import { useMutation } from 'convex/react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { X, SmilePlus } from 'lucide-react';
import {
  type PresenceStatus,
  getPresenceColor,
  getPresenceLabel,
} from '@/components/user-status-indicator';
import { cn } from '@/lib/utils';

type SettablePresence = 'online' | 'idle' | 'dnd' | 'invisible';

const PRESENCE_OPTIONS: {
  value: SettablePresence;
  description: string;
}[] = [
  { value: 'online', description: 'You are visible to others' },
  { value: 'idle', description: 'You appear as away' },
  { value: 'dnd', description: 'Suppress notifications' },
  { value: 'invisible', description: 'Appear offline to others' },
];

const CLEAR_AFTER_OPTIONS = [
  { label: "Don't clear", value: null },
  { label: '30 minutes', value: 30 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '4 hours', value: 4 * 60 * 60 * 1000 },
  { label: 'Today', value: 'today' as const },
] as const;

const COMMON_EMOJIS = [
  '😊',
  '🎯',
  '💻',
  '🚀',
  '☕',
  '🎉',
  '🔥',
  '💡',
  '📝',
  '🏠',
  '🎮',
  '🍕',
  '😴',
  '🏃',
  '📅',
  '🔒',
  '✈️',
  '🎵',
  '📚',
  '🌴',
];

function getClearsAtTimestamp(
  option: (typeof CLEAR_AFTER_OPTIONS)[number]['value'],
): number | undefined {
  if (option === null) return undefined;
  if (option === 'today') {
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return end.getTime();
  }
  return Date.now() + option;
}

export function UserStatusPicker() {
  const status = useCachedQuery(api.status.getCurrentUserStatus);
  const setPresence = useMutation(api.status.setPresence);
  const setCustomStatus = useMutation(api.status.setCustomStatus);
  const clearCustomStatus = useMutation(api.status.clearCustomStatus);

  const [open, setOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [customText, setCustomText] = useState('');
  const [customEmoji, setCustomEmoji] = useState('😊');
  const [clearAfterIndex, setClearAfterIndex] = useState(0);
  const [presenceLoading, setPresenceLoading] = useState<string | null>(null);
  const [customLoading, setCustomLoading] = useState(false);

  const currentPresence: PresenceStatus = status?.presence ?? 'online';
  const hasCustomStatus = status?.customText || status?.customEmoji;

  const handlePresenceChange = async (
    presence: 'online' | 'idle' | 'dnd' | 'invisible',
  ) => {
    setPresenceLoading(presence);
    try {
      await setPresence({ presence });
    } finally {
      setPresenceLoading(null);
    }
  };

  const handleSetCustomStatus = async () => {
    if (!customText.trim() && !customEmoji) return;
    setCustomLoading(true);
    try {
      await setCustomStatus({
        customText: customText.trim() || undefined,
        customEmoji: customEmoji || undefined,
        clearsAt: getClearsAtTimestamp(
          CLEAR_AFTER_OPTIONS[clearAfterIndex].value,
        ),
      });
      setCustomOpen(false);
      setOpen(false);
    } finally {
      setCustomLoading(false);
    }
  };

  const handleClearCustomStatus = async () => {
    await clearCustomStatus();
  };

  const openCustomForm = () => {
    setCustomText(status?.customText ?? '');
    setCustomEmoji(status?.customEmoji ?? '😊');
    setClearAfterIndex(0);
    setCustomOpen(true);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant='ghost'
          size='sm'
          className='h-auto w-full justify-start gap-2 px-2 py-1.5 text-left'
        >
          <span
            className={cn(
              'inline-block size-2.5 shrink-0 rounded-full',
              getPresenceColor(currentPresence),
            )}
          />
          <span className='min-w-0 truncate text-sm'>
            {hasCustomStatus ? (
              <>
                {status?.customEmoji && (
                  <span className='mr-1'>{status.customEmoji}</span>
                )}
                <span className='text-muted-foreground'>
                  {status?.customText || getPresenceLabel(currentPresence)}
                </span>
              </>
            ) : (
              <span className='text-muted-foreground'>
                {getPresenceLabel(currentPresence)}
              </span>
            )}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className='w-72 p-0' align='start' sideOffset={8}>
        {customOpen ? (
          <CustomStatusForm
            customText={customText}
            customEmoji={customEmoji}
            clearAfterIndex={clearAfterIndex}
            loading={customLoading}
            onCustomTextChange={setCustomText}
            onCustomEmojiChange={setCustomEmoji}
            onClearAfterChange={setClearAfterIndex}
            onSubmit={handleSetCustomStatus}
            onBack={() => setCustomOpen(false)}
          />
        ) : (
          <div className='flex flex-col'>
            {/* Custom status section */}
            <div className='border-b p-2'>
              {hasCustomStatus ? (
                <div className='bg-secondary flex items-center gap-2 rounded-md p-2'>
                  <span className='text-sm'>
                    {status?.customEmoji}{' '}
                    <span className='text-muted-foreground'>
                      {status?.customText}
                    </span>
                  </span>
                  <Button
                    variant='ghost'
                    size='sm'
                    className='ml-auto size-6 p-0'
                    onClick={handleClearCustomStatus}
                  >
                    <X className='size-3' />
                  </Button>
                </div>
              ) : null}
              <Button
                variant='ghost'
                size='sm'
                className='mt-1 w-full justify-start gap-2'
                onClick={openCustomForm}
              >
                <SmilePlus className='size-4' />
                <span>
                  {hasCustomStatus ? 'Edit custom status' : 'Set custom status'}
                </span>
              </Button>
            </div>

            {/* Presence options */}
            <div className='p-1'>
              {PRESENCE_OPTIONS.map(opt => {
                const isActive = currentPresence === opt.value;
                const isLoading = presenceLoading === opt.value;
                return (
                  <button
                    key={opt.value}
                    className={cn(
                      'hover:bg-accent flex w-full items-center gap-3 rounded-md px-2 py-1.5 text-left text-sm transition-colors',
                      isActive && 'bg-accent',
                    )}
                    onClick={() => handlePresenceChange(opt.value)}
                    disabled={isLoading}
                  >
                    <span
                      className={cn(
                        'inline-block size-2.5 rounded-full',
                        getPresenceColor(opt.value),
                        opt.value === 'dnd' && 'ring-background relative',
                      )}
                    />
                    <div className='min-w-0 flex-1'>
                      <div className='font-medium'>
                        {getPresenceLabel(opt.value)}
                      </div>
                      <div className='text-muted-foreground text-xs'>
                        {opt.description}
                      </div>
                    </div>
                    {isActive && (
                      <span className='text-muted-foreground text-xs'>
                        Current
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

function CustomStatusForm({
  customText,
  customEmoji,
  clearAfterIndex,
  loading,
  onCustomTextChange,
  onCustomEmojiChange,
  onClearAfterChange,
  onSubmit,
  onBack,
}: {
  customText: string;
  customEmoji: string;
  clearAfterIndex: number;
  loading: boolean;
  onCustomTextChange: (val: string) => void;
  onCustomEmojiChange: (val: string) => void;
  onClearAfterChange: (idx: number) => void;
  onSubmit: () => void;
  onBack: () => void;
}) {
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  return (
    <div className='flex flex-col gap-3 p-3'>
      <div className='flex items-center gap-2'>
        <button
          className='text-muted-foreground hover:text-foreground text-sm'
          onClick={onBack}
        >
          &larr;
        </button>
        <span className='text-sm font-medium'>Set custom status</span>
      </div>

      {/* Emoji + text input */}
      <div className='flex items-center gap-2'>
        <div className='relative'>
          <button
            className='hover:bg-accent flex size-9 items-center justify-center rounded-md border text-lg'
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            {customEmoji || <SmilePlus className='size-4' />}
          </button>
          {showEmojiPicker && (
            <div className='bg-popover absolute top-full left-0 z-50 mt-1 grid grid-cols-5 gap-1 rounded-md border p-2 shadow-md'>
              {COMMON_EMOJIS.map(emoji => (
                <button
                  key={emoji}
                  className='hover:bg-accent flex size-8 items-center justify-center rounded text-lg'
                  onClick={() => {
                    onCustomEmojiChange(emoji);
                    setShowEmojiPicker(false);
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
        <Input
          placeholder="What's your status?"
          value={customText}
          onChange={e => onCustomTextChange(e.target.value)}
          className='h-9 flex-1 text-sm'
          maxLength={128}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.preventDefault();
              onSubmit();
            }
          }}
        />
      </div>

      {/* Clear after selector */}
      <div>
        <label className='text-muted-foreground mb-1 block text-xs'>
          Clear after
        </label>
        <div className='flex flex-wrap gap-1'>
          {CLEAR_AFTER_OPTIONS.map((opt, idx) => (
            <button
              key={opt.label}
              className={cn(
                'rounded-md px-2 py-1 text-xs transition-colors',
                idx === clearAfterIndex
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary hover:bg-accent',
              )}
              onClick={() => onClearAfterChange(idx)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save button */}
      <Button
        size='sm'
        onClick={onSubmit}
        disabled={loading || (!customText.trim() && !customEmoji)}
      >
        {loading ? 'Saving...' : 'Save'}
      </Button>
    </div>
  );
}
