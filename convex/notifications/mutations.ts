import { mutation, internalMutation } from '../_generated/server';
import { internal } from '../_generated/api';
import { ConvexError, v } from 'convex/values';
import { getAuthUserId } from '../authUtils';
import { notificationCategoryValidator } from './shared';
import { notificationActionStateValidator } from '../_shared/work';
import { getOrganizationBySlug, requireOrganizationMember } from '../authz';

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
  args: { orgSlug: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const organizationId = args.orgSlug
      ? (await getOrganizationBySlug(ctx, args.orgSlug))._id
      : undefined;
    if (organizationId) {
      await requireOrganizationMember(ctx, organizationId, userId);
    }

    const recipients = organizationId
      ? await ctx.db
          .query('notificationRecipients')
          .withIndex('by_user_organization_read_archived', q =>
            q
              .eq('userId', userId)
              .eq('organizationId', organizationId)
              .eq('isRead', false)
              .eq('isArchived', false),
          )
          .collect()
      : await ctx.db
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

export const setActionState = mutation({
  args: {
    recipientId: v.id('notificationRecipients'),
    actionState: notificationActionStateValidator,
    snoozedUntil: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('UNAUTHORIZED');
    const recipient = await ctx.db.get(
      'notificationRecipients',
      args.recipientId,
    );
    if (!recipient || recipient.userId !== userId) {
      throw new ConvexError('NOT_FOUND');
    }
    if (args.actionState === 'snoozed' && !args.snoozedUntil) {
      throw new ConvexError('SNOOZE_TIME_REQUIRED');
    }
    if (
      args.actionState === 'snoozed' &&
      args.snoozedUntil !== undefined &&
      args.snoozedUntil <= Date.now()
    ) {
      throw new ConvexError('SNOOZE_TIME_MUST_BE_IN_FUTURE');
    }
    await ctx.db.patch('notificationRecipients', recipient._id, {
      actionState: args.actionState,
      snoozedUntil:
        args.actionState === 'snoozed' ? args.snoozedUntil : undefined,
      isRead: args.actionState === 'done' ? true : recipient.isRead,
      readAt:
        args.actionState === 'done'
          ? (recipient.readAt ?? Date.now())
          : recipient.readAt,
    });
    if (args.actionState === 'snoozed' && args.snoozedUntil) {
      await ctx.scheduler.runAt(
        args.snoozedUntil,
        internal.notifications.mutations.restoreSnoozedAction,
        { recipientId: recipient._id },
      );
    }
    return { success: true } as const;
  },
});

export const restoreSnoozedAction = internalMutation({
  args: { recipientId: v.id('notificationRecipients') },
  handler: async (ctx, args) => {
    const recipient = await ctx.db.get(
      'notificationRecipients',
      args.recipientId,
    );
    if (
      !recipient ||
      recipient.actionState !== 'snoozed' ||
      (recipient.snoozedUntil ?? Number.POSITIVE_INFINITY) > Date.now()
    )
      return;
    await ctx.db.patch('notificationRecipients', recipient._id, {
      actionState: 'needs_action',
      snoozedUntil: undefined,
    });
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

export const upsertMobilePushToken = mutation({
  args: {
    token: v.string(),
    environment: v.union(v.literal('sandbox'), v.literal('production')),
    bundleId: v.optional(v.string()),
    deviceLabel: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const now = Date.now();
    const matchingTokens = await ctx.db
      .query('mobilePushTokens')
      .withIndex('by_token', q => q.eq('token', args.token))
      .take(20);

    for (const token of matchingTokens) {
      if (token.userId !== userId && !token.disabledAt) {
        await ctx.db.patch('mobilePushTokens', token._id, {
          disabledAt: now,
          lastSeenAt: now,
        });
      }
    }

    const existing = await ctx.db
      .query('mobilePushTokens')
      .withIndex('by_user_token_and_environment', q =>
        q
          .eq('userId', userId)
          .eq('token', args.token)
          .eq('environment', args.environment),
      )
      .first();

    if (existing) {
      await ctx.db.patch('mobilePushTokens', existing._id, {
        bundleId: args.bundleId,
        deviceLabel: args.deviceLabel,
        disabledAt: undefined,
        lastSeenAt: now,
      });
      return { tokenId: existing._id } as const;
    }

    const tokenId = await ctx.db.insert('mobilePushTokens', {
      userId,
      token: args.token,
      environment: args.environment,
      platform: 'ios',
      bundleId: args.bundleId,
      deviceLabel: args.deviceLabel,
      lastSeenAt: now,
    });

    return { tokenId } as const;
  },
});

export const removeMobilePushToken = mutation({
  args: {
    token: v.string(),
    environment: v.union(v.literal('sandbox'), v.literal('production')),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const token = await ctx.db
      .query('mobilePushTokens')
      .withIndex('by_user_token_and_environment', q =>
        q
          .eq('userId', userId)
          .eq('token', args.token)
          .eq('environment', args.environment),
      )
      .first();

    if (token) {
      await ctx.db.delete('mobilePushTokens', token._id);
    }
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

export const disableMobilePushToken = internalMutation({
  args: {
    tokenId: v.id('mobilePushTokens'),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch('mobilePushTokens', args.tokenId, {
      disabledAt: Date.now(),
      lastSeenAt: Date.now(),
    });
    return null;
  },
});
