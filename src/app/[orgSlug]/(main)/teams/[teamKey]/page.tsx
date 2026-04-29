import type { Metadata } from 'next';
import { getConvexClient } from '@/lib/convex-server';
import { fetchAuthQuery } from '@/lib/auth-server';
import { api } from '@/convex/_generated/api';
import TeamViewClient from './team-view-client';
import type { FunctionReturnType } from 'convex/server';

interface TeamViewPageProps {
  params: Promise<{ orgSlug: string; teamKey: string }>;
}

function unavailableTeamMetadata(teamKey: string, orgSlug?: string): Metadata {
  const title = `${teamKey} — Vector`;
  const description = 'This team is private or unavailable on Vector.';
  const siteName = orgSlug ? `${orgSlug} on Vector` : 'Vector';

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      siteName,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export async function generateMetadata({
  params,
}: TeamViewPageProps): Promise<Metadata> {
  const { orgSlug, teamKey } = await params;

  try {
    const client = getConvexClient();
    const data = await client.query(api.og.queries.getPublicTeam, {
      orgSlug,
      teamKey,
    });

    if (!data) {
      return unavailableTeamMetadata(teamKey, orgSlug);
    }

    const description =
      data.description ??
      `Team ${data.name} · ${data.memberCount} member${data.memberCount !== 1 ? 's' : ''}`;

    return {
      title: `${data.name} — ${data.orgName}`,
      description,
      openGraph: {
        title: data.name,
        description,
        siteName: 'Vector',
      },
      twitter: {
        card: 'summary_large_image',
        title: data.name,
        description,
      },
    };
  } catch {
    return unavailableTeamMetadata(teamKey, orgSlug);
  }
}

export default async function TeamViewPage({ params }: TeamViewPageProps) {
  const p = await params;
  let initialData: {
    team: FunctionReturnType<typeof api.teams.queries.getByKey>;
    teamIssues: FunctionReturnType<typeof api.issues.queries.listIssues>;
    workspaceOptions: FunctionReturnType<
      typeof api.organizations.queries.getWorkspaceOptions
    > | null;
  } | null = null;

  try {
    const [team, workspaceOptions] = await Promise.all([
      fetchAuthQuery(api.teams.queries.getByKey, {
        orgSlug: p.orgSlug,
        teamKey: p.teamKey,
      }),
      fetchAuthQuery(api.organizations.queries.getWorkspaceOptions, {
        orgSlug: p.orgSlug,
      }),
    ]);

    const teamIssues = team?._id
      ? await fetchAuthQuery(api.issues.queries.listIssues, {
          orgSlug: p.orgSlug,
          teamId: team._id,
        })
      : {
          issues: [],
          total: 0,
          counts: {},
        };

    initialData = {
      team,
      teamIssues,
      workspaceOptions,
    };
  } catch {
    initialData = null;
  }

  return (
    <TeamViewClient
      params={{ orgSlug: p.orgSlug, teamKey: p.teamKey }}
      initialData={initialData}
    />
  );
}
