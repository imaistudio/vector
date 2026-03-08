'use client';

import { usePaginatedQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ActivityFeedList, type ActivityFeedItem } from './activity-feed-list';

export function TeamActivityFeed({
  orgSlug,
  teamId,
}: {
  orgSlug: string;
  teamId: string;
}) {
  const pageSize = 5;

  const { results, status, loadMore } = usePaginatedQuery(
    api.activities.queries.listTeamActivity,
    {
      teamId: teamId as Id<'teams'>,
    },
    {
      initialNumItems: pageSize,
    },
  );

  return (
    <ActivityFeedList
      items={results as ActivityFeedItem[]}
      orgSlug={orgSlug}
      status={status}
      loadMore={loadMore}
      emptyMessage='No activity yet.'
      pageSize={pageSize}
    />
  );
}
