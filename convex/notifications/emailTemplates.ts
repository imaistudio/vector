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
  bg: '#ffffff',
  panel: '#ffffff',
  surface: '#fafafa',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  borderSubtle: '#f4f4f5',
  button: '#18181b',
  buttonText: '#ffffff',
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
          padding: '0',
          fontSize: '11px',
          lineHeight: '17px',
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
          padding: '0',
          fontSize: '12px',
          lineHeight: '17px',
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
          padding: '24px 12px',
        },
      },
      h(
        Container,
        {
          style: {
            maxWidth: '480px',
            margin: '0 auto',
          },
        },
        h(
          Section,
          {
            style: {
              backgroundColor: colors.panel,
              border: `1px solid ${colors.border}`,
              borderRadius: '8px',
              overflow: 'hidden',
            },
          },
          h(
            Section,
            {
              style: {
                padding: '14px 16px 0',
              },
            },
            h(
              Text,
              {
                style: {
                  margin: 0,
                  fontSize: '12px',
                  lineHeight: '17px',
                  fontWeight: 600,
                  fontFamily: fontStack,
                  color: colors.text,
                },
              },
              'Vector',
            ),
            h(Hr, {
              style: {
                borderColor: colors.borderSubtle,
                margin: '12px 0 0',
              },
            }),
          ),
          h(
            Section,
            {
              style: {
                padding: '14px 16px 0',
              },
            },
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
              eyebrow,
            ),
            h(
              Heading,
              {
                as: 'h1',
                style: {
                  margin: '4px 0 0',
                  fontSize: '18px',
                  lineHeight: '24px',
                  fontWeight: 650,
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
                  lineHeight: '20px',
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
                    padding: '14px 16px 0',
                  },
                },
                h(
                  'table',
                  {
                    style: {
                      width: '100%',
                      borderCollapse: 'collapse' as const,
                      backgroundColor: colors.surface,
                      border: `1px solid ${colors.border}`,
                      borderRadius: '7px',
                      overflow: 'hidden',
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
                                index === 0 ? '9px 12px' : '8px 12px 9px',
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
                { style: { padding: '14px 16px 0' } },
                h(
                  Button,
                  {
                    href: ctaHref,
                    style: {
                      backgroundColor: colors.button,
                      color: colors.buttonText,
                      fontSize: '12px',
                      lineHeight: '16px',
                      fontWeight: 600,
                      fontFamily: bodyFontStack,
                      textDecoration: 'none',
                      borderRadius: '6px',
                      padding: '8px 12px',
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
              margin: '16px 0 0',
            },
          }),
          h(
            Section,
            { style: { padding: '10px 16px 12px' } },
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
              footer ??
                'Open Vector to continue in context with the rest of your workspace.',
            ),
          ),
        ),
        h(
          Section,
          { style: { padding: '8px 1px 0' } },
          h(
            Text,
            {
              style: {
                margin: 0,
                fontSize: '10px',
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
    requestKey?: string;
    requestTitle?: string;
    workKey?: string;
    workTitle?: string;
    taskTitle?: string;
    commentPreview?: string;
    inviterName?: string;
    roleLabel?: string;
    statusLabel?: string;
    statusText?: string;
    statusEmoji?: string;
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
            value: capitalizeInviteRole(payload.roleLabel),
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
    case 'work_session_completed':
    case 'work_session_failed':
    case 'issue_reminder':
    case 'user_status_changed':
      return vectorEmailLayout({
        preview: title,
        eyebrow:
          type === 'user_status_changed'
            ? 'Status Update'
            : type === 'issue_reminder'
              ? 'Issue Reminder'
              : 'Work Session',
        title,
        body,
        ctaHref: href,
        ctaLabel:
          type === 'user_status_changed' ? 'Open workspace' : 'Open issue',
        meta: [
          ...(payload.organizationName
            ? [{ label: 'Workspace', value: payload.organizationName }]
            : []),
          ...(payload.issueKey
            ? [
                {
                  label: 'Issue',
                  value: payload.issueKey,
                  tone: 'mono' as const,
                },
              ]
            : []),
          ...(payload.statusLabel
            ? [{ label: 'Status', value: payload.statusLabel }]
            : []),
          ...(payload.statusText
            ? [
                {
                  label: 'Custom status',
                  value: [payload.statusEmoji, payload.statusText]
                    .filter(Boolean)
                    .join(' '),
                },
              ]
            : []),
        ],
      });
  }

  return vectorEmailLayout({
    preview: title,
    eyebrow: notificationEyebrow(type),
    title,
    body,
    ctaHref: href,
    ctaLabel: 'Open in Vector',
    meta: [
      ...(payload.organizationName
        ? [{ label: 'Workspace', value: payload.organizationName }]
        : []),
      ...(payload.requestKey
        ? [
            {
              label: 'Request',
              value: payload.requestKey,
              tone: 'mono' as const,
            },
          ]
        : []),
      ...(payload.workKey
        ? [
            {
              label: 'Work',
              value: payload.workKey,
              tone: 'mono' as const,
            },
          ]
        : []),
      ...(payload.issueKey
        ? [
            {
              label: 'Issue',
              value: payload.issueKey,
              tone: 'mono' as const,
            },
          ]
        : []),
      ...(payload.taskTitle
        ? [{ label: 'Task', value: payload.taskTitle }]
        : []),
    ],
  });
}

function notificationEyebrow(type: NotificationEventType) {
  switch (type) {
    case 'request_routed':
    case 'request_routing_needed':
    case 'request_completed':
      return 'Request Update';
    case 'request_ready_for_review':
    case 'request_changes_requested':
    case 'work_ready_for_review':
      return 'Review';
    case 'work_handoff_proposed':
    case 'work_handoff_accepted':
    case 'work_handoff_declined':
      return 'Handoff';
    case 'task_assigned':
    case 'task_transferred':
      return 'Task Assignment';
    case 'agent_attention_requested':
    case 'agent_attention_resolved':
    case 'work_blocked':
      return 'Attention Needed';
    case 'work_completed':
      return 'Work Update';
    case 'github_action_required':
      return 'GitHub Action';
    case 'reminder_due':
      return 'Reminder';
    default:
      return 'Notification';
  }
}
