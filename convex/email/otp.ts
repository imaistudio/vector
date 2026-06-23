'use node';

import nodemailer from 'nodemailer';
import { v } from 'convex/values';
import { internalAction } from '../_generated/server';

export type OtpEmailType =
  | 'sign-in'
  | 'email-verification'
  | 'forget-password'
  | 'change-email';

const colors = {
  bg: '#eefcfb',
  panel: '#ffffff',
  surface: '#f8fafc',
  text: '#18181b',
  muted: '#71717a',
  border: '#e4e4e7',
  accent: '#2f93b0',
  accentDark: '#287f98',
};

const fontStack =
  'Poppins, Inter, SF Pro Text, Segoe UI, Helvetica Neue, Arial, sans-serif';
const titleFontStack =
  'Urbanist, Poppins, Inter, Segoe UI, Helvetica Neue, Arial, sans-serif';
const monoFontStack =
  'SFMono-Regular, JetBrains Mono, Menlo, Monaco, Consolas, monospace';

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function otpEmailHtml({
  title,
  description,
  otp,
}: {
  title: string;
  description: string;
  otp: string;
}) {
  const safeTitle = escapeHtml(title);
  const safeDescription = escapeHtml(description);
  const safeOtp = escapeHtml(otp);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${safeTitle}</title></head>
<body style="margin:0; background-color:${colors.bg}; font-family:${fontStack}; color:${colors.text}; padding:36px 12px;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="100%" style="max-width:560px;">
    <tr><td style="padding:0 0 12px;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0">
        <tr>
          <td style="width:24px; height:24px; border-radius:8px; background-color:${colors.text}; color:#ffffff; font-family:${titleFontStack}; font-size:13px; line-height:24px; font-weight:700; text-align:center;">V</td>
          <td style="padding-left:8px; font-family:${titleFontStack}; font-size:14px; line-height:20px; font-weight:700; color:${colors.text};">Vector</td>
        </tr>
      </table>
    </td></tr>
    <tr><td style="background-color:${colors.panel}; border:1px solid ${colors.border}; border-radius:12px; overflow:hidden; box-shadow:0 18px 50px rgba(15, 23, 42, 0.08);">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr><td style="height:4px; background-color:${colors.accent}; font-size:0; line-height:0;">&nbsp;</td></tr>
        <tr><td style="padding:22px 24px 0;">
          <div style="margin:0; font-size:10px; line-height:14px; letter-spacing:0.08em; text-transform:uppercase; color:${colors.accentDark}; font-weight:700;">Secure code</div>
          <h1 style="margin:8px 0 0; font-family:${titleFontStack}; font-size:24px; line-height:30px; font-weight:700; color:${colors.text};">${safeTitle}</h1>
          <p style="margin:8px 0 0; font-size:13px; line-height:21px; color:${colors.muted};">${safeDescription}</p>
        </td></tr>
        <tr><td style="padding:18px 24px 0;">
          <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color:${colors.surface}; border:1px solid ${colors.border}; border-radius:10px;">
            <tr><td style="padding:22px 16px 18px; text-align:center;">
              <div style="font-family:${monoFontStack}; font-weight:700; font-size:34px; line-height:40px; letter-spacing:10px; color:${colors.text};">${safeOtp}</div>
              <div style="margin-top:8px; color:${colors.muted}; font-size:12px; line-height:18px;">Enter this code in Vector to continue.</div>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding:16px 24px 0;">
          <p style="margin:0; color:${colors.muted}; font-size:12px; line-height:18px;">This code expires in 15 minutes. If you did not request it, you can ignore this email.</p>
        </td></tr>
        <tr><td><hr style="border:none; border-top:1px solid ${colors.border}; margin:24px 0 0;" /></td></tr>
        <tr><td style="padding:12px 24px 18px;">
          <p style="margin:0; font-size:11px; line-height:17px; color:${colors.muted};">Vector will never ask for this code outside the sign-in or verification flow.</p>
        </td></tr>
      </table>
    </td></tr>
    <tr><td style="padding:12px 2px 0;">
      <p style="margin:0; font-size:11px; line-height:16px; color:${colors.muted};">Sent by Vector</p>
    </td></tr>
  </table>
</body>
</html>`;
}

const templates: Record<
  OtpEmailType,
  { subject: string; title: string; description: string }
> = {
  'sign-in': {
    subject: 'Sign in to Vector',
    title: 'Sign in to Vector',
    description: 'Use the 4-digit code below to sign in:',
  },
  'email-verification': {
    subject: 'Verify your email — Vector',
    title: 'Verify your email',
    description: 'Use the 4-digit code below to verify your email address:',
  },
  'forget-password': {
    subject: 'Reset your password — Vector',
    title: 'Reset your password',
    description: 'Use the 4-digit code below to reset your password:',
  },
  'change-email': {
    subject: 'Confirm your new email — Vector',
    title: 'Confirm your new email',
    description: 'Use the 4-digit code below to confirm this email address:',
  },
};

export const sendOtpEmail = internalAction({
  args: {
    to: v.string(),
    otp: v.string(),
    type: v.union(
      v.literal('sign-in'),
      v.literal('email-verification'),
      v.literal('forget-password'),
      v.literal('change-email'),
    ),
  },
  handler: async (_ctx, { to, otp, type }) => {
    const template = templates[type];
    const html = otpEmailHtml({
      title: template.title,
      description: template.description,
      otp,
    });

    const host = process.env.SMTP_HOST;
    if (!host) {
      console.info(`[otp:email:fallback] ${type} for ${to}: ${otp}`);
      return;
    }

    const port = Number(process.env.SMTP_PORT ?? 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: user && pass ? { user, pass } : undefined,
    });

    await transporter.sendMail({
      from:
        process.env.SMTP_FROM ??
        process.env.SMTP_USER ??
        'Vector <no-reply@vector.local>',
      to,
      subject: template.subject,
      html,
    });
  },
});
