import type { Metadata } from 'next';
import { getConvexClient } from '@/lib/convex-server';
import { fetchAuthQuery } from '@/lib/auth-server';
import { api } from '@/convex/_generated/api';
import IssueViewClient from './issue-view-client';
import type { FunctionReturnType } from 'convex/server';

interface IssueViewPageProps {
  params: Promise<{ orgSlug: string; issueKey: string }>;
}

function unavailableIssueMetadata(
  issueKey: string,
  orgSlug?: string,
): Metadata {
  const title = `${issueKey} — Vector`;
  const description = 'This issue is private or unavailable on Vector.';
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
}: IssueViewPageProps): Promise<Metadata> {
  const { orgSlug, issueKey } = await params;

  try {
    const client = getConvexClient();
    const data = await client.query(api.og.queries.getPublicIssue, {
      orgSlug,
      issueKey,
    });

    if (!data) {
      return unavailableIssueMetadata(issueKey, orgSlug);
    }

    if (!data.title) {
      const title = `${data.key} — ${data.orgName}`;
      const description = 'This issue is private. Sign in to view it.';

      return {
        title,
        description,
        openGraph: {
          title: data.key,
          description,
          siteName: 'Vector',
        },
        twitter: {
          card: 'summary_large_image',
          title: data.key,
          description,
        },
      };
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
    return unavailableIssueMetadata(issueKey, orgSlug);
  }
}

export default async function IssueViewPage({ params }: IssueViewPageProps) {
  const p = await params;
  let initialIssue: FunctionReturnType<typeof api.issues.queries.getByKey> =
    null;
  let initialWorkspaceOptions: FunctionReturnType<
    typeof api.organizations.queries.getWorkspaceOptions
  > | null = null;

  try {
    [initialIssue, initialWorkspaceOptions] = await Promise.all([
      fetchAuthQuery(api.issues.queries.getByKey, {
        orgSlug: p.orgSlug,
        issueKey: p.issueKey,
      }),
      fetchAuthQuery(api.organizations.queries.getWorkspaceOptions, {
        orgSlug: p.orgSlug,
      }),
    ]);
  } catch {
    initialIssue = null;
    initialWorkspaceOptions = null;
  }

  return (
    <IssueViewClient
      params={{ orgSlug: p.orgSlug, issueKey: p.issueKey }}
      initialIssue={initialIssue}
      initialWorkspaceOptions={initialWorkspaceOptions}
    />
  );
}
