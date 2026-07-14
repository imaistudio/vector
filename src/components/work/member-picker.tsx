'use client';

import { useState } from 'react';
import { ChevronsUpDown, UserRound, Users } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { api, useCachedQuery } from '@/lib/convex';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';

export function MemberPicker({
  orgSlug,
  value,
  onChange,
  multiple = false,
  placeholder = 'Select person',
}: {
  orgSlug: string;
  value: Id<'users'>[];
  onChange: (value: Id<'users'>[]) => void;
  multiple?: boolean;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const members = useCachedQuery(api.organizations.queries.listMembers, {
    orgSlug,
  });
  const selected = (members ?? []).filter(member =>
    value.includes(member.userId),
  );
  const label =
    selected.length === 0
      ? placeholder
      : multiple && selected.length > 1
        ? `${selected.length} people`
        : (selected[0]?.user?.name ??
          selected[0]?.user?.username ??
          selected[0]?.user?.email ??
          'Person');

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type='button'
          variant='outline'
          size='sm'
          className='h-7 max-w-52 justify-between gap-2 px-2 text-xs font-normal'
        >
          <span className='flex min-w-0 items-center gap-1.5'>
            {multiple ? (
              <Users className='size-3.5 shrink-0' />
            ) : (
              <UserRound className='size-3.5 shrink-0' />
            )}
            <span className='truncate'>{label}</span>
          </span>
          <ChevronsUpDown className='text-muted-foreground size-3 shrink-0' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-64 p-0'>
        <Command>
          <CommandInput placeholder='Search people…' />
          <CommandList>
            <CommandEmpty>No people found.</CommandEmpty>
            <CommandGroup>
              {(members ?? []).map(member => {
                const checked = value.includes(member.userId);
                const name =
                  member.user?.name ??
                  member.user?.username ??
                  member.user?.email ??
                  'Unnamed';
                return (
                  <CommandItem
                    key={member._id}
                    value={`${name} ${member.user?.email ?? ''}`}
                    data-checked={checked}
                    onSelect={() => {
                      if (multiple) {
                        onChange(
                          checked
                            ? value.filter(id => id !== member.userId)
                            : [...value, member.userId],
                        );
                      } else {
                        onChange(checked ? [] : [member.userId]);
                        setOpen(false);
                      }
                    }}
                  >
                    <span className='bg-muted flex size-5 items-center justify-center rounded-full text-[9px] font-medium'>
                      {name.slice(0, 2).toUpperCase()}
                    </span>
                    <span className='min-w-0 flex-1 truncate'>{name}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
