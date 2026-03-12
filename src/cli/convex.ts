import { ConvexHttpClient } from 'convex/browser';
import { FunctionReference } from 'convex/server';
import { fetchConvexToken } from './auth';
import { CliSession } from './session';

export async function createConvexClient(
  session: CliSession,
  appUrl: string,
  convexUrl: string,
) {
  const { token } = await fetchConvexToken(session, appUrl);
  const client = new ConvexHttpClient(convexUrl);
  client.setAuth(token);
  return client;
}

export async function runQuery<Args extends Record<string, unknown>, Result>(
  client: ConvexHttpClient,
  ref: FunctionReference<'query', 'public', Args, Result>,
  args: Args,
) {
  return await client.query(ref, args);
}

export async function runMutation<Args extends Record<string, unknown>, Result>(
  client: ConvexHttpClient,
  ref: FunctionReference<'mutation', 'public', Args, Result>,
  args: Args,
) {
  return await client.mutation(ref, args);
}

export async function runAction<Args extends Record<string, unknown>, Result>(
  client: ConvexHttpClient,
  ref: FunctionReference<'action', 'public', Args, Result>,
  args: Args,
) {
  return await client.action(ref, args);
}
