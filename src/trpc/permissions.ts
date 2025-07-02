import { TRPCError } from "@trpc/server";
import { db } from "@/db";
import {
  projectMember as projectMemberTable,
  issue as issueTable,
  issueAssignee as assignmentTable,
  team as teamTable,
  project as projectTable,
} from "@/db/schema";
import { eq, and } from "drizzle-orm";
import type { Context, ProtectedContext } from "@/trpc/init";
import { PERMISSIONS, type Permission } from "@/auth/permission-constants";
import { hasPermission } from "@/auth/permissions";

/**
 * Throws UNAUTHORIZED if the requester is not logged in.
 * @deprecated Use protectedProcedure instead which automatically ensures authentication
 */
export function assertAuthenticated(ctx: Context): asserts ctx is Context & {
  session: { user: { id: string; role: string } };
} {
  if (!ctx.session) throw new TRPCError({ code: "UNAUTHORIZED" });
}

export function assertAdmin(ctx: ProtectedContext) {
  if (ctx.session.user.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin role required" });
  }
}

export async function assertProjectLeadOrAdmin(
  ctx: ProtectedContext,
  projectId: string,
) {
  if (ctx.session.user.role === "admin") return;

  const rows = await db
    .select({ role: projectMemberTable.role })
    .from(projectMemberTable)
    .where(
      and(
        eq(projectMemberTable.projectId, projectId),
        eq(projectMemberTable.userId, ctx.session.user.id),
      ),
    )
    .limit(1);

  if (rows.length === 0 || rows[0].role !== "lead") {
    throw new TRPCError({ code: "FORBIDDEN", message: "Lead role required" });
  }
}

export async function assertAssigneeOrLeadOrAdmin(
  ctx: ProtectedContext,
  issueId: string,
) {
  if (ctx.session.user.role === "admin") return;

  // Check if user is assignee on this issue via assignment table
  const assignmentRows = await db
    .select({ id: assignmentTable.id })
    .from(assignmentTable)
    .where(
      and(
        eq(assignmentTable.issueId, issueId),
        eq(assignmentTable.assigneeId, ctx.session.user.id),
      ),
    )
    .limit(1);

  if (assignmentRows.length > 0) return; // is assignee

  // Fall back to lead/admin via project membership
  const issueRows = await db
    .select({ projectId: issueTable.projectId })
    .from(issueTable)
    .where(eq(issueTable.id, issueId))
    .limit(1);

  if (issueRows.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const projectId = issueRows[0].projectId;
  if (projectId) {
    await assertProjectLeadOrAdmin(ctx, projectId);
    return;
  }

  throw new TRPCError({ code: "FORBIDDEN" });
}

// -----------------------------------------------------------------------------
//  Assignment-level permission check
// -----------------------------------------------------------------------------

/**
 * Ensures the requester can modify a specific assignment.
 *
 * Rules:
 * 1. Admins always allowed.
 * 2. User can always modify their _own_ assignment row.
 * 3. Otherwise, the user must possess the ASSIGNMENT_MANAGE permission in the organization.
 */
export async function assertCanManageAssignment(
  ctx: ProtectedContext,
  assignmentId: string,
): Promise<void> {
  const userId = ctx.session.user.id;

  // Admin shortcut
  if (ctx.session.user.role === "admin") return;

  // Fetch assignment details (issue + assignee)
  const assignmentRows = await db
    .select({
      issueId: assignmentTable.issueId,
      assigneeId: assignmentTable.assigneeId,
    })
    .from(assignmentTable)
    .where(eq(assignmentTable.id, assignmentId))
    .limit(1);

  if (assignmentRows.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const { issueId, assigneeId } = assignmentRows[0];

  // Self-assignment modification allowed
  if (assigneeId === userId) return;

  // Resolve organization ID via issue table
  const issueRows = await db
    .select({ organizationId: issueTable.organizationId })
    .from(issueTable)
    .where(eq(issueTable.id, issueId))
    .limit(1);

  if (issueRows.length === 0) {
    throw new TRPCError({ code: "NOT_FOUND" });
  }

  const orgId = issueRows[0].organizationId;

  const allowed = await hasPermission(
    userId,
    orgId,
    PERMISSIONS.ASSIGNMENT_MANAGE,
  );

  if (!allowed) {
    throw new TRPCError({ code: "FORBIDDEN" });
  }
}

// -----------------------------------------------------------------------------
//  Team-level permission check
// -----------------------------------------------------------------------------

export async function assertTeamLeadOrPermission(
  ctx: ProtectedContext,
  teamId: string,
  permission: Permission,
): Promise<void> {
  if (ctx.session.user.role === "admin") return;

  // Check lead
  const teamRow = await db
    .select({ leadId: teamTable.leadId, orgId: teamTable.organizationId })
    .from(teamTable)
    .where(eq(teamTable.id, teamId))
    .limit(1);

  if (teamRow.length === 0) throw new TRPCError({ code: "NOT_FOUND" });

  if (teamRow[0].leadId === ctx.session.user.id) return;

  // Fallback to explicit permission
  const allowed = await hasPermission(
    ctx.session.user.id,
    teamRow[0].orgId,
    permission,
  );

  if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });
}

export async function assertProjectLeadOrPermission(
  ctx: ProtectedContext,
  projectId: string,
  permission: Permission,
): Promise<void> {
  if (ctx.session.user.role === "admin") return;

  // Check lead
  const projRows = await db
    .select({ leadId: projectTable.leadId, orgId: projectTable.organizationId })
    .from(projectTable)
    .where(eq(projectTable.id, projectId))
    .limit(1);

  if (projRows.length === 0) throw new TRPCError({ code: "NOT_FOUND" });

  if (projRows[0].leadId === ctx.session.user.id) return;

  const allowed = await hasPermission(
    ctx.session.user.id,
    projRows[0].orgId,
    permission,
  );

  if (!allowed) throw new TRPCError({ code: "FORBIDDEN" });
}
