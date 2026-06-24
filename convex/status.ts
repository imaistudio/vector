import {
  query,
  mutation,
  internalMutation,
  type MutationCtx,
} from './_generated/server';
import { v, ConvexError } from 'convex/values';
import type { Doc, Id } from './_generated/dataModel';
import { internal } from './_generated/api';
import { getAuthUserId } from './authUtils';
import {
  createNotificationEvent,
  getDefaultPreference,
} from './notifications/lib';

const presenceValidator = v.union(
  v.literal('online'),
  v.literal('idle'),
  v.literal('dnd'),
  v.literal('invisible'),
);

type PresenceStatus = 'online' | 'idle' | 'dnd' | 'invisible';

type StatusSnapshot = {
  presence: PresenceStatus;
  customText?: string;
  customEmoji?: string;
  clearsAt?: number;
};

function actorLabel(user: Doc<'users'> | null | undefined) {
  return user?.name ?? user?.username ?? user?.email ?? 'A teammate';
}

function normalizeStatus(
  status: StatusSnapshot | null | undefined,
  now: number,
): StatusSnapshot {
  const presence = status?.presence ?? 'online';
  const hasActiveCustomStatus =
    status?.clearsAt === undefined || status.clearsAt > now;

  return {
    presence,
    customText: hasActiveCustomStatus ? status?.customText : undefined,
    customEmoji: hasActiveCustomStatus ? status?.customEmoji : undefined,
  };
}

function statusSignature(
  status: StatusSnapshot | null | undefined,
  now: number,
) {
  const normalized = normalizeStatus(status, now);
  return [
    normalized.presence,
    normalized.customEmoji ?? '',
    normalized.customText ?? '',
  ].join('|');
}

function presenceLabel(presence: PresenceStatus) {
  switch (presence) {
    case 'online':
      return 'online';
    case 'idle':
      return 'idle';
    case 'dnd':
      return 'in focus mode';
    case 'invisible':
      return 'invisible';
  }
}

async function isTeamStatusNotificationEnabled(
  ctx: MutationCtx,
  userId: Id<'users'>,
) {
  const preference =
    (await ctx.db
      .query('notificationPreferences')
      .withIndex('by_user_category', q =>
        q.eq('userId', userId).eq('category', 'team_status_changes'),
      )
      .first()) ?? getDefaultPreference('team_status_changes');

  return (
    preference.inAppEnabled || preference.emailEnabled || preference.pushEnabled
  );
}

const ACTOR_TEAM_NOTIFICATION_LIMIT = 100;
const TEAM_MEMBER_NOTIFICATION_LIMIT = 200;

async function scheduleTeamStatusNotification(
  ctx: MutationCtx,
  userId: Id<'users'>,
  before: StatusSnapshot | null | undefined,
  after: StatusSnapshot,
  now: number,
  mode: 'presence' | 'custom',
) {
  const previousStatus = normalizeStatus(before, now);
  const visibleStatus = normalizeStatus(after, now);
  if (visibleStatus.presence === 'invisible') {
    return;
  }

  const customText = visibleStatus.customText?.trim();
  const customEmoji = visibleStatus.customEmoji?.trim();

  if (mode === 'presence') {
    if (previousStatus.presence === visibleStatus.presence) {
      return;
    }
  } else {
    if (statusSignature(before, now) === statusSignature(after, now)) {
      return;
    }
    if (!customText && !customEmoji) {
      return;
    }
  }

  await ctx.scheduler.runAfter(0, internal.status.notifyTeamStatusChanged, {
    userId,
    presence: visibleStatus.presence,
    customText: mode === 'custom' ? customText || undefined : undefined,
    customEmoji: mode === 'custom' ? customEmoji || undefined : undefined,
  });
}

export const notifyTeamStatusChanged = internalMutation({
  args: {
    userId: v.id('users'),
    presence: presenceValidator,
    customText: v.optional(v.string()),
    customEmoji: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const actor = await ctx.db.get('users', args.userId);
    const subjectUserName = actorLabel(actor);
    const actorTeamMemberships = await ctx.db
      .query('teamMembers')
      .withIndex('by_user', q => q.eq('userId', args.userId))
      .take(ACTOR_TEAM_NOTIFICATION_LIMIT);

    if (actorTeamMemberships.length === 0) {
      return;
    }

    if (actorTeamMemberships.length === ACTOR_TEAM_NOTIFICATION_LIMIT) {
      console.warn(
        '[status-notifications] actor team membership limit reached',
        {
          userId: args.userId,
          limit: ACTOR_TEAM_NOTIFICATION_LIMIT,
        },
      );
    }

    const recipientsByOrg = new Map<
      Id<'organizations'>,
      {
        org: Doc<'organizations'>;
        recipients: Set<Id<'users'>>;
      }
    >();

    for (const membership of actorTeamMemberships) {
      const team = await ctx.db.get('teams', membership.teamId);
      if (!team) {
        continue;
      }

      const org = await ctx.db.get('organizations', team.organizationId);
      if (!org) {
        continue;
      }

      const teamMembers = await ctx.db
        .query('teamMembers')
        .withIndex('by_team', q => q.eq('teamId', team._id))
        .take(TEAM_MEMBER_NOTIFICATION_LIMIT);

      if (teamMembers.length === TEAM_MEMBER_NOTIFICATION_LIMIT) {
        console.warn('[status-notifications] team member limit reached', {
          teamId: team._id,
          limit: TEAM_MEMBER_NOTIFICATION_LIMIT,
        });
      }

      let group = recipientsByOrg.get(org._id);
      if (!group) {
        group = {
          org,
          recipients: new Set(),
        };
        recipientsByOrg.set(org._id, group);
      }

      for (const teamMember of teamMembers) {
        if (teamMember.userId !== args.userId) {
          if (await isTeamStatusNotificationEnabled(ctx, teamMember.userId)) {
            group.recipients.add(teamMember.userId);
          }
        }
      }
    }

    const statusLabel = presenceLabel(args.presence);

    for (const { org, recipients } of recipientsByOrg.values()) {
      if (recipients.size === 0) {
        continue;
      }

      await createNotificationEvent(ctx, {
        type: 'user_status_changed',
        actorId: args.userId,
        organizationId: org._id,
        payload: {
          organizationName: org.name,
          subjectUserName,
          statusLabel,
          statusText: args.customText,
          statusEmoji: args.customEmoji,
          href: `/${org.slug}`,
        },
        recipients: Array.from(recipients).map(recipientUserId => ({
          userId: recipientUserId,
        })),
      });
    }
  },
});

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
        customText: undefined,
        customEmoji: undefined,
        clearsAt: undefined,
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
          const hidden = status.presence === 'invisible' || expired;
          statuses[userId] = {
            presence:
              status.presence === 'invisible' ? 'offline' : status.presence,
            customText: hidden ? undefined : status.customText,
            customEmoji: hidden ? undefined : status.customEmoji,
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
    const now = Date.now();

    const existing = await ctx.db
      .query('userStatuses')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique();

    if (existing) {
      await ctx.db.patch('userStatuses', existing._id, {
        presence: args.presence,
        updatedAt: now,
      });
    } else {
      await ctx.db.insert('userStatuses', {
        userId,
        presence: args.presence,
        updatedAt: now,
      });
    }

    await scheduleTeamStatusNotification(
      ctx,
      userId,
      existing,
      {
        presence: args.presence,
        customText: existing?.customText,
        customEmoji: existing?.customEmoji,
        clearsAt: existing?.clearsAt,
      },
      now,
      'presence',
    );
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
    const now = Date.now();

    const existing = await ctx.db
      .query('userStatuses')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique();

    const update = {
      customText: args.customText,
      customEmoji: args.customEmoji,
      clearsAt: args.clearsAt,
      updatedAt: now,
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

    await scheduleTeamStatusNotification(
      ctx,
      userId,
      existing,
      {
        presence: existing?.presence ?? 'online',
        customText: args.customText,
        customEmoji: args.customEmoji,
        clearsAt: args.clearsAt,
      },
      now,
      'custom',
    );

    // Schedule auto-clear if expiry is set
    if (args.clearsAt) {
      const delay = Math.max(0, args.clearsAt - now);
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
    const now = Date.now();

    const existing = await ctx.db
      .query('userStatuses')
      .withIndex('by_user', q => q.eq('userId', userId))
      .unique();

    if (existing) {
      await ctx.db.patch('userStatuses', existing._id, {
        customText: undefined,
        customEmoji: undefined,
        clearsAt: undefined,
        updatedAt: now,
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
