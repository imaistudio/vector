import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server';
import { ConvexError, v } from 'convex/values';
import { mutation, query } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import { requireAuthUser, getOrganizationBySlug } from '../authz';
import { canEditDocument, canViewDocument } from '../access';
import {
  DOCUMENT_CONTENT_CHUNK_BYTES,
  DOCUMENT_CONTENT_PAGE_SIZE,
  getInlineDocumentSizeFromContentBytes,
  getUtf8ByteLength,
  MAX_CONVEX_DOCUMENT_BYTES,
} from '../_shared/document_content';
import { syncDocumentMentionRefs } from './mentions';
import { scheduleContentVersionCleanup } from './contentCleanup';
import {
  recordActivity,
  resolveDocumentScope,
  snapshotForDocument,
} from '../activities/lib';

const mentionRefValidator = v.object({
  mentionType: v.union(
    v.literal('user'),
    v.literal('team'),
    v.literal('project'),
    v.literal('issue'),
    v.literal('document'),
  ),
  rawRef: v.string(),
});

const chunkValidator = v.object({
  _id: v.id('documentContentChunks'),
  _creationTime: v.number(),
  documentId: v.id('documents'),
  version: v.string(),
  chunkIndex: v.number(),
  content: v.string(),
});

async function requireEditableDocument(
  ctx: MutationCtx,
  documentId: Id<'documents'>,
) {
  const doc = await ctx.db.get('documents', documentId);
  if (!doc) throw new ConvexError('DOCUMENT_NOT_FOUND');
  if (!(await canEditDocument(ctx, doc))) throw new ConvexError('FORBIDDEN');
  return doc;
}

export const beginUpload = mutation({
  args: {
    documentId: v.id('documents'),
    uploadId: v.string(),
    expectedChunkCount: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    await requireEditableDocument(ctx, args.documentId);
    if (
      !args.uploadId ||
      args.uploadId.length > 100 ||
      !Number.isInteger(args.expectedChunkCount) ||
      args.expectedChunkCount < 2
    ) {
      throw new ConvexError('INVALID_CHUNK_UPLOAD');
    }

    const pending = await ctx.db
      .query('documentContentUploads')
      .withIndex('by_document', q => q.eq('documentId', args.documentId))
      .unique();
    if (pending) {
      await ctx.db.delete('documentContentUploads', pending._id);
      await scheduleContentVersionCleanup(
        ctx,
        args.documentId,
        pending.uploadId,
      );
    }

    await ctx.db.insert('documentContentUploads', {
      documentId: args.documentId,
      uploadId: args.uploadId,
      expectedChunkCount: args.expectedChunkCount,
      nextChunkIndex: 0,
      contentSize: 0,
      createdBy: userId,
      createdAt: Date.now(),
    });
    return null;
  },
});

export const uploadChunk = mutation({
  args: {
    documentId: v.id('documents'),
    uploadId: v.string(),
    chunkIndex: v.number(),
    content: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    await requireEditableDocument(ctx, args.documentId);
    const upload = await ctx.db
      .query('documentContentUploads')
      .withIndex('by_document', q => q.eq('documentId', args.documentId))
      .unique();
    const contentBytes = getUtf8ByteLength(args.content);
    if (
      !upload ||
      upload.uploadId !== args.uploadId ||
      upload.createdBy !== userId ||
      args.chunkIndex !== upload.nextChunkIndex ||
      args.chunkIndex >= upload.expectedChunkCount ||
      contentBytes === 0 ||
      contentBytes > DOCUMENT_CONTENT_CHUNK_BYTES
    ) {
      throw new ConvexError('INVALID_CHUNK_UPLOAD');
    }

    await ctx.db.insert('documentContentChunks', {
      documentId: args.documentId,
      version: args.uploadId,
      chunkIndex: args.chunkIndex,
      content: args.content,
    });
    await ctx.db.patch('documentContentUploads', upload._id, {
      nextChunkIndex: upload.nextChunkIndex + 1,
      contentSize: upload.contentSize + contentBytes,
    });
    return null;
  },
});

export const commitUpload = mutation({
  args: {
    documentId: v.id('documents'),
    uploadId: v.string(),
    title: v.string(),
    mentionRefs: v.array(mentionRefValidator),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    const doc = await requireEditableDocument(ctx, args.documentId);
    const title = args.title.trim();
    if (!title || title.length > 200) throw new ConvexError('INVALID_INPUT');

    const upload = await ctx.db
      .query('documentContentUploads')
      .withIndex('by_document', q => q.eq('documentId', args.documentId))
      .unique();
    if (
      !upload ||
      upload.uploadId !== args.uploadId ||
      upload.createdBy !== userId ||
      upload.nextChunkIndex !== upload.expectedChunkCount
    ) {
      throw new ConvexError('INCOMPLETE_CHUNK_UPLOAD');
    }

    if (
      getInlineDocumentSizeFromContentBytes(doc, title, upload.contentSize) <
      MAX_CONVEX_DOCUMENT_BYTES
    ) {
      throw new ConvexError('INLINE_CONTENT_REQUIRED');
    }

    await ctx.db.patch('documents', doc._id, {
      title,
      content: undefined,
      contentVersion: upload.uploadId,
      contentChunkCount: upload.expectedChunkCount,
      contentSize: upload.contentSize,
      lastEditedBy: userId,
      lastEditedAt: Date.now(),
    });
    await syncDocumentMentionRefs(
      ctx,
      doc._id,
      doc.organizationId,
      args.mentionRefs,
    );
    const scope = resolveDocumentScope(doc);
    const snapshot = snapshotForDocument({ ...doc, title });
    if (title !== doc.title) {
      await recordActivity(ctx, {
        scope,
        entityType: 'document',
        eventType: 'document_title_changed',
        actorId: userId,
        details: {
          field: 'title',
          fromLabel: doc.title,
          toLabel: title,
        },
        snapshot,
      });
    }
    await recordActivity(ctx, {
      scope,
      entityType: 'document',
      eventType: 'document_content_changed',
      actorId: userId,
      details: { field: 'content' },
      snapshot,
    });
    await ctx.db.delete('documentContentUploads', upload._id);
    if (doc.contentVersion !== upload.uploadId) {
      await scheduleContentVersionCleanup(ctx, doc._id, doc.contentVersion);
    }
    return null;
  },
});

export const listChunks = query({
  args: {
    documentId: v.id('documents'),
    version: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(chunkValidator),
  handler: async (ctx, args) => {
    const doc = await ctx.db.get('documents', args.documentId);
    if (
      !doc ||
      doc.contentVersion !== args.version ||
      !(await canViewDocument(ctx, doc))
    ) {
      throw new ConvexError('DOCUMENT_NOT_FOUND');
    }
    return ctx.db
      .query('documentContentChunks')
      .withIndex('by_document_version_chunk', q =>
        q.eq('documentId', doc._id).eq('version', args.version),
      )
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(
          DOCUMENT_CONTENT_PAGE_SIZE,
          Math.max(1, args.paginationOpts.numItems),
        ),
      });
  },
});

export const listPublicChunks = query({
  args: {
    orgSlug: v.string(),
    documentId: v.id('documents'),
    version: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(chunkValidator),
  handler: async (ctx, args) => {
    const [organization, doc] = await Promise.all([
      getOrganizationBySlug(ctx, args.orgSlug),
      ctx.db.get('documents', args.documentId),
    ]);
    if (
      !doc ||
      doc.organizationId !== organization._id ||
      doc.visibility !== 'public' ||
      doc.contentVersion !== args.version
    ) {
      throw new ConvexError('DOCUMENT_NOT_FOUND');
    }
    return ctx.db
      .query('documentContentChunks')
      .withIndex('by_document_version_chunk', q =>
        q.eq('documentId', doc._id).eq('version', args.version),
      )
      .paginate({
        ...args.paginationOpts,
        numItems: Math.min(
          DOCUMENT_CONTENT_PAGE_SIZE,
          Math.max(1, args.paginationOpts.numItems),
        ),
      });
  },
});
