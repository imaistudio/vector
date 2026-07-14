import { notFound, redirect } from 'next/navigation';
import { fetchAuthQuery } from '@/lib/auth-server';
import { api } from '@/convex/_generated/api';

export default async function LegacyIssueRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; issueKey: string }>;
}) {
  const { orgSlug, issueKey } = await params;
  const target = await fetchAuthQuery(
    api.work.queries.resolveLegacyIssueRoute,
    { orgSlug, issueKey },
  );
  if (!target) notFound();
  const query = target.taskId ? `?task=${target.taskId}` : '';
  redirect(`/${orgSlug}/work/${target.workKey}${query}`);
}
