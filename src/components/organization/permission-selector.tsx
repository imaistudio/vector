'use client';

import { useMemo, useState } from 'react';
import { Search, Lock } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import {
  expandPermissions,
  type Permission,
} from '@/convex/_shared/permissions';
import { ALL_PERMISSIONS_WITH_GROUP } from '@/lib/permission-groups';

const TOTAL_PERMISSIONS = ALL_PERMISSIONS_WITH_GROUP.reduce(
  (sum, group) => sum + group.permissions.length,
  0,
);

interface PermissionSelectorProps {
  /** Currently selected permissions (always kept dependency-expanded). */
  value: Permission[];
  onChange: (next: Permission[]) => void;
}

/**
 * Shared permission picker for the create/edit role dialogs.
 *
 * - Selecting a permission auto-selects everything it depends on (e.g. "Edit
 *   Issue" pulls in "View Issue") so a role can never be saved in an
 *   incoherent state.
 * - Implied permissions render checked + locked so they can't be removed while
 *   something still requires them.
 * - Per-group select-all and a live search make large permission sets fast to
 *   manage.
 */
export function PermissionSelector({
  value,
  onChange,
}: PermissionSelectorProps) {
  const [search, setSearch] = useState('');

  const selectedSet = useMemo(() => new Set(value), [value]);

  // A permission is "locked" when another selected permission implies it.
  const lockedSet = useMemo(() => {
    const locked = new Set<Permission>();
    for (const permission of value) {
      for (const implied of expandPermissions([permission])) {
        if (implied !== permission) locked.add(implied);
      }
    }
    return locked;
  }, [value]);

  const normalizedSearch = search.trim().toLowerCase();

  const groups = useMemo(() => {
    if (!normalizedSearch) return ALL_PERMISSIONS_WITH_GROUP;
    return ALL_PERMISSIONS_WITH_GROUP.map(group => ({
      ...group,
      permissions: group.permissions.filter(
        permission =>
          permission.label.toLowerCase().includes(normalizedSearch) ||
          permission.description.toLowerCase().includes(normalizedSearch) ||
          group.group.toLowerCase().includes(normalizedSearch),
      ),
    })).filter(group => group.permissions.length > 0);
  }, [normalizedSearch]);

  const togglePermission = (permission: Permission) => {
    if (selectedSet.has(permission)) {
      // Locked permissions cannot be removed directly.
      if (lockedSet.has(permission)) return;
      onChange(value.filter(p => p !== permission));
    } else {
      onChange(expandPermissions([...value, permission]));
    }
  };

  const toggleGroup = (groupPermissions: Permission[], selectAll: boolean) => {
    if (selectAll) {
      onChange(expandPermissions([...value, ...groupPermissions]));
    } else {
      const removable = new Set(
        groupPermissions.filter(p => !lockedSet.has(p)),
      );
      onChange(value.filter(p => !removable.has(p)));
    }
  };

  return (
    <div className='space-y-2'>
      <div className='flex items-center justify-between gap-2 px-1'>
        <p className='text-muted-foreground text-sm'>
          Select what this role can do
        </p>
        <span className='text-muted-foreground text-xs tabular-nums'>
          {value.length} of {TOTAL_PERMISSIONS} selected
        </span>
      </div>

      <div className='relative'>
        <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2' />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder='Search permissions…'
          className='h-8 pl-8 text-sm'
        />
      </div>

      <div className='max-h-80 overflow-y-auto rounded-md border p-3'>
        {groups.length === 0 ? (
          <p className='text-muted-foreground py-6 text-center text-sm'>
            No permissions match “{search}”.
          </p>
        ) : (
          <div className='grid grid-cols-1 gap-6 md:grid-cols-2'>
            {groups.map(group => {
              const groupIds = group.permissions.map(p => p.id);
              const allSelected = groupIds.every(id => selectedSet.has(id));
              return (
                <div key={group.group} className='space-y-2'>
                  <div className='flex items-center justify-between'>
                    <h4 className='text-foreground text-sm font-medium'>
                      {group.group}
                    </h4>
                    <button
                      type='button'
                      onClick={() => toggleGroup(groupIds, !allSelected)}
                      className='text-muted-foreground hover:text-foreground text-xs transition-colors'
                    >
                      {allSelected ? 'Clear' : 'Select all'}
                    </button>
                  </div>
                  <div className='space-y-1'>
                    {group.permissions.map(permission => {
                      const isSelected = selectedSet.has(permission.id);
                      const isLocked =
                        isSelected && lockedSet.has(permission.id);
                      return (
                        <label
                          key={permission.id}
                          htmlFor={permission.id}
                          className={cn(
                            'flex cursor-pointer items-start gap-2.5 rounded-md px-1.5 py-1 transition-colors',
                            'hover:bg-muted/60',
                            isLocked && 'cursor-default',
                          )}
                        >
                          <Checkbox
                            id={permission.id}
                            checked={isSelected}
                            disabled={isLocked}
                            onCheckedChange={() =>
                              togglePermission(permission.id)
                            }
                            className='mt-0.5'
                          />
                          <div className='min-w-0 flex-1'>
                            <div className='flex items-center gap-1.5'>
                              <span className='text-sm leading-none font-medium'>
                                {permission.label}
                              </span>
                              {isLocked && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Lock className='text-muted-foreground size-3' />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    Required by another selected permission
                                  </TooltipContent>
                                </Tooltip>
                              )}
                            </div>
                            <p className='text-muted-foreground mt-0.5 text-xs'>
                              {permission.description}
                            </p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
