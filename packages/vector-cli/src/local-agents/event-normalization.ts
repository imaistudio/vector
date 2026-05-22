import type { AgentSessionEvent } from './session-runtime';
import type { ManagedAgentProvider } from './types';

export function statusEvent(
  provider: ManagedAgentProvider,
  text: string,
): AgentSessionEvent {
  return {
    provider,
    role: 'status',
    text,
    status: 'in_progress',
  };
}

export function errorEvent(
  provider: ManagedAgentProvider,
  title: string,
  text: string,
): AgentSessionEvent {
  return {
    provider,
    role: 'error',
    title,
    text,
    status: 'failed',
  };
}
