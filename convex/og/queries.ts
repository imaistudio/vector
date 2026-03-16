/**
 * Public OG metadata queries — no authentication required.
 * Only returns data for entities with visibility === 'public'.
 */
import { query } from '../_generated/server';
import { v } from 'convex/values';
import type { Id } from '../_generated/dataModel';

export const getPublicIssue = query({
  args: {
    orgSlug: v.string(),
    issueKey: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();
    if (!org) return null;

    const issue = await ctx.db
      .query('issues')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', org._id).eq('key', args.issueKey),
      )
      .first();
    if (!issue || issue.visibility !== 'public') return null;

    const state = issue.workflowStateId
      ? await ctx.db.get('issueStates', issue.workflowStateId)
      : null;
    const priority = issue.priorityId
      ? await ctx.db.get('issuePriorities', issue.priorityId)
      : null;
    const project = issue.projectId
      ? await ctx.db.get('projects', issue.projectId)
      : null;

    return {
      key: issue.key,
      title: issue.title,
      orgName: org.name,
      orgSlug: org.slug,
      state: state
        ? { name: state.name, color: state.color, type: state.type }
        : null,
      priority: priority
        ? { name: priority.name, color: priority.color }
        : null,
      project: project ? { name: project.name, key: project.key } : null,
    };
  },
});

export const getPublicProject = query({
  args: {
    orgSlug: v.string(),
    projectKey: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();
    if (!org) return null;

    const project = await ctx.db
      .query('projects')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', org._id).eq('key', args.projectKey),
      )
      .first();
    if (!project || project.visibility !== 'public') return null;

    const status = project.statusId
      ? await ctx.db.get('projectStatuses', project.statusId)
      : null;

    const issueCount = (
      await ctx.db
        .query('issues')
        .withIndex('by_project', q => q.eq('projectId', project._id))
        .collect()
    ).filter(issue => issue.visibility === 'public').length;

    return {
      key: project.key,
      name: project.name,
      description: project.description ?? null,
      orgName: org.name,
      orgSlug: org.slug,
      status: status
        ? { name: status.name, color: status.color, type: status.type }
        : null,
      issueCount,
    };
  },
});

export const getPublicTeam = query({
  args: {
    orgSlug: v.string(),
    teamKey: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();
    if (!org) return null;

    const team = await ctx.db
      .query('teams')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', org._id).eq('key', args.teamKey),
      )
      .first();
    if (!team || team.visibility !== 'public') return null;

    const memberCount = (
      await ctx.db
        .query('teamMembers')
        .withIndex('by_team', q => q.eq('teamId', team._id))
        .collect()
    ).length;

    return {
      key: team.key,
      name: team.name,
      description: team.description ?? null,
      orgName: org.name,
      orgSlug: org.slug,
      icon: team.icon ?? null,
      color: team.color ?? null,
      memberCount,
    };
  },
});

export const getPublicDocument = query({
  args: {
    orgSlug: v.string(),
    documentId: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();
    if (!org) return null;

    let doc;
    try {
      doc = await ctx.db.get('documents', args.documentId as Id<'documents'>);
    } catch {
      return null;
    }
    if (!doc || doc.organizationId !== org._id || doc.visibility !== 'public')
      return null;

    const author = doc.createdBy
      ? await ctx.db.get('users', doc.createdBy)
      : null;

    return {
      title: doc.title,
      orgName: org.name,
      orgSlug: org.slug,
      icon: doc.icon ?? null,
      color: doc.color ?? null,
      author: author ? { name: author.name ?? author.email } : null,
    };
  },
});
