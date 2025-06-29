import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { findProjectByKey } from "@/entities/projects/project.service";

interface ProjectViewPageProps {
  params: Promise<{ orgId: string; projectKey: string }>;
}

export default async function ProjectViewPage({
  params,
}: ProjectViewPageProps) {
  const { orgId, projectKey } = await params;

  const project = await findProjectByKey(orgId, projectKey);

  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{project.name}</h1>
          <p className="text-muted-foreground text-sm">Project {projectKey}</p>
        </div>
        <div className="flex items-center gap-2">
          {project.statusId && (
            <Badge variant="outline">Status ID: {project.statusId}</Badge>
          )}
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-muted-foreground text-sm font-medium">
              Description
            </h3>
            <p className="mt-1 text-sm">
              {project.description || "No description provided."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Lead
              </h3>
              <p className="mt-1 text-sm">
                {project.leadId || "No lead assigned"}
              </p>
            </div>
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Team
              </h3>
              <p className="mt-1 text-sm">
                {project.teamId || "No team assigned"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Start Date
              </h3>
              <p className="mt-1 text-sm">
                {project.startDate
                  ? new Date(project.startDate).toLocaleDateString()
                  : "Not set"}
              </p>
            </div>
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Due Date
              </h3>
              <p className="mt-1 text-sm">
                {project.dueDate
                  ? new Date(project.dueDate).toLocaleDateString()
                  : "Not set"}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Created
              </h3>
              <p className="mt-1 text-sm">
                {new Date(project.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Updated
              </h3>
              <p className="mt-1 text-sm">
                {new Date(project.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
