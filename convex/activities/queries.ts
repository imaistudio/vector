import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { query, type QueryCtx } from '../_generated/server';
import {
  canViewDocument,
  canViewIssue,
  canViewProject,
  canViewTeam,
} from '../access';
import { canViewRequest } from '../requests/lib';
import { getOrganizationBySlug, requireOrganizationMember } from '../authz';
import {
  getUserDisplayName,
  matchesActivityEventFilters,
  queryOrganizationActivityPage,
} from './lib';
import {
  activityEntityTypeValidator,
  activityEventTypeValidator,
} from '../_shared/activity';

type ActivityEventDoc = Doc<'activityEvents'>;

type HydratedUsers = Map<Id<'users'>, Doc<'users'>>;
type HydratedUserStatuses = Map<
  Id<'users'>,
  {
    presence: 'online' | 'idle' | 'dnd' | 'offline';
    customText?: string;
    customEmoji?: string;
    clearsAt?: number;
    updatedAt: number;
  }
>;
type HydratedIssues = Map<Id<'issues'>, Doc<'issues'>>;
type HydratedRequests = Map<Id<'requests'>, Doc<'requests'>>;
type HydratedTasks = Map<Id<'tasks'>, Doc<'tasks'>>;
type HydratedProjects = Map<Id<'projects'>, Doc<'projects'>>;
type HydratedTeams = Map<Id<'teams'>, Doc<'teams'>>;
type HydratedDocuments = Map<Id<'documents'>, Doc<'documents'>>;

async function hydrateUsers(
  ctx: QueryCtx,
  ids: readonly Id<'users'>[],
): Promise<HydratedUsers> {
  const uniqueIds = [...new Set(ids)];
  const users = await Promise.all(uniqueIds.map(id => ctx.db.get('users', id)));
  return new Map(
    uniqueIds.flatMap((id, index) =>
      users[index] ? [[id, users[index]]] : [],
    ),
  );
}

async function hydrateUserStatuses(
  ctx: QueryCtx,
  ids: readonly Id<'users'>[],
): Promise<HydratedUserStatuses> {
  const uniqueIds = [...new Set(ids)];
  const statuses = await Promise.all(
    uniqueIds.map(id =>
      ctx.db
        .query('userStatuses')
        .withIndex('by_user', q => q.eq('userId', id))
        .unique(),
    ),
  );

  return new Map(
    uniqueIds.flatMap((id, index) => {
      const status = statuses[index];
      if (!status) return [];
      const expired = status.clearsAt && status.clearsAt < Date.now();
      const hidden = status.presence === 'invisible' || expired;
      return [
        [
          id,
          {
            presence:
              status.presence === 'invisible'
                ? ('offline' as const)
                : status.presence,
            customText: hidden ? undefined : status.customText,
            customEmoji: hidden ? undefined : status.customEmoji,
            clearsAt: hidden ? undefined : status.clearsAt,
            updatedAt: status.updatedAt,
          },
        ] as const,
      ];
    }),
  );
}

async function hydrateIssues(
  ctx: QueryCtx,
  ids: readonly Id<'issues'>[],
): Promise<HydratedIssues> {
  const uniqueIds = [...new Set(ids)];
  const issues = await Promise.all(
    uniqueIds.map(id => ctx.db.get('issues', id)),
  );
  return new Map(
    uniqueIds.flatMap((id, index) => {
      const issue = issues[index];
      return issue ? [[id, issue]] : [];
    }),
  );
}

async function hydrateRequests(
  ctx: QueryCtx,
  ids: readonly Id<'requests'>[],
): Promise<HydratedRequests> {
  const uniqueIds = [...new Set(ids)];
  const requests = await Promise.all(
    uniqueIds.map(id => ctx.db.get('requests', id)),
  );
  return new Map(
    uniqueIds.flatMap((id, index) => {
      const request = requests[index];
      return request ? [[id, request]] : [];
    }),
  );
}

async function hydrateTasks(
  ctx: QueryCtx,
  ids: readonly Id<'tasks'>[],
): Promise<HydratedTasks> {
  const uniqueIds = [...new Set(ids)];
  const tasks = await Promise.all(uniqueIds.map(id => ctx.db.get('tasks', id)));
  return new Map(
    uniqueIds.flatMap((id, index) => {
      const task = tasks[index];
      return task ? [[id, task]] : [];
    }),
  );
}

async function hydrateProjects(
  ctx: QueryCtx,
  ids: readonly Id<'projects'>[],
): Promise<HydratedProjects> {
  const uniqueIds = [...new Set(ids)];
  const projects = await Promise.all(
    uniqueIds.map(id => ctx.db.get('projects', id)),
  );
  return new Map(
    uniqueIds.flatMap((id, index) => {
      const project = projects[index];
      return project ? [[id, project]] : [];
    }),
  );
}

async function hydrateTeams(
  ctx: QueryCtx,
  ids: readonly Id<'teams'>[],
): Promise<HydratedTeams> {
  const uniqueIds = [...new Set(ids)];
  const teams = await Promise.all(uniqueIds.map(id => ctx.db.get('teams', id)));
  return new Map(
    uniqueIds.flatMap((id, index) => {
      const team = teams[index];
      return team ? [[id, team]] : [];
    }),
  );
}

async function hydrateDocuments(
  ctx: QueryCtx,
  ids: readonly Id<'documents'>[],
): Promise<HydratedDocuments> {
  const uniqueIds = [...new Set(ids)];
  const documents = await Promise.all(
    uniqueIds.map(id => ctx.db.get('documents', id)),
  );
  return new Map(
    uniqueIds.flatMap((id, index) => {
      const document = documents[index];
      return document ? [[id, document]] : [];
    }),
  );
}

async function filterVisibleEvents(
  ctx: QueryCtx,
  events: ActivityEventDoc[],
  issues: HydratedIssues,
  requests: HydratedRequests,
  projects: HydratedProjects,
  teams: HydratedTeams,
  documents: HydratedDocuments,
) {
  const visible: ActivityEventDoc[] = [];

  for (const event of events) {
    if (
      event.entityType === 'issue' ||
      event.entityType === 'work' ||
      event.entityType === 'task'
    ) {
      if (!event.issueId) continue;
      const issue = issues.get(event.issueId);
      if (!issue) continue;
      if (await canViewIssue(ctx, issue)) {
        visible.push(event);
      }
      continue;
    }

    if (event.entityType === 'request') {
      if (!event.requestId) continue;
      const request = requests.get(event.requestId);
      if (!request) continue;
      if (await canViewRequest(ctx, request)) {
        visible.push(event);
      }
      continue;
    }

    if (event.entityType === 'project') {
      if (!event.projectId) continue;
      const project = projects.get(event.projectId);
      if (!project) continue;
      if (await canViewProject(ctx, project)) {
        visible.push(event);
      }
      continue;
    }

    if (event.entityType === 'document') {
      if (!event.documentId) continue;
      const document = documents.get(event.documentId);
      if (!document) continue;
      if (await canViewDocument(ctx, document)) {
        visible.push(event);
      }
      continue;
    }

    if (!event.teamId) continue;
    const team = teams.get(event.teamId);
    if (!team) continue;
    if (await canViewTeam(ctx, team)) {
      visible.push(event);
    }
  }

  return visible;
}

function mapActivityItem(
  event: ActivityEventDoc,
  users: HydratedUsers,
  userStatuses: HydratedUserStatuses,
  issues: HydratedIssues,
  requests: HydratedRequests,
  tasks: HydratedTasks,
  projects: HydratedProjects,
  teams: HydratedTeams,
  documents: HydratedDocuments,
) {
  const actor = users.get(event.actorId) ?? null;
  const subjectUser = event.subjectUserId
    ? (users.get(event.subjectUserId) ?? null)
    : null;
  const issue = event.issueId ? (issues.get(event.issueId) ?? null) : null;
  const request = event.requestId
    ? (requests.get(event.requestId) ?? null)
    : null;
  const task = event.taskId ? (tasks.get(event.taskId) ?? null) : null;
  const project = event.projectId
    ? (projects.get(event.projectId) ?? null)
    : null;
  const team = event.teamId ? (teams.get(event.teamId) ?? null) : null;
  const document = event.documentId
    ? (documents.get(event.documentId) ?? null)
    : null;

  const target =
    event.entityType === 'issue' || event.entityType === 'work'
      ? {
          type: event.entityType,
          id: event.issueId ?? null,
          key: issue?.key ?? event.snapshot.entityKey ?? null,
          name: issue?.title ?? event.snapshot.entityName ?? null,
        }
      : event.entityType === 'request'
        ? {
            type: 'request' as const,
            id: event.requestId ?? null,
            key: request?.key ?? event.snapshot.entityKey ?? null,
            name: request?.title ?? event.snapshot.entityName ?? null,
          }
        : event.entityType === 'task'
          ? {
              type: 'task' as const,
              id: event.taskId ?? null,
              key: task
                ? `${issue?.key ?? event.snapshot.entityKey ?? 'Work'}#${task.number}`
                : (event.snapshot.entityKey ?? null),
              name: task?.title ?? event.snapshot.entityName ?? null,
            }
          : event.entityType === 'project'
            ? {
                type: 'project' as const,
                id: event.projectId ?? null,
                key: project?.key ?? event.snapshot.entityKey ?? null,
                name: project?.name ?? event.snapshot.entityName ?? null,
              }
            : event.entityType === 'document'
              ? {
                  type: 'document' as const,
                  id: event.documentId ?? null,
                  key: null,
                  name: document?.title ?? event.snapshot.entityName ?? null,
                }
              : {
                  type: 'team' as const,
                  id: event.teamId ?? null,
                  key: team?.key ?? event.snapshot.entityKey ?? null,
                  name: team?.name ?? event.snapshot.entityName ?? null,
                };

  return {
    _id: event._id,
    createdAt: event._creationTime,
    entityType: event.entityType,
    eventType: event.eventType,
    actor: actor
      ? {
          _id: actor._id,
          name: getUserDisplayName(actor),
          email: actor.email ?? null,
          image: actor.image ?? null,
          status: userStatuses.get(actor._id) ?? null,
        }
      : null,
    subjectUser: event.subjectUserId
      ? {
          _id: event.subjectUserId,
          name:
            subjectUser?.name ??
            subjectUser?.username ??
            subjectUser?.email ??
            event.details.subjectUserName ??
            'Unknown user',
          email: subjectUser?.email ?? null,
          image: subjectUser?.image ?? null,
          status: userStatuses.get(event.subjectUserId) ?? null,
        }
      : null,
    target,
    details: {
      field: event.details.field ?? null,
      fromLabel: event.details.fromLabel ?? null,
      toLabel: event.details.toLabel ?? null,
      roleName: event.details.roleName ?? null,
      commentId: event.details.commentId ?? null,
      commentPreview: event.details.commentPreview ?? null,
      addedUserNames: event.details.addedUserNames ?? [],
      removedUserNames: event.details.removedUserNames ?? [],
      viaAgent: event.details.viaAgent ?? false,
    },
  };
}

async function enrichEvents(ctx: QueryCtx, events: ActivityEventDoc[]) {
  const users = await hydrateUsers(
    ctx,
    events.flatMap(event =>
      event.subjectUserId
        ? [event.actorId, event.subjectUserId]
        : [event.actorId],
    ),
  );
  const userStatuses = await hydrateUserStatuses(
    ctx,
    events.flatMap(event =>
      event.subjectUserId
        ? [event.actorId, event.subjectUserId]
        : [event.actorId],
    ),
  );
  const issues = await hydrateIssues(
    ctx,
    events.flatMap(event => (event.issueId ? [event.issueId] : [])),
  );
  const requests = await hydrateRequests(
    ctx,
    events.flatMap(event => (event.requestId ? [event.requestId] : [])),
  );
  const tasks = await hydrateTasks(
    ctx,
    events.flatMap(event => (event.taskId ? [event.taskId] : [])),
  );
  const projects = await hydrateProjects(
    ctx,
    events.flatMap(event => (event.projectId ? [event.projectId] : [])),
  );
  const teams = await hydrateTeams(
    ctx,
    events.flatMap(event => (event.teamId ? [event.teamId] : [])),
  );
  const documents = await hydrateDocuments(
    ctx,
    events.flatMap(event => (event.documentId ? [event.documentId] : [])),
  );

  const visibleEvents = await filterVisibleEvents(
    ctx,
    events,
    issues,
    requests,
    projects,
    teams,
    documents,
  );

  return visibleEvents.map(event =>
    mapActivityItem(
      event,
      users,
      userStatuses,
      issues,
      requests,
      tasks,
      projects,
      teams,
      documents,
    ),
  );
}

async function collectOrgActivityItems(
  ctx: QueryCtx,
  organizationId: Id<'organizations'>,
  args: {
    entityType?: ActivityEventDoc['entityType'];
    eventType?: ActivityEventDoc['eventType'];
    actorId?: Id<'users'>;
    since?: number;
    until?: number;
    limit?: number;
    cursor?: string;
  },
) {
  const limit = Math.min(args.limit ?? 50, 100);
  const items: Awaited<ReturnType<typeof enrichEvents>> = [];
  let cursor = args.cursor ?? null;
  let isDone = false;

  while (items.length < limit && !isDone) {
    const page = await queryOrganizationActivityPage(ctx, organizationId, {
      ...args,
      cursor,
      numItems: limit - items.length,
    });

    const matchingEvents = page.page.filter(event =>
      matchesActivityEventFilters(event, args),
    );

    items.push(...(await enrichEvents(ctx, matchingEvents)));

    cursor = page.continueCursor;
    isDone = page.isDone || !page.continueCursor;
  }

  return {
    items,
    nextCursor: isDone ? null : cursor,
  };
}

export const listProjectActivity = query({
  args: {
    projectId: v.id('projects'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const project = await ctx.db.get('projects', args.projectId);
    if (!project) {
      throw new ConvexError('PROJECT_NOT_FOUND');
    }

    if (!(await canViewProject(ctx, project))) {
      throw new ConvexError('FORBIDDEN');
    }

    const result = await ctx.db
      .query('activityEvents')
      .withIndex('by_project', q => q.eq('projectId', args.projectId))
      .order('desc')
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await enrichEvents(ctx, result.page),
    };
  },
});

export const listTeamActivity = query({
  args: {
    teamId: v.id('teams'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const team = await ctx.db.get('teams', args.teamId);
    if (!team) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }

    if (!(await canViewTeam(ctx, team))) {
      throw new ConvexError('FORBIDDEN');
    }

    const result = await ctx.db
      .query('activityEvents')
      .withIndex('by_team', q => q.eq('teamId', args.teamId))
      .order('desc')
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await enrichEvents(ctx, result.page),
    };
  },
});

export const listIssueActivity = query({
  args: {
    issueId: v.id('issues'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }

    if (!(await canViewIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    const result = await ctx.db
      .query('activityEvents')
      .withIndex('by_issue', q => q.eq('issueId', args.issueId))
      .order('desc')
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await enrichEvents(ctx, result.page),
    };
  },
});

export const listRequestActivity = query({
  args: {
    requestId: v.id('requests'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get('requests', args.requestId);
    if (!request) throw new ConvexError('REQUEST_NOT_FOUND');
    if (!(await canViewRequest(ctx, request)))
      throw new ConvexError('FORBIDDEN');

    const result = await ctx.db
      .query('activityEvents')
      .withIndex('by_request', q => q.eq('requestId', request._id))
      .order('desc')
      .paginate(args.paginationOpts);
    return { ...result, page: await enrichEvents(ctx, result.page) };
  },
});

export const listDocumentActivity = query({
  args: {
    documentId: v.id('documents'),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const document = await ctx.db.get('documents', args.documentId);
    if (!document) {
      throw new ConvexError('DOCUMENT_NOT_FOUND');
    }

    if (!(await canViewDocument(ctx, document))) {
      throw new ConvexError('FORBIDDEN');
    }

    const result = await ctx.db
      .query('activityEvents')
      .withIndex('by_document', q => q.eq('documentId', args.documentId))
      .order('desc')
      .paginate(args.paginationOpts);

    return {
      ...result,
      page: await enrichEvents(ctx, result.page),
    };
  },
});

/**
 * List activity across an entire organization with optional filters.
 * Supports filtering by entity type, event type, actor, and time range.
 */
export const listOrgActivity = query({
  args: {
    orgSlug: v.string(),
    entityType: v.optional(activityEntityTypeValidator),
    eventType: v.optional(activityEventTypeValidator),
    actorId: v.optional(v.id('users')),
    since: v.optional(v.number()),
    until: v.optional(v.number()),
    limit: v.optional(v.number()),
    cursor: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrganizationMember(ctx, org._id);
    const result = await collectOrgActivityItems(ctx, org._id, args);

    return {
      items: result.items,
      nextCursor: result.nextCursor,
    };
  },
});
