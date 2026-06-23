import { describe, expect, it } from 'vitest';
import {
  buildAuthHandoffHref,
  buildInviteSignupHref,
  buildPendingInviteHref,
  getInviteWorkspacePath,
} from './invitation-links';

describe('invitation link helpers', () => {
  it('builds the invited workspace path from the org slug', () => {
    expect(getInviteWorkspacePath('engineering')).toBe('/engineering');
  });

  it('builds signup links that preserve invite context', () => {
    const href = buildInviteSignupHref({
      inviteId: 'invite123',
      orgSlug: 'engineering',
      email: 'USER@Example.com',
      organizationName: 'Engineering Team',
    });

    expect(href).toBe(
      '/auth/signup?inviteId=invite123&redirectTo=%2Fengineering&email=user%40example.com&workspace=Engineering+Team',
    );
  });

  it('builds pending invite links for existing users', () => {
    expect(
      buildPendingInviteHref({
        inviteId: 'invite123',
        orgSlug: 'engineering',
      }),
    ).toBe('/settings/invites?inviteId=invite123&redirectTo=%2Fengineering');
  });

  it('preserves invite ids through auth handoff links', () => {
    expect(
      buildAuthHandoffHref({
        path: '/auth/signing-in',
        redirectTo: '/engineering',
        inviteId: 'invite123',
      }),
    ).toBe('/auth/signing-in?redirectTo=%2Fengineering&inviteId=invite123');
  });
});
