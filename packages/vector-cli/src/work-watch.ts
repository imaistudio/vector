export const WORK_WATCH_CATEGORIES = [
  'work',
  'tasks',
  'requests',
  'attention',
  'handoffs',
  'executions',
] as const;

export type WorkWatchCategory = (typeof WORK_WATCH_CATEGORIES)[number];

export type WorkWatchEvent = {
  category: WorkWatchCategory;
  type: string;
  workKey: string;
  entityId?: string;
  summary: string;
  before?: Record<string, unknown>;
  after?: Record<string, unknown>;
};

type WatchEntity = Record<string, unknown> & { _id: string };

export type WorkWatchSource = Record<string, unknown> & {
  _id: string;
  key: string;
  linkedRequests?: WatchEntity[];
  tasks?: WatchEntity[];
  attention?: WatchEntity[];
  handoffs?: WatchEntity[];
  executions?: WatchEntity[];
  owner?: Record<string, unknown> | null;
};

export type WorkWatchSnapshot = {
  work: Record<string, unknown> & { _id: string; key: string };
  tasks: WatchEntity[];
  requests: WatchEntity[];
  attention: WatchEntity[];
  handoffs: WatchEntity[];
  executions: WatchEntity[];
};

const categoryAliases: Record<string, WorkWatchCategory> = {
  work: 'work',
  task: 'tasks',
  tasks: 'tasks',
  request: 'requests',
  requests: 'requests',
  attention: 'attention',
  handoff: 'handoffs',
  handoffs: 'handoffs',
  execution: 'executions',
  executions: 'executions',
};

export function parseWorkWatchCategories(value: string): WorkWatchCategory[] {
  const values = value
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
  if (values.includes('all')) return [...WORK_WATCH_CATEGORIES];

  const categories = values.map(item => {
    const category = categoryAliases[item];
    if (!category) {
      throw new Error(
        `Unknown watch event category "${item}". Use: ${WORK_WATCH_CATEGORIES.join(', ')}, or all`,
      );
    }
    return category;
  });
  return Array.from(new Set(categories));
}

function select(
  value: Record<string, unknown>,
  keys: string[],
): Record<string, unknown> {
  return Object.fromEntries(
    keys.filter(key => key in value).map(key => [key, value[key]]),
  );
}

export function snapshotWork(source: WorkWatchSource): WorkWatchSnapshot {
  const owner = source.owner as Record<string, unknown> | null | undefined;
  return {
    work: {
      ...select(source, [
        '_id',
        'key',
        'title',
        'description',
        'workStatus',
        'effort',
        'dueDate',
        'projectId',
        'teamId',
        'priorityId',
        'ownerId',
        'taskTotal',
        'taskDone',
        'updatedAt',
      ]),
      _id: source._id,
      key: source.key,
      ownerName:
        owner?.name ??
        owner?.username ??
        owner?.email ??
        source.ownerId ??
        null,
    },
    tasks: (source.tasks ?? []).map(
      item =>
        select(item, [
          '_id',
          'number',
          'title',
          'description',
          'status',
          'position',
          'assigneeId',
          'updatedAt',
        ]) as WatchEntity,
    ),
    requests: (source.linkedRequests ?? []).map(
      item =>
        select(item, [
          '_id',
          'key',
          'title',
          'status',
          'relation',
          'expectedOutput',
          'updatedAt',
        ]) as WatchEntity,
    ),
    attention: (source.attention ?? []).map(
      item =>
        select(item, [
          '_id',
          'title',
          'details',
          'status',
          'taskId',
          'createdAt',
          'resolvedAt',
        ]) as WatchEntity,
    ),
    handoffs: (source.handoffs ?? []).map(
      item =>
        select(item, [
          '_id',
          'fromOwnerId',
          'toOwnerId',
          'status',
          'summary',
          'note',
          'createdAt',
          'respondedAt',
        ]) as WatchEntity,
    ),
    executions: (source.executions ?? []).map(
      item =>
        select(item, [
          '_id',
          'provider',
          'status',
          'summary',
          'taskId',
          'startedAt',
          'endedAt',
          'updatedAt',
        ]) as WatchEntity,
    ),
  };
}

function equal(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function entityLabel(category: WorkWatchCategory, entity: WatchEntity) {
  if (category === 'tasks') {
    return `Task #${String(entity.number ?? '?')} ${String(entity.title ?? '')}`.trim();
  }
  if (category === 'requests') {
    return `Request ${String(entity.key ?? '')} ${String(entity.title ?? '')}`.trim();
  }
  return String(entity.title ?? entity.summary ?? entity._id);
}

function diffEntities(
  workKey: string,
  category: Exclude<WorkWatchCategory, 'work'>,
  before: WatchEntity[],
  after: WatchEntity[],
): WorkWatchEvent[] {
  const previous = new Map(before.map(item => [item._id, item]));
  const current = new Map(after.map(item => [item._id, item]));
  const events: WorkWatchEvent[] = [];

  for (const item of after) {
    const oldItem = previous.get(item._id);
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;
    if (!oldItem) {
      events.push({
        category,
        type: `${singular}.added`,
        workKey,
        entityId: item._id,
        summary: `${entityLabel(category, item)} added`,
        after: item,
      });
      continue;
    }
    if (!equal(oldItem, item)) {
      const completed =
        category === 'tasks' &&
        oldItem.status !== 'done' &&
        item.status === 'done';
      events.push({
        category,
        type: completed ? 'task.completed' : `${singular}.updated`,
        workKey,
        entityId: item._id,
        summary: completed
          ? `${entityLabel(category, item)} completed`
          : `${entityLabel(category, item)} updated`,
        before: oldItem,
        after: item,
      });
    }
  }

  for (const item of before) {
    if (current.has(item._id)) continue;
    const singular = category.endsWith('s') ? category.slice(0, -1) : category;
    events.push({
      category,
      type: `${singular}.removed`,
      workKey,
      entityId: item._id,
      summary: `${entityLabel(category, item)} removed`,
      before: item,
    });
  }

  return events;
}

export function diffWorkSnapshots(
  before: WorkWatchSnapshot,
  after: WorkWatchSnapshot,
  categories: WorkWatchCategory[],
): WorkWatchEvent[] {
  const enabled = new Set(categories);
  const events: WorkWatchEvent[] = [];
  if (enabled.has('work') && !equal(before.work, after.work)) {
    events.push({
      category: 'work',
      type: 'work.updated',
      workKey: after.work.key,
      entityId: after.work._id,
      summary: `Work ${after.work.key} updated`,
      before: before.work,
      after: after.work,
    });
  }
  for (const category of WORK_WATCH_CATEGORIES) {
    if (category === 'work' || !enabled.has(category)) continue;
    events.push(
      ...diffEntities(
        after.work.key,
        category,
        before[category],
        after[category],
      ),
    );
  }
  return events;
}
