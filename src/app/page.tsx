'use client';

import { redirect } from 'next/navigation';
import { useEffect } from 'react';
import { useQuery } from '@/lib/convex';
import { api } from '@/lib/convex';

// --- Post-login redirect logic -----------------------------------------------------------
export default function Home() {
  const userQuery = useQuery(api.users.currentUser);
  const userOrgsQuery = useQuery(api.users.getOrganizations);

  const user = userQuery.data;
  const userOrgs = userOrgsQuery.data;
  const hasOrganizations = userOrgs && userOrgs.length > 0;

  useEffect(() => {
    if (userQuery.isPending) {
      // Still loading, don't redirect yet
      return;
    }

    if (user === null) {
      // Not authenticated
      redirect('/auth/login');
    } else {
      // Authenticated
      if (hasOrganizations && userOrgs?.[0]?.slug) {
        redirect(`/${userOrgs[0].slug}/issues`);
      } else {
        redirect('/org-setup');
      }
    }
  }, [user, hasOrganizations, userOrgs, userQuery.isPending]);

  return (
    <div className='flex h-screen w-full items-center justify-center'>
      <div className='text-2xl font-semibold'>Loading...</div>
    </div>
  );
}
