// Copied and adapted from Cells:
// ../cells/src/lib/agent-session-queue.ts

import type { QueuedAgentMessage } from './types';

interface SanitizeQueuedMessagesOptions {
  includeStop?: boolean;
  backfillIds?: boolean;
}

export function createQueuedMessageId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `q_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

export function sanitizeQueuedMessages(
  messages: QueuedAgentMessage[] | null | undefined,
  options: SanitizeQueuedMessagesOptions = {},
): QueuedAgentMessage[] {
  const includeStop = options.includeStop === true;
  const backfillIds = options.backfillIds !== false;
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
      id:
        typeof message.id === 'string' && message.id.trim().length > 0
          ? message.id
          : backfillIds
            ? createQueuedMessageId()
            : '',
      attachments: message.attachments.filter(
        (attachment): attachment is string =>
          typeof attachment === 'string' && attachment.trim().length > 0,
      ),
      model: typeof message.model === 'string' ? message.model : null,
      thinkingLevel: message.thinkingLevel ?? null,
      permissionMode: message.permissionMode ?? null,
      fastMode: message.fastMode ?? null,
      replyTo: message.replyTo ?? null,
    }))
    .filter(message => message.id.length > 0);
}

export function getQueuedMessagesSignature(
  messages: QueuedAgentMessage[] | null | undefined,
) {
  return JSON.stringify(sanitizeQueuedMessages(messages));
}

export function areQueuedMessagesEqual(
  left: QueuedAgentMessage[] | null | undefined,
  right: QueuedAgentMessage[] | null | undefined,
) {
  return getQueuedMessagesSignature(left) === getQueuedMessagesSignature(right);
}
