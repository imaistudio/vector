import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import type { Doc, Id } from '../_generated/dataModel';
import { query, type QueryCtx } from '../_generated/server';
import { canViewIssue, canViewProject, canViewTeam } from '../access';
import { getUserDisplayName } from './lib';

type ActivityEventDoc = Doc<'activityEvents'>;

type HydratedUsers = Map<Id<'users'>, Doc<'users'>>;
type HydratedIssues = Map<Id<'issues'>, Doc<'issues'>>;
type HydratedProjects = Map<Id<'projects'>, Doc<'projects'>>;
type HydratedTeams = Map<Id<'teams'>, Doc<'teams'>>;

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

async function hydrateIssues(
  ctx: QueryCtx,
  ids: readonly Id<'issues'>[],
): Promise<HydratedIssues> {
  const uniqueIds = [...new Set(ids)];
  const issues = await Promise.all(
    uniqueIds.map(id => ctx.db.get('issues', id)),
  );
  return new Map(
    uniqueIds.flatMap((id, index) =>
      issues[index] ? [[id, issues[index] as Doc<'issues'>]] : [],
    ),
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
    uniqueIds.flatMap((id, index) =>
      projects[index] ? [[id, projects[index] as Doc<'projects'>]] : [],
    ),
  );
}

async function hydrateTeams(
  ctx: QueryCtx,
  ids: readonly Id<'teams'>[],
): Promise<HydratedTeams> {
  const uniqueIds = [...new Set(ids)];
  const teams = await Promise.all(uniqueIds.map(id => ctx.db.get('teams', id)));
  return new Map(
    uniqueIds.flatMap((id, index) =>
      teams[index] ? [[id, teams[index] as Doc<'teams'>]] : [],
    ),
  );
}

async function filterVisibleEvents(
  ctx: QueryCtx,
  events: ActivityEventDoc[],
  issues: HydratedIssues,
  projects: HydratedProjects,
  teams: HydratedTeams,
) {
  const visible: ActivityEventDoc[] = [];

  for (const event of events) {
    if (event.entityType === 'issue') {
      if (!event.issueId) continue;
      const issue = issues.get(event.issueId);
      if (!issue) continue;
      if (await canViewIssue(ctx, issue)) {
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
  issues: HydratedIssues,
  projects: HydratedProjects,
  teams: HydratedTeams,
) {
  const actor = users.get(event.actorId) ?? null;
  const subjectUser = event.subjectUserId
    ? (users.get(event.subjectUserId) ?? null)
    : null;
  const issue = event.issueId ? (issues.get(event.issueId) ?? null) : null;
  const project = event.projectId
    ? (projects.get(event.projectId) ?? null)
    : null;
  const team = event.teamId ? (teams.get(event.teamId) ?? null) : null;

  const target =
    event.entityType === 'issue'
      ? {
          type: 'issue' as const,
          id: event.issueId ?? null,
          key: issue?.key ?? event.snapshot.entityKey ?? null,
          name: issue?.title ?? event.snapshot.entityName ?? null,
        }
      : event.entityType === 'project'
        ? {
            type: 'project' as const,
            id: event.projectId ?? null,
            key: project?.key ?? event.snapshot.entityKey ?? null,
            name: project?.name ?? event.snapshot.entityName ?? null,
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
        }
      : null,
    target,
    details: {
      field: event.details.field ?? null,
      fromLabel: event.details.fromLabel ?? null,
      toLabel: event.details.toLabel ?? null,
      roleName: event.details.roleName ?? null,
      commentPreview: event.details.commentPreview ?? null,
      addedUserNames: event.details.addedUserNames ?? [],
      removedUserNames: event.details.removedUserNames ?? [],
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
  const issues = await hydrateIssues(
    ctx,
    events.flatMap(event => (event.issueId ? [event.issueId] : [])),
  );
  const projects = await hydrateProjects(
    ctx,
    events.flatMap(event => (event.projectId ? [event.projectId] : [])),
  );
  const teams = await hydrateTeams(
    ctx,
    events.flatMap(event => (event.teamId ? [event.teamId] : [])),
  );

  const visibleEvents = await filterVisibleEvents(
    ctx,
    events,
    issues,
    projects,
    teams,
  );

  return visibleEvents.map(event =>
    mapActivityItem(event, users, issues, projects, teams),
  );
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
