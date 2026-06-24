'use client';

import { api, useCachedQuery, useMutation } from '@/lib/convex';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { BarsSpinner } from '@/components/bars-spinner';
import { format } from 'date-fns';
import { Mail } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useRef, useState } from 'react';
import type { Id } from '@/convex/_generated/dataModel';
import { useRouter } from 'nextjs-toploader/app';

const header = (
  <div className='border-b'>
    <div className='flex items-center p-1 pl-8 lg:pl-1'>
      <span className='flex items-center gap-1.5 px-3 text-xs font-medium'>
        <Mail className='size-3.5' />
        Invitations
      </span>
    </div>
  </div>
);

export default function InvitesPage() {
  const router = useRouter();
  const invites = useCachedQuery(api.users.getPendingInvitations);
  const acceptInvite = useMutation(
    api.organizations.mutations.acceptInvitation,
  );
  const declineInvite = useMutation(
    api.organizations.mutations.declineInvitation,
  );
  const [pendingAction, setPendingAction] = useState<{
    inviteId: Id<'invitations'>;
    type: 'accept' | 'decline';
  } | null>(null);
  const autoAcceptStartedRef = useRef(false);
  const [inviteUrlParams, setInviteUrlParams] = useState<{
    inviteId: string | null;
    redirectTo: string | null;
  }>({ inviteId: null, redirectTo: null });
  const inviteIdFromUrl = inviteUrlParams.inviteId;
  const redirectTo = inviteUrlParams.redirectTo;

  const isPendingAction = (
    inviteId: Id<'invitations'>,
    type: 'accept' | 'decline',
  ) => pendingAction?.inviteId === inviteId && pendingAction.type === type;

  const handleAccept = async (inviteId: Id<'invitations'>) => {
    setPendingAction({ inviteId, type: 'accept' });
    try {
      const result = await acceptInvite({ inviteId });
      toast.success('Invitation accepted');
      if (result.organizationSlug) {
        router.replace(`/${result.organizationSlug}`);
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPendingAction(null);
    }
  };

  const handleDecline = async (inviteId: Id<'invitations'>) => {
    setPendingAction({ inviteId, type: 'decline' });
    try {
      await declineInvite({ inviteId });
      toast.info('Invitation declined');
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setPendingAction(null);
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setInviteUrlParams({
      inviteId: params.get('inviteId'),
      redirectTo: params.get('redirectTo'),
    });
  }, []);

  useEffect(() => {
    if (
      !inviteIdFromUrl ||
      invites === undefined ||
      autoAcceptStartedRef.current
    ) {
      return;
    }

    const invite = invites.find(inv => inv._id === inviteIdFromUrl);
    if (!invite) {
      return;
    }

    autoAcceptStartedRef.current = true;
    setPendingAction({ inviteId: invite._id, type: 'accept' });

    void (async () => {
      try {
        const result = await acceptInvite({ inviteId: invite._id });
        toast.success('Invitation accepted');
        const target = result.organizationSlug
          ? `/${result.organizationSlug}`
          : redirectTo;
        if (target) {
          router.replace(target);
        }
      } catch (err) {
        toast.error((err as Error).message);
      } finally {
        setPendingAction(null);
      }
    })();
  }, [acceptInvite, inviteIdFromUrl, invites, redirectTo, router]);

  if (invites === undefined) {
    return (
      <div className='bg-background h-full'>
        {header}
        <div className='w-full max-w-full min-w-0 divide-y overflow-x-hidden'>
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className='flex w-full max-w-full min-w-0 items-center gap-3 px-3 py-2'
            >
              <div className='min-w-0 flex-1 space-y-1'>
                <Skeleton className='h-4 w-36' />
                <Skeleton className='h-3 w-24' />
              </div>
              <Skeleton className='h-5 w-14 rounded-full' />
              <Skeleton className='h-3 w-16' />
              <div className='flex gap-1'>
                <Skeleton className='h-6 w-16 rounded-md' />
                <Skeleton className='h-6 w-16 rounded-md' />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className='bg-background h-full'>
      {header}

      {invites.length === 0 ? (
        <div className='text-muted-foreground flex items-center justify-center py-12 text-sm'>
          No pending invitations
        </div>
      ) : (
        <div className='w-full max-w-full min-w-0 divide-y overflow-x-hidden'>
          {invites.map(inv => (
            <div
              key={inv._id}
              className='flex w-full max-w-full min-w-0 flex-wrap items-center gap-2 px-3 py-2 sm:flex-nowrap sm:gap-3'
            >
              <div className='min-w-0 flex-1'>
                <p className='truncate text-sm font-medium'>
                  {inv.organization?.name ?? 'Unknown Organization'}
                </p>
                <p className='text-muted-foreground text-xs'>
                  Invited {format(new Date(inv._creationTime), 'MMM d, yyyy')}
                </p>
              </div>

              <Badge variant='outline' className='text-xs capitalize'>
                {inv.role}
              </Badge>

              <div className='text-muted-foreground hidden shrink-0 text-xs sm:block'>
                Expires {format(new Date(inv.expiresAt), 'MMM d')}
              </div>

              <div className='flex shrink-0 gap-1'>
                <Button
                  size='sm'
                  className='h-6 text-xs'
                  onClick={() => handleAccept(inv._id)}
                  disabled={pendingAction !== null}
                >
                  {isPendingAction(inv._id, 'accept') ? (
                    <BarsSpinner size={12} />
                  ) : (
                    'Accept'
                  )}
                </Button>
                <Button
                  size='sm'
                  variant='ghost'
                  className='h-6 text-xs'
                  onClick={() => handleDecline(inv._id)}
                  disabled={pendingAction !== null}
                >
                  {isPendingAction(inv._id, 'decline') ? (
                    <BarsSpinner size={12} />
                  ) : (
                    'Decline'
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
