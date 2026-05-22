'use client';

import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';

export function AgentMarkdown({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none leading-relaxed',
        className,
      )}
    >
      <ReactMarkdown>{children}</ReactMarkdown>
    </div>
  );
}
