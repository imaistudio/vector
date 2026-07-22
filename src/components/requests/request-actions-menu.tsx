'use client';

import { useState } from 'react';
import { MoreHorizontal, Trash2 } from 'lucide-react';
import { BarsSpinner } from '@/components/bars-spinner';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandGroup,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { cn } from '@/lib/utils';

export function RequestActionsMenu({
  onDelete,
  deleting = false,
  className,
}: {
  onDelete: () => void;
  deleting?: boolean;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='sm'
          className={cn('size-7 shrink-0 p-0', className)}
          aria-label='Open request actions'
          disabled={deleting}
        >
          {deleting ? (
            <BarsSpinner size={14} />
          ) : (
            <MoreHorizontal className='size-3.5' />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align='end' className='w-40 p-0'>
        <Command>
          <CommandList>
            <CommandGroup>
              <CommandItem
                value='Delete request'
                disabled={deleting}
                className='text-destructive data-[selected=true]:bg-destructive/10 data-[selected=true]:text-destructive gap-2 text-xs'
                onSelect={() => {
                  setOpen(false);
                  onDelete();
                }}
              >
                {deleting ? (
                  <BarsSpinner size={14} />
                ) : (
                  <Trash2 className='size-3.5' />
                )}
                Delete request
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
