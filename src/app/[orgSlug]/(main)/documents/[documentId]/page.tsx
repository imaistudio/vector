import type { Metadata } from 'next';
import { getConvexClient } from '@/lib/convex-server';
import { api } from '@/convex/_generated/api';
import DocumentViewClient from './document-view-client';

interface DocumentViewPageProps {
  params: Promise<{ orgSlug: string; documentId: string }>;
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
      return { title: 'Document — Vector' };
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
    return { title: 'Document — Vector' };
  }
}

export default async function DocumentViewPage({
  params,
}: DocumentViewPageProps) {
  return <DocumentViewClient params={params} />;
}
