import * as React from 'react';
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import type { NotificationEventType } from './shared';

const h = React.createElement;

const colors = {
  bg: '#eefcfb',
  panel: '#ffffff',
  surface: '#f8fafc',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  accent: '#2f93b0',
  accentDark: '#287f98',
  accentSoft: '#e6f7f7',
};

const fontStack =
  'Urbanist, Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const bodyFontStack =
  'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
const monoFontStack =
  '"SFMono-Regular", "JetBrains Mono", Menlo, Monaco, Consolas, monospace';

function formatInviteRoleLabel(role?: string) {
  switch (role) {
    case 'owner':
      return 'an owner';
    case 'admin':
      return 'an admin';
    case 'member':
    default:
      return 'a member';
  }
}

function capitalizeInviteRole(role?: string) {
  if (!role) {
    return 'Member';
  }
  return role.charAt(0).toUpperCase() + role.slice(1);
}

function brandMark() {
  return h(
    'table',
    {
      style: {
        borderCollapse: 'collapse' as const,
      },
    },
    h(
      'tbody',
      null,
      h(
        'tr',
        null,
        h(
          'td',
          {
            style: {
              width: '24px',
              height: '24px',
              borderRadius: '8px',
              backgroundColor: colors.text,
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 700,
              lineHeight: '24px',
              textAlign: 'center' as const,
              fontFamily: fontStack,
            },
          },
          'V',
        ),
        h(
          'td',
          {
            style: {
              paddingLeft: '8px',
              fontSize: '14px',
              lineHeight: '20px',
              fontWeight: 700,
              fontFamily: fontStack,
              color: colors.text,
            },
          },
          'Vector',
        ),
      ),
    ),
  );
}

function metaRow(
  label: string,
  value: React.ReactNode,
  key: string,
  tone: 'default' | 'mono' = 'default',
) {
  return h(
    'tr',
    { key },
    h(
      'td',
      {
        style: {
          padding: '4px 0',
          fontSize: '11px',
          lineHeight: '16px',
          color: colors.muted,
          fontFamily: bodyFontStack,
          whiteSpace: 'nowrap' as const,
          verticalAlign: 'top',
          width: '1px',
          paddingRight: '12px',
        },
      },
      label,
    ),
    h(
      'td',
      {
        style: {
          padding: '4px 0',
          fontSize: '12px',
          lineHeight: '18px',
          color: colors.text,
          fontFamily: tone === 'mono' ? monoFontStack : bodyFontStack,
          fontWeight: tone === 'mono' ? 600 : 500,
          wordBreak: 'break-word' as const,
        },
      },
      value,
    ),
  );
}

function vectorEmailLayout({
  preview,
  eyebrow,
  title,
  body,
  ctaHref,
  ctaLabel,
  meta,
  footer,
}: {
  preview: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  meta?: {
    label: string;
    value: React.ReactNode;
    tone?: 'default' | 'mono';
  }[];
  footer?: string;
}) {
  return h(
    Html,
    null,
    h(
      Head,
      null,
      h('meta', { name: 'color-scheme', content: 'light' }),
      h('meta', { name: 'supported-color-schemes', content: 'light' }),
    ),
    h(Preview, null, preview),
    h(
      Body,
      {
        style: {
          backgroundColor: colors.bg,
          fontFamily: bodyFontStack,
          color: colors.text,
          margin: 0,
          padding: '36px 12px',
        },
      },
      h(
        Container,
        {
          style: {
            maxWidth: '560px',
            margin: '0 auto',
          },
        },
        h(
          Section,
          {
            style: {
              padding: '0 0 12px',
            },
          },
          brandMark(),
        ),
        h(
          Section,
          {
            style: {
              backgroundColor: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: '12px',
              overflow: 'hidden',
              boxShadow: '0 18px 50px rgba(15, 23, 42, 0.08)',
            },
          },
          h(Section, {
            style: {
              height: '4px',
              backgroundColor: colors.accent,
            },
          }),
          h(
            Section,
            {
              style: {
                padding: '22px 24px 0',
              },
            },
            h(
              Text,
              {
                style: {
                  margin: 0,
                  fontSize: '10px',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: colors.accentDark,
                  fontWeight: 700,
                  fontFamily: bodyFontStack,
                },
              },
              eyebrow,
            ),
            h(
              Heading,
              {
                as: 'h1',
                style: {
                  margin: '8px 0 0',
                  fontSize: '24px',
                  lineHeight: '30px',
                  fontWeight: 700,
                  fontFamily: fontStack,
                  color: colors.text,
                },
              },
              title,
            ),
            h(
              Text,
              {
                style: {
                  margin: '8px 0 0',
                  fontSize: '13px',
                  lineHeight: '21px',
                  color: colors.muted,
                  fontFamily: bodyFontStack,
                },
              },
              body,
            ),
          ),
          meta && meta.length > 0
            ? h(
                Section,
                {
                  style: {
                    margin: '18px 24px 0',
                    backgroundColor: colors.surface,
                    border: `1px solid ${colors.border}`,
                    borderRadius: '10px',
                    overflow: 'hidden',
                  },
                },
                h(
                  'table',
                  {
                    style: {
                      width: '100%',
                      borderCollapse: 'collapse' as const,
                    },
                  },
                  h(
                    'tbody',
                    null,
                    meta.map((item, index) =>
                      h(
                        'tr',
                        { key: `meta-wrap-${index}` },
                        h(
                          'td',
                          {
                            style: {
                              padding:
                                index === 0 ? '12px 16px 6px' : '2px 16px 6px',
                              borderTop:
                                index === 0
                                  ? undefined
                                  : `1px solid ${colors.border}`,
                            },
                          },
                          h(
                            'table',
                            {
                              style: {
                                width: '100%',
                                borderCollapse: 'collapse' as const,
                              },
                            },
                            h(
                              'tbody',
                              null,
                              metaRow(
                                item.label,
                                item.value,
                                `meta-${index}`,
                                item.tone,
                              ),
                            ),
                          ),
                        ),
                      ),
                    ),
                  ),
                ),
              )
            : null,
          ctaHref && ctaLabel
            ? h(
                Section,
                { style: { padding: '20px 24px 0' } },
                h(
                  Button,
                  {
                    href: ctaHref,
                    style: {
                      backgroundColor: colors.accent,
                      color: '#ffffff',
                      fontSize: '13px',
                      fontWeight: 700,
                      fontFamily: bodyFontStack,
                      textDecoration: 'none',
                      borderRadius: '8px',
                      padding: '10px 18px',
                      display: 'inline-block',
                    },
                  },
                  ctaLabel,
                ),
              )
            : null,
          h(Hr, {
            style: {
              borderColor: colors.border,
              margin: '24px 0 0',
            },
          }),
          h(
            Section,
            { style: { padding: '12px 24px 18px' } },
            h(
              Text,
              {
                style: {
                  margin: 0,
                  fontSize: '11px',
                  lineHeight: '17px',
                  color: colors.muted,
                  fontFamily: bodyFontStack,
                },
              },
              footer ??
                'Open Vector to continue in context with the rest of your workspace.',
            ),
          ),
        ),
        h(
          Section,
          { style: { padding: '12px 2px 0' } },
          h(
            Text,
            {
              style: {
                margin: 0,
                fontSize: '11px',
                lineHeight: '16px',
                color: colors.muted,
                fontFamily: bodyFontStack,
              },
            },
            'Sent by Vector',
          ),
        ),
      ),
    ),
  );
}

export function renderNotificationEmailTemplate({
  type,
  title,
  body,
  href,
  payload,
}: {
  type: NotificationEventType;
  title: string;
  body: string;
  href?: string;
  payload: {
    organizationName?: string;
    issueKey?: string;
    issueTitle?: string;
    commentPreview?: string;
    inviterName?: string;
    roleLabel?: string;
  };
}) {
  switch (type) {
    case 'organization_invite':
      return vectorEmailLayout({
        preview: `${payload.inviterName ?? 'Someone'} invited you to ${payload.organizationName ?? 'a workspace'} on Vector`,
        eyebrow: 'Workspace Invitation',
        title: `Join ${payload.organizationName ?? 'a workspace'}`,
        body: `${payload.inviterName ?? 'Someone'} invited you to collaborate as ${formatInviteRoleLabel(payload.roleLabel)}. Sign in or create an account with this email to get started.`,
        ctaHref: href,
        ctaLabel: 'Accept invitation',
        meta: [
          {
            label: 'Workspace',
            value: payload.organizationName ?? 'Unknown',
          },
          {
            label: 'Invited by',
            value: payload.inviterName ?? 'Unknown',
          },
          {
            label: 'Role',
            value: h(
              'span',
              {
                style: {
                  display: 'inline-block',
                  borderRadius: '5px',
                  backgroundColor: colors.accentSoft,
                  color: colors.accentDark,
                  padding: '2px 8px',
                  fontSize: '10px',
                  lineHeight: '16px',
                  fontWeight: 700,
                },
              },
              capitalizeInviteRole(payload.roleLabel),
            ),
          },
        ],
        footer:
          'This invite is tied to the email address it was sent to. Sign in or create an account with this email to accept it.',
      });
    case 'issue_assigned':
    case 'issue_reassigned':
      return vectorEmailLayout({
        preview: title,
        eyebrow: type === 'issue_assigned' ? 'New Assignment' : 'Reassignment',
        title,
        body,
        ctaHref: href,
        ctaLabel: 'Open issue',
        meta: [
          {
            label: 'Issue',
            value: payload.issueKey ?? 'Unknown',
            tone: 'mono',
          },
          ...(payload.issueTitle
            ? [{ label: 'Title', value: payload.issueTitle }]
            : []),
        ],
      });
    case 'issue_mentioned':
      return vectorEmailLayout({
        preview: title,
        eyebrow: 'Mention',
        title,
        body,
        ctaHref: href,
        ctaLabel: 'View comment',
        meta: [
          {
            label: 'Issue',
            value: payload.issueKey ?? 'Unknown',
            tone: 'mono',
          },
          ...(payload.commentPreview
            ? [{ label: 'Comment', value: payload.commentPreview }]
            : []),
        ],
      });
    case 'issue_comment_on_assigned_issue':
      return vectorEmailLayout({
        preview: title,
        eyebrow: 'New Comment',
        title,
        body,
        ctaHref: href,
        ctaLabel: 'Open issue',
        meta: [
          {
            label: 'Issue',
            value: payload.issueKey ?? 'Unknown',
            tone: 'mono',
          },
          ...(payload.commentPreview
            ? [{ label: 'Comment', value: payload.commentPreview }]
            : []),
        ],
      });
  }
}
