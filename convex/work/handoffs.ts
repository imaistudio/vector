import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';

async function resolveHandoffNotification(
  ctx: MutationCtx,
  handoffId: Id<'workHandoffs'>,
  now: number,
) {
  const event = await ctx.db
    .query('notificationEvents')
    .withIndex('by_dedupe_key', q =>
      q.eq('dedupeKey', `handoff-proposed:${handoffId}`),
    )
    .first();
  if (!event) return;
  const recipients = await ctx.db
    .query('notificationRecipients')
    .withIndex('by_event', q => q.eq('eventId', event._id))
    .collect();
  await Promise.all(
    recipients.map(recipient =>
      ctx.db.patch('notificationRecipients', recipient._id, {
        actionState: 'done',
        isRead: true,
        readAt: recipient.readAt ?? now,
      }),
    ),
  );
}

export async function cancelPendingHandoffs(
  ctx: MutationCtx,
  workId: Id<'issues'>,
  actorId?: Id<'users'>,
) {
  const pending = await ctx.db
    .query('workHandoffs')
    .withIndex('by_work_status', q =>
      q.eq('workId', workId).eq('status', 'pending'),
    )
    .collect();
  if (pending.length === 0) return;

  const now = Date.now();
  await Promise.all(
    pending.map(async handoff => {
      await ctx.db.patch('workHandoffs', handoff._id, {
        status: 'canceled',
        respondedAt: now,
        ...(actorId ? { respondedBy: actorId } : {}),
      });
      await resolveHandoffNotification(ctx, handoff._id, now);
    }),
  );
}

export function canEditPendingHandoff(
  handoff: Doc<'workHandoffs'>,
  userId: Id<'users'>,
  canAssignWork: boolean,
) {
  return (
    handoff.status === 'pending' &&
    (handoff.initiatedBy === userId ||
      handoff.fromOwnerId === userId ||
      canAssignWork)
  );
}

export async function resolvePendingHandoffNotification(
  ctx: MutationCtx,
  handoffId: Id<'workHandoffs'>,
) {
  await resolveHandoffNotification(ctx, handoffId, Date.now());
}
