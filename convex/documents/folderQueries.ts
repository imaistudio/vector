import {
  paginationOptsValidator,
  paginationResultValidator,
} from 'convex/server';
import { query } from '../_generated/server';
import { v } from 'convex/values';
import { getOrganizationBySlug } from '../authz';

const folderValidator = v.object({
  _id: v.id('documentFolders'),
  _creationTime: v.number(),
  organizationId: v.id('organizations'),
  name: v.string(),
  description: v.optional(v.string()),
  color: v.optional(v.string()),
  icon: v.optional(v.string()),
  createdBy: v.id('users'),
});

export const listFoldersPage = query({
  args: {
    orgSlug: v.string(),
    paginationOpts: paginationOptsValidator,
  },
  returns: paginationResultValidator(folderValidator),
  handler: async (ctx, args) => {
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    return ctx.db
      .query('documentFolders')
      .withIndex('by_organizationId', q => q.eq('organizationId', org._id))
      .order('asc')
      .paginate(args.paginationOpts);
  },
});

export const listFolders = query({
  args: {
    orgSlug: v.string(),
  },
  handler: async (ctx, args) => {
    const org = await getOrganizationBySlug(ctx, args.orgSlug);

    const folders = await ctx.db
      .query('documentFolders')
      .withIndex('by_organizationId', q => q.eq('organizationId', org._id))
      .collect();

    // Count documents per folder
    const foldersWithCounts = await Promise.all(
      folders.map(async folder => {
        const docs = await ctx.db
          .query('documents')
          .withIndex('by_folder', q => q.eq('folderId', folder._id))
          .collect();

        return {
          ...folder,
          documentCount: docs.length,
        };
      }),
    );

    return foldersWithCounts;
  },
});
