import { createTRPCRouter, protectedProcedure, getUserId } from "@/trpc/init";
import {
  createProject,
  updateProject,
  addMember as addProjectMember,
  removeMember as removeProjectMember,
  findProjectByKey,
} from "@/entities/projects/project.service";
import { OrganizationService } from "@/entities/organizations/organization.service";
import { z } from "zod";
import { assertAdmin, assertProjectLeadOrAdmin } from "@/trpc/permissions";
import { eq } from "drizzle-orm";
import {
  project as projectTable,
  projectMember as projectMemberTable,
} from "@/db/schema";
import { TRPCError } from "@trpc/server";

export const projectRouter = createTRPCRouter({
  getByKey: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        projectKey: z.string(),
      }),
    )
    .query(async ({ input }) => {
      const project = await findProjectByKey(input.orgSlug, input.projectKey);
      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }
      return project;
    }),

  create: protectedProcedure
    .input(
      z.object({
        orgSlug: z.string(),
        key: z.string().min(1).max(50),
        teamId: z.string().uuid().optional(),
        name: z.string().min(1),
        description: z.string().optional(),
        leadId: z.string().optional(),
        startDate: z.string().optional(), // ISO
        dueDate: z.string().optional(),
        statusId: z.string().uuid().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = getUserId(ctx);

      // Verify user access and get organization details
      const membership = await OrganizationService.verifyUserOrganizationAccess(
        userId,
        input.orgSlug,
      );
      if (!membership) {
        throw new Error("FORBIDDEN");
      }

      const { id } = await createProject({
        organizationId: membership.organizationId,
        key: input.key,
        teamId: input.teamId || null,
        name: input.name,
        description: input.description,
        leadId: input.leadId,
        startDate: input.startDate,
        dueDate: input.dueDate,
        statusId: input.statusId,
      });
      return { id } as const;
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        data: z.object({
          name: z.string().optional(),
          description: z.string().optional(),
          leadId: z.string().optional(),
          startDate: z.string().optional(),
          dueDate: z.string().optional(),
          statusId: z.string().uuid().optional(),
        }),
      }),
    )
    .use(({ ctx, next, input }) => {
      return assertProjectLeadOrAdmin(ctx, input.id).then(() => next());
    })
    .mutation(async ({ input }) => {
      await updateProject({ id: input.id, data: input.data });
    }),

  addMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string(),
        role: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      await addProjectMember(input.projectId, input.userId, input.role);
    }),

  removeMember: protectedProcedure
    .input(
      z.object({
        projectId: z.string().uuid(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ input }) => {
      await removeProjectMember(input.projectId, input.userId);
    }),

  listMine: protectedProcedure.query(async ({ ctx }) => {
    const userId = getUserId(ctx);
    const projects = await ctx.db
      .select({ id: projectTable.id, name: projectTable.name })
      .from(projectTable)
      .leftJoin(
        projectMemberTable,
        eq(projectMemberTable.projectId, projectTable.id),
      )
      .where(eq(projectMemberTable.userId, userId));
    return projects;
  }),
});
