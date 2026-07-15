import { createPrivateKey, sign } from 'node:crypto';
import { appendFile } from 'node:fs/promises';

const requiredEnvironment = [
  'APPLE_API_KEY_CONTENT',
  'APPLE_API_KEY_ID',
  'APPLE_API_ISSUER',
  'IOS_BUNDLE_ID',
  'TESTFLIGHT_BUILD_NUMBER',
];

for (const name of requiredEnvironment) {
  if (!process.env[name]) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
}

const keyId = process.env.APPLE_API_KEY_ID;
const issuerId = process.env.APPLE_API_ISSUER;
const bundleId = process.env.IOS_BUNDLE_ID;
const buildNumber = process.env.TESTFLIGHT_BUILD_NUMBER;
const maxAttempts = Number(process.env.TESTFLIGHT_VERIFY_ATTEMPTS ?? 40);
const delayMs = Number(process.env.TESTFLIGHT_VERIFY_DELAY_MS ?? 30_000);

if (!Number.isInteger(maxAttempts) || maxAttempts < 1) {
  throw new Error('TESTFLIGHT_VERIFY_ATTEMPTS must be a positive integer.');
}

if (!Number.isFinite(delayMs) || delayMs < 0) {
  throw new Error('TESTFLIGHT_VERIFY_DELAY_MS must be a non-negative number.');
}

const base64Url = value => Buffer.from(value).toString('base64url');
const now = Math.floor(Date.now() / 1000);
const header = base64Url(
  JSON.stringify({ alg: 'ES256', kid: keyId, typ: 'JWT' }),
);
const payload = base64Url(
  JSON.stringify({
    iss: issuerId,
    iat: now,
    exp: now + 20 * 60,
    aud: 'appstoreconnect-v1',
  }),
);
const signingInput = `${header}.${payload}`;
const signature = sign('sha256', Buffer.from(signingInput), {
  key: createPrivateKey(process.env.APPLE_API_KEY_CONTENT),
  dsaEncoding: 'ieee-p1363',
}).toString('base64url');
const token = `${signingInput}.${signature}`;

const request = async path => {
  const response = await fetch(`https://api.appstoreconnect.apple.com${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(
      `App Store Connect request failed (${response.status}): ${body.slice(0, 1_000)}`,
    );
  }

  return response.json();
};

const apps = await request(
  `/v1/apps?filter%5BbundleId%5D=${encodeURIComponent(bundleId)}&limit=1`,
);
const app = apps.data?.[0];

if (!app) {
  throw new Error(`No App Store Connect app found for bundle ID ${bundleId}.`);
}

const sleep = milliseconds =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
  const builds = await request(
    `/v1/builds?filter%5Bapp%5D=${encodeURIComponent(app.id)}` +
      `&filter%5Bversion%5D=${encodeURIComponent(buildNumber)}` +
      '&sort=-uploadedDate&limit=1',
  );
  const build = builds.data?.[0];

  if (!build) {
    console.log(
      `TestFlight build ${buildNumber} is not visible yet (${attempt}/${maxAttempts}).`,
    );
  } else {
    const state = build.attributes?.processingState ?? 'UNKNOWN';
    console.log(
      `TestFlight build ${buildNumber} processing state: ${state} (${attempt}/${maxAttempts}).`,
    );

    if (state === 'VALID') {
      if (process.env.GITHUB_STEP_SUMMARY) {
        await appendFile(
          process.env.GITHUB_STEP_SUMMARY,
          [
            '',
            '## TestFlight verification',
            '',
            `- Bundle ID: \`${bundleId}\``,
            `- Build number: \`${buildNumber}\``,
            '- Processing state: `VALID`',
            '',
          ].join('\n'),
        );
      }
      process.exit(0);
    }

    if (state === 'FAILED' || state === 'INVALID') {
      throw new Error(
        `TestFlight build ${buildNumber} finished processing with state ${state}.`,
      );
    }
  }

  if (attempt < maxAttempts) {
    await sleep(delayMs);
  }
}

throw new Error(
  `TestFlight build ${buildNumber} did not become VALID within ${maxAttempts} attempts.`,
);
