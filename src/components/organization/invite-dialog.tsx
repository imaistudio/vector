'use client';
import { useState } from 'react';
import { api, useCachedQuery, useMutation } from '@/lib/convex';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarsSpinner } from '@/components/bars-spinner';
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
  CheckCircle2,
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
  const selectedRoleLabel =
    roleOptions.find(option =>
      option.kind === 'custom'
        ? customRoleId === option.value
        : customRoleId === null && role === option.value,
    )?.label ?? 'Member';

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
            <div className='bg-muted text-muted-foreground rounded-md px-2 py-1 text-xs'>
              {selectedRoleLabel}
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

          <div
            role='radiogroup'
            aria-label='Invite role'
            className='bg-muted/20 grid gap-1 rounded-lg border p-1 sm:grid-cols-2'
          >
            {roleOptions.map(option => {
              const isSelected =
                option.kind === 'custom'
                  ? customRoleId === option.value
                  : customRoleId === null && role === option.value;
              const Icon = option.Icon;

              return (
                <button
                  key={`${option.kind}-${option.value}`}
                  type='button'
                  role='radio'
                  aria-checked={isSelected}
                  disabled={isSubmitting}
                  onClick={() => {
                    if (option.kind === 'custom') {
                      setRole('member');
                      setCustomRoleId(option.value);
                      return;
                    }
                    setRole(option.value);
                    setCustomRoleId(null);
                  }}
                  className={cn(
                    'flex min-h-20 items-start gap-2 rounded-md border px-3 py-2 text-left transition-colors',
                    'focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
                    isSelected
                      ? 'border-primary/70 bg-primary/10 text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-background/70 hover:text-foreground border-transparent bg-transparent',
                  )}
                >
                  <Icon
                    className={cn(
                      'mt-0.5 size-4 flex-shrink-0',
                      isSelected ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span className='min-w-0 flex-1'>
                    <span className='flex items-center gap-1.5 text-sm font-medium'>
                      {option.label}
                      {isSelected && (
                        <CheckCircle2 className='text-primary size-3.5' />
                      )}
                    </span>
                    <span className='mt-0.5 block text-xs leading-4'>
                      {option.description}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

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
            <Button size='sm' disabled={!email.trim() || isSubmitting}>
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
