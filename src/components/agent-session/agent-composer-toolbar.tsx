'use client';

import { Check, Gauge, Shield } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AgentIcon } from '@/components/agent-icon';
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
    <div className='text-muted-foreground flex min-w-0 flex-wrap items-center gap-1.5 text-xs'>
      <Picker
        icon={<AgentIcon agent={provider} className='size-3.5' size={14} />}
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
        className='placeholder:text-muted-foreground/55 bg-foreground/5 hover:bg-foreground/10 focus:bg-foreground/10 text-foreground/85 h-7 w-28 rounded-[8px] border-0 px-2 text-[11.5px] transition-colors outline-none'
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
          variant='ghost'
          size='xs'
          className={cn(
            'bg-foreground/5 text-muted-foreground/85 hover:bg-foreground/10 hover:text-foreground h-7 rounded-[8px] px-2 text-[11.5px]',
            contextLength === 'extended' &&
              'bg-cyan-400/14 text-cyan-100 hover:bg-cyan-400/18',
          )}
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
        variant='ghost'
        size='xs'
        className={cn(
          'bg-foreground/5 text-muted-foreground/85 hover:bg-foreground/10 hover:text-foreground h-7 rounded-[8px] px-2 text-[11.5px]',
          fastMode && 'bg-cyan-400/14 text-cyan-100 hover:bg-cyan-400/18',
        )}
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
        <Button
          type='button'
          variant='ghost'
          size='xs'
          className='bg-foreground/5 text-muted-foreground/85 hover:bg-foreground/10 hover:text-foreground h-7 gap-1.5 rounded-[8px] px-2 text-[11.5px]'
        >
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
