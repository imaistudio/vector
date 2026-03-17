'use client';

import { use } from 'react';
import { PublicTeamPage } from '@/components/views/public-team-page';

export default function PublicTeamRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; teamKey: string }>;
}) {
  const { orgSlug, teamKey } = use(params);
  return <PublicTeamPage orgSlug={orgSlug} teamKey={teamKey} />;
}
