// Copied and adapted from Cells agent session types:
// ../cells/src/types/index.ts

export type LocalAgentProvider =
  | 'codex'
  | 'claude_code'
  | 'cursor'
  | 'copilot'
  | 'opencode'
  | 'pi'
  | 'vector_cli';

export type ManagedAgentProvider = Exclude<LocalAgentProvider, 'vector_cli'>;
export type AgentPermissionMode = 'plan' | 'ask' | 'bypass';
export type AgentThinkingLevel =
  | 'off'
  | 'low'
  | 'medium'
  | 'high'
  | 'max'
  | 'xhigh';
export type AgentContextLength = 'default' | 'extended';

export type AgentSessionMessageRole =
  | 'user'
  | 'assistant'
  | 'reasoning'
  | 'tool'
  | 'system'
  | 'error'
  | 'auth_request'
  | 'compaction'
  | 'status';

export interface AgentReplyReference {
  id: string;
  role: AgentSessionMessageRole | string;
  label: string;
  preview: string;
  title?: string | null;
}

export interface QueuedAgentMessage {
  id: string;
  text: string;
  attachments: string[];
  mode: 'after-turn' | 'after-tool' | 'stop';
  model: string | null;
  thinkingLevel: AgentThinkingLevel | null;
  permissionMode: AgentPermissionMode | null;
  fastMode?: boolean | null;
  replyTo?: AgentReplyReference | null;
}

export interface AgentSessionRequest {
  provider: ManagedAgentProvider;
  cwd: string;
  prompt: string;
  sessionKey?: string;
  model?: string | null;
  permissionMode?: AgentPermissionMode | null;
  thinkingLevel?: AgentThinkingLevel | null;
  fastMode?: boolean | null;
  contextLength?: AgentContextLength | null;
}

export interface AgentUsageStats {
  model: string | null;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  contextWindow: number | null;
  usedTokens: number | null;
  totalProcessedTokens: number | null;
  compactsAutomatically: boolean;
  updatedAt: number;
}
