import { execSync, spawn } from 'child_process';
import { existsSync, readFileSync, readdirSync } from 'fs';
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

const LSOF_PATHS = ['/usr/sbin/lsof', '/usr/bin/lsof'];

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
  const historyBySession = buildCodexHistoryIndex();

  return listLiveProcessIds('codex')
    .flatMap(pid => {
      const transcriptPath = getCodexTranscriptPath(pid);
      if (!transcriptPath) {
        return [];
      }

      const processCwd = getProcessCwd(pid);
      const parsed = parseObservedCodexSession(
        pid,
        transcriptPath,
        processCwd,
        historyBySession,
      );
      return parsed ? [parsed] : [];
    })
    .sort(compareObservedSessions);
}

function discoverClaudeSessions(): SessionProcessRecord[] {
  const historyBySession = buildClaudeHistoryIndex();

  return listLiveProcessIds('claude')
    .flatMap(pid => {
      const sessionMeta = readClaudePidSession(pid);
      if (!sessionMeta?.sessionId) {
        return [];
      }

      const transcriptPath = findClaudeTranscriptPath(sessionMeta.sessionId);
      const parsed = parseObservedClaudeSession(
        pid,
        sessionMeta,
        transcriptPath,
        historyBySession,
      );
      return parsed ? [parsed] : [];
    })
    .sort(compareObservedSessions);
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

function getCodexSessionsDir(): string {
  return join(getRealHomeDir(), '.codex', 'sessions');
}

function getCodexHistoryFile(): string {
  return join(getRealHomeDir(), '.codex', 'history.jsonl');
}

function getClaudeProjectsDir(): string {
  return join(getRealHomeDir(), '.claude', 'projects');
}

function getClaudeSessionStateDir(): string {
  return join(getRealHomeDir(), '.claude', 'sessions');
}

function getClaudeHistoryFile(): string {
  return join(getRealHomeDir(), '.claude', 'history.jsonl');
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

function resolveExecutable(
  fallbackCommand: string,
  absoluteCandidates: string[],
): string | undefined {
  for (const candidate of absoluteCandidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }

  try {
    const output = execSync(`command -v ${fallbackCommand}`, {
      encoding: 'utf-8',
      timeout: 1000,
    }).trim();
    return output || undefined;
  } catch {
    return undefined;
  }
}

function listLiveProcessIds(commandName: string): string[] {
  try {
    const output = execSync('ps -axo pid=,comm=', {
      encoding: 'utf-8',
      timeout: 3000,
    });

    return output
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => line.split(/\s+/, 2))
      .filter(([, command]) => command === commandName)
      .map(([pid]) => pid)
      .filter(Boolean);
  } catch {
    return [];
  }
}

function getProcessCwd(pid: string): string | undefined {
  const lsofCommand = resolveExecutable('lsof', LSOF_PATHS);
  if (!lsofCommand) {
    return undefined;
  }

  try {
    const output = execSync(`${lsofCommand} -a -p ${pid} -Fn -d cwd`, {
      encoding: 'utf-8',
      timeout: 3000,
    });

    return output
      .split('\n')
      .map(line => line.trim())
      .find(line => line.startsWith('n'))
      ?.slice(1);
  } catch {
    return undefined;
  }
}

function getCodexTranscriptPath(pid: string): string | undefined {
  const lsofCommand = resolveExecutable('lsof', LSOF_PATHS);
  if (!lsofCommand) {
    return undefined;
  }

  try {
    const output = execSync(`${lsofCommand} -p ${pid} -Fn`, {
      encoding: 'utf-8',
      timeout: 3000,
    });

    return output
      .split('\n')
      .map(line => line.trim())
      .find(
        line =>
          line.startsWith('n') &&
          line.includes('/.codex/sessions/') &&
          line.endsWith('.jsonl'),
      )
      ?.slice(1);
  } catch {
    return undefined;
  }
}

function readClaudePidSession(
  pid: string,
): { sessionId: string; cwd?: string; startedAt?: number } | null {
  const path = join(getClaudeSessionStateDir(), `${pid}.json`);
  if (!existsSync(path)) {
    return null;
  }

  try {
    const payload = JSON.parse(readFileSync(path, 'utf-8'));
    const sessionId = asString(payload.sessionId);
    if (!sessionId) {
      return null;
    }

    return {
      sessionId,
      cwd: asString(payload.cwd),
      startedAt:
        typeof payload.startedAt === 'number' ? payload.startedAt : undefined,
    };
  } catch {
    return null;
  }
}

function findClaudeTranscriptPath(sessionId: string): string | undefined {
  return findJsonlFileByStem(getClaudeProjectsDir(), sessionId);
}

function findJsonlFileByStem(root: string, stem: string): string | undefined {
  if (!existsSync(root)) {
    return undefined;
  }

  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) {
      const nested = findJsonlFileByStem(path, stem);
      if (nested) {
        return nested;
      }
      continue;
    }

    if (entry.isFile() && entry.name === `${stem}.jsonl`) {
      return path;
    }
  }

  return undefined;
}

function readJsonLines(path: string): any[] {
  try {
    return readFileSync(path, 'utf-8')
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(tryParseJson)
      .filter(Boolean);
  } catch {
    return [];
  }
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
    const key = `${session.provider}:${session.localProcessId ?? session.sessionKey}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function compareObservedSessions(
  a: SessionProcessRecord,
  b: SessionProcessRecord,
): number {
  return Number(b.localProcessId ?? 0) - Number(a.localProcessId ?? 0);
}

function parseObservedCodexSession(
  pid: string,
  transcriptPath: string,
  processCwd?: string,
  historyBySession?: Map<string, string[]>,
): SessionProcessRecord | null {
  const entries = readJsonLines(transcriptPath);
  let sessionKey: string | undefined;
  let cwd = processCwd;
  const userMessages: string[] = [];
  const assistantMessages: string[] = [];

  for (const entry of entries) {
    if (entry.type === 'session_meta') {
      sessionKey = asString(entry.payload?.id) ?? sessionKey;
      cwd = asString(entry.payload?.cwd) ?? cwd;
    }

    if (entry.type === 'event_msg' && entry.payload?.type === 'user_message') {
      pushIfPresent(userMessages, entry.payload?.message);
    }

    if (
      entry.type === 'response_item' &&
      entry.payload?.type === 'message' &&
      entry.payload?.role === 'user'
    ) {
      userMessages.push(...extractTextSegments(entry.payload?.content));
    }

    if (entry.type === 'event_msg' && entry.payload?.type === 'agent_message') {
      pushIfPresent(assistantMessages, entry.payload?.message);
    }

    if (
      entry.type === 'response_item' &&
      entry.payload?.type === 'message' &&
      entry.payload?.role === 'assistant'
    ) {
      assistantMessages.push(...extractTextSegments(entry.payload?.content));
    }
  }

  if (!sessionKey) {
    return null;
  }

  const gitInfo = cwd ? getGitInfo(cwd) : {};
  const historyTitle = sessionKey
    ? selectSessionTitle(historyBySession?.get(sessionKey) ?? [])
    : undefined;

  return {
    provider: 'codex',
    providerLabel: 'Codex',
    localProcessId: pid,
    sessionKey,
    cwd,
    ...gitInfo,
    title: summarizeTitle(
      historyTitle ??
        selectSessionTitle(userMessages) ??
        selectSessionTitle(assistantMessages),
      cwd,
    ),
    mode: 'observed',
    status: 'observed',
    supportsInboundMessages: true,
  };
}

function parseObservedClaudeSession(
  pid: string,
  sessionMeta: { sessionId: string; cwd?: string; startedAt?: number },
  transcriptPath?: string,
  historyBySession?: Map<string, string[]>,
): SessionProcessRecord | null {
  const entries = transcriptPath ? readJsonLines(transcriptPath) : [];
  let cwd = sessionMeta.cwd;
  let branch: string | undefined;
  let model: string | undefined;
  const userMessages: string[] = [];
  const assistantMessages: string[] = [];

  for (const entry of entries) {
    cwd = asString(entry.cwd) ?? cwd;
    branch = asString(entry.gitBranch) ?? branch;

    if (entry.type === 'user') {
      userMessages.push(...extractClaudeMessageTexts(entry.message));
    }

    if (entry.type === 'assistant') {
      model = asString(entry.message?.model) ?? model;
      assistantMessages.push(...extractClaudeMessageTexts(entry.message));
    }
  }

  const gitInfo = cwd ? getGitInfo(cwd) : {};
  const historyTitle = selectSessionTitle(
    historyBySession?.get(sessionMeta.sessionId) ?? [],
  );

  return {
    provider: 'claude_code',
    providerLabel: 'Claude',
    localProcessId: pid,
    sessionKey: sessionMeta.sessionId,
    cwd,
    repoRoot: gitInfo.repoRoot,
    branch: branch ?? gitInfo.branch,
    title: summarizeTitle(
      historyTitle ??
        selectSessionTitle(userMessages) ??
        selectSessionTitle(assistantMessages),
      cwd,
    ),
    model,
    mode: 'observed',
    status: 'observed',
    supportsInboundMessages: true,
  };
}

function extractCodexResponseText(content: unknown): string | undefined {
  const texts = extractTextSegments(content);
  return texts.length > 0 ? texts.join('\n\n') : undefined;
}

function extractClaudeUserText(message: unknown): string | undefined {
  const texts = extractClaudeMessageTexts(message);
  if (texts.length > 0) {
    return texts.join('\n\n');
  }
  return undefined;
}

function extractClaudeAssistantText(message: unknown): string | undefined {
  const texts = extractClaudeMessageTexts(message);
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

function pushIfPresent(target: string[], value: unknown): void {
  const text = asString(value);
  if (text) {
    target.push(text);
  }
}

function extractClaudeMessageTexts(message: unknown): string[] {
  if (!message || typeof message !== 'object') {
    return [];
  }

  return extractTextSegments((message as { content?: unknown }).content);
}

function extractTextSegments(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }

  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap(extractTextSegmentFromBlock).filter(Boolean);
}

function extractTextSegmentFromBlock(block: unknown): string[] {
  if (!block || typeof block !== 'object') {
    return [];
  }

  const typedBlock = block as {
    type?: unknown;
    text?: unknown;
    content?: unknown;
  };

  const blockType = asString(typedBlock.type);
  if (blockType && isIgnoredContentBlockType(blockType)) {
    return [];
  }

  const directText = asString(typedBlock.text);
  if (directText) {
    return [directText];
  }

  if (typeof typedBlock.content === 'string') {
    return [typedBlock.content];
  }

  return [];
}

function isIgnoredContentBlockType(blockType: string): boolean {
  return [
    'tool_result',
    'tool_use',
    'image',
    'thinking',
    'reasoning',
    'contextCompaction',
  ].includes(blockType);
}

function buildCodexHistoryIndex(): Map<string, string[]> {
  const historyBySession = new Map<string, string[]>();

  for (const entry of readJsonLines(getCodexHistoryFile())) {
    const sessionId = asString(entry.session_id);
    const text = asString(entry.text);
    if (!sessionId || !text) {
      continue;
    }

    appendHistoryEntry(historyBySession, sessionId, text);
  }

  return historyBySession;
}

function buildClaudeHistoryIndex(): Map<string, string[]> {
  const historyBySession = new Map<string, string[]>();

  for (const entry of readJsonLines(getClaudeHistoryFile())) {
    const sessionId = asString(entry.sessionId);
    if (!sessionId) {
      continue;
    }

    const texts = extractClaudeHistoryTexts(entry);
    for (const text of texts) {
      appendHistoryEntry(historyBySession, sessionId, text);
    }
  }

  return historyBySession;
}

function appendHistoryEntry(
  historyBySession: Map<string, string[]>,
  sessionId: string,
  text: string,
): void {
  const existing = historyBySession.get(sessionId);
  if (existing) {
    existing.push(text);
    return;
  }

  historyBySession.set(sessionId, [text]);
}

function extractClaudeHistoryTexts(entry: unknown): string[] {
  if (!entry || typeof entry !== 'object') {
    return [];
  }

  const record = entry as {
    display?: unknown;
    pastedContents?: unknown;
  };

  const pastedTexts = extractClaudePastedTexts(record.pastedContents);
  if (pastedTexts.length > 0) {
    return pastedTexts;
  }

  const display = asString(record.display);
  return display ? [display] : [];
}

function extractClaudePastedTexts(value: unknown): string[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.values(value as Record<string, unknown>)
    .flatMap(item => {
      if (!item || typeof item !== 'object') {
        return [];
      }

      const record = item as {
        type?: unknown;
        content?: unknown;
      };

      return record.type === 'text' && typeof record.content === 'string'
        ? [record.content]
        : [];
    })
    .filter(Boolean);
}

function selectSessionTitle(messages: string[]): string | undefined {
  for (const message of messages) {
    const cleaned = cleanSessionTitleCandidate(message);
    if (cleaned) {
      return cleaned;
    }
  }

  return undefined;
}

function cleanSessionTitleCandidate(message: string): string | undefined {
  const normalized = stripAnsi(message).replace(/\s+/g, ' ').trim();
  if (!normalized) {
    return undefined;
  }

  if (normalized.length < 4) {
    return undefined;
  }

  if (
    normalized.startsWith('/') ||
    looksLikeGeneratedTagEnvelope(normalized) ||
    looksLikeGeneratedImageSummary(normalized) ||
    looksLikeStandaloneImagePath(normalized) ||
    looksLikeInstructionScaffold(normalized)
  ) {
    return undefined;
  }

  return normalized;
}

function looksLikeGeneratedTagEnvelope(value: string): boolean {
  return /^<[\w:-]+>.*<\/[\w:-]+>$/s.test(value);
}

function looksLikeGeneratedImageSummary(value: string): boolean {
  return (
    /^\[image:/i.test(value) ||
    (/displayed at/i.test(value) && /coordinates/i.test(value))
  );
}

function looksLikeStandaloneImagePath(value: string): boolean {
  return (
    /^\/\S+\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(value) ||
    /^file:\S+\.(png|jpe?g|gif|webp|heic|bmp)$/i.test(value)
  );
}

function looksLikeInstructionScaffold(value: string): boolean {
  if (value.length < 700) {
    return false;
  }

  const headingCount = value.match(/^#{1,3}\s/gm)?.length ?? 0;
  const tagCount = value.match(/<\/?[\w:-]+>/g)?.length ?? 0;
  const bulletCount = value.match(/^\s*[-*]\s/gm)?.length ?? 0;

  return headingCount + tagCount + bulletCount >= 6;
}

function stripAnsi(value: string): string {
  return value.replace(/\u001B\[[0-9;]*m/g, '');
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
