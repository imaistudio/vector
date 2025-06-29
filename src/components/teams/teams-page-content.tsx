"use client";

import { trpc } from "@/lib/trpc";
import { CreateTeamButton, TeamsTable } from "@/components/teams";

interface TeamsPageContentProps {
  orgSlug: string;
  isAdminOrOwner: boolean;
  orgName: string;
}

export function TeamsPageContent({
  orgSlug,
  isAdminOrOwner,
  orgName,
}: TeamsPageContentProps) {
  const { data: teams = [], isLoading } = trpc.organization.listTeams.useQuery({
    orgSlug,
  });

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Teams</h1>
          <p className="text-muted-foreground text-sm">
            Manage teams and members in {orgName}
          </p>
        </div>

        {isAdminOrOwner && <CreateTeamButton orgSlug={orgSlug} />}
      </div>

      {/* Teams Table */}
      {isLoading ? (
        <div className="rounded-lg border p-8 text-center">
          <div className="text-muted-foreground">Loading teams...</div>
        </div>
      ) : (
        <TeamsTable orgSlug={orgSlug} teams={teams} />
      )}

      {/* Empty state with create button */}
      {!isLoading && teams.length === 0 && isAdminOrOwner && (
        <div className="mt-4 flex justify-center">
          <CreateTeamButton orgSlug={orgSlug} />
        </div>
      )}
    </div>
  );
}
