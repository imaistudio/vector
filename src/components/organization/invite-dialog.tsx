'use client';
import { useState } from 'react';
import { api, useCachedQuery, useMutation } from '@/lib/convex';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarsSpinner } from '@/components/bars-spinner';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
} from '@/components/ui/responsive-dialog';
import { useFormSubmission } from '@/hooks/use-error-handling';
import { cn } from '@/lib/utils';

import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  AlertCircle,
  ChevronsUpDown,
  Sparkles,
  ShieldCheck,
  UserRoundPlus,
} from 'lucide-react';
import type { OrganizationRoleId } from '@/lib/organization-role-types';

type NonOwnerMemberRole = 'member' | 'admin';
type InviteRoleOption =
  | {
      kind: 'built-in';
      value: NonOwnerMemberRole;
      label: string;
      description: string;
      Icon: typeof UserRoundPlus;
    }
  | {
      kind: 'custom';
      value: OrganizationRoleId;
      label: string;
      description: string;
      Icon: typeof Sparkles;
    };

const BUILT_IN_ROLE_OPTIONS: InviteRoleOption[] = [
  {
    kind: 'built-in',
    value: 'member',
    label: 'Member',
    description: 'Can view and collaborate in the workspace.',
    Icon: UserRoundPlus,
  },
  {
    kind: 'built-in',
    value: 'admin',
    label: 'Admin',
    description: 'Can manage members, roles, and settings.',
    Icon: ShieldCheck,
  },
];

export function InviteDialog({
  orgSlug,
  onClose,
}: {
  orgSlug: string;
  onClose: () => void;
}) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<NonOwnerMemberRole>('member');
  const [customRoleId, setCustomRoleId] = useState<OrganizationRoleId | null>(
    null,
  );
  const [roleOpen, setRoleOpen] = useState(false);
  const customRoles =
    useCachedQuery(api.roles.index.listInviteAssignable, { orgSlug }) ?? [];

  const inviteMutation = useMutation(api.organizations.mutations.invite);

  const { submit, isSubmitting, error } = useFormSubmission(inviteMutation, {
    context: 'Invite',
    successMessage: 'Invitation sent successfully',
    onSuccess: () => {
      onClose();
      setEmail('');
      setRole('member');
      setCustomRoleId(null);
    },
  });

  const roleOptions: InviteRoleOption[] = [
    ...BUILT_IN_ROLE_OPTIONS,
    ...customRoles.map(customRole => ({
      kind: 'custom' as const,
      value: customRole._id,
      label: customRole.name,
      description: customRole.description || 'Custom organization role.',
      Icon: Sparkles,
    })),
  ];
  const selectedRole =
    roleOptions.find(option =>
      option.kind === 'custom'
        ? customRoleId === option.value
        : customRoleId === null && role === option.value,
    ) ?? BUILT_IN_ROLE_OPTIONS[0];
  const SelectedRoleIcon = selectedRole.Icon;

  const handleRoleSelect = (option: InviteRoleOption) => {
    if (option.kind === 'custom') {
      setRole('member');
      setCustomRoleId(option.value);
    } else {
      setRole(option.value);
      setCustomRoleId(null);
    }
    setRoleOpen(false);
  };

  const handleInvite = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!email.trim()) return;

    await submit({
      orgSlug,
      email: email.trim(),
      role,
      customRoleId: customRoleId ?? undefined,
    });
  };

  return (
    <ResponsiveDialog
      open
      onOpenChange={(isOpen: boolean) => !isOpen && onClose()}
    >
      <ResponsiveDialogContent
        showCloseButton={false}
        className='gap-2 p-2 sm:max-w-lg'
      >
        <ResponsiveDialogHeader className='sr-only'>
          <ResponsiveDialogTitle>Invite member</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <form onSubmit={handleInvite} className='space-y-2'>
          <div className='flex items-start justify-between gap-3 px-2 pt-1'>
            <div className='min-w-0'>
              <div className='text-sm font-medium'>Invite member</div>
              <p className='text-muted-foreground mt-0.5 text-xs'>
                Send an email invitation and choose their starting access.
              </p>
            </div>
          </div>

          {error && (
            <Alert variant='destructive' className='py-2'>
              <AlertCircle className='h-4 w-4' />
              <AlertDescription>{error.userMessage}</AlertDescription>
            </Alert>
          )}

          <div className='relative'>
            <Input
              placeholder='name@company.com'
              value={email}
              onChange={e => setEmail(e.target.value)}
              type='email'
              disabled={isSubmitting}
              className='h-10 pr-20 text-base'
              autoFocus
            />
            <span className='text-muted-foreground bg-background pointer-events-none absolute top-1/2 right-2 -translate-y-1/2 rounded px-2 py-0.5 text-xs'>
              Email
            </span>
          </div>

          <Popover open={roleOpen} onOpenChange={setRoleOpen}>
            <PopoverTrigger asChild>
              <Button
                type='button'
                variant='outline'
                className='bg-muted/30 hover:bg-muted/50 h-10 w-full justify-between gap-2 px-3'
                role='combobox'
                aria-expanded={roleOpen}
                aria-label='Invite role'
                disabled={isSubmitting}
              >
                <span className='flex min-w-0 items-center gap-2'>
                  <SelectedRoleIcon className='text-muted-foreground size-4 flex-shrink-0' />
                  <span className='truncate'>{selectedRole.label}</span>
                </span>
                <ChevronsUpDown className='text-muted-foreground size-3.5 flex-shrink-0' />
              </Button>
            </PopoverTrigger>
            <PopoverContent align='start' className='w-(--anchor-width) p-0'>
              <Command>
                <CommandInput placeholder='Search roles...' className='h-9' />
                <CommandList>
                  <CommandEmpty>No roles found.</CommandEmpty>
                  <CommandGroup>
                    {roleOptions.map(option => {
                      const isSelected =
                        option.kind === 'custom'
                          ? customRoleId === option.value
                          : customRoleId === null && role === option.value;
                      const Icon = option.Icon;

                      return (
                        <CommandItem
                          key={`${option.kind}-${option.value}`}
                          value={`${option.label} ${option.description}`}
                          data-checked={isSelected}
                          onSelect={() => handleRoleSelect(option)}
                        >
                          <Icon
                            className={cn(
                              'size-4',
                              isSelected
                                ? 'text-primary'
                                : 'text-muted-foreground',
                            )}
                          />
                          <span className='min-w-0 flex-1'>
                            <span className='block truncate font-medium'>
                              {option.label}
                            </span>
                            <span className='text-muted-foreground block truncate text-xs'>
                              {option.description}
                            </span>
                          </span>
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>

          <div className='flex w-full flex-row items-center justify-between gap-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={!email.trim() || isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <BarsSpinner size={12} />
                  Sending
                </>
              ) : (
                'Send invite'
              )}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
