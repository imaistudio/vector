// Cells-style runtime boundary for Vector's local bridge.
//
// The provider implementations currently delegate to the existing adapter
// module so Codex/Claude keep their native event support while Cursor,
// Copilot, OpenCode, and Pi are routed through the CLI-owned managed runner.

export {
  discoverAttachableSessions,
  launchProviderSession,
  resumeProviderSession,
  type AgentSessionEvent,
  type AgentSessionEventHandler,
  type BridgeProvider,
  type SessionProcessRecord,
  type SessionRunResult,
} from '../agent-adapters';
