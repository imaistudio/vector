import type { Metadata } from 'next';
import { getConvexClient } from '@/lib/convex-server';
import { api } from '@/convex/_generated/api';
import IssueViewClient from './issue-view-client';

interface IssueViewPageProps {
  params: Promise<{ orgSlug: string; issueKey: string }>;
}

export async function generateMetadata({
  params,
}: IssueViewPageProps): Promise<Metadata> {
  const { orgSlug, issueKey } = await params;

  try {
    const client = getConvexClient();
    const data = await client.query(api.og.queries.getPublicIssue, {
      orgSlug,
      issueKey,
    });

    if (!data) {
      return { title: `${issueKey} — Vector` };
    }

    const description = [
      data.state?.name,
      data.priority?.name,
      data.project?.name,
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      title: `${data.key} ${data.title} — ${data.orgName}`,
      description: description || `Issue ${data.key} on Vector`,
      openGraph: {
        title: `${data.key} ${data.title}`,
        description: description || `Issue ${data.key} on Vector`,
        siteName: 'Vector',
      },
      twitter: {
        card: 'summary_large_image',
        title: `${data.key} ${data.title}`,
        description: description || `Issue ${data.key} on Vector`,
      },
    };
  } catch {
    return { title: `${issueKey} — Vector` };
  }
}

export default async function IssueViewPage({ params }: IssueViewPageProps) {
  return <IssueViewClient params={params} />;
}
