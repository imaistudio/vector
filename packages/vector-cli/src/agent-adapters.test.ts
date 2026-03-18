import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

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

  it('discovers Codex sessions from the real home directory when HOME is overridden', async () => {
    const realHome = mkdtempSync(join(tmpdir(), 'vector-real-home-'));
    const fakeHome = mkdtempSync(join(tmpdir(), 'vector-fake-home-'));
    const workspace = mkdtempSync(join(tmpdir(), 'vector-workspace-'));

    writeJsonl(
      join(
        realHome,
        '.codex',
        'sessions',
        '2026',
        '03',
        '19',
        'rollout-test.jsonl',
      ),
      [
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
              { type: 'input_text', text: 'Bridge the real home flow' },
            ],
          },
        },
      ],
    );

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

    const { discoverAttachableSessions } = await import('./agent-adapters');
    const sessions = discoverAttachableSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      provider: 'codex',
      sessionKey: 'codex-session-1',
      cwd: workspace,
      title: 'Bridge the real home flow',
      supportsInboundMessages: true,
    });
  });

  it('discovers Claude sessions from the real home directory when HOME is overridden', async () => {
    const realHome = mkdtempSync(join(tmpdir(), 'vector-real-home-'));
    const fakeHome = mkdtempSync(join(tmpdir(), 'vector-fake-home-'));
    const workspace = mkdtempSync(join(tmpdir(), 'vector-workspace-'));

    writeJsonl(
      join(realHome, '.claude', 'projects', 'project-1', 'session.jsonl'),
      [
        {
          type: 'user',
          sessionId: 'claude-session-1',
          cwd: workspace,
          gitBranch: 'main',
          message: { role: 'user', content: 'Resume bridge run' },
        },
      ],
    );

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

    const { discoverAttachableSessions } = await import('./agent-adapters');
    const sessions = discoverAttachableSessions();

    expect(sessions).toHaveLength(1);
    expect(sessions[0]).toMatchObject({
      provider: 'claude_code',
      sessionKey: 'claude-session-1',
      cwd: workspace,
      branch: 'main',
      title: 'Resume bridge run',
      supportsInboundMessages: true,
    });
  });
});
