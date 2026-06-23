'use client';

import { useSearchParams } from 'next/navigation';
import { useRouter } from 'nextjs-toploader/app';
import { Suspense, useEffect, useRef, useState } from 'react';
import { useMutation, useQuery } from '@/lib/convex';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { BarsSpinner } from '@/components/bars-spinner';
import { Button } from '@/components/ui/button';

function getInviteErrorMessage(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);

  if (message.includes('INVITATION_EXPIRED')) {
    return 'This invitation has expired.';
  }
  if (message.includes('NOT_YOUR_INVITATION')) {
    return 'This invitation belongs to a different email address.';
  }
  if (message.includes('INVITATION_NOT_FOUND')) {
    return 'This invitation could not be found.';
  }
  if (message.includes('INVITATION_NOT_PENDING')) {
    return 'This invitation has already been used or is no longer pending.';
  }

  return 'We could not accept this invitation automatically.';
}

function SigningInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userQuery = useQuery(api.users.currentUser);
  const acceptInvitation = useMutation(
    api.organizations.mutations.acceptInvitation,
  );
  const redirectTo = searchParams.get('redirectTo') || '/';
  const inviteId = searchParams.get('inviteId');
  const handledRef = useRef(false);
  const [inviteError, setInviteError] = useState<string | null>(null);

  useEffect(() => {
    // Wait until the Convex session is established and the user record exists.
    // Without this, the root page may see user === null and bounce to /auth/login.
    if (userQuery.isPending || userQuery.data === null) return;
    if (handledRef.current) return;

    handledRef.current = true;

    if (!inviteId) {
      router.push(redirectTo);
      return;
    }

    void (async () => {
      try {
        const result = await acceptInvitation({
          inviteId: inviteId as Id<'invitations'>,
        });
        router.push(
          result.organizationSlug ? `/${result.organizationSlug}` : redirectTo,
        );
      } catch (error) {
        setInviteError(getInviteErrorMessage(error));
      }
    })();
  }, [
    acceptInvitation,
    inviteId,
    redirectTo,
    router,
    userQuery.isPending,
    userQuery.data,
  ]);

  if (inviteError) {
    return (
      <div className='flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center'>
        <div className='space-y-1'>
          <h1 className='text-sm font-medium'>Invitation not accepted</h1>
          <p className='text-muted-foreground max-w-sm text-xs'>
            {inviteError}
          </p>
        </div>
        <Button
          size='sm'
          variant='outline'
          onClick={() => router.push('/settings/invites')}
        >
          View invitations
        </Button>
      </div>
    );
  }

  const title = inviteId ? 'Joining workspace' : 'Logging you in';
  const body = inviteId
    ? 'Accepting your invitation before opening the workspace.'
    : 'Hang tight while we set up your session.';

  return (
    <div className='flex min-h-dvh flex-col items-center justify-center gap-2 text-center'>
      <div className='flex items-center gap-2 text-sm font-medium'>
        <BarsSpinner className='text-muted-foreground' size={16} />
        <span>{title}</span>
      </div>
      <p className='text-muted-foreground text-xs'>{body}</p>
    </div>
  );
}

function SigningInFallback() {
  return (
    <div className='flex min-h-dvh flex-col items-center justify-center gap-2 text-center'>
      <div className='flex items-center gap-2 text-sm font-medium'>
        <BarsSpinner className='text-muted-foreground' size={16} />
        <span>Logging you in</span>
      </div>
      <p className='text-muted-foreground text-xs'>
        Hang tight while we set up your session.
      </p>
    </div>
  );
}

export default function SigningInPage() {
  return (
    <Suspense fallback={<SigningInFallback />}>
      <SigningInContent />
    </Suspense>
  );
}
