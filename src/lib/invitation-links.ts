type InviteLinkInput = {
  inviteId: string;
  orgSlug: string;
  email?: string;
  organizationName?: string;
};

export function getInviteWorkspacePath(orgSlug: string) {
  return `/${orgSlug}`;
}

export function buildInviteSignupHref({
  inviteId,
  orgSlug,
  email,
  organizationName,
}: InviteLinkInput) {
  const params = new URLSearchParams({
    inviteId,
    redirectTo: getInviteWorkspacePath(orgSlug),
  });

  if (email) {
    params.set('email', email.toLowerCase());
  }

  if (organizationName) {
    params.set('workspace', organizationName);
  }

  return `/auth/signup?${params.toString()}`;
}

export function buildPendingInviteHref({
  inviteId,
  orgSlug,
}: Pick<InviteLinkInput, 'inviteId' | 'orgSlug'>) {
  const params = new URLSearchParams({
    inviteId,
    redirectTo: getInviteWorkspacePath(orgSlug),
  });

  return `/settings/invites?${params.toString()}`;
}

export function buildAuthHandoffHref({
  path,
  redirectTo,
  inviteId,
}: {
  path: '/auth/login' | '/auth/signup' | '/auth/signing-in';
  redirectTo: string;
  inviteId?: string | null;
}) {
  const params = new URLSearchParams({ redirectTo });

  if (inviteId) {
    params.set('inviteId', inviteId);
  }

  return `${path}?${params.toString()}`;
}
