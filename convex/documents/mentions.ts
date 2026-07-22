/**
 * Utilities for extracting and syncing document mentions.
 *
 * Mentions are stored as links in document HTML content with specific href patterns:
 * - Users:      /{orgSlug}/people/{userId}
 * - Teams:      /{orgSlug}/teams/{TEAM_KEY}
 * - Projects:   /{orgSlug}/projects/{PROJECT_KEY}
 * - Issues:     /{orgSlug}/issues/{ISSUE_KEY}
 * - Documents:  /{orgSlug}/documents/{documentId}
 */

import type { MutationCtx, QueryCtx } from '../_generated/server';
import type { Id } from '../_generated/dataModel';
import { extractMentions, type MentionRef } from '../_shared/document_mentions';

export { extractMentions, type MentionRef } from '../_shared/document_mentions';

/**
 * Resolve raw mention refs (keys) to Convex entity IDs.
 * Users already have IDs; teams/projects/issues need key→ID lookup.
 */
export async function resolveMentionIds(
  ctx: MutationCtx,
  orgId: Id<'organizations'>,
  refs: MentionRef[],
): Promise<{ mentionType: MentionRef['mentionType']; entityId: string }[]> {
  const resolved: {
    mentionType: MentionRef['mentionType'];
    entityId: string;
  }[] = [];

  for (const ref of refs) {
    switch (ref.mentionType) {
      case 'user': {
        // rawRef is already the user ID — verify it exists
        try {
          const user = await ctx.db.get('users', ref.rawRef as Id<'users'>);
          if (user) {
            resolved.push({ mentionType: 'user', entityId: ref.rawRef });
          }
        } catch {
          // Invalid ID format — skip
        }
        break;
      }
      case 'team': {
        const team = await ctx.db
          .query('teams')
          .withIndex('by_org_key', q =>
            q.eq('organizationId', orgId).eq('key', ref.rawRef),
          )
          .first();
        if (team) {
          resolved.push({ mentionType: 'team', entityId: team._id });
        }
        break;
      }
      case 'project': {
        const project = await ctx.db
          .query('projects')
          .withIndex('by_org_key', q =>
            q.eq('organizationId', orgId).eq('key', ref.rawRef),
          )
          .first();
        if (project) {
          resolved.push({ mentionType: 'project', entityId: project._id });
        }
        break;
      }
      case 'issue': {
        // Issue key format: PROJ-42 → stored as searchText or key field
        const issue = await ctx.db
          .query('issues')
          .withIndex('by_org_key', q =>
            q.eq('organizationId', orgId).eq('key', ref.rawRef),
          )
          .first();
        if (issue) {
          resolved.push({ mentionType: 'issue', entityId: issue._id });
        }
        break;
      }
      case 'document': {
        // rawRef is a Convex document ID
        try {
          const doc = await ctx.db.get(
            'documents',
            ref.rawRef as Id<'documents'>,
          );
          if (doc && doc.organizationId === orgId) {
            resolved.push({ mentionType: 'document', entityId: doc._id });
          }
        } catch {
          // Invalid ID format — skip
        }
        break;
      }
    }
  }

  return resolved;
}

/**
 * Extract document IDs referenced in HTML content (via links or @mentions).
 * Returns only valid document IDs that belong to the given org.
 */
export async function extractReferencedDocumentIds(
  ctx: QueryCtx | MutationCtx,
  orgId: Id<'organizations'>,
  html: string,
): Promise<Id<'documents'>[]> {
  const refs = extractMentions(html);
  const docRefs = refs.filter(r => r.mentionType === 'document');
  const ids: Id<'documents'>[] = [];

  for (const ref of docRefs) {
    try {
      const doc = await ctx.db.get('documents', ref.rawRef as Id<'documents'>);
      if (doc && doc.organizationId === orgId) {
        ids.push(doc._id);
      }
    } catch {
      // Invalid ID format — skip
    }
  }

  return ids;
}

/**
 * Sync the documentMentions table for a given document.
 * Diffs existing mentions against new ones and inserts/deletes accordingly.
 */
export async function syncDocumentMentions(
  ctx: MutationCtx,
  documentId: Id<'documents'>,
  organizationId: Id<'organizations'>,
  content: string | undefined,
) {
  const refs = content ? extractMentions(content) : [];
  await syncDocumentMentionRefs(ctx, documentId, organizationId, refs);
}

export async function syncDocumentMentionRefs(
  ctx: MutationCtx,
  documentId: Id<'documents'>,
  organizationId: Id<'organizations'>,
  refs: MentionRef[],
) {
  // Get current mentions from DB
  const existing = await ctx.db
    .query('documentMentions')
    .withIndex('by_document', q => q.eq('documentId', documentId))
    .collect();

  const existingSet = new Set(
    existing.map(m => `${m.mentionType}:${m.entityId}`),
  );

  // Parse new mentions from content
  const newMentions = await resolveMentionIds(ctx, organizationId, refs);

  const newSet = new Set(
    newMentions.map(m => `${m.mentionType}:${m.entityId}`),
  );

  // Delete removed mentions
  for (const mention of existing) {
    const key = `${mention.mentionType}:${mention.entityId}`;
    if (!newSet.has(key)) {
      await ctx.db.delete('documentMentions', mention._id);
    }
  }

  // Insert new mentions
  for (const mention of newMentions) {
    const key = `${mention.mentionType}:${mention.entityId}`;
    if (!existingSet.has(key)) {
      await ctx.db.insert('documentMentions', {
        documentId,
        organizationId,
        mentionType: mention.mentionType,
        entityId: mention.entityId,
      });
    }
  }
}
