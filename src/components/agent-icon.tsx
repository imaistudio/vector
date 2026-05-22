'use client';

import { Bot, Sparkles } from 'lucide-react';
import {
  ClaudeCodeIcon,
  CursorBrandIcon,
  GitHubCopilotIcon,
  OpenAIAvatarIcon,
} from '@/components/brand-icons';
import { cn } from '@/lib/utils';
import type { LocalAgentProvider } from '@/lib/local-agents/types';

// Copied and adapted from Cells:
// ../cells/src/components/agent-icon.tsx
export function AgentIcon({
  agent,
  className,
  size = 14,
}: {
  agent: LocalAgentProvider | string | null | undefined;
  className?: string;
  size?: number | string;
}) {
  const numericSize = typeof size === 'number' ? size : Number(size) || 14;

  if (agent === 'claude_code' || agent === 'claude') {
    return <ClaudeCodeIcon className={cn('shrink-0', className)} size={size} />;
  }

  if (agent === 'codex') {
    return (
      <OpenAIAvatarIcon
        className={cn('shrink-0', className)}
        size={numericSize}
      />
    );
  }

  if (agent === 'cursor') {
    return (
      <CursorBrandIcon className={cn('shrink-0', className)} size={size} />
    );
  }

  if (agent === 'copilot') {
    return (
      <GitHubCopilotIcon className={cn('shrink-0', className)} size={size} />
    );
  }

  if (agent === 'opencode') {
    return (
      <Bot
        className={cn('shrink-0', className)}
        style={{ width: size, height: size }}
      />
    );
  }

  if (agent === 'pi') {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full border border-current/15 bg-current/8 leading-none font-semibold',
          className,
        )}
        style={{
          width: numericSize,
          height: numericSize,
          fontSize: Math.max(9, numericSize * 0.75),
        }}
        aria-label='Pi'
      >
        pi
      </span>
    );
  }

  return (
    <Sparkles
      className={cn('shrink-0', className)}
      style={{ width: size, height: size }}
    />
  );
}
