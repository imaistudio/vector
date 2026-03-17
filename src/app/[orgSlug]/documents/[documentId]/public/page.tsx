'use client';

import { use } from 'react';
import { PublicDocumentPage } from '@/components/views/public-document-page';

export default function PublicDocumentRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; documentId: string }>;
}) {
  const { orgSlug, documentId } = use(params);

  return <PublicDocumentPage orgSlug={orgSlug} documentId={documentId} />;
}
