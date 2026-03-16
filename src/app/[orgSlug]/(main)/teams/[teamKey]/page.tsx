import type { Metadata } from 'next';
import { getConvexClient } from '@/lib/convex-server';
import { api } from '@/convex/_generated/api';
import TeamViewClient from './team-view-client';

interface TeamViewPageProps {
  params: Promise<{ orgSlug: string; teamKey: string }>;
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
      return { title: `${teamKey} — Vector` };
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
    return { title: `${teamKey} — Vector` };
  }
}

export default async function TeamViewPage(_props: TeamViewPageProps) {
  return <TeamViewClient />;
}
