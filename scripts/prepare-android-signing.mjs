// Materialize and validate an Android upload keystore on an ephemeral CI
// runner. The encoded keystore and its passwords must come from secret-backed
// environment variables; only the temporary file path is exported.

import { Buffer } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const requireSigning = process.env.ANDROID_REQUIRE_SIGNING === '1';
const encodedKeystore =
  process.env.ANDROID_UPLOAD_KEYSTORE_BASE64?.trim() ?? '';
const existingKeystore = process.env.ANDROID_UPLOAD_KEYSTORE_FILE?.trim() ?? '';
const keyAlias = process.env.ANDROID_UPLOAD_KEY_ALIAS?.trim() ?? '';
const storePassword = process.env.ANDROID_UPLOAD_STORE_PASSWORD ?? '';
const keyPassword = process.env.ANDROID_UPLOAD_KEY_PASSWORD ?? '';
const githubEnv = process.env.GITHUB_ENV;

function appendGithubEnv(key, value) {
  if (!githubEnv) return;
  if (value.includes('\n') || value.includes('\r')) {
    throw new Error(`Refusing to export a multiline value for ${key}.`);
  }
  fs.appendFileSync(githubEnv, `${key}=${value}\n`, { mode: 0o600 });
}

function decodeBase64(value) {
  const normalized = value.replace(/\s/g, '');
  if (
    !normalized ||
    normalized.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]+={0,2}$/.test(normalized)
  ) {
    throw new Error('ANDROID_UPLOAD_KEYSTORE_BASE64 is not valid base64.');
  }

  const decoded = Buffer.from(normalized, 'base64');
  if (decoded.length === 0) {
    throw new Error('ANDROID_UPLOAD_KEYSTORE_BASE64 decoded to an empty file.');
  }

  const canonical = decoded.toString('base64').replace(/=+$/, '');
  if (canonical !== normalized.replace(/=+$/, '')) {
    throw new Error('ANDROID_UPLOAD_KEYSTORE_BASE64 failed validation.');
  }
  return decoded;
}

function validateInputs() {
  const missing = [];
  if (!encodedKeystore && !existingKeystore) {
    missing.push('ANDROID_UPLOAD_KEYSTORE_BASE64');
  }
  if (!keyAlias) missing.push('ANDROID_UPLOAD_KEY_ALIAS');
  if (!storePassword) missing.push('ANDROID_UPLOAD_STORE_PASSWORD');
  if (!keyPassword) missing.push('ANDROID_UPLOAD_KEY_PASSWORD');

  if (missing.length > 0) {
    throw new Error(
      `Missing required Android signing inputs: ${missing.join(', ')}.`,
    );
  }
}

function validateKeystore(keystorePath) {
  try {
    const output = execFileSync(
      'keytool',
      [
        '-list',
        '-v',
        '-keystore',
        keystorePath,
        '-storepass:env',
        'ANDROID_UPLOAD_STORE_PASSWORD',
        '-alias',
        keyAlias,
      ],
      {
        encoding: 'utf8',
        env: process.env,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    );
    if (!output.includes('PrivateKeyEntry')) {
      throw new Error('The selected alias is not a private-key entry.');
    }
    execFileSync(
      'keytool',
      [
        '-certreq',
        '-keystore',
        keystorePath,
        '-storepass:env',
        'ANDROID_UPLOAD_STORE_PASSWORD',
        '-keypass:env',
        'ANDROID_UPLOAD_KEY_PASSWORD',
        '-alias',
        keyAlias,
      ],
      {
        env: process.env,
        stdio: ['ignore', 'ignore', 'pipe'],
      },
    );
  } catch (error) {
    const detail =
      error instanceof Error && error.message.includes('private-key entry')
        ? ` ${error.message}`
        : '';
    throw new Error(
      `Unable to validate the Android upload keystore, alias, and private-key password.${detail}`,
    );
  }
}

if (!encodedKeystore && !existingKeystore && !requireSigning) {
  console.log('Android signing inputs are not set; skipping preparation.');
  process.exit(0);
}

validateInputs();

let temporaryDirectory;
let keystorePath;

try {
  if (encodedKeystore) {
    const temporaryRoot = process.env.RUNNER_TEMP || os.tmpdir();
    temporaryDirectory = fs.mkdtempSync(
      path.join(temporaryRoot, 'vector-android-signing-'),
    );
    fs.chmodSync(temporaryDirectory, 0o700);
    keystorePath = path.join(temporaryDirectory, 'upload-keystore.jks');
    fs.writeFileSync(keystorePath, decodeBase64(encodedKeystore), {
      mode: 0o600,
      flag: 'wx',
    });
  } else {
    keystorePath = path.resolve(existingKeystore);
    if (!fs.existsSync(keystorePath) || !fs.statSync(keystorePath).isFile()) {
      throw new Error('ANDROID_UPLOAD_KEYSTORE_FILE is not a readable file.');
    }
  }

  validateKeystore(keystorePath);
  appendGithubEnv('ANDROID_UPLOAD_KEYSTORE_FILE', keystorePath);
  console.log('Android upload keystore prepared and validated.');
} catch (error) {
  if (temporaryDirectory) {
    fs.rmSync(temporaryDirectory, { recursive: true, force: true });
  }
  throw error;
}
