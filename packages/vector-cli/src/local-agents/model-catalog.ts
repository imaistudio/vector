import type { AgentThinkingLevel, ManagedAgentProvider } from './types';

export interface AgentModelOption {
  id: string;
  label: string;
  hint?: string;
  isDefault?: boolean;
  available?: boolean;
  supportedEfforts: AgentThinkingLevel[];
  defaultEffort: AgentThinkingLevel;
}

export function fallbackModels(
  provider: ManagedAgentProvider,
): AgentModelOption[] {
  if (provider === 'claude_code') {
    return [
      {
        id: 'claude-sonnet-4-6',
        label: 'Sonnet 4.6',
        hint: 'Best for everyday tasks',
        isDefault: true,
        supportedEfforts: ['off', 'low', 'medium', 'high', 'max'],
        defaultEffort: 'medium',
      },
      {
        id: 'claude-opus-4-7',
        label: 'Opus 4.7',
        hint: 'Most capable for complex work',
        supportedEfforts: ['off', 'low', 'medium', 'high', 'xhigh', 'max'],
        defaultEffort: 'medium',
      },
    ];
  }

  if (provider === 'codex') {
    return [
      {
        id: 'gpt-5.4',
        label: 'GPT-5.4',
        hint: 'Strong model for everyday coding',
        isDefault: true,
        supportedEfforts: ['low', 'medium', 'high', 'xhigh'],
        defaultEffort: 'medium',
      },
      {
        id: 'gpt-5.5',
        label: 'GPT-5.5',
        hint: 'Frontier model for complex work',
        supportedEfforts: ['low', 'medium', 'high', 'xhigh'],
        defaultEffort: 'medium',
      },
    ];
  }

  return [
    {
      id: 'auto',
      label: 'Auto',
      hint: 'Let the provider choose',
      isDefault: true,
      supportedEfforts: ['off', 'low', 'medium', 'high', 'xhigh'],
      defaultEffort: 'medium',
    },
  ];
}
