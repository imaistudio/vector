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
  bg: '#f5f7fb',
  panel: '#ffffff',
  text: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  accent: '#111827',
};

function textBlock(line: string, key: string) {
  return h(
    Text,
    {
      key,
      style: {
        margin: '0 0 6px',
        fontSize: '12px',
        lineHeight: '18px',
        color: colors.muted,
      },
    },
    line,
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
}: {
  preview: string;
  eyebrow: string;
  title: string;
  body: string;
  ctaHref?: string;
  ctaLabel?: string;
  meta?: string[];
}) {
  return h(
    Html,
    null,
    h(Head),
    h(Preview, null, preview),
    h(
      Body,
      {
        style: {
          backgroundColor: colors.bg,
          fontFamily:
            'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
          color: colors.text,
          margin: 0,
          padding: '24px 0',
        },
      },
      h(
        Container,
        {
          style: {
            maxWidth: '580px',
            backgroundColor: colors.panel,
            border: `1px solid ${colors.border}`,
            borderRadius: '16px',
            overflow: 'hidden',
          },
        },
        h(
          Section,
          { style: { padding: '20px 24px 8px' } },
          h(
            Text,
            {
              style: {
                margin: 0,
                fontSize: '11px',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: colors.muted,
                fontWeight: 600,
              },
            },
            eyebrow,
          ),
          h(
            Heading,
            {
              as: 'h1',
              style: {
                margin: '10px 0 0',
                fontSize: '24px',
                lineHeight: '30px',
                fontWeight: 700,
              },
            },
            title,
          ),
          h(
            Text,
            {
              style: {
                margin: '12px 0 0',
                fontSize: '14px',
                lineHeight: '22px',
                color: colors.muted,
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
                  padding: '16px 24px 0',
                  border: `1px solid ${colors.border}`,
                  borderRadius: '12px',
                  backgroundColor: '#fafafa',
                  margin: '16px 24px 0',
                },
              },
              h(
                Section,
                {
                  style: {
                    padding: '12px 14px',
                  },
                },
                meta.map((line, index) => textBlock(line, `${index}-${line}`)),
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
                    fontSize: '14px',
                    fontWeight: 600,
                    textDecoration: 'none',
                    borderRadius: '10px',
                    padding: '12px 18px',
                  },
                },
                ctaLabel,
              ),
            )
          : null,
        h(Hr, {
          style: { borderColor: colors.border, margin: '24px 0 0' },
        }),
        h(
          Section,
          { style: { padding: '12px 24px 20px' } },
          h(
            Text,
            {
              style: {
                margin: 0,
                fontSize: '12px',
                lineHeight: '18px',
                color: colors.muted,
              },
            },
            'Vector notifications are intentionally compact: open the linked item to continue where the work is happening.',
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
        preview: title,
        eyebrow: 'Invitation',
        title,
        body,
        ctaHref: href,
        ctaLabel: 'Open invitation',
        meta: [
          `Organization: ${payload.organizationName ?? 'Unknown organization'}`,
          `Invited by: ${payload.inviterName ?? 'Unknown user'}`,
          `Role: ${payload.roleLabel ?? 'Member'}`,
        ],
      });
    case 'issue_assigned':
    case 'issue_reassigned':
      return vectorEmailLayout({
        preview: title,
        eyebrow: 'Assignment',
        title,
        body,
        ctaHref: href,
        ctaLabel: 'Open issue',
        meta: [
          `Issue: ${payload.issueKey ?? 'Unknown issue'}`,
          payload.issueTitle ? `Title: ${payload.issueTitle}` : '',
        ].filter(Boolean),
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
          `Issue: ${payload.issueKey ?? 'Unknown issue'}`,
          payload.commentPreview ? `Comment: ${payload.commentPreview}` : '',
        ].filter(Boolean),
      });
    case 'issue_comment_on_assigned_issue':
      return vectorEmailLayout({
        preview: title,
        eyebrow: 'Comment',
        title,
        body,
        ctaHref: href,
        ctaLabel: 'Open issue',
        meta: [
          `Issue: ${payload.issueKey ?? 'Unknown issue'}`,
          payload.commentPreview ? `Comment: ${payload.commentPreview}` : '',
        ].filter(Boolean),
      });
  }
}
