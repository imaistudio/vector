'use node';

import { render } from '@react-email/render';
import { importPKCS8, SignJWT } from 'jose';
import nodemailer from 'nodemailer';
import webpush from 'web-push';
import { internal } from '../_generated/api';
import { internalAction } from '../_generated/server';
import { v } from 'convex/values';
import { renderNotificationEmailTemplate } from './emailTemplates';
import type { Id } from '../_generated/dataModel';

type MailTransportConfig = {
  host: string;
  port: number;
  secure: boolean;
  auth?: {
    user: string;
    pass: string;
  };
};

function getMailTransportConfig(): MailTransportConfig | null {
  const host = process.env.SMTP_HOST;
  if (!host) {
    return null;
  }

  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  return {
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  };
}

async function sendEmail({
  to,
  subject,
  html,
  fromOverride,
}: {
  to: string;
  subject: string;
  html: string;
  fromOverride?: string | null;
}) {
  const config = getMailTransportConfig();
  if (!config) {
    console.info('[notification:email:fallback]', { to, subject });
    return { providerMessageId: 'console-fallback' };
  }

  const transporter = nodemailer.createTransport(config);
  const info = await transporter.sendMail({
    from:
      fromOverride ||
      (process.env.SMTP_FROM ??
        process.env.SMTP_USER ??
        'Vector <no-reply@vector.local>'),
    to,
    subject,
    html,
  });

  return { providerMessageId: info.messageId };
}

function configureWebPush() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

type ApnsConfig = {
  teamId: string;
  keyId: string;
  privateKey: string;
  defaultTopic?: string;
};

function getApnsConfig(): ApnsConfig | null {
  const teamId = process.env.APNS_TEAM_ID;
  const keyId = process.env.APNS_KEY_ID;
  const privateKey = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!teamId || !keyId || !privateKey) {
    return null;
  }

  return {
    teamId,
    keyId,
    privateKey,
    defaultTopic: process.env.APNS_TOPIC ?? process.env.APNS_BUNDLE_ID,
  };
}

async function createApnsJwt(config: ApnsConfig) {
  const key = await importPKCS8(config.privateKey, 'ES256');
  return await new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.keyId })
    .setIssuer(config.teamId)
    .setIssuedAt()
    .sign(key);
}

type ApnsJwtCache = {
  cacheKey: string;
  jwt: string;
  expiresAt: number;
};

let apnsJwtCache: ApnsJwtCache | null = null;

async function getCachedApnsJwt(config: ApnsConfig) {
  const cacheKey = `${config.teamId}:${config.keyId}:${config.privateKey}`;
  const now = Date.now();

  if (
    apnsJwtCache &&
    apnsJwtCache.cacheKey === cacheKey &&
    apnsJwtCache.expiresAt > now
  ) {
    return apnsJwtCache.jwt;
  }

  const jwt = await createApnsJwt(config);
  apnsJwtCache = {
    cacheKey,
    jwt,
    // APNs provider tokens are valid for up to an hour. Refresh before that.
    expiresAt: now + 50 * 60 * 1000,
  };
  return jwt;
}

async function sendApnsNotification({
  token,
  environment,
  topic,
  jwt,
  title,
  body,
  href,
  recipientId,
  category,
}: {
  token: string;
  environment: 'sandbox' | 'production';
  topic: string;
  jwt: string;
  title: string;
  body: string;
  href?: string;
  recipientId: Id<'notificationRecipients'>;
  category: string;
}) {
  const host =
    environment === 'sandbox'
      ? 'https://api.sandbox.push.apple.com'
      : 'https://api.push.apple.com';
  const response = await fetch(`${host}/3/device/${token}`, {
    method: 'POST',
    headers: {
      authorization: `bearer ${jwt}`,
      'apns-topic': topic,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      aps: {
        alert: { title, body },
        sound: 'default',
      },
      href,
      recipientId,
      category,
    }),
  });

  if (response.ok) {
    return { providerMessageId: response.headers.get('apns-id') ?? undefined };
  }

  let reason = `HTTP ${response.status}`;
  try {
    const payload = (await response.json()) as { reason?: string };
    if (payload.reason) reason = payload.reason;
  } catch {
    // APNs may return an empty response body for some failures.
  }
  throw Object.assign(new Error(reason), { statusCode: response.status });
}

function shouldDisableApnsToken(
  statusCode: number | undefined,
  error: unknown,
) {
  const reason = error instanceof Error ? error.message : undefined;
  return (
    statusCode === 410 ||
    (statusCode === 400 &&
      (reason === 'BadDeviceToken' || reason === 'Unregistered'))
  );
}

export const sendCustomEmail = internalAction({
  args: {
    to: v.string(),
    subject: v.string(),
    html: v.string(),
  },
  handler: async (_ctx, args) => {
    const result = await sendEmail({
      to: args.to,
      subject: args.subject,
      html: args.html,
    });
    return result;
  },
});

export const deliverRecipient = internalAction({
  args: {
    recipientId: v.id('notificationRecipients'),
  },
  handler: async (ctx, args) => {
    const context = await ctx.runQuery(
      internal.notifications.queries.getDeliveryContext,
      {
        recipientId: args.recipientId,
      },
    );

    if (!context) {
      return null;
    }

    const {
      recipient,
      event,
      user,
      preference,
      pushSubscriptions,
      mobilePushTokens,
    } = context;
    const mandatoryInviteEmail = event.type === 'organization_invite';
    const emailEnabled = mandatoryInviteEmail || preference.emailEnabled;

    if (!recipient.email && !user?.email) {
      await ctx.runMutation(
        internal.notifications.mutations.setDeliveryResult,
        {
          recipientId: recipient._id,
          channel: 'email',
          status: 'skipped',
          lastError: 'No email address available',
        },
      );
    } else if (!emailEnabled) {
      await ctx.runMutation(
        internal.notifications.mutations.setDeliveryResult,
        {
          recipientId: recipient._id,
          channel: 'email',
          status: 'skipped',
          lastError: 'Email disabled by preference',
        },
      );
    } else {
      try {
        // Resolve relative hrefs to absolute URLs for emails
        const baseUrl = (
          process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        ).replace(/\/$/, '');
        const absoluteHref =
          recipient.href && !recipient.href.startsWith('http')
            ? `${baseUrl}${recipient.href}`
            : recipient.href;

        const html = await render(
          renderNotificationEmailTemplate({
            type: event.type,
            title: recipient.title,
            body: recipient.body,
            href: absoluteHref,
            payload: event.payload,
          }),
        );

        // Fetch configured from address from siteSettings
        const configuredFrom = await ctx.runQuery(
          internal.platformAdmin.queries.getEmailFromAddress,
          {},
        );

        const result = await sendEmail({
          to: recipient.email ?? user?.email ?? '',
          subject: recipient.title,
          html,
          fromOverride: configuredFrom,
        });

        await ctx.runMutation(
          internal.notifications.mutations.setDeliveryResult,
          {
            recipientId: recipient._id,
            channel: 'email',
            status: 'sent',
            providerMessageId: result.providerMessageId,
          },
        );
      } catch (error) {
        await ctx.runMutation(
          internal.notifications.mutations.setDeliveryResult,
          {
            recipientId: recipient._id,
            channel: 'email',
            status: 'failed',
            lastError:
              error instanceof Error ? error.message : 'Unknown email error',
          },
        );
      }
    }

    if (!recipient.userId) {
      return null;
    }

    if (!preference.pushEnabled) {
      await ctx.runMutation(
        internal.notifications.mutations.setDeliveryResult,
        {
          recipientId: recipient._id,
          channel: 'push',
          status: 'skipped',
          lastError: 'Push disabled by preference',
        },
      );
      return null;
    }

    if (pushSubscriptions.length === 0 && mobilePushTokens.length === 0) {
      await ctx.runMutation(
        internal.notifications.mutations.setDeliveryResult,
        {
          recipientId: recipient._id,
          channel: 'push',
          status: 'skipped',
          lastError: 'No active push subscriptions',
        },
      );
      return null;
    }

    let sent = false;
    const pushErrors: string[] = [];

    if (pushSubscriptions.length > 0) {
      if (!configureWebPush()) {
        pushErrors.push('VAPID keys are not configured');
      } else {
        for (const subscription of pushSubscriptions) {
          try {
            await webpush.sendNotification(
              {
                endpoint: subscription.endpoint,
                keys: {
                  p256dh: subscription.p256dh,
                  auth: subscription.auth,
                },
              },
              JSON.stringify({
                title: recipient.title,
                body: recipient.body,
                href: recipient.href,
                recipientId: recipient._id,
                category: recipient.category,
              }),
            );
            sent = true;
          } catch (error) {
            const statusCode =
              typeof error === 'object' &&
              error !== null &&
              'statusCode' in error &&
              typeof error.statusCode === 'number'
                ? error.statusCode
                : undefined;

            if (statusCode === 404 || statusCode === 410) {
              await ctx.runMutation(
                internal.notifications.mutations.disablePushSubscription,
                {
                  subscriptionId: subscription._id,
                },
              );
            }
            pushErrors.push(
              error instanceof Error
                ? `Web push: ${error.message}`
                : 'Web push failed',
            );
          }
        }
      }
    }

    if (mobilePushTokens.length > 0) {
      const apnsConfig = getApnsConfig();
      if (!apnsConfig) {
        pushErrors.push('APNs credentials are not configured');
      } else {
        const jwt = await getCachedApnsJwt(apnsConfig);
        for (const mobileToken of mobilePushTokens) {
          const topic = mobileToken.bundleId ?? apnsConfig.defaultTopic;
          if (!topic) {
            pushErrors.push('APNs topic is not configured');
            continue;
          }

          try {
            await sendApnsNotification({
              token: mobileToken.token,
              environment: mobileToken.environment,
              topic,
              jwt,
              title: recipient.title,
              body: recipient.body,
              href: recipient.href,
              recipientId: recipient._id,
              category: recipient.category,
            });
            sent = true;
          } catch (error) {
            const statusCode =
              typeof error === 'object' &&
              error !== null &&
              'statusCode' in error &&
              typeof error.statusCode === 'number'
                ? error.statusCode
                : undefined;
            if (shouldDisableApnsToken(statusCode, error)) {
              await ctx.runMutation(
                internal.notifications.mutations.disableMobilePushToken,
                {
                  tokenId: mobileToken._id,
                },
              );
            }
            pushErrors.push(
              error instanceof Error ? `APNs: ${error.message}` : 'APNs failed',
            );
          }
        }
      }
    }

    await ctx.runMutation(internal.notifications.mutations.setDeliveryResult, {
      recipientId: recipient._id,
      channel: 'push',
      status: sent ? 'sent' : 'failed',
      lastError: sent
        ? pushErrors.length > 0
          ? pushErrors.join('; ')
          : undefined
        : pushErrors.join('; ') || 'Push delivery failed for all subscriptions',
    });

    return null;
  },
});
