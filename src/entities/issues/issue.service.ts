import { db } from "@/db";
import {
  issue as issueTable,
  issueActivity as activityTable,
  issueActivityTypeEnum as activityEnum,
  project as projectTable,
  organization as organizationTable,
  team as teamTable,
  member,
  user as userTable,
} from "@/db/schema";
import { getNextIssueSequence } from "@/entities/teams/team.service";
import {
  eq,
  and,
  InferInsertModel,
  InferSelectModel,
  desc,
  or,
  like,
} from "drizzle-orm";
import { randomUUID } from "crypto";

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type IssueInsertModel = InferInsertModel<typeof issueTable>;
export type Issue = InferSelectModel<typeof issueTable>;

export type CreateIssueParams = Pick<
  IssueInsertModel,
  | "teamId"
  | "reporterId"
  | "title"
  | "description"
  | "projectId"
  | "priorityId"
  | "stateId"
> & {
  orgSlug: string;
  issueKeyFormat: "user" | "project" | "team";
};

// -----------------------------------------------------------------------------
// Sequence generation helpers
// -----------------------------------------------------------------------------

/**
 * Generates a user-based issue key from username.
 * Takes first 3 characters of username (or first 3 chars of name if no username).
 */
export async function generateUserIssueKey(
  userId: string,
  sequenceNumber: number,
): Promise<string> {
  const userResult = await db
    .select({ username: userTable.username, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (userResult.length === 0) {
    throw new Error(`User not found: ${userId}`);
  }

  const { username, name } = userResult[0];

  // Use username if available, otherwise use name
  const baseText = username || name;

  // Take first 3 characters and convert to uppercase
  const prefix = baseText.slice(0, 3).toUpperCase();

  return `${prefix}-${sequenceNumber}`;
}

/**
 * Generates a project-based issue key from project key.
 */
export async function generateProjectIssueKey(
  projectId: string,
  sequenceNumber: number,
): Promise<string> {
  const projectResult = await db
    .select({ key: projectTable.key })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (projectResult.length === 0) {
    throw new Error(`Project not found: ${projectId}`);
  }

  const { key } = projectResult[0];
  return `${key}-${sequenceNumber}`;
}

/**
 * Generates a team-based issue key from team key.
 */
export async function generateTeamIssueKey(
  teamId: string,
  sequenceNumber: number,
): Promise<string> {
  const teamResult = await db
    .select({ key: teamTable.key })
    .from(teamTable)
    .where(eq(teamTable.id, teamId))
    .limit(1);

  if (teamResult.length === 0) {
    throw new Error(`Team not found: ${teamId}`);
  }

  const { key } = teamResult[0];
  return `${key}-${sequenceNumber}`;
}

/**
 * Generates the next sequence number for project-based issues within a given project.
 * Optimized: counts all issues associated with the project (since project format
 * issues will always have a projectId), rather than using LIKE pattern matching.
 */
export async function getNextProjectIssueSequence(
  projectId: string,
): Promise<number> {
  // Count all issues that belong to this project
  // More optimized than LIKE query since we know project format issues always have projectId
  const res = await db
    .select({ seq: issueTable.sequenceNumber })
    .from(issueTable)
    .where(eq(issueTable.projectId, projectId))
    .orderBy(desc(issueTable.sequenceNumber))
    .limit(1);

  const current = res[0]?.seq ?? 0;
  return current + 1;
}

/**
 * Generates the next sequence number for user-based issues created by a user in an organization.
 * Only counts issues that were created with user-based keys.
 */
export async function getNextUserIssueSequence(
  orgSlug: string,
  userId: string,
): Promise<number> {
  // Get organization ID first
  const orgRes = await db
    .select({ id: organizationTable.id })
    .from(organizationTable)
    .where(eq(organizationTable.slug, orgSlug))
    .limit(1);

  const orgId = orgRes[0]?.id;
  if (!orgId) return 1;

  // Get user info to determine their key prefix
  const userResult = await db
    .select({ username: userTable.username, name: userTable.name })
    .from(userTable)
    .where(eq(userTable.id, userId))
    .limit(1);

  if (userResult.length === 0) {
    return 1;
  }

  const { username, name } = userResult[0];
  const baseText = username || name;
  const userPrefix = baseText.slice(0, 3).toUpperCase();

  // Find highest sequence number for user-based issues with this user's prefix
  const res = await db
    .select({ seq: issueTable.sequenceNumber })
    .from(issueTable)
    .leftJoin(projectTable, eq(issueTable.projectId, projectTable.id))
    .leftJoin(teamTable, eq(issueTable.teamId, teamTable.id))
    .leftJoin(member, eq(member.userId, issueTable.reporterId))
    .where(
      and(
        eq(issueTable.reporterId, userId),
        // Only count issues with user-based keys (start with user prefix)
        like(issueTable.key, `${userPrefix}-%`),
        // Issue belongs to org via project, team, or reporter membership
        or(
          eq(projectTable.organizationId, orgId),
          eq(teamTable.organizationId, orgId),
          eq(member.organizationId, orgId),
        ),
      ),
    )
    .orderBy(desc(issueTable.sequenceNumber))
    .limit(1);

  const current = res[0]?.seq ?? 0;
  return current + 1;
}

export async function createIssue(
  params: CreateIssueParams,
): Promise<{ id: string; key: string }> {
  const {
    orgSlug,
    teamId,
    reporterId,
    title,
    description,
    projectId,
    priorityId,
    stateId,
    issueKeyFormat,
  } = params;

  let seq: number;
  let issueKey: string;

  // Generate sequence number and key based on the selected format
  switch (issueKeyFormat) {
    case "team": {
      if (!teamId) {
        throw new Error("Team ID is required for team-based issue keys");
      }
      seq = await getNextIssueSequence(teamId);
      issueKey = await generateTeamIssueKey(teamId, seq);
      break;
    }
    case "project": {
      if (!projectId) {
        throw new Error("Project ID is required for project-based issue keys");
      }
      seq = await getNextProjectIssueSequence(projectId);
      issueKey = await generateProjectIssueKey(projectId, seq);
      break;
    }
    case "user":
    default: {
      seq = await getNextUserIssueSequence(orgSlug, reporterId!);
      issueKey = await generateUserIssueKey(reporterId!, seq);
      break;
    }
  }

  const now = new Date();
  const id = randomUUID();

  await db.transaction(async (tx) => {
    await tx.insert(issueTable).values({
      id,
      key: issueKey,
      sequenceNumber: seq,
      title,
      description,
      teamId,
      reporterId: reporterId!,
      projectId,
      priorityId,
      stateId,
      createdAt: now,
      updatedAt: now,
    });

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId: id,
      actorId: reporterId!,
      type: activityEnum.enumValues[6]!, // "created"
      createdAt: now,
    });
  });

  return { id, key: issueKey } as const;
}

// ----------------------------------------------------------------------------
// Updates
// ----------------------------------------------------------------------------

export async function changeState(
  issueId: string,
  actorId: string,
  stateId: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ stateId, updatedAt: now })
      .where(eq(issueTable.id, issueId));

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId: actorId!,
      type: "status_changed",
      payload: { stateId },
      createdAt: now,
    });
  });
}

export async function changePriority(
  issueId: string,
  actorId: string,
  priorityId: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ priorityId, updatedAt: now })
      .where(eq(issueTable.id, issueId));

    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId: actorId!,
      type: "priority_changed",
      payload: { priorityId },
      createdAt: now,
    });
  });
}

export async function assign(
  issueId: string,
  actorId: string,
  assigneeId: string | null,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ assigneeId, updatedAt: now })
      .where(eq(issueTable.id, issueId));
    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId: actorId!,
      type: "assignee_changed",
      payload: { assigneeId },
      createdAt: now,
    });
  });
}

export async function updateTitle(
  issueId: string,
  actorId: string,
  title: string,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ title, updatedAt: now })
      .where(eq(issueTable.id, issueId));
    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId: actorId!,
      type: "title_changed",
      payload: { title },
      createdAt: now,
    });
  });
}

export async function updateDescription(
  issueId: string,
  actorId: string,
  description: string | null,
): Promise<void> {
  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(issueTable)
      .set({ description, updatedAt: now })
      .where(eq(issueTable.id, issueId));
    await tx.insert(activityTable).values({
      id: randomUUID(),
      issueId,
      actorId: actorId!,
      type: "description_changed",
      createdAt: now,
    });
  });
}

// -----------------------------------------------------------------------------
// Query operations
// -----------------------------------------------------------------------------

/**
 * Finds an issue by its stored key (e.g., "JOH-123", "ENG-45", "PROJ-67") within an organization.
 */
export async function findIssueByKey(
  orgSlug: string,
  issueKey: string,
): Promise<Issue | null> {
  // Check if it's a UUID (fallback for direct ID lookup)
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (uuidRegex.test(issueKey)) {
    // Direct UUID lookup
    const issueResult = await db
      .select()
      .from(issueTable)
      .where(eq(issueTable.id, issueKey))
      .limit(1);
    return issueResult[0] || null;
  }

  // Get organization ID from slug
  const orgResult = await db
    .select({ id: organizationTable.id })
    .from(organizationTable)
    .where(eq(organizationTable.slug, orgSlug))
    .limit(1);

  if (orgResult.length === 0) {
    return null;
  }

  const organizationId = orgResult[0].id;

  // Find issue by stored key, ensuring it belongs to the organization
  // This handles all key formats (user, project, team) since we store the full key
  const issueResult = await db
    .select({
      issue: issueTable,
    })
    .from(issueTable)
    .leftJoin(projectTable, eq(issueTable.projectId, projectTable.id))
    .leftJoin(teamTable, eq(issueTable.teamId, teamTable.id))
    .leftJoin(member, eq(member.userId, issueTable.reporterId))
    .where(
      and(
        eq(issueTable.key, issueKey),
        // Issue belongs to org via project, team, or reporter membership
        or(
          eq(projectTable.organizationId, organizationId),
          eq(teamTable.organizationId, organizationId),
          eq(member.organizationId, organizationId),
        ),
      ),
    )
    .limit(1);

  return issueResult[0]?.issue || null;
}

/**
 * Gets the stored issue key for an issue (e.g., "JOH-123").
 */
export async function getIssueKey(issueId: string): Promise<string | null> {
  const result = await db
    .select({ key: issueTable.key })
    .from(issueTable)
    .where(eq(issueTable.id, issueId))
    .limit(1);

  if (result.length === 0) {
    return null;
  }

  return result[0].key;
}

// -----------------------------------------------------------------------------
// Deletion
// -----------------------------------------------------------------------------

export async function deleteIssue(issueId: string): Promise<void> {
  await db.delete(issueTable).where(eq(issueTable.id, issueId));
}
