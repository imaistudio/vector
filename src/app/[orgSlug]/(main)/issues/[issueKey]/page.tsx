import { notFound, redirect } from 'next/navigation';
import { fetchAuthQuery, isAuthenticated } from '@/lib/auth-server';
import { api } from '@/convex/_generated/api';

export default async function LegacyIssueRoute({
  params,
}: {
  params: Promise<{ orgSlug: string; issueKey: string }>;
}) {
  const { orgSlug, issueKey } = await params;
  const legacyPath = `/${orgSlug}/issues/${issueKey}`;
  if (!(await isAuthenticated())) {
    redirect(`/auth/login?redirectTo=${encodeURIComponent(legacyPath)}`);
  }
  let target: { workKey: string; taskId: string | null } | null;
  try {
    target = await fetchAuthQuery(api.work.queries.resolveLegacyIssueRoute, {
      orgSlug,
      issueKey,
    });
  } catch {
    notFound();
  }
  if (!target) notFound();
  const query = target.taskId ? `?task=${target.taskId}` : '';
  redirect(`/${orgSlug}/work/${target.workKey}${query}`);
}
