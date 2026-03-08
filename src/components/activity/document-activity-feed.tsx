'use client';

import { useState } from 'react';
import { usePaginatedQuery } from 'convex/react';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { ActivityFeedList, type ActivityFeedItem } from './activity-feed-list';
import { ChevronDown, ChevronRight } from 'lucide-react';

export function DocumentActivityFeed({
  orgSlug,
  documentId,
}: {
  orgSlug: string;
  documentId: string;
}) {
  const [isOpen, setIsOpen] = useState(true);

  const { results, status, loadMore } = usePaginatedQuery(
    api.activities.queries.listDocumentActivity,
    {
      documentId: documentId as Id<'documents'>,
    },
    {
      initialNumItems: 5,
    },
  );

  return (
    <div>
      <button
        type='button'
        onClick={() => setIsOpen(v => !v)}
        className='text-muted-foreground hover:text-foreground mb-4 flex items-center gap-1 text-xs font-medium tracking-wider uppercase transition-colors'
      >
        {isOpen ? (
          <ChevronDown className='size-3.5' />
        ) : (
          <ChevronRight className='size-3.5' />
        )}
        Activity
      </button>

      {isOpen && (
        <ActivityFeedList
          items={results as ActivityFeedItem[]}
          orgSlug={orgSlug}
          status={status}
          loadMore={loadMore}
          emptyMessage='No activity yet for this document.'
          pageSize={5}
        />
      )}
    </div>
  );
}
