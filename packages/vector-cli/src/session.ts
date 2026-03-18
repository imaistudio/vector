import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import path from 'node:path';

export type CliSession = {
  version: 1;
  appUrl?: string;
  convexUrl?: string;
  activeOrgSlug?: string;
  cookies: Record<string, string>;
  bearerToken?: string;
};

function getSessionRoot() {
  return process.env.VECTOR_HOME?.trim() || path.join(homedir(), '.vector');
}

export function getSessionPath(profile = 'default') {
  return path.join(getSessionRoot(), `cli-${profile}.json`);
}

export async function readSession(profile = 'default') {
  try {
    const raw = await readFile(getSessionPath(profile), 'utf8');
    const parsed = JSON.parse(raw) as Partial<CliSession>;
    return {
      version: 1,
      cookies: {},
      ...parsed,
    } satisfies CliSession;
  } catch {
    return null;
  }
}

export async function writeSession(session: CliSession, profile = 'default') {
  await mkdir(getSessionRoot(), { recursive: true });
  await writeFile(
    getSessionPath(profile),
    `${JSON.stringify(session, null, 2)}\n`,
    'utf8',
  );
}

export async function clearSession(profile = 'default') {
  await rm(getSessionPath(profile), { force: true });
}

export function createEmptySession(): CliSession {
  return {
    version: 1,
    cookies: {},
  };
}
