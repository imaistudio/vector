'use client';

import { use } from 'react';
import { PublicIssuePage } from '@/components/views/public-issue-page';

export default function PublicIssueRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; issueKey: string }>;
}) {
  const { orgSlug, issueKey } = use(params);
  return <PublicIssuePage orgSlug={orgSlug} issueKey={issueKey} />;
}
