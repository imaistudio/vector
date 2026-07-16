import { paginationOptsValidator } from 'convex/server';
import { query, internalQuery, type QueryCtx } from '../_generated/server';
import { ConvexError, v } from 'convex/values';
import type { Doc } from '../_generated/dataModel';
import { getAuthUserId } from '../authUtils';
import { getOrganizationBySlug, requireOrganizationMember } from '../authz';
import { getDefaultPreference } from './lib';
import {
  NOTIFICATION_CATEGORIES,
  notificationCategoryValidator,
} from './shared';

export const listInbox = query({
  args: {
    orgSlug: v.optional(v.string()),
    filter: v.optional(
      v.union(v.literal('all'), v.literal('unread'), v.literal('action')),
    ),
    paginationOpts: paginationOptsValidator,
  },
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

    const fetchPage = (paginationOpts: typeof args.paginationOpts) => {
      if (args.filter === 'action') {
        if (organizationId) {
          return ctx.db
            .query('notificationRecipients')
            .withIndex('by_user_organization_action_archived', q =>
              q
                .eq('userId', userId)
                .eq('organizationId', organizationId)
                .eq('actionState', 'needs_action')
                .eq('isArchived', false),
            )
            .order('desc')
            .paginate(paginationOpts);
        }
        return ctx.db
          .query('notificationRecipients')
          .withIndex('by_user_action_archived', q =>
            q
              .eq('userId', userId)
              .eq('actionState', 'needs_action')
              .eq('isArchived', false),
          )
          .order('desc')
          .paginate(paginationOpts);
      }

      if (args.filter === 'unread') {
        if (organizationId) {
          return ctx.db
            .query('notificationRecipients')
            .withIndex('by_user_organization_read_archived', q =>
              q
                .eq('userId', userId)
                .eq('organizationId', organizationId)
                .eq('isRead', false)
                .eq('isArchived', false),
            )
            .order('desc')
            .paginate(paginationOpts);
        }
        return ctx.db
          .query('notificationRecipients')
          .withIndex('by_user_read_archived', q =>
            q.eq('userId', userId).eq('isRead', false).eq('isArchived', false),
          )
          .order('desc')
          .paginate(paginationOpts);
      }

      if (organizationId) {
        return ctx.db
          .query('notificationRecipients')
          .withIndex('by_user_organization_archived', q =>
            q
              .eq('userId', userId)
              .eq('organizationId', organizationId)
              .eq('isArchived', false),
          )
          .order('desc')
          .paginate(paginationOpts);
      }
      return ctx.db
        .query('notificationRecipients')
        .withIndex('by_user_archived', q =>
          q.eq('userId', userId).eq('isArchived', false),
        )
        .order('desc')
        .paginate(paginationOpts);
    };

    const isVisible = (item: Doc<'notificationRecipients'>) => {
      if (
        item.actionState === 'snoozed' &&
        (item.snoozedUntil ?? 0) > Date.now()
      )
        return false;
      return true;
    };

    let page = await fetchPage(args.paginationOpts);
    const visible = page.page.filter(isVisible);

    // Archived and read state are handled by indexes. Active snoozes are
    // time-based, so keep advancing the database cursor until this visible
    // page is full or the underlying result set is exhausted. Bound the scan
    // so a large snoozed backlog cannot turn one subscription into an
    // unbounded chain of reads; the returned cursor lets the client continue.
    const maxVisibilityFetchAttempts = 5;
    let visibilityFetchAttempts = 0;
    while (
      visible.length < args.paginationOpts.numItems &&
      !page.isDone &&
      visibilityFetchAttempts < maxVisibilityFetchAttempts
    ) {
      visibilityFetchAttempts += 1;
      page = await fetchPage({
        ...args.paginationOpts,
        cursor: page.continueCursor,
        numItems: args.paginationOpts.numItems - visible.length,
      });
      visible.push(...page.page.filter(isVisible));
    }

    // Resolve a fresh deep link for each notification. Stored hrefs from
    // older recipients can be stale or missing — recompute from the parent
    // event so clicking always lands the user on the right surface.
    const enriched = await Promise.all(
      visible.map(async recipient => {
        const event = await ctx.db.get('notificationEvents', recipient.eventId);
        const href = event
          ? await resolveNotificationHrefFromEvent(ctx, recipient, event)
          : recipient.href;
        return {
          ...recipient,
          href,
          issueId: event?.issueId,
          requestId: event?.requestId,
          taskId: event?.taskId,
          projectId: event?.projectId,
          teamId: event?.teamId,
        };
      }),
    );

    return {
      ...page,
      page: enriched,
    };
  },
});

const COUNT_LIMIT = 100;

export const inboxCounts = query({
  args: { orgSlug: v.optional(v.string()) },
  returns: v.object({
    action: v.number(),
    actionCapped: v.boolean(),
    unread: v.number(),
    unreadCapped: v.boolean(),
    all: v.number(),
    allCapped: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId)
      return {
        action: 0,
        actionCapped: false,
        unread: 0,
        unreadCapped: false,
        all: 0,
        allCapped: false,
      };

    const organizationId = args.orgSlug
      ? (await getOrganizationBySlug(ctx, args.orgSlug))._id
      : undefined;
    if (organizationId) {
      await requireOrganizationMember(ctx, organizationId, userId);
    }

    const [actionRows, unreadRows, allRows] = organizationId
      ? await Promise.all([
          ctx.db
            .query('notificationRecipients')
            .withIndex('by_user_organization_action_archived', q =>
              q
                .eq('userId', userId)
                .eq('organizationId', organizationId)
                .eq('actionState', 'needs_action')
                .eq('isArchived', false),
            )
            .take(COUNT_LIMIT + 1),
          ctx.db
            .query('notificationRecipients')
            .withIndex('by_user_organization_read_archived', q =>
              q
                .eq('userId', userId)
                .eq('organizationId', organizationId)
                .eq('isRead', false)
                .eq('isArchived', false),
            )
            .take(COUNT_LIMIT + 1),
          ctx.db
            .query('notificationRecipients')
            .withIndex('by_user_organization_archived', q =>
              q
                .eq('userId', userId)
                .eq('organizationId', organizationId)
                .eq('isArchived', false),
            )
            .take(COUNT_LIMIT + 1),
        ])
      : await Promise.all([
          ctx.db
            .query('notificationRecipients')
            .withIndex('by_user_action_archived', q =>
              q
                .eq('userId', userId)
                .eq('actionState', 'needs_action')
                .eq('isArchived', false),
            )
            .take(COUNT_LIMIT + 1),
          ctx.db
            .query('notificationRecipients')
            .withIndex('by_user_read_archived', q =>
              q
                .eq('userId', userId)
                .eq('isRead', false)
                .eq('isArchived', false),
            )
            .take(COUNT_LIMIT + 1),
          ctx.db
            .query('notificationRecipients')
            .withIndex('by_user_archived', q =>
              q.eq('userId', userId).eq('isArchived', false),
            )
            .take(COUNT_LIMIT + 1),
        ]);
    const now = Date.now();
    const visibleCount = (rows: Doc<'notificationRecipients'>[]) =>
      rows
        .slice(0, COUNT_LIMIT)
        .filter(row => !row.snoozedUntil || row.snoozedUntil <= now).length;

    return {
      action: visibleCount(actionRows),
      actionCapped: actionRows.length > COUNT_LIMIT,
      unread: visibleCount(unreadRows),
      unreadCapped: unreadRows.length > COUNT_LIMIT,
      all: visibleCount(allRows),
      allCapped: allRows.length > COUNT_LIMIT,
    };
  },
});

async function resolveNotificationHrefFromEvent(
  ctx: QueryCtx,
  recipient: Doc<'notificationRecipients'>,
  event: Doc<'notificationEvents'>,
): Promise<string | undefined> {
  const org = event.organizationId
    ? await ctx.db.get('organizations', event.organizationId)
    : null;
  const orgSlug = org?.slug;

  if (event.requestId && orgSlug) {
    const request = await ctx.db.get('requests', event.requestId);
    if (request?.key) return `/${orgSlug}/requests/${request.key}`;
  }

  if (event.issueId && orgSlug) {
    const issue = await ctx.db.get('issues', event.issueId);
    if (issue?.key) return `/${orgSlug}/work/${issue.key}`;
  }

  if (event.projectId && orgSlug) {
    const project = await ctx.db.get('projects', event.projectId);
    if (project?.key) return `/${orgSlug}/projects/${project.key}`;
  }

  if (event.teamId && orgSlug) {
    const team = await ctx.db.get('teams', event.teamId);
    if (team?.key) return `/${orgSlug}/teams/${team.key}`;
  }

  // Fall back to a payload-supplied href (e.g. invitation links to
  // /settings/invites or /auth/signup) before giving up.
  const payloadHref =
    event.payload &&
    typeof event.payload === 'object' &&
    'href' in event.payload
      ? ((event.payload as { href?: unknown }).href as string | undefined)
      : undefined;
  if (payloadHref) return payloadHref;
  return recipient.href;
}

export const unreadCount = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      return 0;
    }

    const rows = await ctx.db
      .query('notificationRecipients')
      .withIndex('by_user_read_archived', q =>
        q.eq('userId', userId).eq('isRead', false).eq('isArchived', false),
      )
      .collect();
    const now = Date.now();
    return rows.filter(row => !row.snoozedUntil || row.snoozedUntil <= now)
      .length;
  },
});

export const getPreferences = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    const rows = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_user', q => q.eq('userId', userId))
      .collect();

    const map = new Map(rows.map(row => [row.category, row]));

    return NOTIFICATION_CATEGORIES.map(category => {
      const row = map.get(category);
      return row
        ? {
            category,
            inAppEnabled: row.inAppEnabled,
            emailEnabled: row.emailEnabled,
            pushEnabled: row.pushEnabled,
          }
        : getDefaultPreference(category);
    });
  },
});

export const listPushSubscriptions = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    return await ctx.db
      .query('pushSubscriptions')
      .withIndex('by_user', q => q.eq('userId', userId))
      .order('desc')
      .collect();
  },
});

export const listMobilePushTokens = query({
  args: {},
  handler: async ctx => {
    const userId = await getAuthUserId(ctx);
    if (!userId) {
      throw new ConvexError('UNAUTHORIZED');
    }

    return await ctx.db
      .query('mobilePushTokens')
      .withIndex('by_user', q => q.eq('userId', userId))
      .order('desc')
      .take(50);
  },
});

export const getPreferenceByCategory = internalQuery({
  args: {
    userId: v.id('users'),
    category: notificationCategoryValidator,
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query('notificationPreferences')
      .withIndex('by_user_category', q =>
        q.eq('userId', args.userId).eq('category', args.category),
      )
      .first();

    if (row) {
      return {
        category: args.category,
        inAppEnabled: row.inAppEnabled,
        emailEnabled: row.emailEnabled,
        pushEnabled: row.pushEnabled,
      };
    }

    return getDefaultPreference(args.category);
  },
});

export const getDeliveryContext = internalQuery({
  args: {
    recipientId: v.id('notificationRecipients'),
  },
  handler: async (ctx, args) => {
    const recipient = await ctx.db.get(
      'notificationRecipients',
      args.recipientId,
    );
    if (!recipient) {
      return null;
    }

    const event = await ctx.db.get('notificationEvents', recipient.eventId);
    if (!event) {
      return null;
    }

    const user = recipient.userId
      ? await ctx.db.get('users', recipient.userId)
      : null;
    const preference = recipient.userId
      ? ((await ctx.db
          .query('notificationPreferences')
          .withIndex('by_user_category', q =>
            q
              .eq('userId', recipient.userId!)
              .eq('category', recipient.category),
          )
          .first()) ?? getDefaultPreference(recipient.category))
      : getDefaultPreference(recipient.category);

    const pushSubscriptions = recipient.userId
      ? await ctx.db
          .query('pushSubscriptions')
          .withIndex('by_user', q => q.eq('userId', recipient.userId!))
          .collect()
      : [];
    const mobilePushTokens = recipient.userId
      ? await ctx.db
          .query('mobilePushTokens')
          .withIndex('by_user', q => q.eq('userId', recipient.userId!))
          .take(20)
      : [];

    return {
      recipient,
      event,
      user,
      preference: {
        inAppEnabled: preference.inAppEnabled,
        emailEnabled: preference.emailEnabled,
        pushEnabled: preference.pushEnabled,
      },
      pushSubscriptions: pushSubscriptions.filter(sub => !sub.disabledAt),
      mobilePushTokens: mobilePushTokens.filter(token => !token.disabledAt),
    };
  },
});
