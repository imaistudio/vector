import { mutation } from '../_generated/server';
import { v, ConvexError } from 'convex/values';
import { getAuthUserId } from '../authUtils';
import { requirePermission, PERMISSIONS } from '../permissions/utils';
import { getOrganizationBySlug } from '../authz';
import {
  getVisibilityLabel,
  recordActivity,
  resolveViewScope,
  snapshotForView,
} from '../activities/lib';

const visibilityValidator = v.union(
  v.literal('private'),
  v.literal('organization'),
  v.literal('public'),
);

const filtersValidator = v.object({
  teamId: v.optional(v.id('teams')),
  projectId: v.optional(v.id('projects')),
  priorityIds: v.optional(v.array(v.id('issuePriorities'))),
  workflowStateIds: v.optional(v.array(v.id('issueStates'))),
  workflowStateTypes: v.optional(v.array(v.string())),
  assigneeIds: v.optional(v.array(v.id('users'))),
  labelIds: v.optional(v.array(v.id('issueLabels'))),
});

const layoutValidator = v.optional(
  v.object({
    viewMode: v.optional(
      v.union(v.literal('table'), v.literal('kanban'), v.literal('timeline')),
    ),
    groupBy: v.optional(v.string()),
  }),
);

export const createView = mutation({
  args: {
    orgSlug: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    filters: filtersValidator,
    layout: layoutValidator,
    visibility: visibilityValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('AUTH_REQUIRED');

    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requirePermission(ctx, org._id, PERMISSIONS.VIEW_CREATE);

    const name = args.name.trim();
    if (!name) throw new ConvexError('INVALID_INPUT');
    if (name.length > 100) throw new ConvexError('INVALID_INPUT');

    const now = Date.now();
    const viewId = await ctx.db.insert('views', {
      organizationId: org._id,
      name,
      description: args.description?.trim() || undefined,
      icon: args.icon,
      color: args.color,
      filters: args.filters,
      layout: args.layout,
      visibility: args.visibility,
      createdBy: userId,
      updatedAt: now,
    });

    const view = await ctx.db.get('views', viewId);

    await recordActivity(ctx, {
      scope: resolveViewScope(view!),
      entityType: 'view',
      eventType: 'view_created',
      actorId: userId,
      snapshot: snapshotForView(view),
    });

    return viewId;
  },
});

export const updateView = mutation({
  args: {
    viewId: v.id('views'),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    icon: v.optional(v.string()),
    color: v.optional(v.string()),
    filters: v.optional(filtersValidator),
    layout: layoutValidator,
    visibility: v.optional(visibilityValidator),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('AUTH_REQUIRED');

    const view = await ctx.db.get('views', args.viewId);
    if (!view) throw new ConvexError('VIEW_NOT_FOUND');

    // Creator can always edit; otherwise need permission
    if (view.createdBy !== userId) {
      await requirePermission(ctx, view.organizationId, PERMISSIONS.VIEW_EDIT);
    }

    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.name !== undefined) {
      const name = args.name.trim();
      if (!name) throw new ConvexError('INVALID_INPUT');
      if (name.length > 100) throw new ConvexError('INVALID_INPUT');
      patch.name = name;
    }
    if (args.description !== undefined)
      patch.description = args.description.trim() || undefined;
    if (args.icon !== undefined) patch.icon = args.icon;
    if (args.color !== undefined) patch.color = args.color;
    if (args.filters !== undefined) patch.filters = args.filters;
    if (args.layout !== undefined) patch.layout = args.layout;
    if (args.visibility !== undefined) patch.visibility = args.visibility;

    await ctx.db.patch('views', args.viewId, patch);

    // Record activity for key changes
    if (args.name !== undefined && args.name.trim() !== view.name) {
      await recordActivity(ctx, {
        scope: resolveViewScope(view),
        entityType: 'view',
        eventType: 'view_name_changed',
        actorId: userId,
        details: {
          field: 'name',
          fromLabel: view.name,
          toLabel: args.name.trim(),
        },
        snapshot: snapshotForView(view),
      });
    }

    if (args.visibility !== undefined && args.visibility !== view.visibility) {
      await recordActivity(ctx, {
        scope: resolveViewScope(view),
        entityType: 'view',
        eventType: 'view_visibility_changed',
        actorId: userId,
        details: {
          field: 'visibility',
          fromLabel: getVisibilityLabel(view.visibility),
          toLabel: getVisibilityLabel(args.visibility),
        },
        snapshot: snapshotForView(view),
      });
    }

    if (args.filters !== undefined) {
      await recordActivity(ctx, {
        scope: resolveViewScope(view),
        entityType: 'view',
        eventType: 'view_filters_changed',
        actorId: userId,
        snapshot: snapshotForView(view),
      });
    }
  },
});

export const excludeIssueFromView = mutation({
  args: {
    viewId: v.id('views'),
    issueId: v.id('issues'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('AUTH_REQUIRED');

    const view = await ctx.db.get('views', args.viewId);
    if (!view) throw new ConvexError('VIEW_NOT_FOUND');

    if (view.createdBy !== userId) {
      await requirePermission(ctx, view.organizationId, PERMISSIONS.VIEW_EDIT);
    }

    const existing = await ctx.db
      .query('viewExclusions')
      .withIndex('by_view_issue', q =>
        q.eq('viewId', args.viewId).eq('issueId', args.issueId),
      )
      .first();
    if (existing) return;

    await ctx.db.insert('viewExclusions', {
      viewId: args.viewId,
      issueId: args.issueId,
      excludedBy: userId,
    });
  },
});

export const includeIssueInView = mutation({
  args: {
    viewId: v.id('views'),
    issueId: v.id('issues'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('AUTH_REQUIRED');

    const view = await ctx.db.get('views', args.viewId);
    if (!view) throw new ConvexError('VIEW_NOT_FOUND');

    if (view.createdBy !== userId) {
      await requirePermission(ctx, view.organizationId, PERMISSIONS.VIEW_EDIT);
    }

    const existing = await ctx.db
      .query('viewExclusions')
      .withIndex('by_view_issue', q =>
        q.eq('viewId', args.viewId).eq('issueId', args.issueId),
      )
      .first();
    if (existing) {
      await ctx.db.delete('viewExclusions', existing._id);
    }
  },
});

export const deleteView = mutation({
  args: {
    viewId: v.id('views'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('AUTH_REQUIRED');

    const view = await ctx.db.get('views', args.viewId);
    if (!view) throw new ConvexError('VIEW_NOT_FOUND');

    // Creator can always delete; otherwise need permission
    if (view.createdBy !== userId) {
      await requirePermission(
        ctx,
        view.organizationId,
        PERMISSIONS.VIEW_DELETE,
      );
    }

    await recordActivity(ctx, {
      scope: resolveViewScope(view),
      entityType: 'view',
      eventType: 'view_deleted',
      actorId: userId,
      snapshot: snapshotForView(view),
    });

    await ctx.db.delete('views', args.viewId);
  },
});
