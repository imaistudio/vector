'use client';

import { cn } from '@/lib/utils';
import { Editor } from '@/components/ui/editor';

interface RichEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  mode?: 'full' | 'compact';
  /** Remove all borders, shadows, and padding for a clean inline look */
  borderless?: boolean;
  /** Pass orgSlug to enable @mentions */
  orgSlug?: string;
  className?: string;
}

export function RichEditor({
  value,
  onChange,
  disabled = false,
  mode = 'compact',
  borderless = false,
  orgSlug,
  className,
}: RichEditorProps) {
  const isBorderless = borderless || className?.includes('notion-editor');

  return (
    <Editor
      value={value}
      onChange={onChange}
      format='markdown'
      disabled={disabled}
      enableImages={mode === 'full'}
      enableImagePasteDrop={mode === 'full'}
      orgSlug={orgSlug}
      className={cn(className?.replace('notion-editor', '').trim())}
      editorClassName={cn(
        'prose prose-sm dark:prose-invert max-w-none',
        disabled
          ? 'border-none shadow-none p-0 min-h-0 bg-transparent dark:bg-transparent'
          : isBorderless
            ? 'border-none shadow-none ring-0 focus-visible:ring-0 focus-visible:border-none p-0 min-h-[60vh] bg-transparent dark:bg-transparent'
            : mode === 'compact'
              ? 'min-h-[100px]'
              : 'min-h-[300px]',
      )}
    />
  );
}
