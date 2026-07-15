import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { createNotificationEvent } from '../notifications/lib';
import { requestFocusRank } from '../requests/lib';

export async function setLinkedRequestsInDelivery(
  ctx: MutationCtx,
  workId: Id<'issues'>,
) {
  const links = await ctx.db
    .query('requestWorkLinks')
    .withIndex('by_work', query => query.eq('workId', workId))
    .collect();
  for (const link of links) {
    if (link.relation !== 'fulfills') continue;
    const request = await ctx.db.get('requests', link.requestId);
    if (request && ['new', 'routed', 'planned'].includes(request.status)) {
      await ctx.db.patch('requests', request._id, {
        status: 'in_delivery',
        focusRank: requestFocusRank('in_delivery'),
        updatedAt: Date.now(),
      });
    }
  }
}

export async function reopenLinkedRequestsAfterCancellation(
  ctx: MutationCtx,
  workId: Id<'issues'>,
) {
  const links = await ctx.db
    .query('requestWorkLinks')
    .withIndex('by_work', query => query.eq('workId', workId))
    .collect();
  for (const link of links) {
    if (link.relation !== 'fulfills') continue;
    const request = await ctx.db.get('requests', link.requestId);
    if (
      !request ||
      ['completed', 'declined', 'duplicate', 'changes_requested'].includes(
        request.status,
      )
    )
      continue;
    const requestLinks = await ctx.db
      .query('requestWorkLinks')
      .withIndex('by_request', query => query.eq('requestId', request._id))
      .collect();
    const otherFulfillingWork = (
      await Promise.all(
        requestLinks
          .filter(
            requestLink =>
              requestLink.relation === 'fulfills' &&
              requestLink.workId !== workId,
          )
          .map(requestLink => ctx.db.get('issues', requestLink.workId)),
      )
    ).filter((item): item is Doc<'issues'> => item !== null);
    const hasOtherDeliveryInProgress = otherFulfillingWork.some(item =>
      ['active', 'waiting', 'blocked', 'ready_for_review'].includes(
        item.workStatus ?? '',
      ),
    );
    const nextStatus = hasOtherDeliveryInProgress ? 'in_delivery' : 'planned';
    await ctx.db.patch('requests', request._id, {
      status: nextStatus,
      focusRank: requestFocusRank(nextStatus),
      readyForReviewAt: undefined,
      updatedAt: Date.now(),
    });
  }
}

export async function maybeRaiseLinkedRequestsForReview(
  ctx: MutationCtx,
  work: Doc<'issues'>,
  actorId: Id<'users'>,
) {
  const links = await ctx.db
    .query('requestWorkLinks')
    .withIndex('by_work', query => query.eq('workId', work._id))
    .collect();
  const now = Date.now();
  for (const link of links) {
    if (link.relation !== 'fulfills') continue;
    const request = await ctx.db.get('requests', link.requestId);
    if (
      !request ||
      ['ready_for_review', 'completed', 'declined', 'duplicate'].includes(
        request.status,
      )
    )
      continue;
    const allLinks = await ctx.db
      .query('requestWorkLinks')
      .withIndex('by_request', query => query.eq('requestId', request._id))
      .collect();
    const linkedWork = await Promise.all(
      allLinks
        .filter(row => row.relation === 'fulfills')
        .map(row => ctx.db.get('issues', row.workId)),
    );
    const allReady = linkedWork.every(
      item =>
        item &&
        ['ready_for_review', 'completed'].includes(item.workStatus ?? ''),
    );
    if (!allReady) continue;
    await ctx.db.patch('requests', request._id, {
      status: 'ready_for_review',
      focusRank: requestFocusRank('ready_for_review'),
      readyForReviewAt: now,
      updatedAt: now,
    });
    const org = await ctx.db.get('organizations', request.organizationId);
    const recipients = new Set<Id<'users'>>();
    if (request.requesterId) recipients.add(request.requesterId);
    if (request.createdBy) recipients.add(request.createdBy);
    await createNotificationEvent(ctx, {
      type: 'request_ready_for_review',
      actorId,
      organizationId: request.organizationId,
      requestId: request._id,
      issueId: work._id,
      payload: {
        requestKey: request.key,
        requestTitle: request.title,
        workKey: work.key,
        workTitle: work.title,
        href: org ? `/${org.slug}/requests/${request.key}` : undefined,
      },
      recipients: Array.from(recipients).map(userId => ({ userId })),
      // A request can return to delivery after changes are requested and then
      // become ready again with the same set of Work. Include the transition
      // timestamp so each review cycle creates one notification while retries
      // within the same cycle remain idempotent.
      dedupeKey: `request-ready:${request._id}:${now}`,
    });
  }
}
