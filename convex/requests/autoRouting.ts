import { v } from 'convex/values';
import { internalMutation, internalQuery } from '../_generated/server';
import { createNotificationEvent } from '../notifications/lib';
import { requestFocusRank, requestHref } from './lib';

export const getContext = internalQuery({
  args: { requestId: v.id('requests') },
  handler: async (ctx, args) => {
    const request = await ctx.db.get('requests', args.requestId);
    if (!request || request.status !== 'new') return null;
    const organization = await ctx.db.get(
      'organizations',
      request.organizationId,
    );
    if (
      !organization?.requestAutoRoutingEnabled ||
      !organization.requestRoutingRules?.trim()
    )
      return null;

    const [teams, memberships] = await Promise.all([
      ctx.db
        .query('teams')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .take(100),
      ctx.db
        .query('members')
        .withIndex('by_organization', q =>
          q.eq('organizationId', organization._id),
        )
        .take(200),
    ]);
    const users = await Promise.all(
      memberships.map(membership => ctx.db.get('users', membership.userId)),
    );

    return {
      request: {
        title: request.title,
        description: request.description,
        expectedOutput: request.expectedOutput,
        reviewGuidance: request.reviewGuidance,
      },
      rules: organization.requestRoutingRules,
      teams: teams.map(team => ({
        id: team._id,
        name: team.name,
        key: team.key,
      })),
      members: memberships.flatMap((membership, index) => {
        const user = users[index];
        return user
          ? [
              {
                id: user._id,
                name:
                  user.name ?? user.username ?? user.email ?? 'Unnamed member',
                email: user.email,
              },
            ]
          : [];
      }),
    };
  },
});

export const apply = internalMutation({
  args: {
    requestId: v.id('requests'),
    rules: v.string(),
    teamId: v.optional(v.id('teams')),
    recipientIds: v.array(v.id('users')),
  },
  handler: async (ctx, args) => {
    const request = await ctx.db.get('requests', args.requestId);
    if (!request || request.status !== 'new')
      return { applied: false } as const;
    const organization = await ctx.db.get(
      'organizations',
      request.organizationId,
    );
    if (
      !organization?.requestAutoRoutingEnabled ||
      organization.requestRoutingRules !== args.rules
    )
      return { applied: false } as const;
    const existingRecipients = await ctx.db
      .query('requestRecipients')
      .withIndex('by_request', q => q.eq('requestId', request._id))
      .take(1);
    if (existingRecipients.length || request.routedTeamId)
      return { applied: false } as const;

    if (args.teamId) {
      const team = await ctx.db.get('teams', args.teamId);
      if (!team || team.organizationId !== request.organizationId)
        return { applied: false } as const;
    }
    const recipientIds = Array.from(new Set(args.recipientIds));
    const memberships = await Promise.all(
      recipientIds.map(userId =>
        ctx.db
          .query('members')
          .withIndex('by_org_user', q =>
            q.eq('organizationId', request.organizationId).eq('userId', userId),
          )
          .unique(),
      ),
    );
    if (memberships.some(membership => !membership))
      return { applied: false } as const;
    if (!args.teamId && recipientIds.length === 0)
      return { applied: false } as const;

    const now = Date.now();
    for (const recipientId of recipientIds) {
      await ctx.db.insert('requestRecipients', {
        requestId: request._id,
        userId: recipientId,
        role: 'recipient',
        assignedAt: now,
      });
    }
    await ctx.db.patch('requests', request._id, {
      routedTeamId: args.teamId,
      ownerId: recipientIds.length === 1 ? recipientIds[0] : undefined,
      status: 'routed',
      focusRank: requestFocusRank('routed'),
      updatedAt: now,
    });
    if (recipientIds.length) {
      await createNotificationEvent(ctx, {
        type: 'request_routed',
        organizationId: request.organizationId,
        requestId: request._id,
        payload: {
          requestKey: request.key,
          requestTitle: request.title,
          href: requestHref(organization.slug, request.key),
        },
        recipients: recipientIds.map(userId => ({ userId })),
        dedupeKey: `request-auto-routed:${request._id}`,
      });
    }
    return { applied: true } as const;
  },
});
