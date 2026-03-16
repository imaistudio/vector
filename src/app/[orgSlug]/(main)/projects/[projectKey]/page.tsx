import type { Metadata } from 'next';
import { getConvexClient } from '@/lib/convex-server';
import { api } from '@/convex/_generated/api';
import ProjectViewClient from './project-view-client';

interface ProjectViewPageProps {
  params: Promise<{ orgSlug: string; projectKey: string }>;
}

export async function generateMetadata({
  params,
}: ProjectViewPageProps): Promise<Metadata> {
  const { orgSlug, projectKey } = await params;

  try {
    const client = getConvexClient();
    const data = await client.query(api.og.queries.getPublicProject, {
      orgSlug,
      projectKey,
    });

    if (!data) {
      return { title: `${projectKey} — Vector` };
    }

    const description =
      data.description ??
      `Project ${data.name} · ${data.issueCount} issue${data.issueCount !== 1 ? 's' : ''}`;

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
    return { title: `${projectKey} — Vector` };
  }
}

export default async function ProjectViewPage({
  params,
}: ProjectViewPageProps) {
  const p = await params;
  return (
    <ProjectViewClient
      params={{ orgSlug: p.orgSlug, projectKey: p.projectKey }}
    />
  );
}
