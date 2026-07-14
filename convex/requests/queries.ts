import { paginationOptsValidator } from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { query, type QueryCtx } from '../_generated/server';
import type { Doc, Id } from '../_generated/dataModel';
import { getOrganizationBySlug, requireOrganizationMember } from '../authz';
import { getAuthUserId } from '../authUtils';
import { canEditRequest, canViewRequest } from './lib';

async function userSummary(ctx: QueryCtx, userId?: Id<'users'>) {
  if (!userId) return null;
  const user = await ctx.db.get('users', userId);
  return user
    ? {
        _id: user._id,
        name: user.name,
        username: user.username,
        email: user.email,
        image: user.image,
      }
    : null;
}

export const list = query({
  args: {
    orgSlug: v.string(),
    scope: v.optional(
      v.union(
        v.literal('inbox'),
        v.literal('mine'),
        v.literal('requested'),
        v.literal('all'),
      ),
    ),
    paginationOpts: paginationOptsValidator,
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new ConvexError('UNAUTHORIZED');
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrganizationMember(ctx, org._id, userId);
    const page =
      args.scope === 'mine'
        ? await ctx.db
            .query('requests')
            .withIndex('by_org_owner', q =>
              q.eq('organizationId', org._id).eq('ownerId', userId),
            )
            .order('desc')
            .paginate(args.paginationOpts)
        : args.scope === 'requested'
          ? await ctx.db
              .query('requests')
              .withIndex('by_requester', q => q.eq('requesterId', userId))
              .order('desc')
              .paginate(args.paginationOpts)
          : await ctx.db
              .query('requests')
              .withIndex('by_organization', q =>
                q.eq('organizationId', org._id),
              )
              .order('desc')
              .paginate(args.paginationOpts);
    const visible = (
      await Promise.all(
        page.page.map(async request =>
          (await canViewRequest(ctx, request)) ? request : null,
        ),
      )
    ).filter((request): request is Doc<'requests'> => Boolean(request));
    const enriched = await Promise.all(
      visible.map(async request => {
        const [owner, requester, links, recipients] = await Promise.all([
          userSummary(ctx, request.ownerId),
          userSummary(ctx, request.requesterId),
          ctx.db
            .query('requestWorkLinks')
            .withIndex('by_request', q => q.eq('requestId', request._id))
            .collect(),
          ctx.db
            .query('requestRecipients')
            .withIndex('by_request', q => q.eq('requestId', request._id))
            .collect(),
        ]);
        return {
          ...request,
          owner,
          requester,
          linkedWorkCount: links.length,
          recipientCount: recipients.filter(r => r.role === 'recipient').length,
        };
      }),
    );
    const inbox =
      args.scope === 'inbox'
        ? enriched.filter(request =>
            ['new', 'routed', 'ready_for_review', 'changes_requested'].includes(
              request.status,
            ),
          )
        : enriched;
    if (args.scope === 'inbox') {
      const statusRank: Record<string, number> = {
        ready_for_review: 0,
        changes_requested: 1,
        new: 2,
        routed: 3,
      };
      inbox.sort(
        (left, right) =>
          (statusRank[left.status] ?? 9) - (statusRank[right.status] ?? 9) ||
          left.createdAt - right.createdAt,
      );
    }
    return { ...page, page: inbox };
  },
});

export const getByKey = query({
  args: { orgSlug: v.string(), requestKey: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();
    if (!org) throw new ConvexError('ORGANIZATION_NOT_FOUND');
    const request = await ctx.db
      .query('requests')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', org._id).eq('key', args.requestKey),
      )
      .first();
    if (!request) return null;
    if (!(await canViewRequest(ctx, request)))
      throw new ConvexError('FORBIDDEN');
    const [requester, owner, recipientRows, workLinks] = await Promise.all([
      userSummary(ctx, request.requesterId),
      userSummary(ctx, request.ownerId),
      ctx.db
        .query('requestRecipients')
        .withIndex('by_request', q => q.eq('requestId', request._id))
        .collect(),
      ctx.db
        .query('requestWorkLinks')
        .withIndex('by_request', q => q.eq('requestId', request._id))
        .collect(),
    ]);
    const recipients = await Promise.all(
      recipientRows.map(async row => ({
        ...row,
        user: await userSummary(ctx, row.userId),
      })),
    );
    const linkedWork = (
      await Promise.all(
        workLinks.map(async link => {
          const work = await ctx.db.get('issues', link.workId);
          return work ? { ...work, relation: link.relation } : null;
        }),
      )
    ).filter(Boolean);
    return {
      ...request,
      requester,
      owner,
      recipients,
      linkedWork,
      canEdit: await canEditRequest(ctx, request),
    };
  },
});

export const getPublicByKey = query({
  args: { orgSlug: v.string(), requestKey: v.string() },
  handler: async (ctx, args) => {
    const org = await ctx.db
      .query('organizations')
      .withIndex('by_slug', q => q.eq('slug', args.orgSlug))
      .first();
    if (!org) return null;
    const request = await ctx.db
      .query('requests')
      .withIndex('by_org_key', q =>
        q.eq('organizationId', org._id).eq('key', args.requestKey),
      )
      .first();
    if (!request || request.visibility !== 'public') return null;
    return {
      key: request.key,
      title: request.title,
      expectedOutput: request.expectedOutput,
      status: request.status,
      createdAt: request.createdAt,
      completedAt: request.completedAt,
    };
  },
});
