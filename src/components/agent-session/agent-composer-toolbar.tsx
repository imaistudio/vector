'use client';

import { Check, Gauge, Shield, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type {
  AgentContextLength,
  AgentPermissionMode,
  AgentThinkingLevel,
  LocalAgentProvider,
} from '@/lib/local-agents/types';

export const THINKING_LEVEL_LABEL_MAP: Record<AgentThinkingLevel, string> = {
  off: 'Off',
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  max: 'Max',
  xhigh: 'X High',
};

const PERMISSION_OPTIONS: Array<{
  id: AgentPermissionMode;
  label: string;
  hint: string;
}> = [
  { id: 'plan', label: 'Plan', hint: 'Read and plan only' },
  { id: 'ask', label: 'Ask', hint: 'Ask before writes/tools' },
  { id: 'bypass', label: 'Bypass', hint: 'No runtime confirmations' },
];

const THINKING_OPTIONS: AgentThinkingLevel[] = [
  'off',
  'low',
  'medium',
  'high',
  'xhigh',
  'max',
];

const PROVIDERS: Array<{ id: LocalAgentProvider; label: string }> = [
  { id: 'codex', label: 'Codex' },
  { id: 'claude_code', label: 'Claude' },
  { id: 'cursor', label: 'Cursor' },
  { id: 'copilot', label: 'Copilot' },
  { id: 'opencode', label: 'OpenCode' },
  { id: 'pi', label: 'Pi' },
];

export function AgentComposerToolbar({
  provider,
  model,
  permissionMode,
  thinkingLevel,
  fastMode,
  contextLength,
  onProviderChange,
  onSettingsChange,
}: {
  provider: LocalAgentProvider;
  model?: string | null;
  permissionMode?: AgentPermissionMode | null;
  thinkingLevel?: AgentThinkingLevel | null;
  fastMode?: boolean | null;
  contextLength?: AgentContextLength | null;
  onProviderChange?: (provider: LocalAgentProvider) => void;
  onSettingsChange: (patch: {
    model?: string | null;
    permissionMode?: AgentPermissionMode | null;
    thinkingLevel?: AgentThinkingLevel | null;
    fastMode?: boolean | null;
    contextLength?: AgentContextLength | null;
  }) => void;
}) {
  return (
    <div className='text-muted-foreground flex flex-wrap items-center gap-1 px-2 py-1.5 text-xs'>
      <Picker
        icon={<Zap className='size-3.5' />}
        label={
          PROVIDERS.find(option => option.id === provider)?.label ?? provider
        }
        options={PROVIDERS.map(option => ({
          id: option.id,
          label: option.label,
          selected: option.id === provider,
          onSelect: () => onProviderChange?.(option.id),
        }))}
      />
      <input
        value={model ?? ''}
        onChange={event =>
          onSettingsChange({ model: event.target.value || null })
        }
        placeholder='auto model'
        className='border-input bg-background h-7 w-32 rounded-md border px-2 text-xs outline-none'
      />
      <Picker
        icon={<Shield className='size-3.5' />}
        label={
          PERMISSION_OPTIONS.find(
            option => option.id === (permissionMode ?? 'ask'),
          )?.label ?? 'Ask'
        }
        options={PERMISSION_OPTIONS.map(option => ({
          id: option.id,
          label: option.label,
          hint: option.hint,
          selected: option.id === (permissionMode ?? 'ask'),
          onSelect: () => onSettingsChange({ permissionMode: option.id }),
        }))}
      />
      <Picker
        icon={<Gauge className='size-3.5' />}
        label={THINKING_LEVEL_LABEL_MAP[thinkingLevel ?? 'medium']}
        options={THINKING_OPTIONS.map(option => ({
          id: option,
          label: THINKING_LEVEL_LABEL_MAP[option],
          selected: option === (thinkingLevel ?? 'medium'),
          onSelect: () => onSettingsChange({ thinkingLevel: option }),
        }))}
      />
      {provider === 'claude_code' ? (
        <Button
          type='button'
          variant={contextLength === 'extended' ? 'secondary' : 'ghost'}
          size='xs'
          className='h-7'
          onClick={() =>
            onSettingsChange({
              contextLength:
                contextLength === 'extended' ? 'default' : 'extended',
            })
          }
        >
          1M
        </Button>
      ) : null}
      <Button
        type='button'
        variant={fastMode ? 'secondary' : 'ghost'}
        size='xs'
        className='h-7'
        onClick={() => onSettingsChange({ fastMode: !fastMode })}
      >
        Fast
      </Button>
    </div>
  );
}

function Picker({
  icon,
  label,
  options,
}: {
  icon: ReactNode;
  label: string;
  options: Array<{
    id: string;
    label: string;
    hint?: string;
    selected: boolean;
    onSelect?: () => void;
  }>;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button type='button' variant='ghost' size='xs' className='h-7 gap-1.5'>
          {icon}
          {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-56 p-1'>
        {options.map(option => (
          <button
            key={option.id}
            type='button'
            className={cn(
              'hover:bg-muted flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm',
              option.selected && 'bg-muted',
            )}
            onClick={option.onSelect}
          >
            <Check
              className={cn(
                'size-3.5',
                option.selected ? 'opacity-100' : 'opacity-0',
              )}
            />
            <span className='min-w-0 flex-1'>
              <span className='block truncate'>{option.label}</span>
              {option.hint ? (
                <span className='text-muted-foreground block truncate text-xs'>
                  {option.hint}
                </span>
              ) : null}
            </span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}
