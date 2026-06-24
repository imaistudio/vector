// Prepare iOS code signing on macOS CI.
//
// This mirrors the Cells macOS signing setup: import a base64/file/URL .p12
// certificate into a throwaway keychain, install a provisioning profile, and
// export only derived paths/identifiers through GITHUB_ENV for later xcodebuild
// steps. Missing signing input is allowed for local/package builds unless
// IOS_REQUIRE_SIGNING=1 is set. This is intended for ephemeral CI runners; do
// not run it unchanged on shared self-hosted runners because it mutates the user
// keychain search list and installs a provisioning profile.

import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { URL } from 'node:url';

const certificateInput = firstNonEmpty(
  process.env.IOS_CERTIFICATE_P12,
  process.env.IOS_CERTIFICATE_P12_BASE64,
  process.env.IOS_SIGNING_CERTIFICATE_BASE64,
);
const certificatePassword =
  process.env.IOS_CERTIFICATE_PASSWORD ??
  process.env.IOS_SIGNING_CERTIFICATE_PASSWORD ??
  '';
const provisioningProfileInput = firstNonEmpty(
  process.env.IOS_PROVISIONING_PROFILE,
  process.env.IOS_PROVISIONING_PROFILE_BASE64,
);
const githubEnv = process.env.GITHUB_ENV;
const requireSigning = process.env.IOS_REQUIRE_SIGNING === '1';

function firstNonEmpty(...values) {
  return values.map(value => value?.trim()).find(Boolean) ?? '';
}

function appendGithubEnv(key, value) {
  if (!githubEnv || !value) return;
  fs.appendFileSync(githubEnv, `${key}=${value}\n`);
}

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options,
  });
}

function resolveSecretFile(input, tmpDir, fileName) {
  if (!input) return null;

  if (/^https?:\/\//i.test(input)) {
    const outputPath = path.join(tmpDir, fileName);
    execFileSync('curl', ['-fsSL', '--retry', '5', input, '-o', outputPath], {
      stdio: 'inherit',
    });
    return outputPath;
  }

  if (input.startsWith('file://')) {
    return new URL(input).pathname;
  }

  if (fs.existsSync(input)) {
    return input;
  }

  const outputPath = path.join(tmpDir, fileName);
  const base64 = input.replace(/^data:[^,]+,/, '').replace(/\s/g, '');
  fs.writeFileSync(outputPath, Buffer.from(base64, 'base64'));
  return outputPath;
}

function findIdentity(keychainPath) {
  const output = run('security', [
    'find-identity',
    '-v',
    '-p',
    'codesigning',
    keychainPath,
  ]);
  const lines = output.split('\n').filter(Boolean);
  const preferred =
    lines.find(line => line.includes('Apple Distribution')) ??
    lines.find(line => line.includes('iPhone Distribution')) ??
    lines.find(line => line.includes('Apple Development')) ??
    lines.find(line => line.includes('iPhone Developer')) ??
    lines[0];
  const hash = preferred?.match(/\b([A-F0-9]{40})\b/i)?.[1] ?? null;
  const name = preferred?.match(/"([^"]+)"/)?.[1] ?? null;
  return hash && name ? { hash, name } : null;
}

function plistValue(plistPath, keyPath) {
  try {
    return run('plutil', [
      '-extract',
      keyPath,
      'raw',
      '-o',
      '-',
      plistPath,
    ]).trim();
  } catch {
    return '';
  }
}

if (!certificateInput || !provisioningProfileInput) {
  if (requireSigning) {
    throw new Error(
      'IOS_CERTIFICATE_P12_BASE64 and IOS_PROVISIONING_PROFILE_BASE64 are required for signed iOS archives.',
    );
  }

  console.log('iOS signing inputs are not set; skipping signing preparation.');
  process.exit(0);
}

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vector-ios-signing-'));
const keychainPath = path.join(tmpDir, 'vector-ios-build.keychain-db');
const keychainPassword = randomUUID();
const certificatePath = resolveSecretFile(
  certificateInput,
  tmpDir,
  'certificate.p12',
);
const provisioningProfilePath = resolveSecretFile(
  provisioningProfileInput,
  tmpDir,
  'profile.mobileprovision',
);

if (!certificatePath || !fs.existsSync(certificatePath)) {
  throw new Error('Unable to resolve iOS signing certificate.');
}

if (!provisioningProfilePath || !fs.existsSync(provisioningProfilePath)) {
  throw new Error('Unable to resolve iOS provisioning profile.');
}

run('security', ['create-keychain', '-p', keychainPassword, keychainPath]);
run('security', ['set-keychain-settings', '-lut', '21600', keychainPath]);
run('security', ['unlock-keychain', '-p', keychainPassword, keychainPath]);
run('security', [
  'import',
  certificatePath,
  '-k',
  keychainPath,
  '-P',
  certificatePassword,
  '-T',
  '/usr/bin/codesign',
  '-T',
  '/usr/bin/security',
]);
run('security', [
  'set-key-partition-list',
  '-S',
  'apple-tool:,apple:,codesign:',
  '-s',
  '-k',
  keychainPassword,
  keychainPath,
]);

const existingKeychains = run('security', ['list-keychains', '-d', 'user'])
  .split('\n')
  .map(line => line.trim().replace(/^"|"$/g, ''))
  .filter(Boolean);
run('security', [
  'list-keychains',
  '-d',
  'user',
  '-s',
  keychainPath,
  ...existingKeychains,
]);

const identity = findIdentity(keychainPath);
if (!identity) {
  throw new Error(
    'No iOS code signing identity found after importing the certificate.',
  );
}

const profilePlistPath = path.join(tmpDir, 'profile.plist');
const profilePlist = run('security', [
  'cms',
  '-D',
  '-i',
  provisioningProfilePath,
]);
fs.writeFileSync(profilePlistPath, profilePlist);

const profileUuid = plistValue(profilePlistPath, 'UUID');
const profileName = plistValue(profilePlistPath, 'Name');
const teamId = plistValue(profilePlistPath, 'TeamIdentifier.0');

if (!profileUuid) {
  throw new Error('Provisioning profile does not contain a UUID.');
}

const profilesDir = path.join(
  os.homedir(),
  'Library',
  'MobileDevice',
  'Provisioning Profiles',
);
fs.mkdirSync(profilesDir, { recursive: true });
const installedProfilePath = path.join(
  profilesDir,
  `${profileUuid}.mobileprovision`,
);
fs.copyFileSync(provisioningProfilePath, installedProfilePath);

appendGithubEnv('IOS_CODESIGN_IDENTITY', identity.hash);
appendGithubEnv('IOS_CODESIGN_IDENTITY_NAME', identity.name);
appendGithubEnv('IOS_CODESIGN_KEYCHAIN', keychainPath);
appendGithubEnv('IOS_PROVISIONING_PROFILE_PATH', installedProfilePath);
appendGithubEnv('IOS_PROVISIONING_PROFILE_UUID', profileUuid);
appendGithubEnv('IOS_PROVISIONING_PROFILE_NAME', profileName || profileUuid);
appendGithubEnv('IOS_PROVISIONING_TEAM_ID', teamId);

console.log(`Imported iOS signing identity ${identity.hash}`);
console.log(`Installed provisioning profile ${profileUuid}`);
