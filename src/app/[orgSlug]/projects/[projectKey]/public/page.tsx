'use client';

import { use } from 'react';
import { PublicProjectPage } from '@/components/views/public-project-page';

export default function PublicProjectRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; projectKey: string }>;
}) {
  const { orgSlug, projectKey } = use(params);
  return <PublicProjectPage orgSlug={orgSlug} projectKey={projectKey} />;
}
