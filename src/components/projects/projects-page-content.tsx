"use client";

import { trpc } from "@/lib/trpc";
import { CreateProjectButton, ProjectsTable } from "@/components/projects";

interface ProjectsPageContentProps {
  orgSlug: string;
  isAdminOrOwner: boolean;
  orgName: string;
}

export function ProjectsPageContent({
  orgSlug,
  isAdminOrOwner,
  orgName,
}: ProjectsPageContentProps) {
  const { data: projects = [], isLoading } =
    trpc.organization.listProjects.useQuery({
      orgSlug,
    });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-muted-foreground text-sm">
            Manage projects and workflows in {orgName}
          </p>
        </div>

        {isAdminOrOwner && <CreateProjectButton orgSlug={orgSlug} />}
      </div>

      {/* Projects Table */}
      {isLoading ? (
        <div className="rounded-lg border p-8 text-center">
          <div className="text-muted-foreground">Loading projects...</div>
        </div>
      ) : (
        <ProjectsTable orgSlug={orgSlug} projects={projects} />
      )}

      {/* Empty state with create button */}
      {!isLoading && projects.length === 0 && isAdminOrOwner && (
        <div className="mt-4 flex justify-center">
          <CreateProjectButton orgSlug={orgSlug}>
            Create Your First Project
          </CreateProjectButton>
        </div>
      )}
    </div>
  );
}
