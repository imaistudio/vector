'use client';

import { Brain, Check, Infinity, Shield, Zap } from 'lucide-react';
import type { ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
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

const MODEL_OPTIONS: Record<
  LocalAgentProvider,
  Array<{ id: string; label: string; hint: string; unavailable?: boolean }>
> = {
  codex: [
    { id: 'gpt-5.5', label: 'GPT-5.5', hint: 'Frontier model.' },
    { id: 'gpt-5.4', label: 'GPT-5.4', hint: 'Strong everyday coding.' },
    { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', hint: 'Fast, lower cost.' },
    { id: 'gpt-5.3-codex', label: 'GPT-5.3 Codex', hint: 'Coding optimized.' },
  ],
  claude_code: [
    {
      id: 'claude-opus-4-5',
      label: 'Opus 4.5',
      hint: 'Highest capability Claude model.',
    },
    {
      id: 'claude-sonnet-4-5',
      label: 'Sonnet 4.5',
      hint: 'Balanced coding model.',
    },
    {
      id: 'claude-haiku-4-5',
      label: 'Haiku 4.5',
      hint: 'Fast Claude model.',
    },
  ],
  cursor: [
    { id: 'auto', label: 'Auto', hint: 'Cursor chooses the model.' },
    { id: 'gpt-5.5', label: 'GPT-5.5', hint: 'Frontier model.' },
    {
      id: 'claude-sonnet-4-5',
      label: 'Sonnet 4.5',
      hint: 'Claude coding model.',
    },
  ],
  copilot: [
    { id: 'auto', label: 'Auto', hint: 'Copilot chooses the model.' },
    { id: 'gpt-5.5', label: 'GPT-5.5', hint: 'OpenAI frontier model.' },
    {
      id: 'claude-sonnet-4-5',
      label: 'Sonnet 4.5',
      hint: 'Claude coding model.',
    },
  ],
  opencode: [
    { id: 'auto', label: 'Auto', hint: 'OpenCode default model.' },
    { id: 'gpt-5.5', label: 'GPT-5.5', hint: 'OpenAI frontier model.' },
    {
      id: 'claude-sonnet-4-5',
      label: 'Sonnet 4.5',
      hint: 'Claude coding model.',
    },
  ],
  pi: [
    { id: 'auto', label: 'Auto', hint: 'Pi default model.', unavailable: true },
  ],
  vector_cli: [
    {
      id: 'shell',
      label: 'Shell',
      hint: 'Manual terminal sessions do not use model selection.',
      unavailable: true,
    },
  ],
};

export function AgentComposerToolbar({
  provider,
  model,
  permissionMode,
  thinkingLevel,
  fastMode,
  contextLength,
  onSettingsChange,
}: {
  provider: LocalAgentProvider;
  model?: string | null;
  permissionMode?: AgentPermissionMode | null;
  thinkingLevel?: AgentThinkingLevel | null;
  fastMode?: boolean | null;
  contextLength?: AgentContextLength | null;
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
      <PermissionPicker
        value={permissionMode ?? 'ask'}
        onChange={permissionMode => onSettingsChange({ permissionMode })}
      />
      <ModelPicker
        provider={provider}
        value={model}
        contextLength={contextLength}
        onChange={model => onSettingsChange({ model })}
        onContextLengthChange={contextLength =>
          onSettingsChange({ contextLength })
        }
      />
      <FastModeToggle
        provider={provider}
        value={fastMode}
        onChange={fastMode => onSettingsChange({ fastMode })}
      />
      <ThinkingPicker
        value={thinkingLevel ?? 'medium'}
        onChange={thinkingLevel => onSettingsChange({ thinkingLevel })}
      />
    </div>
  );
}

function PermissionPicker({
  value,
  onChange,
}: {
  value: AgentPermissionMode;
  onChange: (value: AgentPermissionMode) => void;
}) {
  return (
    <Picker
      icon={<Shield className='size-3.5 text-sky-300/85' />}
      label={
        PERMISSION_OPTIONS.find(option => option.id === value)?.label ?? 'Ask'
      }
      heading='Permissions'
      options={PERMISSION_OPTIONS.map(option => ({
        id: option.id,
        label: option.label,
        hint: option.hint,
        selected: option.id === value,
        onSelect: () => onChange(option.id),
      }))}
    />
  );
}

function ModelPicker({
  provider,
  value,
  contextLength,
  onChange,
  onContextLengthChange,
}: {
  provider: LocalAgentProvider;
  value?: string | null;
  contextLength?: AgentContextLength | null;
  onChange: (value: string | null) => void;
  onContextLengthChange: (value: AgentContextLength) => void;
}) {
  const models = MODEL_OPTIONS[provider];
  const current =
    models.find(option => option.id === value && !option.unavailable) ??
    models.find(option => !option.unavailable) ??
    models[0];
  const supportsExtended =
    provider === 'claude_code' &&
    (current.id.includes('sonnet') || current.id.includes('opus'));

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type='button'
          className='bg-foreground/5 text-foreground/85 hover:bg-foreground/10 inline-flex h-7 min-w-0 shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-[11px] transition-colors'
          title={
            contextLength === 'extended'
              ? `Model: ${current.label} · 1M context`
              : `Model: ${current.label}`
          }
        >
          <span className='max-w-36 truncate font-medium'>{current.label}</span>
          {supportsExtended && contextLength === 'extended' ? (
            <span className='inline-flex items-center gap-0.5 rounded-[4px] bg-sky-400/15 px-1 py-px text-[9.5px] font-semibold text-sky-300'>
              <Infinity className='size-2.5' />
              1M
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align='start'
        side='top'
        sideOffset={6}
        className='w-64 p-1'
      >
        <PickerHeading>{providerModelHeading(provider)}</PickerHeading>
        {models.map(option => {
          const selected = option.id === current.id;
          return (
            <PickerOption
              key={option.id}
              label={option.label}
              hint={
                option.unavailable
                  ? 'Unavailable in the current CLI/account'
                  : option.hint
              }
              selected={selected}
              disabled={option.unavailable}
              onSelect={() => onChange(option.id)}
            />
          );
        })}
        {supportsExtended ? (
          <>
            <div className='bg-border/60 my-1 h-px' />
            <PickerHeading
              icon={<Infinity className='size-3 text-sky-300/80' />}
            >
              Context window
            </PickerHeading>
            <PickerOption
              label='200k standard'
              hint='Normal context. Applies on next send.'
              selected={(contextLength ?? 'default') === 'default'}
              onSelect={() => onContextLengthChange('default')}
            />
            <PickerOption
              label='1M beta'
              hint='Anthropic context-1m beta. Applies on next send.'
              selected={contextLength === 'extended'}
              onSelect={() => onContextLengthChange('extended')}
            />
          </>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

function ThinkingPicker({
  value,
  onChange,
}: {
  value: AgentThinkingLevel;
  onChange: (value: AgentThinkingLevel) => void;
}) {
  return (
    <Picker
      icon={<Brain className='size-3.5 text-violet-300/90' />}
      label={THINKING_LEVEL_LABEL_MAP[value]}
      heading='Thinking'
      options={THINKING_OPTIONS.map(option => ({
        id: option,
        label: THINKING_LEVEL_LABEL_MAP[option],
        selected: option === value,
        onSelect: () => onChange(option),
      }))}
    />
  );
}

function FastModeToggle({
  provider,
  value,
  onChange,
}: {
  provider: LocalAgentProvider;
  value?: boolean | null;
  onChange: (value: boolean) => void;
}) {
  if (provider !== 'codex') return null;
  const active = value === true;
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type='button'
            onClick={() => onChange(!active)}
            className={cn(
              'inline-flex size-7 shrink-0 items-center justify-center rounded-[8px] transition-colors',
              active
                ? 'bg-emerald-400/14 text-emerald-100 ring-1 ring-emerald-300/20 hover:bg-emerald-400/18'
                : 'bg-foreground/5 text-foreground/85 hover:bg-foreground/10',
            )}
            aria-label={
              active ? 'Disable Codex fast mode' : 'Enable Codex fast mode'
            }
            aria-pressed={active}
          >
            <Zap
              className={cn(
                'size-3.5',
                active ? 'text-emerald-300' : 'text-muted-foreground/75',
              )}
            />
          </button>
        </TooltipTrigger>
        <TooltipContent side='top'>
          {active
            ? 'Fast mode on: Codex uses low reasoning effort'
            : 'Fast mode off: Codex uses selected thinking'}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function Picker({
  icon,
  label,
  heading,
  options,
}: {
  icon: ReactNode;
  label: string;
  heading: string;
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
        <PickerHeading icon={icon}>{heading}</PickerHeading>
        {options.map(option => (
          <PickerOption
            key={option.id}
            label={option.label}
            hint={option.hint}
            selected={option.selected}
            onSelect={option.onSelect}
          />
        ))}
      </PopoverContent>
    </Popover>
  );
}

function PickerHeading({
  children,
  icon,
}: {
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className='text-muted-foreground/70 mb-1 flex items-center gap-1.5 px-2 pt-1 text-[10px] font-medium tracking-[0.14em] uppercase'>
      {icon}
      <span>{children}</span>
    </div>
  );
}

function PickerOption({
  label,
  hint,
  selected,
  disabled,
  onSelect,
}: {
  label: string;
  hint?: string;
  selected: boolean;
  disabled?: boolean;
  onSelect?: () => void;
}) {
  return (
    <button
      type='button'
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-2 rounded-[8px] px-2 py-1.5 text-left text-[12px] transition-colors',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : selected
            ? 'bg-foreground/8 text-foreground'
            : 'hover:bg-foreground/5 text-foreground/90',
      )}
      onClick={onSelect}
    >
      <span className='min-w-0 flex-1'>
        <span className='block truncate font-medium'>{label}</span>
        {hint ? (
          <span className='text-muted-foreground/70 block truncate text-[10.5px]'>
            {hint}
          </span>
        ) : null}
      </span>
      {selected ? <Check className='text-foreground mt-0.5 size-3.5' /> : null}
    </button>
  );
}

function providerModelHeading(provider: LocalAgentProvider): string {
  if (provider === 'claude_code') return 'Claude models';
  if (provider === 'cursor') return 'Cursor models';
  if (provider === 'copilot') return 'Copilot models';
  if (provider === 'opencode') return 'OpenCode models';
  if (provider === 'pi') return 'Pi models';
  if (provider === 'vector_cli') return 'Session';
  return 'Codex models';
}
