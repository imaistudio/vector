import { render } from '@react-email/render';
import { describe, expect, it } from 'vitest';
import { renderNotificationEmailTemplate } from './emailTemplates';
import { NOTIFICATION_EVENT_TYPES } from './shared';

describe('notification email templates', () => {
  it.each(NOTIFICATION_EVENT_TYPES)('renders a body for %s', async type => {
    const html = await render(
      renderNotificationEmailTemplate({
        type,
        title: 'Notification title',
        body: 'Notification body',
        href: 'https://vector.example/acme/work/VEC-123',
        payload: {
          organizationName: 'Acme',
          issueKey: 'VEC-123',
          issueTitle: 'Issue title',
          requestKey: 'REQ-123',
          requestTitle: 'Request title',
          workKey: 'VEC-123',
          workTitle: 'Work title',
          taskTitle: 'Task title',
          commentPreview: 'Comment preview',
          inviterName: 'A teammate',
          roleLabel: 'member',
          statusLabel: 'Available',
        },
      }),
    );

    expect(html.trim().length).toBeGreaterThan(500);
    expect(html).toContain('Sent by Vector');
  });
});
