import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { mkdtempSync } from 'fs';
import { EventEmitter } from 'events';

type RecordedRpcWrite = {
  id?: number;
  method?: string;
  params?: unknown;
};

type MockSpawnChild = EventEmitter & {
  stdout: EventEmitter;
  stderr: EventEmitter;
  stdin: {
    write: ReturnType<typeof vi.fn>;
  };
  kill: ReturnType<typeof vi.fn>;
};

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
        timestamp: '2026-03-19T10:00:00.000Z',
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
        timestamp: '2026-03-19T10:01:00.000Z',
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Bridge the real home flow' }],
        },
      },
      {
        timestamp: '2026-03-19T10:02:00.000Z',
        type: 'response_item',
        payload: {
          id: 'assistant-1',
          type: 'message',
          role: 'assistant',
          content: [{ type: 'output_text', text: 'The bridge is ready.' }],
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
      transcript: [
        {
          sourceId: 'codex:codex-session-1:2:user',
          role: 'user',
          text: 'Bridge the real home flow',
          createdAt: Date.parse('2026-03-19T10:01:00.000Z'),
        },
        {
          sourceId: 'codex:codex-session-1:assistant-1:assistant',
          role: 'assistant',
          text: 'The bridge is ready.',
          createdAt: Date.parse('2026-03-19T10:02:00.000Z'),
        },
      ],
    });
  });

  it('keeps multiple Codex threads that share one process attachable', async () => {
    const realHome = mkdtempSync(join(tmpdir(), 'vector-real-home-'));
    const fakeHome = mkdtempSync(join(tmpdir(), 'vector-fake-home-'));
    const workspace = mkdtempSync(join(tmpdir(), 'vector-workspace-'));
    const firstTranscript = join(
      realHome,
      '.codex',
      'sessions',
      '2026',
      '07',
      '16',
      'first.jsonl',
    );
    const secondTranscript = join(
      realHome,
      '.codex',
      'sessions',
      '2026',
      '07',
      '16',
      'second.jsonl',
    );

    writeJsonl(firstTranscript, [
      { type: 'session_meta', payload: { id: 'thread-a', cwd: workspace } },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'First Work session' }],
        },
      },
    ]);
    writeJsonl(secondTranscript, [
      { type: 'session_meta', payload: { id: 'thread-b', cwd: workspace } },
      {
        type: 'response_item',
        payload: {
          type: 'message',
          role: 'user',
          content: [{ type: 'input_text', text: 'Second Work session' }],
        },
      },
    ]);
    process.env.HOME = fakeHome;

    vi.doMock('os', async () => {
      const actual = await vi.importActual<typeof import('os')>('os');
      return {
        ...actual,
        homedir: () => fakeHome,
        userInfo: () => ({ ...actual.userInfo(), homedir: realHome }),
      };
    });
    vi.doMock('child_process', async () => {
      const actual =
        await vi.importActual<typeof import('child_process')>('child_process');
      return {
        ...actual,
        execSync: vi.fn((command: string) => {
          if (command === 'ps -axo pid=,ucomm=') return '123 codex\n';
          if (command.includes('-a -p 123 -Fn -d cwd')) {
            return `p123\nfcwd\nn${workspace}\n`;
          }
          if (command.includes('-p 123 -Fn')) {
            return `p123\nn${firstTranscript}\nn${secondTranscript}\n`;
          }
          throw new Error(`Unexpected command: ${command}`);
        }),
      };
    });

    const { discoverAttachableSessions } = await import('./agent-adapters');
    const sessions = discoverAttachableSessions();

    expect(sessions).toHaveLength(2);
    expect(sessions.map(session => session.sessionKey).sort()).toEqual([
      'thread-a',
      'thread-b',
    ]);
    expect(new Set(sessions.map(session => session.localProcessId))).toEqual(
      new Set(['123']),
    );
  });

  it('selects the invoking agent session from process ancestry', async () => {
    const { findCurrentAgentSession } = await import('./agent-adapters');
    const sessions = [
      {
        provider: 'codex' as const,
        providerLabel: 'Codex',
        localProcessId: '100',
        sessionKey: 'codex-current',
        cwd: '/workspace/vector',
        mode: 'observed' as const,
        status: 'observed' as const,
        supportsInboundMessages: true,
      },
      {
        provider: 'claude_code' as const,
        providerLabel: 'Claude',
        localProcessId: '200',
        sessionKey: 'claude-other',
        cwd: '/workspace/vector',
        mode: 'observed' as const,
        status: 'observed' as const,
        supportsInboundMessages: true,
      },
    ];

    expect(
      findCurrentAgentSession(sessions, {
        currentPid: 103,
        processTable: '1 0\n100 1\n102 100\n103 102\n200 1\n',
        cwd: '/workspace/vector',
      }),
    ).toMatchObject({ sessionKey: 'codex-current' });
  });

  it('requires an explicit session when a workspace match is ambiguous', async () => {
    const { findCurrentAgentSession } = await import('./agent-adapters');
    const sessions = ['session-a', 'session-b'].map((sessionKey, index) => ({
      provider: 'codex' as const,
      providerLabel: 'Codex',
      localProcessId: String(100 + index),
      sessionKey,
      cwd: '/workspace/vector',
      mode: 'observed' as const,
      status: 'observed' as const,
      supportsInboundMessages: true,
    }));

    expect(
      findCurrentAgentSession(sessions, {
        currentPid: 500,
        processTable: '500 1\n',
        cwd: '/workspace/vector/packages/cli',
      }),
    ).toBeUndefined();
    expect(
      findCurrentAgentSession(sessions, { sessionKey: 'session-b' }),
    ).toMatchObject({ sessionKey: 'session-b' });
  });

  it('does not guess between agent threads that share an ancestor process', async () => {
    const { findCurrentAgentSession } = await import('./agent-adapters');
    const sessions = ['thread-a', 'thread-b'].map(sessionKey => ({
      provider: 'codex' as const,
      providerLabel: 'Codex',
      localProcessId: '100',
      sessionKey,
      cwd: '/workspace/vector',
      mode: 'observed' as const,
      status: 'observed' as const,
      supportsInboundMessages: true,
    }));

    expect(
      findCurrentAgentSession(sessions, {
        currentPid: 103,
        processTable: '1 0\n100 1\n103 100\n',
        cwd: '/workspace/vector',
      }),
    ).toBeUndefined();
    expect(
      findCurrentAgentSession(sessions, { sessionKey: 'thread-b' }),
    ).toMatchObject({ sessionKey: 'thread-b' });
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
        uuid: 'user-clear',
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
        uuid: 'user-tool',
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
        uuid: 'user-visible',
        timestamp: '2026-03-19T11:00:00.000Z',
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
        uuid: 'assistant-visible',
        timestamp: '2026-03-19T11:01:00.000Z',
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
      transcript: [
        {
          sourceId: 'claude_code:claude-session-1:user-visible:user',
          role: 'user',
          text: 'Implement the bridge attach flow properly',
          createdAt: Date.parse('2026-03-19T11:00:00.000Z'),
        },
        {
          sourceId: 'claude_code:claude-session-1:assistant-visible:assistant',
          role: 'assistant',
          text: 'Working on it.',
          createdAt: Date.parse('2026-03-19T11:01:00.000Z'),
        },
      ],
    });
  });

  it('uses codex app-server thread/start and turn/start for managed launches', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'vector-workspace-'));
    const writes: RecordedRpcWrite[] = [];

    vi.doMock('child_process', async () => {
      const actual =
        await vi.importActual<typeof import('child_process')>('child_process');

      return {
        ...actual,
        execSync: vi.fn((command: string) => {
          if (command === 'git rev-parse --show-toplevel') {
            return `${workspace}\n`;
          }
          if (command === 'git rev-parse --abbrev-ref HEAD') {
            return 'main\n';
          }
          throw new Error(`Unexpected command: ${command}`);
        }),
        spawn: vi.fn(() => {
          const stdout = new EventEmitter();
          const stderr = new EventEmitter();
          const child = new EventEmitter() as MockSpawnChild;

          child.stdout = stdout;
          child.stderr = stderr;
          child.kill = vi.fn(() => {
            child.emit('close', 0);
          });
          child.stdin = {
            write: vi.fn((chunk: string) => {
              for (const line of chunk.trim().split('\n')) {
                const payload = JSON.parse(line);
                writes.push(payload);

                if (payload.method === 'initialize') {
                  stdout.emit(
                    'data',
                    Buffer.from(
                      `${JSON.stringify({ id: payload.id, result: {} })}\n`,
                    ),
                  );
                }

                if (payload.method === 'thread/start') {
                  stdout.emit(
                    'data',
                    Buffer.from(
                      `${JSON.stringify({ id: payload.id, result: { thread: { id: 'thr_vector_codex' } } })}\n`,
                    ),
                  );
                  stdout.emit(
                    'data',
                    Buffer.from(
                      `${JSON.stringify({ method: 'thread/started', params: { thread: { id: 'thr_vector_codex' } } })}\n`,
                    ),
                  );
                }

                if (payload.method === 'turn/start') {
                  stdout.emit(
                    'data',
                    Buffer.from(
                      `${JSON.stringify({ id: payload.id, result: { turn: { id: 'turn_1', status: 'inProgress', items: [] } } })}\n`,
                    ),
                  );
                  stdout.emit(
                    'data',
                    Buffer.from(
                      `${JSON.stringify({ method: 'item/agentMessage/delta', params: { delta: 'Managed via Codex.' } })}\n`,
                    ),
                  );
                  stdout.emit(
                    'data',
                    Buffer.from(
                      `${JSON.stringify({ method: 'turn/completed', params: { turn: { id: 'turn_1', status: 'completed' } } })}\n`,
                    ),
                  );
                }
              }
            }),
          };

          return child;
        }),
      };
    });

    const { launchProviderSession } = await import('./agent-adapters');
    const result = await launchProviderSession(
      'codex',
      workspace,
      'Ship the bridge fix',
    );

    expect(result).toMatchObject({
      provider: 'codex',
      sessionKey: 'thr_vector_codex',
      responseText: 'Managed via Codex.',
      cwd: workspace,
      branch: 'main',
      repoRoot: workspace,
      launchCommand: 'codex app-server',
    });
    expect(writes.some(entry => entry.method === 'thread/start')).toBe(true);
    expect(writes.some(entry => entry.method === 'turn/start')).toBe(true);
  });

  it('uses the Claude Agent SDK query resume flow for managed follow-up messages', async () => {
    const workspace = mkdtempSync(join(tmpdir(), 'vector-workspace-'));
    const close = vi.fn();
    const assistantEvents: string[] = [];
    const queryMock = vi
      .fn()
      .mockImplementationOnce((args: { options?: { resume?: string } }) => {
        const options = args.options ?? {};
        expect(options.resume).toBeUndefined();
        return {
          close,
          async *[Symbol.asyncIterator]() {
            yield {
              type: 'assistant',
              session_id: 'claude-session-new',
              message: {
                content: [{ type: 'text', text: 'Initial Claude reply' }],
              },
            };
            yield {
              type: 'result',
              subtype: 'success',
              session_id: 'claude-session-new',
              result: 'Initial Claude reply',
              modelUsage: { 'claude-opus-4-6': {} },
            };
          },
        };
      })
      .mockImplementationOnce((args: { options?: { resume?: string } }) => {
        const options = args.options ?? {};
        expect(options.resume).toBe('claude-session-new');
        return {
          close,
          async *[Symbol.asyncIterator]() {
            yield {
              type: 'result',
              subtype: 'success',
              session_id: 'claude-session-new',
              result: 'Follow-up reply',
              modelUsage: { 'claude-opus-4-6': {} },
            };
          },
        };
      });

    vi.doMock('@anthropic-ai/claude-agent-sdk', () => ({
      query: queryMock,
    }));

    vi.doMock('child_process', async () => {
      const actual =
        await vi.importActual<typeof import('child_process')>('child_process');
      return {
        ...actual,
        execSync: vi.fn((command: string) => {
          if (command === 'git rev-parse --show-toplevel') {
            return `${workspace}\n`;
          }
          if (command === 'git rev-parse --abbrev-ref HEAD') {
            return 'main\n';
          }
          throw new Error(`Unexpected command: ${command}`);
        }),
      };
    });

    const { launchProviderSession, resumeProviderSession } =
      await import('./agent-adapters');
    const launched = await launchProviderSession(
      'claude_code',
      workspace,
      'Start the delegated issue',
      event => {
        if (event.role === 'assistant') assistantEvents.push(event.text);
      },
    );
    const resumed = await resumeProviderSession(
      'claude_code',
      launched.sessionKey,
      workspace,
      'Continue and finish it',
    );

    expect(launched).toMatchObject({
      provider: 'claude_code',
      sessionKey: 'claude-session-new',
      responseText: 'Initial Claude reply',
      model: 'claude-opus-4-6',
    });
    expect(resumed).toMatchObject({
      provider: 'claude_code',
      sessionKey: 'claude-session-new',
      responseText: 'Follow-up reply',
      model: 'claude-opus-4-6',
      launchCommand: '@anthropic-ai/claude-agent-sdk query(resume)',
    });
    expect(close).toHaveBeenCalledTimes(2);
    expect(assistantEvents).toEqual(['Initial Claude reply']);
  });

  it('rejects unsupported generic-provider resumes instead of starting a fresh session', async () => {
    const { resumeProviderSession } = await import('./agent-adapters');

    await expect(
      resumeProviderSession(
        'cursor',
        'unverifiable-session-id',
        process.cwd(),
        'Continue',
      ),
    ).rejects.toThrow(/cannot be resumed reliably/);
  });
});
