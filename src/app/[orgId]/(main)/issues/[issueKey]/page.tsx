import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { findIssueByKey } from "@/entities/issues/issue.service";

interface IssueViewPageProps {
  params: Promise<{ orgId: string; issueKey: string }>;
}

export default async function IssueViewPage({ params }: IssueViewPageProps) {
  const { orgId, issueKey } = await params;

  const issue = await findIssueByKey(orgId, issueKey);

  if (!issue) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{issue.title}</h1>
          <p className="text-muted-foreground text-sm">Issue {issueKey}</p>
        </div>
        <div className="flex items-center gap-2">
          {issue.stateId && (
            <Badge variant="outline">State ID: {issue.stateId}</Badge>
          )}
          {issue.priorityId && (
            <Badge variant="outline">Priority ID: {issue.priorityId}</Badge>
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
              {issue.description || "No description provided."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Assignee
              </h3>
              <p className="mt-1 text-sm">{issue.assigneeId || "Unassigned"}</p>
            </div>
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Reporter
              </h3>
              <p className="mt-1 text-sm">{issue.reporterId || "Unknown"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Created
              </h3>
              <p className="mt-1 text-sm">
                {new Date(issue.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Updated
              </h3>
              <p className="mt-1 text-sm">
                {new Date(issue.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>

          {issue.dueDate && (
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Due Date
              </h3>
              <p className="mt-1 text-sm">
                {new Date(issue.dueDate).toLocaleDateString()}
              </p>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
