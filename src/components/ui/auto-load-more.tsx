'use client';

import { useEffect, useRef } from 'react';
import { BarsSpinner } from '@/components/bars-spinner';
import { cn } from '@/lib/utils';

type PaginatedStatus =
  | 'LoadingFirstPage'
  | 'LoadingMore'
  | 'CanLoadMore'
  | 'Exhausted';

interface AutoLoadMoreProps {
  status: PaginatedStatus;
  loadMore: (numItems: number) => void;
  pageSize?: number;
  className?: string;
}

export function AutoLoadMore({
  status,
  loadMore,
  pageSize = 20,
  className,
}: AutoLoadMoreProps) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status !== 'CanLoadMore') return;

    const node = sentinelRef.current;
    if (!node) return;

    let requested = false;
    const observer = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting) || requested) return;
        requested = true;
        loadMore(pageSize);
      },
      { rootMargin: '240px 0px' },
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [status, loadMore, pageSize]);

  if (status !== 'CanLoadMore' && status !== 'LoadingMore') {
    return null;
  }

  return (
    <div
      ref={sentinelRef}
      className={cn(
        'border-t px-3 py-3',
        status === 'LoadingMore'
          ? 'flex items-center justify-center'
          : 'pointer-events-none',
        className,
      )}
      aria-hidden='true'
    >
      {status === 'LoadingMore' ? (
        <BarsSpinner />
      ) : (
        <div className='h-4 w-full' />
      )}
    </div>
  );
}
