import { mutation, internalMutation } from '../_generated/server';
import { ConvexError, v } from 'convex/values';
import { getAuthUserId } from '../authUtils';
import { notificationCategoryValidator } from './shared';

export const markRead = mutation({
  args: {
    recipientId: v.id('notificationRecipients'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const recipient = await ctx.db.get(
      'notificationRecipients',
      args.recipientId,
    );
    if (!recipient || recipient.userId !== userId) {
      throw new ConvexError('NOT_FOUND');
    }

    if (!recipient.isRead) {
      await ctx.db.patch('notificationRecipients', args.recipientId, {
        isRead: true,
        readAt: Date.now(),
      });
    }

    return { success: true } as const;
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const recipients = await ctx.db
      .query('notificationRecipients')
      .withIndex('by_user_read', q =>
        q.eq('userId', userId).eq('isRead', false),
      )
      .collect();

    for (const recipient of recipients) {
      if (recipient.isArchived) {
        continue;
      }
      await ctx.db.patch('notificationRecipients', recipient._id, {
        isRead: true,
        readAt: Date.now(),
      });
    }

    return { success: true } as const;
  },
});

export const archive = mutation({
  args: {
    recipientId: v.id('notificationRecipients'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const recipient = await ctx.db.get(
      'notificationRecipients',
      args.recipientId,
    );
    if (!recipient || recipient.userId !== userId) {
      throw new ConvexError('NOT_FOUND');
    }

    await ctx.db.patch('notificationRecipients', args.recipientId, {
      isArchived: true,
      archivedAt: Date.now(),
      isRead: true,
      readAt: recipient.readAt ?? Date.now(),
    });

    return { success: true } as const;
  },
});

export const updatePreferences = mutation({
  args: {
    category: notificationCategoryValidator,
    inAppEnabled: v.boolean(),
    emailEnabled: v.boolean(),
    pushEnabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const existing = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_user_category', q =>
        q.eq('userId', userId).eq('category', args.category),
      )
      .first();

    if (existing) {
      await ctx.db.patch('notificationPreferences', existing._id, {
        inAppEnabled: args.inAppEnabled,
        emailEnabled: args.emailEnabled,
        pushEnabled: args.pushEnabled,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('notificationPreferences', {
        userId,
        category: args.category,
        inAppEnabled: args.inAppEnabled,
        emailEnabled: args.emailEnabled,
        pushEnabled: args.pushEnabled,
        updatedAt: Date.now(),
      });
    }

    return { success: true } as const;
  },
});

export const upsertPushSubscription = mutation({
  args: {
    endpoint: v.string(),
    p256dh: v.string(),
    auth: v.string(),
    deviceLabel: v.optional(v.string()),
    userAgent: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const existing = await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user_endpoint', q =>
        q.eq('userId', userId).eq('endpoint', args.endpoint),
      )
      .first();

    if (existing) {
      await ctx.db.patch('pushSubscriptions', existing._id, {
        p256dh: args.p256dh,
        auth: args.auth,
        deviceLabel: args.deviceLabel,
        userAgent: args.userAgent,
        disabledAt: undefined,
        lastSeenAt: Date.now(),
      });
      return { subscriptionId: existing._id } as const;
    }

    const subscriptionId = await ctx.db.insert('pushSubscriptions', {
      userId,
      endpoint: args.endpoint,
      p256dh: args.p256dh,
      auth: args.auth,
      deviceLabel: args.deviceLabel,
      userAgent: args.userAgent,
      lastSeenAt: Date.now(),
    });

    return { subscriptionId } as const;
  },
});

export const removePushSubscription = mutation({
  args: {
    subscriptionId: v.id('pushSubscriptions'),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const subscription = await ctx.db.get(
      'pushSubscriptions',
      args.subscriptionId,
    );
    if (!subscription || subscription.userId !== userId) {
      throw new ConvexError('NOT_FOUND');
    }

    await ctx.db.delete('pushSubscriptions', args.subscriptionId);
    return { success: true } as const;
  },
});

export const setDeliveryResult = internalMutation({
  args: {
    recipientId: v.id('notificationRecipients'),
    channel: v.union(v.literal('email'), v.literal('push')),
    status: v.union(
      v.literal('sent'),
      v.literal('failed'),
      v.literal('skipped'),
    ),
    providerMessageId: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const recipient = await ctx.db.get(
      'notificationRecipients',
      args.recipientId,
    );
    if (!recipient) {
      return null;
    }

    const existing = await ctx.db
      .query('notificationDeliveries')
      .withIndex('by_recipient_channel', q =>
        q.eq('recipientId', args.recipientId).eq('channel', args.channel),
      )
      .first();

    if (existing) {
      await ctx.db.patch('notificationDeliveries', existing._id, {
        status: args.status,
        providerMessageId: args.providerMessageId,
        lastError: args.lastError,
        sentAt: args.status === 'sent' ? Date.now() : existing.sentAt,
        attemptCount: existing.attemptCount + 1,
        updatedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('notificationDeliveries', {
      eventId: recipient.eventId,
      recipientId: args.recipientId,
      channel: args.channel,
      status: args.status,
      attemptCount: 1,
      providerMessageId: args.providerMessageId,
      lastError: args.lastError,
      sentAt: args.status === 'sent' ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
  },
});

export const disablePushSubscription = internalMutation({
  args: {
    subscriptionId: v.id('pushSubscriptions'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('pushSubscriptions', args.subscriptionId, {
      disabledAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    return null;
  },
});
