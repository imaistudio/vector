import { paginationOptsValidator } from 'convex/server';
import { query, type QueryCtx } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import { canViewTeam } from '../access';
import {
  getLeadMembershipFromMembers,
  getTeamLeadSummary,
} from '../_shared/leads';
import { isDefined } from '../_shared/typeGuards';
import { getAuthUserId } from '../authUtils';

async function hydrateTeams(ctx: QueryCtx, teams: readonly Doc<'teams'>[]) {
  const teamMemberships = await Promise.all(
    teams.map(async team => ({
      teamId: team._id,
      members: await ctx.db
        .query('teamMembers')
        .withIndex('by_team', q => q.eq('teamId', team._id))
        .collect(),
    })),
  );
  const teamMembershipMap = new Map(
    teamMemberships.map(({ teamId, members }) => [teamId, members]),
  );

  const leadIds = teams
    .map(team => {
      const members = teamMembershipMap.get(team._id) ?? [];
      return getLeadMembershipFromMembers(members)?.userId ?? team.leadId;
    })
    .filter(isDefined);
  const leadUsers = await Promise.all(
    leadIds.map(id => ctx.db.get('users', id)),
  );
  const leadUserMap = new Map(leadIds.map((id, i) => [id, leadUsers[i]]));

  return teams.map(team => {
    const members = teamMembershipMap.get(team._id) ?? [];
    const leadId = getLeadMembershipFromMembers(members)?.userId ?? team.leadId;
    const leadUser = leadId ? leadUserMap.get(leadId) : null;

    return {
      ...team,
      leadId,
      lead: leadUser,
      memberCount: members.length,
    };
  });
}

async function listVisibleOrgTeams(
  ctx: QueryCtx,
  organizationId: Doc<'organizations'>['_id'],
) {
  const allTeams = await ctx.db
    .query('teams')
    .withIndex('by_organization', q => q.eq('organizationId', organizationId))
    .collect();

  const visibleTeams: Doc<'teams'>[] = [];
  for (const team of allTeams) {
    if (await canViewTeam(ctx, team)) {
      visibleTeams.push(team);
    }
  }

  return visibleTeams;
}

async function listMyTeamDocs(
  ctx: QueryCtx,
  organizationId: Doc<'organizations'>['_id'],
  userId: Doc<'users'>['_id'],
) {
  const myMemberships = await ctx.db
    .query('teamMembers')
    .withIndex('by_user', q => q.eq('userId', userId))
    .collect();

  const teams = (
    await Promise.all(
      myMemberships.map(async membership => {
        const team = await ctx.db.get('teams', membership.teamId);
        return team && team.organizationId === organizationId ? team : null;
      }),
    )
  ).filter((team): team is Doc<'teams'> => team !== null);

  const allOrgTeams = await ctx.db
    .query('teams')
    .withIndex('by_organization', q => q.eq('organizationId', organizationId))
    .collect();
  const createdTeams = allOrgTeams.filter(
    team =>
      team.createdBy === userId &&
      !teams.some(myTeam => myTeam._id === team._id),
  );

  return [...teams, ...createdTeams].sort(
    (a, b) => b._creationTime - a._creationTime,
  );
}

/**
 * Get team by organization slug and team key
 */
export const getByKey = query({
  args: {
    orgSlug: v.string(),
    teamKey: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    const team = await ctx.db
      .query('teams')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', org._id).eq('key', args.teamKey),
      )
      .first();

    if (!team) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }

    if (!(await canViewTeam(ctx, team))) {
      throw new ConvexError('FORBIDDEN');
    }

    const { leadId, lead } = await getTeamLeadSummary(ctx, team);

    return {
      ...team,
      leadId,
      lead,
    };
  },
});

/**
 * List teams in organization
 */
export const list = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();

    if (!org) {
      throw new ConvexError('ORGANIZATION_NOT_FOUND');
    }

    return hydrateTeams(ctx, await listVisibleOrgTeams(ctx, org._id));
  },
});

/**
 * List only teams where the current user is a member (for sidebar).
 */
export const listMyTeams = query({
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

    return hydrateTeams(ctx, await listMyTeamDocs(ctx, org._id, userId));
  },
});

export const listPage = query({
  args: {
    orgSlug: v.string(),
    scope: v.union(v.literal('mine'), v.literal('all')),
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

    if (args.scope === 'all') {
      const target = Math.max(1, args.paginationOpts.numItems);
      const pageItems: Doc<'teams'>[] = [];
      let cursor = args.paginationOpts.cursor;
      let isDone = false;

      while (pageItems.length < target && !isDone) {
        const source = await ctx.db
          .query('teams')
          .withIndex('by_organization', q => q.eq('organizationId', org._id))
          .order('desc')
          .paginate({
            cursor,
            numItems: target - pageItems.length,
          });

        for (const team of source.page) {
          if (await canViewTeam(ctx, team)) {
            pageItems.push(team);
          }
        }

        cursor = source.continueCursor;
        isDone = source.isDone || !source.continueCursor;
      }

      return {
        page: await hydrateTeams(ctx, pageItems),
        continueCursor: cursor ?? '',
        isDone,
      };
    }

    const userId = await getAuthUserId(ctx);
    if (userId === null) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const teams = await listMyTeamDocs(ctx, org._id, userId);
    const offset = Number.parseInt(args.paginationOpts.cursor ?? '0', 10) || 0;
    const page = teams.slice(offset, offset + args.paginationOpts.numItems);
    const nextOffset = offset + page.length;

    return {
      page: await hydrateTeams(ctx, page),
      continueCursor: nextOffset >= teams.length ? '' : String(nextOffset),
      isDone: nextOffset >= teams.length,
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

    const [allTeams, myTeams] = await Promise.all([
      listVisibleOrgTeams(ctx, org._id),
      listMyTeamDocs(ctx, org._id, userId),
    ]);

    return {
      allCount: allTeams.length,
      mineCount: myTeams.length,
    };
  },
});

/**
 * List team members
 */
export const listMembers = query({
  args: {
    teamId: v.optional(v.id('teams')),
  },
  handler: async (ctx, args) => {
    if (!args.teamId) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }
    const team = await ctx.db.get('teams', args.teamId);
    if (!team) {
      throw new ConvexError('TEAM_NOT_FOUND');
    }

    if (!(await canViewTeam(ctx, team))) {
      throw new ConvexError('FORBIDDEN');
    }

    const teamMembers = await ctx.db
      .query('teamMembers')
      .withIndex('by_team', q => q.eq('teamId', team._id))
      .collect();

    const membersWithUsers = await Promise.all(
      teamMembers.map(async member => {
        const user = await ctx.db.get('users', member.userId);
        return {
          ...member,
          user,
        };
      }),
    );

    return membersWithUsers;
  },
});
