import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { homedir, userInfo } from 'os';
import { basename, join } from 'path';

export type BridgeProvider = 'codex' | 'claude_code';

export interface SessionProcessRecord {
  provider: BridgeProvider;
  providerLabel: string;
  localProcessId?: string;
  sessionKey: string;
  cwd?: string;
  repoRoot?: string;
  branch?: string;
  title?: string;
  model?: string;
  mode: 'observed' | 'managed';
  status: 'observed' | 'waiting';
  supportsInboundMessages: true;
}

export interface SessionRunResult extends SessionProcessRecord {
  responseText?: string;
  launchCommand: string;
}

const MAX_DISCOVERED_FILES_PER_PROVIDER = 30;

export function discoverAttachableSessions(): SessionProcessRecord[] {
  return dedupeSessions([
    ...discoverCodexSessions(),
    ...discoverClaudeSessions(),
  ]);
}

export async function launchProviderSession(
  provider: BridgeProvider,
  cwd: string,
  prompt: string,
): Promise<SessionRunResult> {
  if (provider === 'codex') {
    const stdout = await runCommand('codex', ['exec', '--json', prompt], cwd);
    return parseCodexRunResult(stdout, cwd, 'codex exec --json');
  }

  const stdout = await runCommand(
    'claude',
    ['-p', '--output-format', 'json', prompt],
    cwd,
  );
  return parseClaudeRunResult(stdout, cwd, 'claude -p --output-format json');
}

export async function resumeProviderSession(
  provider: BridgeProvider,
  sessionKey: string,
  cwd: string,
  prompt: string,
): Promise<SessionRunResult> {
  if (provider === 'codex') {
    const stdout = await runCommand(
      'codex',
      ['exec', 'resume', '--json', sessionKey, prompt],
      cwd,
    );
    return parseCodexRunResult(stdout, cwd, 'codex exec resume --json');
  }

  const stdout = await runCommand(
    'claude',
    ['-p', '--resume', sessionKey, '--output-format', 'json', prompt],
    cwd,
  );
  return parseClaudeRunResult(
    stdout,
    cwd,
    'claude -p --resume --output-format json',
  );
}

async function runCommand(
  command: string,
  args: string[],
  cwd: string,
): Promise<string> {
  const child = spawn(command, args, {
    cwd,
    env: { ...process.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';

  child.stdout.on('data', chunk => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', chunk => {
    stderr += chunk.toString();
  });

  return await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('close', code => {
      if (code === 0) {
        resolve(stdout);
        return;
      }

      const detail = stderr.trim() || stdout.trim() || `exit code ${code}`;
      reject(new Error(`${command} failed: ${detail}`));
    });
  });
}

function discoverCodexSessions(): SessionProcessRecord[] {
  return listRecentJsonlFiles(getCodexSessionsDir()).flatMap(file => {
    const entries = readJsonLines(file);
    let sessionKey: string | undefined;
    let cwd: string | undefined;
    let title: string | undefined;
    let lastUserMessage: string | undefined;
    let lastAssistantMessage: string | undefined;

    for (const entry of entries) {
      if (entry.type === 'session_meta') {
        sessionKey = asString(entry.payload?.id) ?? sessionKey;
        cwd = asString(entry.payload?.cwd) ?? cwd;
      }

      if (
        entry.type === 'event_msg' &&
        entry.payload?.type === 'user_message'
      ) {
        lastUserMessage = asString(entry.payload?.message) ?? lastUserMessage;
      }

      if (
        entry.type === 'response_item' &&
        entry.payload?.type === 'message' &&
        entry.payload?.role === 'user'
      ) {
        lastUserMessage =
          extractCodexResponseText(entry.payload?.content) ?? lastUserMessage;
      }

      if (
        entry.type === 'event_msg' &&
        entry.payload?.type === 'agent_message'
      ) {
        lastAssistantMessage =
          asString(entry.payload?.message) ?? lastAssistantMessage;
      }

      if (
        entry.type === 'response_item' &&
        entry.payload?.type === 'message' &&
        entry.payload?.role === 'assistant'
      ) {
        lastAssistantMessage =
          extractCodexResponseText(entry.payload?.content) ??
          lastAssistantMessage;
      }
    }

    if (!sessionKey) {
      return [];
    }

    title = summarizeTitle(lastUserMessage ?? lastAssistantMessage, cwd);
    const gitInfo = cwd ? getGitInfo(cwd) : {};

    return [
      {
        provider: 'codex' as const,
        providerLabel: 'Codex',
        sessionKey,
        cwd,
        ...gitInfo,
        title,
        mode: 'observed' as const,
        status: 'observed' as const,
        supportsInboundMessages: true as const,
      },
    ];
  });
}

function discoverClaudeSessions(): SessionProcessRecord[] {
  return listRecentJsonlFiles(getClaudeSessionsDir()).flatMap(file => {
    const entries = readJsonLines(file);
    let sessionKey: string | undefined;
    let cwd: string | undefined;
    let branch: string | undefined;
    let model: string | undefined;
    let lastUserMessage: string | undefined;
    let lastAssistantMessage: string | undefined;

    for (const entry of entries) {
      sessionKey = asString(entry.sessionId) ?? sessionKey;
      cwd = asString(entry.cwd) ?? cwd;
      branch = asString(entry.gitBranch) ?? branch;

      if (entry.type === 'user') {
        lastUserMessage =
          extractClaudeUserText(entry.message) ?? lastUserMessage;
      }

      if (entry.type === 'assistant') {
        model = asString(entry.message?.model) ?? model;
        lastAssistantMessage =
          extractClaudeAssistantText(entry.message) ?? lastAssistantMessage;
      }
    }

    if (!sessionKey) {
      return [];
    }

    const gitInfo = cwd ? getGitInfo(cwd) : {};

    return [
      {
        provider: 'claude_code' as const,
        providerLabel: 'Claude',
        sessionKey,
        cwd,
        repoRoot: gitInfo.repoRoot,
        branch: branch ?? gitInfo.branch,
        title: summarizeTitle(lastUserMessage ?? lastAssistantMessage, cwd),
        model,
        mode: 'observed' as const,
        status: 'observed' as const,
        supportsInboundMessages: true as const,
      },
    ];
  });
}

function parseCodexRunResult(
  stdout: string,
  cwd: string,
  launchCommand: string,
): SessionRunResult {
  let sessionKey: string | undefined;
  const responseParts: string[] = [];

  for (const line of stdout
    .split('\n')
    .map(part => part.trim())
    .filter(Boolean)) {
    const payload = tryParseJson(line);
    if (!payload) continue;

    if (payload.type === 'thread.started') {
      sessionKey = asString(payload.thread_id) ?? sessionKey;
    }

    if (
      payload.type === 'item.completed' &&
      payload.item?.type === 'agent_message' &&
      typeof payload.item.text === 'string'
    ) {
      responseParts.push(payload.item.text.trim());
    }

    if (
      payload.type === 'response_item' &&
      payload.payload?.type === 'message' &&
      payload.payload?.role === 'assistant'
    ) {
      const responseText = extractCodexResponseText(payload.payload?.content);
      if (responseText) {
        responseParts.push(responseText);
      }
    }
  }

  if (!sessionKey) {
    throw new Error('Codex did not return a thread id');
  }

  const gitInfo = getGitInfo(cwd);
  const responseText = responseParts.filter(Boolean).join('\n\n') || undefined;

  return {
    provider: 'codex',
    providerLabel: 'Codex',
    sessionKey,
    cwd,
    ...gitInfo,
    title: summarizeTitle(undefined, cwd),
    mode: 'managed',
    status: 'waiting',
    supportsInboundMessages: true,
    responseText,
    launchCommand,
  };
}

function parseClaudeRunResult(
  stdout: string,
  cwd: string,
  launchCommand: string,
): SessionRunResult {
  const payload = stdout
    .split('\n')
    .map(line => tryParseJson(line))
    .filter(Boolean)
    .pop();

  if (!payload) {
    throw new Error('Claude did not return JSON output');
  }

  const sessionKey = asString(payload.session_id);
  if (!sessionKey) {
    throw new Error('Claude did not return a session id');
  }

  const gitInfo = getGitInfo(cwd);
  const model = firstObjectKey(payload.modelUsage);

  return {
    provider: 'claude_code',
    providerLabel: 'Claude',
    sessionKey,
    cwd,
    ...gitInfo,
    title: summarizeTitle(undefined, cwd),
    model,
    mode: 'managed',
    status: 'waiting',
    supportsInboundMessages: true,
    responseText: asString(payload.result) ?? undefined,
    launchCommand,
  };
}

function listRecentJsonlFiles(root: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const files = collectJsonlFiles(root);
  return files
    .map(path => ({ path, mtimeMs: statSync(path).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)
    .slice(0, MAX_DISCOVERED_FILES_PER_PROVIDER)
    .map(file => file.path);
}

function getCodexSessionsDir(): string {
  return join(getRealHomeDir(), '.codex', 'sessions');
}

function getClaudeSessionsDir(): string {
  return join(getRealHomeDir(), '.claude', 'projects');
}

function getRealHomeDir(): string {
  try {
    const realHome = userInfo().homedir?.trim();
    if (realHome) {
      return realHome;
    }
  } catch {
    /* fall back */
  }

  return homedir();
}

function collectJsonlFiles(root: string): string[] {
  const files: string[] = [];

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectJsonlFiles(path));
      continue;
    }

    if (entry.isFile() && entry.name.endsWith('.jsonl')) {
      files.push(path);
    }
  }

  return files;
}

function readJsonLines(path: string): any[] {
  return readFileSync(path, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean)
    .map(tryParseJson)
    .filter(Boolean);
}

function tryParseJson(value: string): any | null {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function dedupeSessions(
  sessions: SessionProcessRecord[],
): SessionProcessRecord[] {
  const seen = new Set<string>();
  return sessions.filter(session => {
    const key = `${session.provider}:${session.sessionKey}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function extractCodexResponseText(content: unknown): string | undefined {
  if (!Array.isArray(content)) {
    return undefined;
  }

  const texts = content
    .map(item =>
      item && typeof item === 'object' && 'text' in item
        ? asString((item as { text?: unknown }).text)
        : undefined,
    )
    .filter(Boolean);

  return texts.length > 0 ? texts.join('\n\n') : undefined;
}

function extractClaudeUserText(message: unknown): string | undefined {
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  const content = (message as { content?: unknown }).content;
  if (typeof content === 'string') {
    return content;
  }

  return undefined;
}

function extractClaudeAssistantText(message: unknown): string | undefined {
  if (!message || typeof message !== 'object') {
    return undefined;
  }

  const content = (message as { content?: unknown }).content;
  if (!Array.isArray(content)) {
    return undefined;
  }

  const texts = content
    .map(item =>
      item && typeof item === 'object' && 'text' in item
        ? asString((item as { text?: unknown }).text)
        : undefined,
    )
    .filter(Boolean);

  return texts.length > 0 ? texts.join('\n\n') : undefined;
}

function summarizeTitle(message: string | undefined, cwd?: string): string {
  if (message) {
    return truncate(message.replace(/\s+/g, ' ').trim(), 96);
  }

  if (cwd) {
    return basename(cwd);
  }

  return 'Local session';
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength
    ? `${value.slice(0, maxLength - 3).trimEnd()}...`
    : value;
}

function firstObjectKey(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') {
    return undefined;
  }

  const [firstKey] = Object.keys(value);
  return firstKey;
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined;
}

function getGitInfo(cwd: string): { repoRoot?: string; branch?: string } {
  try {
    const repoRoot = execSync('git rev-parse --show-toplevel', {
      encoding: 'utf-8',
      cwd,
      timeout: 3000,
    }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', {
      encoding: 'utf-8',
      cwd,
      timeout: 3000,
    }).trim();

    return {
      repoRoot: repoRoot || undefined,
      branch: branch || undefined,
    };
  } catch {
    return {};
  }
}
