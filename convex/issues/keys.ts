import type { Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';

async function issueKeyExists(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  key: string,
) {
  const existingIssue = await ctx.db
    .query('issues')
    .withIndex('by_org_key', q =>
      q.eq('organizationId', organizationId).eq('key', key),
    )
    .first();

  return existingIssue !== null;
}

/**
 * Seed for the next issue key: max(sequenceNumber) + 1 within the project (or
 * within the org's project-less issues when projectId is undefined), read via
 * a single indexed row instead of collecting the entire issue set. The probe
 * loop in getNextAvailableIssueKey still guarantees uniqueness for any legacy
 * data whose keys don't line up with sequenceNumber.
 */
export async function getNextSequenceSeed(
  ctx: QueryCtx | MutationCtx,
  organizationId: Id<'organizations'>,
  projectId: Id<'projects'> | undefined,
) {
  const newest = await ctx.db
    .query('issues')
    .withIndex('by_org_project_sequence', q =>
      q.eq('organizationId', organizationId).eq('projectId', projectId),
    )
    .order('desc')
    .first();

  return (newest?.sequenceNumber ?? 0) + 1;
}

export async function getNextAvailableIssueKey(
  ctx: QueryCtx | MutationCtx,
  args: {
    organizationId: Id<'organizations'>;
    prefix: string;
    startingSequenceNumber: number;
  },
) {
  let sequenceNumber = Math.max(1, args.startingSequenceNumber);

  while (true) {
    const key = `${args.prefix}-${sequenceNumber}`;
    if (!(await issueKeyExists(ctx, args.organizationId, key))) {
      return { key, sequenceNumber };
    }
    sequenceNumber += 1;
  }
}

export function parseIssueKeyParts(key: string) {
  const match = key.match(/^(.*)-(\d+)$/);
  if (!match) {
    return {
      prefix: key,
      sequenceNumber: 2,
    };
  }

  return {
    prefix: match[1],
    sequenceNumber: Number(match[2]) + 1,
  };
}
