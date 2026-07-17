'use client';

import { memo } from 'react';
import { Streamdown } from 'streamdown';
import { cn } from '@/lib/utils';

export const MarkdownContent = memo(function MarkdownContent({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <Streamdown
      mode='static'
      controls={false}
      lineNumbers={false}
      className={cn(
        'prose prose-sm dark:prose-invert max-w-none text-xs break-words',
        'prose-p:my-2 prose-p:leading-5',
        'prose-ul:my-2 prose-ol:my-2 prose-ul:pl-5 prose-ol:pl-5',
        'prose-li:my-0.5 prose-li:leading-5',
        'prose-headings:mt-4 prose-headings:mb-2 prose-headings:leading-tight',
        'prose-h1:text-base prose-h1:font-semibold',
        'prose-h2:text-sm prose-h2:font-semibold',
        'prose-h3:text-xs prose-h3:font-semibold',
        'prose-a:text-foreground prose-a:underline prose-a:underline-offset-4',
        'prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-[0.85em]',
        'prose-code:before:content-none prose-code:after:content-none',
        'prose-pre:my-2 prose-pre:max-w-full prose-pre:overflow-x-auto prose-pre:rounded-md prose-pre:border prose-pre:border-border prose-pre:bg-muted/45 prose-pre:px-3 prose-pre:py-2 prose-pre:text-foreground prose-pre:shadow-none',
        'prose-blockquote:my-2 prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-3 prose-blockquote:text-muted-foreground',
        '[&_table]:my-2 [&_table]:block [&_table]:w-full [&_table]:max-w-full [&_table]:border-collapse [&_table]:overflow-x-auto',
        '[&_th]:border-border [&_th]:bg-muted/40 [&_th]:border [&_th]:px-2 [&_th]:py-1 [&_th]:text-left [&_th]:text-[11px] [&_th]:whitespace-nowrap',
        '[&_td]:border-border [&_td]:border [&_td]:px-2 [&_td]:py-1 [&_td]:align-top [&_td]:text-[11px]',
        '[&_img]:h-auto [&_img]:max-w-full [&_img]:rounded-md [&_img]:border',
        '[&_input[type=checkbox]]:mr-1.5',
        '[&>*:first-child]:mt-0 [&>*:last-child]:mb-0',
        className,
      )}
    >
      {children}
    </Streamdown>
  );
});
