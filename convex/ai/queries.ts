import { listUIMessages, syncStreams, vStreamArgs } from '@convex-dev/agent';
import { paginationOptsValidator } from 'convex/server';
import { v } from 'convex/values';
import { components } from '../_generated/api';
import { query } from '../_generated/server';
import { getAuthUserId } from '../authUtils';
import {
  requireOrgForAssistant,
  getAssistantThreadRow,
  canViewThread,
} from './lib';

export const getThreadForCurrentUser = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return null;
    }
    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      userId,
    );
    return await getAssistantThreadRow(ctx, organization._id, userId);
  },
});

export const getActiveThread = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      userId,
    );

    // Check assistantUserState for an active thread
    const userState = await ctx.db
      .query('assistantUserState')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', organization._id).eq('userId', userId),
      )
      .first();

    if (userState?.activeThreadId) {
      const thread = await ctx.db.get(
        'assistantThreads',
        userState.activeThreadId,
      );
      if (thread && (await canViewThread(ctx, thread, userId))) {
        return thread;
      }
    }

    // Fallback: legacy single thread
    return await getAssistantThreadRow(ctx, organization._id, userId);
  },
});

export const getThreadById = query({
  args: {
    threadId: v.id('assistantThreads'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const thread = await ctx.db.get('assistantThreads', args.threadId);
    if (!thread) return null;

    if (!(await canViewThread(ctx, thread, userId))) return null;

    return thread;
  },
});

export const listMyThreads = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      userId,
    );

    // Own threads
    const ownThreads = await ctx.db
      .query('assistantThreads')
      .withIndex('by_org_createdBy', q =>
        q.eq('organizationId', organization._id).eq('createdBy', userId),
      )
      .collect();

    // Also get legacy threads (createdBy not set, but userId matches)
    const legacyThreads = await ctx.db
      .query('assistantThreads')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', organization._id).eq('userId', userId),
      )
      .collect();

    // Shared threads (via threadMembers)
    const memberships = await ctx.db
      .query('threadMembers')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    const sharedThreads: typeof ownThreads = [];
    for (const membership of memberships) {
      const thread = await ctx.db.get('assistantThreads', membership.threadId);
      if (thread && thread.organizationId === organization._id) {
        sharedThreads.push(thread);
      }
    }

    // Deduplicate by _id and sort by updatedAt desc
    const seen = new Set<string>();
    const all = [...ownThreads, ...legacyThreads, ...sharedThreads].filter(
      t => {
        if (seen.has(t._id)) return false;
        seen.add(t._id);
        return true;
      },
    );

    all.sort((a, b) => b.updatedAt - a.updatedAt);
    return all;
  },
});

export const listOrgThreads = query({
  args: {
    orgSlug: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return { page: [], isDone: true, continueCursor: '' };
    }

    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      userId,
    );

    const result = await ctx.db
      .query('assistantThreads')
      .withIndex('by_org_updated', q =>
        q.eq('organizationId', organization._id),
      )
      .order('desc')
      .paginate(args.paginationOpts);

    // Filter to only accessible threads
    const accessiblePage = [];
    for (const thread of result.page) {
      if (await canViewThread(ctx, thread, userId)) {
        accessiblePage.push(thread);
      }
    }

    return {
      ...result,
      page: accessiblePage,
    };
  },
});

export const listThreadMembers = query({
  args: {
    threadId: v.id('assistantThreads'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const thread = await ctx.db.get('assistantThreads', args.threadId);
    if (!thread) return [];
    if (!(await canViewThread(ctx, thread, userId))) return [];

    const memberships = await ctx.db
      .query('threadMembers')
      .withIndex('by_thread', q => q.eq('threadId', args.threadId))
      .collect();

    const result = [];
    for (const membership of memberships) {
      const user = await ctx.db.get('users', membership.userId);
      if (user) {
        result.push({
          ...membership,
          user: { _id: user._id, name: user.name, image: user.image },
        });
      }
    }
    return result;
  },
});

export const listThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: v.optional(vStreamArgs),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const denied = {
      page: [],
      isDone: true,
      continueCursor: '',
      streams: undefined,
    };

    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return denied;
    }
    const row = await ctx.db
      .query('assistantThreads')
      .withIndex('by_threadId', q => q.eq('threadId', args.threadId))
      .first();

    if (!row) {
      return denied;
    }

    // Use canViewThread instead of strict owner check
    if (!(await canViewThread(ctx, row, userId))) {
      return denied;
    }

    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = args.streamArgs
      ? await syncStreams(ctx, components.agent, {
          threadId: args.threadId,
          streamArgs: args.streamArgs,
        })
      : undefined;

    return {
      ...paginated,
      streams: streams ?? undefined,
    };
  },
});

export const getPublicThread = query({
  args: {
    threadId: v.id('assistantThreads'),
  },
  handler: async (ctx, args) => {
    const thread = await ctx.db.get('assistantThreads', args.threadId);
    if (!thread || thread.visibility !== 'public') return null;
    return thread;
  },
});

export const listPublicThreadMessages = query({
  args: {
    threadId: v.string(),
    paginationOpts: paginationOptsValidator,
    streamArgs: v.optional(vStreamArgs),
  },
  returns: v.any(),
  handler: async (ctx, args) => {
    const denied = {
      page: [],
      isDone: true,
      continueCursor: '',
      streams: undefined,
    };

    // Verify thread is public
    const row = await ctx.db
      .query('assistantThreads')
      .withIndex('by_threadId', q => q.eq('threadId', args.threadId))
      .first();

    if (!row || row.visibility !== 'public') {
      return denied;
    }

    const paginated = await listUIMessages(ctx, components.agent, {
      threadId: args.threadId,
      paginationOpts: args.paginationOpts,
    });
    const streams = args.streamArgs
      ? await syncStreams(ctx, components.agent, {
          threadId: args.threadId,
          streamArgs: args.streamArgs,
        })
      : undefined;

    return {
      ...paginated,
      streams: streams ?? undefined,
    };
  },
});

export const listPendingActions = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return [];

    const organization = await requireOrgForAssistant(
      ctx,
      args.orgSlug,
      userId,
    );

    return await ctx.db
      .query('assistantActions')
      .withIndex('by_user_status', q =>
        q.eq('userId', userId).eq('status', 'pending'),
      )
      .filter(q => q.eq(q.field('organizationId'), organization._id))
      .collect();
  },
});
