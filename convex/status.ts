import { query, mutation, internalMutation } from './_generated/server';
import { v, ConvexError } from 'convex/values';
import { internal } from './_generated/api';
import { getAuthUserId } from './authUtils';

const presenceValidator = v.union(
  v.literal('online'),
  v.literal('idle'),
  v.literal('dnd'),
  v.literal('invisible'),
);

/**
 * Get the current user's status
 */
export const getCurrentUserStatus = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;

    const status = await ctx.db
      .query('userStatuses')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique();

    if (!status) return null;

    // If custom status has expired, return without it
    if (status.clearsAt && status.clearsAt < Date.now()) {
      return {
        ...status,
        customText: undefined,
        customEmoji: undefined,
        clearsAt: undefined,
      };
    }

    return status;
  },
});

/**
 * Get status for a single user
 */
export const getStatus = query({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const status = await ctx.db
      .query('userStatuses')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .unique();

    if (!status) return null;

    // Don't expose invisible users as online
    if (status.presence === 'invisible') {
      return {
        ...status,
        presence: 'offline' as const,
      };
    }

    // If custom status has expired, return without it
    if (status.clearsAt && status.clearsAt < Date.now()) {
      return {
        ...status,
        customText: undefined,
        customEmoji: undefined,
        clearsAt: undefined,
      };
    }

    return status;
  },
});

/**
 * Batch-get statuses for multiple users
 */
export const getStatuses = query({
  args: { userIds: v.array(v.id('users')) },
  handler: async (ctx, args) => {
    const statuses: Record<
      string,
      {
        presence: 'online' | 'idle' | 'dnd' | 'invisible' | 'offline';
        customText?: string;
        customEmoji?: string;
      }
    > = {};

    await Promise.all(
      args.userIds.map(async userId => {
        const status = await ctx.db
          .query('userStatuses')
          .withIndex('by_user', q => q.eq('userId', userId))
          .unique();

        if (status) {
          const expired = status.clearsAt && status.clearsAt < Date.now();
          statuses[userId] = {
            presence:
              status.presence === 'invisible' ? 'offline' : status.presence,
            customText: expired ? undefined : status.customText,
            customEmoji: expired ? undefined : status.customEmoji,
          };
        }
      }),
    );

    return statuses;
  },
});

/**
 * Set the user's presence status
 */
export const setPresence = mutation({
  args: { presence: presenceValidator },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('UNAUTHORIZED');

    const existing = await ctx.db
      .query('userStatuses')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique();

    if (existing) {
      await ctx.db.patch('userStatuses', existing._id, {
        presence: args.presence,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('userStatuses', {
        userId,
        presence: args.presence,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Set the user's custom status (emoji + text + optional expiry)
 */
export const setCustomStatus = mutation({
  args: {
    customText: v.optional(v.string()),
    customEmoji: v.optional(v.string()),
    clearsAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('UNAUTHORIZED');

    const existing = await ctx.db
      .query('userStatuses')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique();

    const update = {
      customText: args.customText,
      customEmoji: args.customEmoji,
      clearsAt: args.clearsAt,
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch('userStatuses', existing._id, update);
    } else {
      await ctx.db.insert('userStatuses', {
        userId,
        presence: 'online',
        ...update,
      });
    }

    // Schedule auto-clear if expiry is set
    if (args.clearsAt) {
      const delay = Math.max(0, args.clearsAt - Date.now());
      await ctx.scheduler.runAfter(
        delay,
        internal.status.clearExpiredCustomStatus,
        { userId },
      );
    }
  },
});

/**
 * Clear the user's custom status
 */
export const clearCustomStatus = mutation({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('UNAUTHORIZED');

    const existing = await ctx.db
      .query('userStatuses')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique();

    if (existing) {
      await ctx.db.patch('userStatuses', existing._id, {
        customText: undefined,
        customEmoji: undefined,
        clearsAt: undefined,
        updatedAt: Date.now(),
      });
    }
  },
});

/**
 * Internal: clear expired custom status for a user
 */
export const clearExpiredCustomStatus = internalMutation({
  args: { userId: v.id('users') },
  handler: async (ctx, args) => {
    const status = await ctx.db
      .query('userStatuses')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .unique();

    if (!status) return;

    // Only clear if the status still has a clearsAt that has passed
    if (status.clearsAt && status.clearsAt <= Date.now()) {
      await ctx.db.patch('userStatuses', status._id, {
        customText: undefined,
        customEmoji: undefined,
        clearsAt: undefined,
        updatedAt: Date.now(),
      });
    }
  },
});
