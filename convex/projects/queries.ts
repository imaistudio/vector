import { paginationOptsValidator } from 'convex/server';
import { query, type QueryCtx } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import { canViewProject } from '../access';
import {
  getLeadMembershipFromMembers,
  getProjectLeadSummary,
} from '../_shared/leads';
import { isDefined } from '../_shared/typeGuards';
import { getAuthUserId } from '../authUtils';

async function getProjectForOrgByKey(
  ctx: QueryCtx,
  orgSlug: string,
  projectKey: string,
) {
  const org = await ctx.db
    .query('organizations')
    .withIndex('by_slug', q => q.eq('slug', orgSlug))
    .first();

  if (!org) {
    throw new ConvexError('ORGANIZATION_NOT_FOUND');
  }

  const project = await ctx.db
    .query('projects')
    .withIndex('by_org_key', q =>
      q.eq('organizationId', org._id).eq('key', projectKey),
    )
    .first();

  return project;
}

async function loadProjectDetails(ctx: QueryCtx, project: Doc<'projects'>) {
  const { leadId, lead } = await getProjectLeadSummary(ctx, project);
  return { ...project, leadId, lead };
}

async function hydrateProjects(
  ctx: QueryCtx,
  projects: readonly Doc<'projects'>[],
) {
  const projectMemberships = await Promise.all(
    projects.map(async project => ({
      projectId: project._id,
      members: await ctx.db
        .query('projectMembers')
        .withIndex('by_project', q => q.eq('projectId', project._id))
        .collect(),
    })),
  );
  const projectMembershipMap = new Map(
    projectMemberships.map(({ projectId, members }) => [projectId, members]),
  );

  const leadIds = projects
    .map(project => {
      const members = projectMembershipMap.get(project._id) ?? [];
      return getLeadMembershipFromMembers(members)?.userId ?? project.leadId;
    })
    .filter(isDefined);
  const statusIds = projects.map(project => project.statusId).filter(isDefined);

  const [leadUsers, statuses] = await Promise.all([
    Promise.all(leadIds.map(id => ctx.db.get('users', id))),
    Promise.all(statusIds.map(id => ctx.db.get('projectStatuses', id))),
  ]);

  const leadUserMap = new Map(leadIds.map((id, i) => [id, leadUsers[i]]));
  const statusMap = new Map(statusIds.map((id, i) => [id, statuses[i]]));

  return projects.map(project => {
    const leadId =
      getLeadMembershipFromMembers(projectMembershipMap.get(project._id) ?? [])
        ?.userId ?? project.leadId;
    const leadUser = leadId ? leadUserMap.get(leadId) : null;
    const status = project.statusId ? statusMap.get(project.statusId) : null;

    return {
      ...project,
      leadId,
      lead: leadUser,
      status,
    };
  });
}

async function listVisibleOrgProjects(
  ctx: QueryCtx,
  organizationId: Doc<'organizations'>['_id'],
  teamId?: Doc<'teams'>['_id'],
) {
  const allProjects = teamId
    ? await ctx.db
        .query('projects')
        .withIndex('by_org_team', q =>
          q.eq('organizationId', organizationId).eq('teamId', teamId),
        )
        .collect()
    : await ctx.db
        .query('projects')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organizationId),
        )
        .collect();

  const visibleProjects: Doc<'projects'>[] = [];
  for (const project of allProjects) {
    if (await canViewProject(ctx, project)) {
      visibleProjects.push(project);
    }
  }

  return visibleProjects;
}

async function listMyProjectDocs(
  ctx: QueryCtx,
  organizationId: Doc<'organizations'>['_id'],
  userId: Doc<'users'>['_id'],
) {
  const myMemberships = await ctx.db
    .query('projectMembers')
    .withIndex('by_user', q => q.eq('userId', userId))
    .collect();

  const projects = (
    await Promise.all(
      myMemberships.map(async membership => {
        const project = await ctx.db.get('projects', membership.projectId);
        return project && project.organizationId === organizationId
          ? project
          : null;
      }),
    )
  ).filter((project): project is Doc<'projects'> => project !== null);

  const allOrgProjects = await ctx.db
    .query('projects')
    .withIndex('by_organization', q => q.eq('organizationId', organizationId))
    .collect();
  const ownedProjects = allOrgProjects.filter(
    project =>
      (project.createdBy === userId || project.leadId === userId) &&
      !projects.some(myProject => myProject._id === project._id),
  );

  return [...projects, ...ownedProjects].sort(
    (a, b) => b._creationTime - a._creationTime,
  );
}

export const getByKey = query({
  args: {
    orgSlug: v.string(),
    projectKey: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await getProjectForOrgByKey(
      ctx,
      args.orgSlug,
      args.projectKey,
    );

    if (!project) {
      throw new ConvexError('PROJECT_NOT_FOUND');
    }

    if (!(await canViewProject(ctx, project))) {
      throw new ConvexError('FORBIDDEN');
    }

    return loadProjectDetails(ctx, project);
  },
});

export const getByKeyOrNull = query({
  args: {
    orgSlug: v.string(),
    projectKey: v.string(),
  },
  handler: async (ctx, args) => {
    const project = await getProjectForOrgByKey(
      ctx,
      args.orgSlug,
      args.projectKey,
    );

    if (!project) {
      return null;
    }

    if (!(await canViewProject(ctx, project))) {
      throw new ConvexError('FORBIDDEN');
    }

    return loadProjectDetails(ctx, project);
  },
});

export const list = query({
  args: {
    orgSlug: v.string(),
    teamId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    let resolvedTeamId: Doc<'teams'>['_id'] | undefined;

    if (args.teamId) {
      const team = await ctx.db
        .query('teams')
        .withIndex('by_org_key', q =>
          q.eq('organizationId', org._id).eq('key', args.teamId!),
        )
        .first();

      if (!team) {
        return [];
      }

      resolvedTeamId = team._id;
    }

    return hydrateProjects(
      ctx,
      await listVisibleOrgProjects(ctx, org._id, resolvedTeamId),
    );
  },
});

/**
 * List only projects where the current user is a member (for sidebar).
 */
export const listMyProjects = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    return hydrateProjects(ctx, await listMyProjectDocs(ctx, org._id, userId));
  },
});

export const listPage = query({
  args: {
    orgSlug: v.string(),
    scope: v.union(v.literal('mine'), v.literal('all')),
    statusType: v.optional(v.string()),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const statuses = await ctx.db
      .query('projectStatuses')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();
    const statusTypeById = new Map(
      statuses.map(status => [status._id, status.type]),
    );
    const matchesStatus = (project: Doc<'projects'>) =>
      !args.statusType ||
      (project.statusId
        ? statusTypeById.get(project.statusId) === args.statusType
        : false);

    if (args.scope === 'all') {
      const target = Math.max(1, args.paginationOpts.numItems);
      const pageItems: Doc<'projects'>[] = [];
      let cursor = args.paginationOpts.cursor;
      let isDone = false;

      while (pageItems.length < target && !isDone) {
        const source = await ctx.db
          .query('projects')
          .withIndex('by_organization', q => q.eq('organizationId', org._id))
          .order('desc')
          .paginate({
            cursor,
            numItems: target - pageItems.length,
          });

        for (const project of source.page) {
          if (!matchesStatus(project)) continue;
          if (await canViewProject(ctx, project)) {
            pageItems.push(project);
          }
        }

        cursor = source.continueCursor;
        isDone = source.isDone || !source.continueCursor;
      }

      return {
        page: await hydrateProjects(ctx, pageItems),
        continueCursor: cursor ?? '',
        isDone,
      };
    }

    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const projects = (await listMyProjectDocs(ctx, org._id, userId)).filter(
      matchesStatus,
    );
    const offset = Number.parseInt(args.paginationOpts.cursor ?? '0', 10) || 0;
    const page = projects.slice(offset, offset + args.paginationOpts.numItems);
    const nextOffset = offset + page.length;

    return {
      page: await hydrateProjects(ctx, page),
      continueCursor: nextOffset >= projects.length ? '' : String(nextOffset),
      isDone: nextOffset >= projects.length,
    };
  },
});

export const getListSummary = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const statuses = await ctx.db
      .query('projectStatuses')
      .withIndex('by_organization', q => q.eq('organizationId', org._id))
      .collect();
    const statusTypeById = new Map(
      statuses.map(status => [status._id, status.type]),
    );

    const [allProjects, myProjects] = await Promise.all([
      listVisibleOrgProjects(ctx, org._id),
      listMyProjectDocs(ctx, org._id, userId),
    ]);

    const buildCounts = (projects: readonly Doc<'projects'>[]) =>
      projects.reduce(
        (acc, project) => {
          const type = project.statusId
            ? statusTypeById.get(project.statusId)
            : null;
          if (type) {
            acc[type] = (acc[type] ?? 0) + 1;
          }
          return acc;
        },
        {} as Record<string, number>,
      );

    return {
      allCount: allProjects.length,
      mineCount: myProjects.length,
      allStatusCounts: buildCounts(allProjects),
      mineStatusCounts: buildCounts(myProjects),
    };
  },
});

export const listMembers = query({
  args: {
    projectId: v.optional(v.id('projects')),
    orgSlug: v.optional(v.string()),
    projectKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    let project: Doc<'projects'> | null = null;

    if (args.projectId) {
      project = await ctx.db.get('projects', args.projectId);
    } else if (args.orgSlug && args.projectKey) {
      const org = await ctx.db
        .query('organizations')
        .withIndex('by_slug', q => q.eq('slug', args.orgSlug!))
        .first();

      if (!org) {
        throw new ConvexError('ORGANIZATION_NOT_FOUND');
      }

      project = await ctx.db
        .query('projects')
        .withIndex('by_org_key', q =>
          q.eq('organizationId', org._id).eq('key', args.projectKey!),
        )
        .first();
    }

    if (!project) {
      return [];
    }

    if (!(await canViewProject(ctx, project))) {
      throw new ConvexError('FORBIDDEN');
    }

    const projectMembers = await ctx.db
      .query('projectMembers')
      .withIndex('by_project', q => q.eq('projectId', project._id))
      .collect();

    const membersWithUsers = await Promise.all(
      projectMembers.map(async member => {
        const user = await ctx.db.get('users', member.userId);
        return { ...member, user };
      }),
    );

    return membersWithUsers;
  },
});
