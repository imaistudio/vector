import { db } from "@/db";
import {
  issueState,
  projectStatus,
  organization,
  issue,
  project as projectTable,
  issuePriority,
} from "@/db/schema";
import { eq, and, count } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface StatePayload {
  name: string;
  position: number;
  color: string;
  type: string;
}

export interface PriorityPayload {
  name: string;
  weight: number;
  color: string;
}

// ---------------------------------------------------------------------------
// Default definitions (same semantic mapping used in earlier static UI)
// ---------------------------------------------------------------------------

const ISSUE_STATE_DEFAULTS: StatePayload[] = [
  { name: "Backlog", position: 0, color: "#6b7280", type: "backlog" },
  { name: "To Do", position: 1, color: "#3b82f6", type: "todo" },
  { name: "In Progress", position: 2, color: "#f59e0b", type: "in_progress" },
  { name: "Done", position: 3, color: "#10b981", type: "done" },
  { name: "Canceled", position: 4, color: "#ef4444", type: "canceled" },
];

const PROJECT_STATUS_DEFAULTS: StatePayload[] = [
  { name: "Backlog", position: 0, color: "#6b7280", type: "backlog" },
  { name: "Planned", position: 1, color: "#3b82f6", type: "planned" },
  { name: "In Progress", position: 2, color: "#f59e0b", type: "in_progress" },
  { name: "Completed", position: 3, color: "#10b981", type: "completed" },
  { name: "Canceled", position: 4, color: "#ef4444", type: "canceled" },
];

const ISSUE_PRIORITY_DEFAULTS: PriorityPayload[] = [
  { name: "No priority", weight: 0, color: "#94a3b8" },
  { name: "Low", weight: 1, color: "#10b981" },
  { name: "Medium", weight: 2, color: "#f59e0b" },
  { name: "High", weight: 3, color: "#ef4444" },
  { name: "Urgent", weight: 4, color: "#dc2626" },
];

// Helper: ensure a default exists for org
async function ensureDefaults<
  T extends typeof issueState | typeof projectStatus,
>(table: T, orgId: string, defaults: StatePayload[]) {
  const existingRows = await db
    .select({ type: table.type })
    .from(table)
    .where(eq(table.organizationId, orgId));

  const existingTypes = new Set<string>(
    existingRows.map((r) => r.type as unknown as string),
  );

  const toInsert = defaults.filter((d) => !existingTypes.has(d.type as string));

  if (toInsert.length > 0) {
    const nowValues = toInsert.map((d) => ({
      id: randomUUID(),
      organizationId: orgId,
      name: d.name,
      position: d.position,
      color: d.color,
      type: d.type as unknown as any,
    }));
    await db.insert(table).values(nowValues as any[]);
  }
}

// Helper: ensure default priorities exist for org
async function ensurePriorityDefaults(
  orgId: string,
  defaults: PriorityPayload[],
) {
  const existingRows = await db
    .select({ weight: issuePriority.weight })
    .from(issuePriority)
    .where(eq(issuePriority.organizationId, orgId));

  const existingWeights = new Set<number>(existingRows.map((r) => r.weight));

  const toInsert = defaults.filter((d) => !existingWeights.has(d.weight));

  if (toInsert.length > 0) {
    const nowValues = toInsert.map((d) => ({
      id: randomUUID(),
      organizationId: orgId,
      name: d.name,
      weight: d.weight,
      color: d.color,
    }));
    await db.insert(issuePriority).values(nowValues);
  }
}

export class WorkflowService {
  /* -------------------------------------------------------------------------- */
  /*                             Issue State APIs                              */
  /* -------------------------------------------------------------------------- */
  static async listIssueStates(orgSlug: string) {
    // Ensure defaults exist first
    const orgRow = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);

    if (!orgRow[0]) return [] as const;

    await WorkflowService.ensureDefaultsForOrg(orgRow[0].id);

    return db
      .select({
        id: issueState.id,
        name: issueState.name,
        position: issueState.position,
        color: issueState.color,
        type: issueState.type,
      })
      .from(issueState)
      .where(eq(issueState.organizationId, orgRow[0].id))
      .orderBy(issueState.position);
  }

  static async createIssueState(orgSlug: string, data: StatePayload) {
    const org = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);

    if (!org[0]) throw new Error("Organization not found");

    const id = randomUUID();
    await db.insert(issueState).values({
      id,
      organizationId: org[0].id,
      name: data.name,
      position: data.position,
      color: data.color,
      type: data.type as any,
    });
    return { id } as const;
  }

  static async updateIssueState(
    stateId: string,
    orgId: string,
    data: Omit<StatePayload, "position"> & { position?: number },
  ) {
    // Ensure the state belongs to the organization first
    const rows = await db
      .select({ id: issueState.id })
      .from(issueState)
      .where(
        and(eq(issueState.id, stateId), eq(issueState.organizationId, orgId)),
      )
      .limit(1);

    if (!rows[0]) throw new Error("FORBIDDEN");

    await db
      .update(issueState)
      .set({
        ...(data.name ? { name: data.name } : {}),
        ...(data.color ? { color: data.color } : {}),
        ...(data.type ? { type: data.type as any } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
      })
      .where(eq(issueState.id, stateId));
  }

  /* -------------------------------------------------------------------------- */
  /*                            Project Status APIs                             */
  /* -------------------------------------------------------------------------- */

  static async listProjectStatuses(orgSlug: string) {
    const orgRow = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);

    if (!orgRow[0]) return [] as const;

    await WorkflowService.ensureDefaultsForOrg(orgRow[0].id);

    return db
      .select({
        id: projectStatus.id,
        name: projectStatus.name,
        position: projectStatus.position,
        color: projectStatus.color,
        type: projectStatus.type,
      })
      .from(projectStatus)
      .where(eq(projectStatus.organizationId, orgRow[0].id))
      .orderBy(projectStatus.position);
  }

  static async createProjectStatus(orgSlug: string, data: StatePayload) {
    const org = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);
    if (!org[0]) throw new Error("Organization not found");

    const id = randomUUID();
    await db.insert(projectStatus).values({
      id,
      organizationId: org[0].id,
      name: data.name,
      position: data.position,
      color: data.color,
      type: data.type as any,
    });

    return { id } as const;
  }

  static async updateProjectStatus(
    statusId: string,
    orgId: string,
    data: Omit<StatePayload, "position"> & { position?: number },
  ) {
    const rows = await db
      .select({ id: projectStatus.id })
      .from(projectStatus)
      .where(
        and(
          eq(projectStatus.id, statusId),
          eq(projectStatus.organizationId, orgId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new Error("FORBIDDEN");

    await db
      .update(projectStatus)
      .set({
        ...(data.name ? { name: data.name } : {}),
        ...(data.color ? { color: data.color } : {}),
        ...(data.type ? { type: data.type as any } : {}),
        ...(data.position !== undefined ? { position: data.position } : {}),
      })
      .where(eq(projectStatus.id, statusId));
  }

  /* -------------------------------------------------------------------------- */
  /*                             Issue Priority APIs                            */
  /* -------------------------------------------------------------------------- */

  static async listIssuePriorities(orgSlug: string) {
    // Ensure defaults exist first
    const orgRow = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);

    if (!orgRow[0]) return [] as const;

    await WorkflowService.ensureDefaultsForOrg(orgRow[0].id);

    return db
      .select({
        id: issuePriority.id,
        name: issuePriority.name,
        weight: issuePriority.weight,
        color: issuePriority.color,
      })
      .from(issuePriority)
      .where(eq(issuePriority.organizationId, orgRow[0].id))
      .orderBy(issuePriority.weight);
  }

  static async createIssuePriority(orgSlug: string, data: PriorityPayload) {
    const org = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);
    if (!org[0]) throw new Error("Organization not found");

    const id = randomUUID();
    await db.insert(issuePriority).values({
      id,
      organizationId: org[0].id,
      name: data.name,
      weight: data.weight,
      color: data.color,
    });
    return { id } as const;
  }

  static async updateIssuePriority(
    priorityId: string,
    orgId: string,
    data: Partial<PriorityPayload>,
  ) {
    const rows = await db
      .select({ id: issuePriority.id })
      .from(issuePriority)
      .where(
        and(
          eq(issuePriority.id, priorityId),
          eq(issuePriority.organizationId, orgId),
        ),
      )
      .limit(1);

    if (!rows[0]) throw new Error("FORBIDDEN");

    await db
      .update(issuePriority)
      .set({
        ...(data.name ? { name: data.name } : {}),
        ...(data.weight !== undefined ? { weight: data.weight } : {}),
        ...(data.color ? { color: data.color } : {}),
      })
      .where(eq(issuePriority.id, priorityId));
  }

  static async deleteIssuePriority(priorityId: string, orgId: string) {
    const rows = await db
      .select({ id: issuePriority.id })
      .from(issuePriority)
      .where(
        and(
          eq(issuePriority.id, priorityId),
          eq(issuePriority.organizationId, orgId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new Error("FORBIDDEN");

    // Prevent deletion if any issues reference this priority
    const usage = await db
      .select({ cnt: count() })
      .from(issue)
      .where(eq(issue.priorityId, priorityId));

    if (usage[0].cnt > 0) {
      throw new Error("Priority is in use by existing issues");
    }

    await db.delete(issuePriority).where(eq(issuePriority.id, priorityId));
  }

  static async resetIssuePriorities(orgSlug: string) {
    const org = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);
    if (!org[0]) throw new Error("Organization not found");
    await ensurePriorityDefaults(org[0].id, ISSUE_PRIORITY_DEFAULTS);
  }

  /* -------------------------------------------------------------------- */
  /*  Defaults / Reset                                                    */
  /* -------------------------------------------------------------------- */

  static async ensureDefaultsForOrg(orgId: string) {
    await ensureDefaults(issueState as any, orgId, ISSUE_STATE_DEFAULTS as any);
    await ensureDefaults(
      projectStatus as any,
      orgId,
      PROJECT_STATUS_DEFAULTS as any,
    );
    await ensurePriorityDefaults(orgId, ISSUE_PRIORITY_DEFAULTS);
  }

  static async resetIssueStates(orgSlug: string) {
    const org = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);
    if (!org[0]) throw new Error("Organization not found");
    await ensureDefaults(
      issueState as any,
      org[0].id,
      ISSUE_STATE_DEFAULTS as any,
    );
  }

  static async resetProjectStatuses(orgSlug: string) {
    const org = await db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.slug, orgSlug))
      .limit(1);
    if (!org[0]) throw new Error("Organization not found");
    await ensureDefaults(
      projectStatus as any,
      org[0].id,
      PROJECT_STATUS_DEFAULTS as any,
    );
  }

  /* -------------------------------------------------------------------- */
  /*  Deletion with safety checks                                         */
  /* -------------------------------------------------------------------- */

  static async deleteIssueState(stateId: string, orgId: string) {
    // Ensure belongs to org
    const rows = await db
      .select({ id: issueState.id })
      .from(issueState)
      .where(
        and(eq(issueState.id, stateId), eq(issueState.organizationId, orgId)),
      )
      .limit(1);
    if (!rows[0]) throw new Error("FORBIDDEN");

    // Check usage in issues
    const usage = await db
      .select({ cnt: count() })
      .from(issue)
      .innerJoin(projectTable, eq(issue.projectId, projectTable.id))
      .where(
        and(eq(issue.stateId, stateId), eq(projectTable.organizationId, orgId)),
      );

    if (usage[0].cnt > 0) {
      throw new Error("State is in use by existing issues");
    }

    await db.delete(issueState).where(eq(issueState.id, stateId));
  }

  static async deleteProjectStatus(statusId: string, orgId: string) {
    const rows = await db
      .select({ id: projectStatus.id })
      .from(projectStatus)
      .where(
        and(
          eq(projectStatus.id, statusId),
          eq(projectStatus.organizationId, orgId),
        ),
      )
      .limit(1);
    if (!rows[0]) throw new Error("FORBIDDEN");

    const usage = await db
      .select({ cnt: count() })
      .from(projectTable)
      .where(
        and(
          eq(projectTable.statusId, statusId),
          eq(projectTable.organizationId, orgId),
        ),
      );

    if (usage[0].cnt > 0) {
      throw new Error("Status is in use by existing projects");
    }

    await db.delete(projectStatus).where(eq(projectStatus.id, statusId));
  }
}
