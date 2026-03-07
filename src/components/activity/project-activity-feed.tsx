'use client';

import { usePaginatedQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ActivityFeedList, type ActivityFeedItem } from './activity-feed-list';

export function ProjectActivityFeed({
  orgSlug,
  projectId,
}: {
  orgSlug: string;
  projectId: string;
}) {
  const { results, status, loadMore } = usePaginatedQuery(
    api.activities.queries.listProjectActivity,
    {
      projectId: projectId as Id<'projects'>,
    },
    {
      initialNumItems: 20,
    },
  );

  return (
    <ActivityFeedList
      items={results as ActivityFeedItem[]}
      orgSlug={orgSlug}
      status={status}
      loadMore={loadMore}
      emptyMessage='No activity yet.'
    />
  );
}
