// Copied and adapted from Cells agent session types:
// ../cells/src/types/index.ts

import type { Id } from '@/convex/_generated/dataModel';

export type LocalAgentProvider =
  | 'codex'
  | 'claude_code'
  | 'cursor'
  | 'copilot'
  | 'opencode'
  | 'pi'
  | 'vector_cli';

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

export interface PendingAgentApproval {
  kind: 'command' | 'file-change';
  title: string;
  detail?: string | null;
  reason?: string | null;
  command?: string | null;
  cwd?: string | null;
  grantRoot?: string | null;
  canApproveForSession?: boolean;
  createdAt: number;
}

export interface PendingPlanApproval {
  plan: string;
  createdAt: number;
}

export interface PendingQuestionOption {
  label: string;
  description: string;
  preview?: string;
}

export interface PendingQuestion {
  id?: string;
  question: string;
  header: string;
  options: PendingQuestionOption[];
  multiSelect: boolean;
}

export interface PendingQuestionApproval {
  questions: PendingQuestion[];
  createdAt: number;
}

export interface CodexPlanSnapshot {
  items: Array<{ text: string; completed: boolean }>;
  updatedAt: number;
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

export interface AgentSessionMessage {
  id: string;
  role: AgentSessionMessageRole;
  text: string;
  title?: string | null;
  metadata?: string | null;
  status?: 'in_progress' | 'completed' | 'failed';
  startedAt?: number | null;
  updatedAt?: number | null;
  attachments?: string[];
  replyTo?: AgentReplyReference | null;
  authLoginUrl?: string | null;
  parentToolUseId?: string | null;
  toolUseId?: string | null;
  createdAt: number;
  deliveryStatus?: 'sent' | 'pending' | 'delivered' | 'failed';
  direction?: 'agent_to_vector' | 'vector_to_agent';
}

export interface AgentSessionSnapshot {
  liveActivityId: Id<'issueLiveActivities'>;
  workSessionId?: Id<'workSessions'>;
  agent: LocalAgentProvider;
  title: string;
  status:
    | 'active'
    | 'waiting_for_input'
    | 'paused'
    | 'completed'
    | 'failed'
    | 'canceled'
    | 'disconnected';
  cwd?: string | null;
  model?: string | null;
  permissionMode?: AgentPermissionMode | null;
  thinkingLevel?: AgentThinkingLevel | null;
  fastMode?: boolean | null;
  contextLength?: AgentContextLength | null;
  messages: AgentSessionMessage[];
  queuedMessages: QueuedAgentMessage[];
  pendingApproval?: PendingAgentApproval | null;
  pendingPlanApproval?: PendingPlanApproval | null;
  pendingQuestion?: PendingQuestionApproval | null;
  codexPlan?: CodexPlanSnapshot | null;
  usage?: AgentUsageStats | null;
}

export interface AgentModelOption {
  id: string;
  label: string;
  hint?: string;
  isDefault?: boolean;
  available?: boolean;
  supportedEfforts: AgentThinkingLevel[];
  defaultEffort: AgentThinkingLevel;
}
