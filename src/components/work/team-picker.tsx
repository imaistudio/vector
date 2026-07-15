'use client';

import { useState } from 'react';
import { ChevronsUpDown, Users } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';
import { api, useCachedQuery } from '@/lib/convex';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
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

export function TeamPicker({
  orgSlug,
  value,
  onChange,
  placeholder = 'Route to team',
}: {
  orgSlug: string;
  value?: Id<'teams'>;
  onChange: (value?: Id<'teams'>) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const workspace = useCachedQuery(
    api.organizations.queries.getWorkspaceOptions,
    { orgSlug },
  );
  const selected = workspace?.teams.find(team => team._id === value);
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
            <DynamicIcon
              name={selected?.icon}
              fallback={Users}
              className='size-3.5 shrink-0'
              style={{ color: selected?.color ?? undefined }}
            />
            <span className='truncate'>{selected?.name ?? placeholder}</span>
          </span>
          <ChevronsUpDown className='text-muted-foreground size-3 shrink-0' />
        </Button>
      </PopoverTrigger>
      <PopoverContent align='start' className='w-60 p-0'>
        <Command>
          <CommandInput placeholder='Search teams…' />
          <CommandList>
            {workspace === undefined ? (
              <div className='space-y-1 p-2'>
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className='flex h-8 items-center gap-2 px-1'>
                    <Skeleton className='size-4 rounded' />
                    <Skeleton className='h-3 flex-1' />
                  </div>
                ))}
              </div>
            ) : (
              <>
                <CommandEmpty>No teams found.</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    data-checked={!value}
                    onSelect={() => {
                      onChange();
                      setOpen(false);
                    }}
                  >
                    <Users className='size-3.5' />
                    No team
                  </CommandItem>
                  {(workspace?.teams ?? []).map(team => (
                    <CommandItem
                      key={team._id}
                      value={`${team.name} ${team.key}`}
                      data-checked={team._id === value}
                      onSelect={() => {
                        onChange(team._id);
                        setOpen(false);
                      }}
                    >
                      <DynamicIcon
                        name={team.icon}
                        fallback={Users}
                        className='size-3.5'
                        style={{ color: team.color ?? undefined }}
                      />
                      <span className='truncate'>{team.name}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
