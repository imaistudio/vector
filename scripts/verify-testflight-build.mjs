import { appendFile } from 'node:fs/promises';

import {
  configurationFromEnvironment,
  createAppStoreConnectClient,
  distributeTestFlightBuild,
  formatTestFlightSummary,
} from './testflight-distribution.mjs';

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

const client = createAppStoreConnectClient({
  keyContent: process.env.APPLE_API_KEY_CONTENT,
  keyId: process.env.APPLE_API_KEY_ID,
  issuerId: process.env.APPLE_API_ISSUER,
});
const result = await distributeTestFlightBuild({
  client,
  ...configurationFromEnvironment(process.env),
});
const summary = formatTestFlightSummary(result);

console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) {
  await appendFile(process.env.GITHUB_STEP_SUMMARY, summary);
}
