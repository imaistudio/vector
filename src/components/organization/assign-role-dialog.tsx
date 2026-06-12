'use client';

import { useMemo, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { UserAvatar } from '@/components/user-avatar';
import { api, useCachedQuery, useMutation } from '@/lib/convex';
import type { Id } from '@/convex/_generated/dataModel';
import type { OrganizationRoleId } from '@/lib/organization-role-types';

interface AssignRoleDialogProps {
  orgSlug: string;
  roleId: OrganizationRoleId | null;
  onClose: () => void;
  onSuccess: () => void;
}

export function AssignRoleDialog({
  orgSlug,
  roleId,
  onClose,
  onSuccess,
}: AssignRoleDialogProps) {
  const [selectedUserId, setSelectedUserId] = useState<Id<'users'> | null>(
    null,
  );
  const [search, setSearch] = useState('');

  const members =
    useCachedQuery(api.organizations.queries.listMembers, { orgSlug }) || [];
  const assignMutation = useMutation(api.roles.index.assign);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const filteredMembers = useMemo(() => {
    const normalized = search.trim().toLowerCase();
    if (!normalized) return members;
    return members.filter(
      member =>
        member.user?.name?.toLowerCase().includes(normalized) ||
        member.user?.email?.toLowerCase().includes(normalized),
    );
  }, [members, search]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserId) return;

    setIsSubmitting(true);
    try {
      await assignMutation({
        orgSlug,
        roleId: roleId as OrganizationRoleId,
        userId: selectedUserId,
      });
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Failed to assign role:', error);
      toast.error('Failed to assign role');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <ResponsiveDialogContent showCloseButton={false} className='max-w-lg'>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Assign Role to Member</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit} className='space-y-4'>
          <div className='space-y-3'>
            <div className='space-y-1'>
              <Label>Select Member</Label>
              <p className='text-muted-foreground text-sm'>
                Choose a member to assign this role to
              </p>
            </div>

            <div className='relative'>
              <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2' />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder='Search members…'
                className='h-8 pl-8 text-sm'
                autoFocus
              />
            </div>

            <div className='max-h-64 space-y-1 overflow-y-auto rounded-md border p-2'>
              {filteredMembers.length === 0 ? (
                <p className='text-muted-foreground py-6 text-center text-sm'>
                  {search
                    ? `No members match “${search}”.`
                    : 'No members found.'}
                </p>
              ) : (
                filteredMembers.map(member => (
                  <button
                    type='button'
                    key={member.userId}
                    className={`hover:bg-muted flex w-full cursor-pointer items-center justify-between rounded-md p-2.5 text-left transition-colors ${
                      selectedUserId === member.userId ? 'bg-muted' : ''
                    }`}
                    onClick={() => setSelectedUserId(member.userId)}
                  >
                    <div className='flex items-center gap-3'>
                      <UserAvatar
                        name={member.user?.name}
                        email={member.user?.email}
                        image={member.user?.image}
                        userId={member.userId}
                      />
                      <div>
                        <div className='text-sm font-medium'>
                          {member.user?.name}
                        </div>
                        <div className='text-muted-foreground text-xs'>
                          {member.user?.email}
                        </div>
                      </div>
                    </div>
                    <div className='flex items-center gap-2'>
                      <Badge variant='outline' className='text-xs capitalize'>
                        {member.role}
                      </Badge>
                      {selectedUserId === member.userId && (
                        <Check className='text-primary size-4' />
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          {/* Actions */}
          <div className='flex justify-between'>
            <Button type='button' variant='ghost' onClick={onClose}>
              Cancel
            </Button>
            <Button type='submit' disabled={!selectedUserId || isSubmitting}>
              {isSubmitting ? 'Assigning...' : 'Assign Role'}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
