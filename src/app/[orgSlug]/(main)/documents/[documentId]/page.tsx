import type { Metadata } from 'next';
import { getConvexClient } from '@/lib/convex-server';
import { fetchAuthQuery } from '@/lib/auth-server';
import { api } from '@/convex/_generated/api';
import DocumentViewClient from './document-view-client';
import type { Id } from '@/convex/_generated/dataModel';
import type { FunctionReturnType } from 'convex/server';

interface DocumentViewPageProps {
  params: Promise<{ orgSlug: string; documentId: string }>;
}

function unavailableDocumentMetadata(orgSlug?: string): Metadata {
  const title = 'Document — Vector';
  const description = 'This document is private or unavailable on Vector.';
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
}: DocumentViewPageProps): Promise<Metadata> {
  const { orgSlug, documentId } = await params;

  try {
    const client = getConvexClient();
    const data = await client.query(api.og.queries.getPublicDocument, {
      orgSlug,
      documentId,
    });

    if (!data) {
      return unavailableDocumentMetadata(orgSlug);
    }

    const description = data.author
      ? `${data.title} by ${data.author.name}`
      : data.title;

    return {
      title: `${data.title} — ${data.orgName}`,
      description,
      openGraph: {
        title: data.title,
        description,
        siteName: 'Vector',
      },
      twitter: {
        card: 'summary_large_image',
        title: data.title,
        description,
      },
    };
  } catch {
    return unavailableDocumentMetadata(orgSlug);
  }
}

export default async function DocumentViewPage({
  params,
}: DocumentViewPageProps) {
  const p = await params;
  let initialDocument: FunctionReturnType<
    typeof api.documents.queries.getById
  > = null;
  let initialTeams: FunctionReturnType<
    typeof api.organizations.queries.listTeams
  > = [];

  try {
    const [document, workspaceOptions] = await Promise.all([
      fetchAuthQuery(api.documents.queries.getById, {
        documentId: p.documentId as Id<'documents'>,
      }),
      fetchAuthQuery(api.organizations.queries.getWorkspaceOptions, {
        orgSlug: p.orgSlug,
      }),
    ]);
    initialDocument = document;
    initialTeams = workspaceOptions.teams;
  } catch {
    initialDocument = null;
    initialTeams = [];
  }

  return (
    <DocumentViewClient
      params={{ orgSlug: p.orgSlug, documentId: p.documentId }}
      initialDocument={initialDocument}
      initialTeams={initialTeams}
    />
  );
}
