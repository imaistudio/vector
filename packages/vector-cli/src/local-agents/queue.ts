// Copied and adapted from Cells:
// ../cells/src/lib/agent-session-queue.ts

import type { QueuedAgentMessage } from './types';

export function createQueuedMessageId(): string {
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeQueuedMessages(
  messages: QueuedAgentMessage[] | null | undefined,
  includeStop = false,
): QueuedAgentMessage[] {
  return (messages ?? [])
    .filter((message): message is QueuedAgentMessage => {
      if (
        !message ||
        typeof message.text !== 'string' ||
        !Array.isArray(message.attachments)
      ) {
        return false;
      }
      if (message.mode === 'after-turn' || message.mode === 'after-tool') {
        return true;
      }
      return includeStop && message.mode === 'stop';
    })
    .map(message => ({
      ...message,
      id: message.id?.trim() || createQueuedMessageId(),
      attachments: message.attachments.filter(
        attachment => typeof attachment === 'string' && attachment.trim(),
      ),
      model: typeof message.model === 'string' ? message.model : null,
      thinkingLevel: message.thinkingLevel ?? null,
      permissionMode: message.permissionMode ?? null,
      fastMode: message.fastMode ?? null,
      replyTo: message.replyTo ?? null,
    }));
}
