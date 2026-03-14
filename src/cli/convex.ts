import { ConvexHttpClient } from 'convex/browser';
import { FunctionReference, OptionalRestArgs } from 'convex/server';
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

export async function runQuery<Query extends FunctionReference<'query'>>(
  client: ConvexHttpClient,
  ref: Query,
  ...args: OptionalRestArgs<Query>
) {
  return await client.query(ref, ...args);
}

export async function runMutation<
  Mutation extends FunctionReference<'mutation'>,
>(
  client: ConvexHttpClient,
  ref: Mutation,
  ...args: OptionalRestArgs<Mutation>
) {
  return await client.mutation(ref, ...args);
}

export async function runAction<Action extends FunctionReference<'action'>>(
  client: ConvexHttpClient,
  ref: Action,
  ...args: OptionalRestArgs<Action>
) {
  return await client.action(ref, ...args);
}
