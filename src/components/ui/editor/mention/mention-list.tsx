import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { Ban, Loader2, Search } from 'lucide-react';
import { TYPE_ICONS, TYPE_LABELS, type MentionTypeId } from './mention-config';

export type MentionItemType = MentionTypeId;

export type MentionItem = {
  id: string;
  label: string;
  type: MentionItemType;
  href: string;
  subtitle?: string;
  /** User email — used as avatar seed for user mentions */
  email?: string;
  /** Lucide icon name for teams/projects */
  icon?: string;
  /** Icon color hex for teams/projects */
  color?: string;
};

type MentionListProps = {
  items: MentionItem[];
  command: (item: MentionItem) => void;
  isLoading?: boolean;
  /** Whether the user has typed a search query */
  hasQuery?: boolean;
};

export type MentionListHandle = {
  onKeyDown: (event: KeyboardEvent) => boolean;
};

const typeIcons = TYPE_ICONS;
const typeLabels = TYPE_LABELS;

const MentionList = forwardRef<MentionListHandle, MentionListProps>(
  ({ items, command, isLoading, hasQuery }, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = (index: number) => {
      const item = items[index];
      if (item) command(item);
    };

    useImperativeHandle(ref, () => ({
      onKeyDown: (event: KeyboardEvent) => {
        if (!items.length) return false;

        if (event.key === 'ArrowUp') {
          event.preventDefault();
          setSelectedIndex(c => (c + items.length - 1) % items.length);
          return true;
        }

        if (event.key === 'ArrowDown') {
          event.preventDefault();
          setSelectedIndex(c => (c + 1) % items.length);
          return true;
        }

        if (event.key === 'Enter') {
          event.preventDefault();
          selectItem(selectedIndex);
          return true;
        }

        return false;
      },
    }));

    // Group items by type
    const grouped: { type: MentionItemType; items: MentionItem[] }[] = [];
    const seen = new Set<MentionItemType>();
    for (const item of items) {
      if (!seen.has(item.type)) {
        seen.add(item.type);
        grouped.push({ type: item.type, items: [] });
      }
      grouped.find(g => g.type === item.type)!.items.push(item);
    }

    // Flat index tracking for keyboard nav
    let flatIndex = 0;

    return (
      <div className='bg-popover text-popover-foreground border-border z-50 max-w-72 min-w-56 overflow-hidden rounded-md border p-1 shadow-md'>
        {!hasQuery && items.length === 0 && (
          <div className='text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-sm'>
            <Search className='size-4' />
            Type to search...
          </div>
        )}
        {hasQuery && isLoading && items.length === 0 && (
          <div className='text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-sm'>
            <Loader2 className='size-4 animate-spin' />
            Searching...
          </div>
        )}
        {hasQuery && !isLoading && items.length === 0 && (
          <div className='text-muted-foreground flex items-center gap-2 px-2 py-1.5 text-sm'>
            <Ban className='size-4' />
            No results
          </div>
        )}
        {grouped.map(group => {
          return (
            <div key={group.type}>
              <div className='text-muted-foreground px-2 py-1 text-[10px] font-medium tracking-wider uppercase'>
                {typeLabels[group.type]}
              </div>
              {group.items.map(item => {
                const thisIndex = flatIndex++;
                const Icon = typeIcons[item.type];
                return (
                  <button
                    key={`${item.type}-${item.id}`}
                    type='button'
                    onClick={() => selectItem(thisIndex)}
                    data-selected={selectedIndex === thisIndex || undefined}
                    className='focus:bg-accent focus:text-accent-foreground data-[selected]:bg-accent data-[selected]:text-accent-foreground relative flex w-full cursor-default items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none'
                  >
                    <Icon className='text-muted-foreground size-3.5 flex-shrink-0' />
                    <span className='truncate'>{item.label}</span>
                    {item.subtitle && (
                      <span className='text-muted-foreground ml-auto truncate text-xs'>
                        {item.subtitle}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  },
);

MentionList.displayName = 'MentionList';

export default MentionList;
