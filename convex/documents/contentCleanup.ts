import type { Id } from '../_generated/dataModel';
import { internalMutation, type MutationCtx } from '../_generated/server';
import { makeFunctionReference } from 'convex/server';
import { v } from 'convex/values';

const removeContentVersionReference = makeFunctionReference<
  'mutation',
  { documentId: Id<'documents'>; version: string },
  null
>('documents/contentCleanup:removeContentVersion');

export async function scheduleContentVersionCleanup(
  ctx: MutationCtx,
  documentId: Id<'documents'>,
  version: string | undefined,
) {
  if (!version) return;
  await ctx.scheduler.runAfter(0, removeContentVersionReference, {
    documentId,
    version,
  });
}

export const removeContentVersion = internalMutation({
  args: {
    documentId: v.id('documents'),
    version: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args): Promise<null> => {
    const chunks = await ctx.db
      .query('documentContentChunks')
      .withIndex('by_document_version_chunk', q =>
        q.eq('documentId', args.documentId).eq('version', args.version),
      )
      .take(100);

    for (const chunk of chunks) {
      await ctx.db.delete('documentContentChunks', chunk._id);
    }

    if (chunks.length === 100) {
      await ctx.scheduler.runAfter(0, removeContentVersionReference, args);
    }
    return null;
  },
});
