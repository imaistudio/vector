import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { notFound } from "next/navigation";
import { findTeamByKey } from "@/entities/teams/team.service";

interface TeamViewPageProps {
  params: Promise<{ orgId: string; teamKey: string }>;
}

export default async function TeamViewPage({ params }: TeamViewPageProps) {
  const { orgId, teamKey } = await params;

  const team = await findTeamByKey(orgId, teamKey);

  if (!team) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{team.name}</h1>
          <p className="text-muted-foreground text-sm">Team {teamKey}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Key: {team.key}</Badge>
        </div>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <h3 className="text-muted-foreground text-sm font-medium">
              Description
            </h3>
            <p className="mt-1 text-sm">
              {team.description || "No description provided."}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Lead
              </h3>
              <p className="mt-1 text-sm">
                {team.leadId || "No lead assigned"}
              </p>
            </div>
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Organization
              </h3>
              <p className="mt-1 text-sm">{team.organizationId}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Created
              </h3>
              <p className="mt-1 text-sm">
                {new Date(team.createdAt).toLocaleDateString()}
              </p>
            </div>
            <div>
              <h3 className="text-muted-foreground text-sm font-medium">
                Updated
              </h3>
              <p className="mt-1 text-sm">
                {new Date(team.updatedAt).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
