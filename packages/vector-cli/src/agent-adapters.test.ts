import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';

function writeJsonl(path: string, entries: unknown[]) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(
    path,
    `${entries.map(entry => JSON.stringify(entry)).join('\n')}\n`,
  );
}

describe('agent-adapters session discovery', () => {
  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    delete process.env.HOME;
  });

  it('discovers only live Codex sessions from the real home directory', async () => {
    const realHome = mkdtempSync(join(tmpdir(), 'vector-real-home-'));
    const fakeHome = mkdtempSync(join(tmpdir(), 'vector-fake-home-'));
    const workspace = mkdtempSync(join(tmpdir(), 'vector-workspace-'));
    const activeTranscript = join(
      realHome,
      '.codex',
      'sessions',
      '2026',
      '03',
      '19',
      'active.jsonl',
    );
    const staleTranscript = join(
      realHome,
      '.codex',
      'sessions',
      '2026',
      '03',
      '18',
      'stale.jsonl',
    );

    writeJsonl(activeTranscript, [
      {
        type: 'session_meta',
        payload: { id: 'codex-session-1', cwd: workspace },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [
            {
              type: 'input_text',
              text: '# AGENTS.md instructions for /Users/raj/projects/vector',
            },
          ],
        },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Bridge the real home flow' }],
        },
      },
    ]);

    writeJsonl(join(realHome, '.codex', 'history.jsonl'), [
      {
        session_id: 'codex-session-1',
        ts: 1,
        text: 'Bridge the real home flow',
      },
      { session_id: 'codex-session-stale', ts: 1, text: 'Do not show me' },
    ]);

    writeJsonl(staleTranscript, [
      {
        type: 'session_meta',
        payload: { id: 'codex-session-stale', cwd: workspace },
      },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Do not show me' }],
        },
      },
    ]);

    process.env.HOME = fakeHome;

    vi.doMock('os', async () => {
      const actual = await vi.importActual<typeof import('os')>('os');
      return {
        ...actual,
        homedir: () => fakeHome,
        userInfo: () => ({
          ...actual.userInfo(),
          homedir: realHome,
        }),
      };
    });

    vi.doMock('child_process', async () => {
      const actual =
        await vi.importActual<typeof import('child_process')>('child_process');
      return {
        ...actual,
        execSync: vi.fn((command: string) => {
          if (command === 'ps -axo pid=,comm=') {
            return '123 codex\n';
          }

          if (
            command === '/usr/sbin/lsof -a -p 123 -Fn -d cwd' ||
            command === '/usr/bin/lsof -a -p 123 -Fn -d cwd' ||
            command === 'lsof -a -p 123 -Fn -d cwd'
          ) {
            return `p123\nfcwd\nn${workspace}\n`;
          }

          if (
            command === '/usr/sbin/lsof -p 123 -Fn' ||
            command === '/usr/bin/lsof -p 123 -Fn' ||
            command === 'lsof -p 123 -Fn'
          ) {
            return `p123\nn${activeTranscript}\n`;
          }

          throw new Error(`Unexpected command: ${command}`);
        }),
      };
    });

    const { discoverAttachableSessions } = await import('./agent-adapters');
    const sessions = discoverAttachableSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      provider: 'codex',
      localProcessId: '123',
      sessionKey: 'codex-session-1',
      cwd: workspace,
      title: 'Bridge the real home flow',
      supportsInboundMessages: true,
    });
  });

  it('discovers only live Claude sessions and ignores tool-result noise in titles', async () => {
    const realHome = mkdtempSync(join(tmpdir(), 'vector-real-home-'));
    const fakeHome = mkdtempSync(join(tmpdir(), 'vector-fake-home-'));
    const workspace = mkdtempSync(join(tmpdir(), 'vector-workspace-'));
    const transcriptPath = join(
      realHome,
      '.claude',
      'projects',
      'project-1',
      'claude-session-1.jsonl',
    );

    mkdirSync(join(realHome, '.claude', 'sessions'), { recursive: true });
    writeFileSync(
      join(realHome, '.claude', 'sessions', '456.json'),
      JSON.stringify({
        pid: 456,
        sessionId: 'claude-session-1',
        cwd: workspace,
        startedAt: Date.now(),
      }),
    );

    writeJsonl(transcriptPath, [
      {
        type: 'user',
        sessionId: 'claude-session-1',
        cwd: workspace,
        gitBranch: 'main',
        message: {
          role: 'user',
          content:
            '<command-name>/clear</command-name>\n<command-message>clear</command-message>',
        },
      },
      {
        type: 'user',
        sessionId: 'claude-session-1',
        cwd: workspace,
        gitBranch: 'main',
        message: {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              content:
                '[Image: original 3600x100, displayed at 2000x56. Multiply coordinates by 1.80]',
            },
          ],
        },
      },
      {
        type: 'user',
        sessionId: 'claude-session-1',
        cwd: workspace,
        gitBranch: 'main',
        message: {
          role: 'user',
          content: 'Implement the bridge attach flow properly',
        },
      },
      {
        type: 'assistant',
        sessionId: 'claude-session-1',
        cwd: workspace,
        gitBranch: 'main',
        message: {
          role: 'assistant',
          model: 'claude-opus-4-6',
          content: [{ type: 'text', text: 'Working on it.' }],
        },
      },
    ]);

    writeJsonl(join(realHome, '.claude', 'history.jsonl'), [
      {
        sessionId: 'claude-session-1',
        display: '[Pasted text #1 +2 lines]',
        pastedContents: {
          1: {
            id: 1,
            type: 'text',
            content: 'Implement the bridge attach flow properly',
          },
        },
      },
    ]);

    process.env.HOME = fakeHome;

    vi.doMock('os', async () => {
      const actual = await vi.importActual<typeof import('os')>('os');
      return {
        ...actual,
        homedir: () => fakeHome,
        userInfo: () => ({
          ...actual.userInfo(),
          homedir: realHome,
        }),
      };
    });

    vi.doMock('child_process', async () => {
      const actual =
        await vi.importActual<typeof import('child_process')>('child_process');
      return {
        ...actual,
        execSync: vi.fn((command: string) => {
          if (command === 'ps -axo pid=,comm=') {
            return '456 claude\n';
          }

          throw new Error(`Unexpected command: ${command}`);
        }),
      };
    });

    const { discoverAttachableSessions } = await import('./agent-adapters');
    const sessions = discoverAttachableSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      provider: 'claude_code',
      localProcessId: '456',
      sessionKey: 'claude-session-1',
      cwd: workspace,
      branch: 'main',
      model: 'claude-opus-4-6',
      title: 'Implement the bridge attach flow properly',
      supportsInboundMessages: true,
    });
  });
});
