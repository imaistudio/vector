import { describe, expect, it } from 'vitest';
import {
  diffWorkSnapshots,
  parseWorkWatchCategories,
  snapshotWork,
  type WorkWatchSource,
} from './work-watch';

function work(overrides: Partial<WorkWatchSource> = {}): WorkWatchSource {
  return {
    _id: 'work-1',
    key: 'API-1',
    title: 'Ship API',
    workStatus: 'active',
    tasks: [],
    linkedRequests: [],
    attention: [],
    handoffs: [],
    executions: [],
    ...overrides,
  };
}

describe('Work watch', () => {
  it('parses aliases and rejects unknown categories', () => {
    expect(parseWorkWatchCategories('task,requests')).toEqual([
      'tasks',
      'requests',
    ]);
    expect(() => parseWorkWatchCategories('comments')).toThrow(
      'Unknown watch event category',
    );
  });

  it('emits task completion and newly linked Request events', () => {
    const before = snapshotWork(
      work({
        tasks: [{ _id: 'task-1', number: 1, title: 'Code', status: 'doing' }],
      }),
    );
    const after = snapshotWork(
      work({
        tasks: [{ _id: 'task-1', number: 1, title: 'Code', status: 'done' }],
        linkedRequests: [
          { _id: 'request-1', key: 'REQ-7', title: 'Ship it', status: 'new' },
        ],
      }),
    );

    expect(diffWorkSnapshots(before, after, ['tasks', 'requests'])).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ type: 'task.completed', entityId: 'task-1' }),
        expect.objectContaining({
          type: 'request.added',
          entityId: 'request-1',
        }),
      ]),
    );
  });

  it('only emits enabled categories', () => {
    const before = snapshotWork(work());
    const after = snapshotWork(
      work({
        workStatus: 'waiting',
        linkedRequests: [
          { _id: 'request-1', key: 'REQ-7', title: 'Ship it', status: 'new' },
        ],
      }),
    );

    expect(diffWorkSnapshots(before, after, ['requests'])).toHaveLength(1);
    expect(diffWorkSnapshots(before, after, ['requests'])[0]?.type).toBe(
      'request.added',
    );
  });
});
