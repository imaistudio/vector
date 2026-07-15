import { saveMessage } from '@convex-dev/agent';
import { ConvexError, v } from 'convex/values';
import { components, internal } from '../_generated/api';
import type { Doc, Id } from '../_generated/dataModel';
import {
  internalMutation,
  mutation,
  type MutationCtx,
} from '../_generated/server';
import {
  getOrganizationBySlug,
  requireAuthUser,
  requireOrgPermission,
} from '../authz';
import { canEditIssue } from '../access';
import {
  recordActivity,
  resolveIssueScope,
  snapshotForIssue,
} from '../activities/lib';
import { PERMISSIONS } from '../_shared/permissions';
import { buildIssueSearchText } from '../issues/search';
import { getNextAvailableIssueKey, getNextSequenceSeed } from '../issues/keys';
import {
  nextRequestKey,
  requestFocusRank,
  requestSearchText,
} from '../requests/lib';
import { createNotificationEvent, getRequestHref } from '../notifications/lib';
import { workFocusRank } from '../work/lib';
import {
  buildArtifactExternalKey,
  normalizeIssueKey,
  selectWorkflowTypeFromGitHubIssues,
  selectWorkflowTypeFromPullRequests,
  type GitHubArtifactType,
} from './shared';

async function getOrCreateIntegration(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
) {
  const existing = await ctx.db
    .query('githubIntegrations')
    .withIndex('by_org_provider', q =>
      q.eq('organizationId', organizationId).eq('provider', 'github'),
    )
    .first();

  if (existing) return existing;

  const id = await ctx.db.insert('githubIntegrations', {
    organizationId,
    provider: 'github',
    autoLinkEnabled: true,
    keyLinkEnabled: true,
    aiMatchEnabled: true,
    unmatchedArtifactPolicy: 'development_inbox',
    stateAutomationPolicy: 'manual',
    identityContributionPolicy: 'contributors',
    githubNotificationPolicy: 'action_only',
    connectionMode: 'webhook',
    updatedAt: Date.now(),
  });
  return await ctx.db.get('githubIntegrations', id);
}

async function getIssueStateIdByType(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  type: Doc<'issueStates'>['type'],
) {
  return await ctx.db
    .query('issueStates')
    .withIndex('by_org_type', q =>
      q.eq('organizationId', organizationId).eq('type', type),
    )
    .first()
    .then(state => state?._id ?? null);
}

async function getDefaultAssignmentState(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
) {
  return (
    (await ctx.db
      .query('issueStates')
      .withIndex('by_org_type', q =>
        q.eq('organizationId', organizationId).eq('type', 'in_progress'),
      )
      .first()) ??
    (await ctx.db
      .query('issueStates')
      .withIndex('by_org_type', q =>
        q.eq('organizationId', organizationId).eq('type', 'todo'),
      )
      .first()) ??
    (await ctx.db
      .query('issueStates')
      .withIndex('by_organization', q => q.eq('organizationId', organizationId))
      .order('asc')
      .first()) ??
    null
  );
}

function buildImportedPullRequestDescription(args: {
  repoFullName: string;
  number: number;
  url: string;
  body?: string | null;
}) {
  return [
    `Imported from GitHub PR ${args.repoFullName}#${args.number}`,
    args.url,
    args.body?.trim() || null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

function buildImportedGitHubIssueDescription(args: {
  repoFullName: string;
  number: number;
  url: string;
  body?: string | null;
}) {
  return [
    `Imported from GitHub issue ${args.repoFullName}#${args.number}`,
    args.url,
    args.body?.trim() || null,
  ]
    .filter(Boolean)
    .join('\n\n');
}

const PULL_REQUEST_SUMMARY_START = '<!-- vector-github-pr-summary:start -->';
const PULL_REQUEST_SUMMARY_END = '<!-- vector-github-pr-summary:end -->';

function stripManagedPullRequestSummary(description?: string | null) {
  if (!description) {
    return '';
  }

  return description
    .replace(
      new RegExp(
        `${PULL_REQUEST_SUMMARY_START}[\\s\\S]*?${PULL_REQUEST_SUMMARY_END}`,
        'g',
      ),
      '',
    )
    .trim();
}

function stripLegacyImportedPullRequestDescription(args: {
  description?: string | null;
  legacyImportedDescriptions?: string[];
}) {
  const description = stripManagedPullRequestSummary(args.description);
  if (!description.trim().startsWith('Imported from GitHub PR ')) {
    return description.trim();
  }

  const trimmedDescription = description.trim();
  const matchingLegacyDescription = (args.legacyImportedDescriptions ?? [])
    .map(value => value.trim())
    .sort((a, b) => b.length - a.length)
    .find(value => trimmedDescription.startsWith(value));

  if (matchingLegacyDescription) {
    return trimmedDescription.slice(matchingLegacyDescription.length).trim();
  }

  return trimmedDescription
    .replace(
      /^Imported from GitHub PR [^\n]+\n+(?:https?:\/\/[^\n]+)(?:\n+)?/i,
      '',
    )
    .trim();
}

function mergeIssueDescriptionWithPullRequestSummary(args: {
  currentDescription?: string | null;
  summaryMarkdown?: string | null;
  legacyImportedDescriptions?: string[];
}) {
  const userDescription = stripLegacyImportedPullRequestDescription({
    description: args.currentDescription,
    legacyImportedDescriptions: args.legacyImportedDescriptions,
  });

  if (!args.summaryMarkdown?.trim()) {
    return userDescription.trim();
  }

  return [
    userDescription || null,
    PULL_REQUEST_SUMMARY_START,
    args.summaryMarkdown.trim(),
    PULL_REQUEST_SUMMARY_END,
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

async function queueIssueDescriptionRefreshForAssistantThreads(
  ctx: MutationCtx,
  args: {
    organization: Doc<'organizations'>;
    issue: Doc<'issues'>;
    pullRequest: Doc<'githubPullRequests'>;
    repoFullName: string;
    previousImportedDescription: string;
    nextImportedDescription: string;
  },
) {
  const scopedThreads = await ctx.db
    .query('assistantThreads')
    .withIndex('by_org_context_entity', q =>
      q
        .eq('organizationId', args.organization._id)
        .eq('lastContextType', 'issue_detail')
        .eq('lastEntityKey', args.issue.key),
    )
    .collect();

  if (scopedThreads.length === 0) {
    return;
  }

  const pageContext = {
    kind: 'issue_detail' as const,
    orgSlug: args.organization.slug,
    path:
      args.issue.key.trim().length > 0
        ? args.issue.kind === 'work'
          ? `/${args.organization.slug}/work/${args.issue.key}`
          : `/${args.organization.slug}/issues/${args.issue.key}`
        : args.issue.kind === 'work'
          ? `/${args.organization.slug}/work`
          : `/${args.organization.slug}/issues`,
    issueKey: args.issue.key,
    entityType: 'issue' as const,
    entityId: String(args.issue._id),
    entityKey: args.issue.key,
  };

  const prompt = [
    `The linked GitHub pull request ${args.repoFullName}#${args.pullRequest.number} description changed.`,
    'Update the current issue description so it reflects the latest pull request description while preserving any issue-specific context that still matters.',
    `Current issue description:\n${args.issue.description ?? '(empty)'}`,
    `Previous imported pull request description:\n${args.previousImportedDescription}`,
    `Latest imported pull request description:\n${args.nextImportedDescription}`,
    `Pull request URL: ${args.pullRequest.url}`,
  ].join('\n\n');

  for (const thread of scopedThreads) {
    if (thread.threadStatus === 'pending') {
      continue;
    }

    const saved = await saveMessage(ctx, components.agent, {
      threadId: thread.threadId,
      userId: thread.userId,
      prompt,
    });

    await ctx.db.patch('assistantThreads', thread._id, {
      updatedAt: Date.now(),
      threadStatus: 'pending',
      errorMessage: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.ai.actions.generateResponse, {
      assistantThreadId: thread._id,
      orgSlug: args.organization.slug,
      userId: thread.userId,
      threadId: thread.threadId,
      promptMessageId: saved.messageId,
      pageContext,
    });
  }
}

async function resolveOrgMemberByGitHubIdentity(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  identity: {
    githubUserId?: number | null;
    githubUsername?: string | null;
    email?: string | null;
  },
) {
  const candidateUsers: Doc<'users'>[] = [];
  const seenUserIds = new Set<string>();

  const addCandidate = (user: Doc<'users'> | null) => {
    if (!user) return;
    const key = String(user._id);
    if (seenUserIds.has(key)) return;
    seenUserIds.add(key);
    candidateUsers.push(user);
  };

  const addCandidateFromBetterAuthUser = async (authUserId: string | null) => {
    if (!authUserId) return;

    const authUser = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'user',
      where: [
        {
          field: '_id',
          operator: 'eq',
          value: authUserId,
        },
      ],
    });

    if (!authUser) return;

    const localUserId =
      typeof authUser.userId === 'string'
        ? ctx.db.normalizeId('users', authUser.userId)
        : null;
    if (localUserId) {
      addCandidate(await ctx.db.get('users', localUserId));
      return;
    }

    if (typeof authUser.email === 'string' && authUser.email.length > 0) {
      addCandidate(
        await ctx.db
          .query('users')
          .withIndex('email', q => q.eq('email', authUser.email))
          .first(),
      );
    }
  };

  const addCandidateFromGitHubAccountId = async (accountId: string | null) => {
    if (!accountId) return;

    const account = await ctx.runQuery(components.betterAuth.adapter.findOne, {
      model: 'account',
      where: [
        {
          field: 'providerId',
          operator: 'eq',
          value: 'github',
        },
        {
          field: 'accountId',
          operator: 'eq',
          value: accountId,
        },
      ],
    });

    await addCandidateFromBetterAuthUser(account?.userId ?? null);
  };

  if (typeof identity.githubUserId === 'number') {
    addCandidate(
      await ctx.db
        .query('users')
        .withIndex('by_github_user_id', q =>
          q.eq('githubUserId', identity.githubUserId!),
        )
        .first(),
    );

    if (candidateUsers.length === 0) {
      await addCandidateFromGitHubAccountId(String(identity.githubUserId));
    }
  }

  if (identity.githubUsername) {
    addCandidate(
      await ctx.db
        .query('users')
        .withIndex('by_github_username', q =>
          q.eq('githubUsername', identity.githubUsername!),
        )
        .first(),
    );

    if (candidateUsers.length === 0) {
      await addCandidateFromGitHubAccountId(identity.githubUsername);
    }
  }

  if (identity.email) {
    addCandidate(
      await ctx.db
        .query('users')
        .withIndex('email', q => q.eq('email', identity.email!))
        .first(),
    );
  }

  for (const candidate of candidateUsers) {
    const membership = await ctx.db
      .query('members')
      .withIndex('by_org_user', q =>
        q.eq('organizationId', organizationId).eq('userId', candidate._id),
      )
      .first();
    if (!membership) continue;

    if (
      (identity.githubUserId &&
        candidate.githubUserId !== identity.githubUserId) ||
      (identity.githubUsername &&
        candidate.githubUsername !== identity.githubUsername)
    ) {
      await ctx.db.patch('users', candidate._id, {
        githubUserId:
          identity.githubUserId ?? candidate.githubUserId ?? undefined,
        githubUsername:
          identity.githubUsername ?? candidate.githubUsername ?? undefined,
      });
    }

    return candidate;
  }

  return null;
}

async function recordGithubLinkActivity(
  ctx: MutationCtx,
  issue: Doc<'issues'>,
  actorId: Id<'users'> | undefined,
  eventType:
    | 'issue_github_artifact_linked'
    | 'issue_github_artifact_unlinked'
    | 'issue_github_artifact_suppressed'
    | 'issue_github_artifact_status_changed',
  toLabel: string,
) {
  if (!actorId) return;
  await recordActivity(ctx, {
    scope: resolveIssueScope(issue),
    actorId,
    entityType: 'issue',
    eventType,
    details: {
      toLabel,
    },
    snapshot: snapshotForIssue(issue),
  });
}

async function loadWorkflowEvidence(
  ctx: MutationCtx,
  links: Doc<'githubArtifactLinks'>[],
) {
  const pullRequests = await Promise.all(
    links
      .map(link => link.pullRequestId)
      .filter((id): id is Id<'githubPullRequests'> => Boolean(id))
      .map(id => ctx.db.get('githubPullRequests', id)),
  ).then(items =>
    items.filter((item): item is NonNullable<typeof item> => item !== null),
  );
  const githubIssues = await Promise.all(
    links
      .map(link => link.githubIssueId)
      .filter((id): id is Id<'githubIssues'> => Boolean(id))
      .map(id => ctx.db.get('githubIssues', id)),
  ).then(items =>
    items.filter((item): item is NonNullable<typeof item> => item !== null),
  );
  return { pullRequests, githubIssues };
}

async function applyTaskScopedWorkflowAutomation(
  ctx: MutationCtx,
  work: Doc<'issues'>,
  links: Doc<'githubArtifactLinks'>[],
) {
  const taskIds = Array.from(
    new Set(
      links
        .map(link => link.taskId)
        .filter((id): id is Id<'tasks'> => Boolean(id)),
    ),
  );
  let changed = false;
  let doneDelta = 0;
  for (const taskId of taskIds) {
    const task = await ctx.db.get('tasks', taskId);
    if (!task || task.workId !== work._id) continue;
    const taskLinks = links.filter(link => link.taskId === taskId);
    const { pullRequests, githubIssues } = await loadWorkflowEvidence(
      ctx,
      taskLinks,
    );
    const targetType =
      selectWorkflowTypeFromPullRequests(pullRequests.map(pr => pr.state)) ??
      selectWorkflowTypeFromGitHubIssues(githubIssues.map(item => item.state));
    if (!targetType) {
      const recipientId = task.assigneeId ?? work.ownerId;
      if (
        recipientId &&
        pullRequests.length > 0 &&
        pullRequests.every(pr => pr.state === 'closed')
      ) {
        const organization = await ctx.db.get(
          'organizations',
          work.organizationId,
        );
        await createNotificationEvent(ctx, {
          type: 'github_action_required',
          organizationId: work.organizationId,
          issueId: work._id,
          taskId: task._id,
          payload: {
            workKey: work.key,
            workTitle: work.title,
            taskTitle: task.title,
            href: organization
              ? `/${organization.slug}/work/${work.key}?task=${task._id}`
              : undefined,
          },
          recipients: [{ userId: recipientId }],
          dedupeKey: `github-task-closed-unmerged:${task._id}:${pullRequests
            .map(pr => pr._id)
            .sort()
            .join(',')}`,
        });
      }
      continue;
    }
    const nextStatus =
      targetType === 'done'
        ? 'done'
        : targetType === 'canceled'
          ? 'canceled'
          : targetType === 'in_progress'
            ? 'in_progress'
            : 'todo';
    if (task.status === nextStatus) continue;
    const now = Date.now();
    await ctx.db.patch('tasks', task._id, {
      status: nextStatus,
      startedAt:
        nextStatus === 'in_progress' ? (task.startedAt ?? now) : task.startedAt,
      completedAt: nextStatus === 'done' ? now : undefined,
      updatedAt: now,
    });
    if (task.status !== 'done' && nextStatus === 'done') doneDelta += 1;
    if (task.status === 'done' && nextStatus !== 'done') doneDelta -= 1;
    changed = true;
    const actorId = work.createdBy ?? work.reporterId;
    if (actorId) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(work),
        taskId: task._id,
        actorId,
        entityType: 'task',
        eventType: 'task_status_changed',
        details: {
          field: 'status',
          fromLabel: task.status,
          toLabel: nextStatus,
        },
        snapshot: snapshotForIssue(work),
      });
    }
  }
  if (changed) {
    let taskTotal = work.taskTotal;
    let taskDone = work.taskDone;
    if (taskTotal === undefined || taskDone === undefined) {
      const tasks = await ctx.db
        .query('tasks')
        .withIndex('by_work', q => q.eq('workId', work._id))
        .collect();
      taskTotal = tasks.length;
      taskDone = tasks.filter(task => task.status === 'done').length;
    } else {
      taskDone = Math.max(0, taskDone + doneDelta);
    }
    await ctx.db.patch('issues', work._id, {
      updatedAt: Date.now(),
      lastMeaningfulActivityAt: Date.now(),
      lastActivityEventType: 'github_task_state_automation',
      taskTotal,
      taskDone,
    });
  }
}

async function applyWorkflowAutomationForIssue(
  ctx: MutationCtx,
  issueId: Id<'issues'>,
) {
  const issue = await ctx.db.get('issues', issueId);
  if (!issue) return;
  const integration = await ctx.db
    .query('githubIntegrations')
    .withIndex('by_org_provider', q =>
      q.eq('organizationId', issue.organizationId).eq('provider', 'github'),
    )
    .first();
  const stateAutomationPolicy = integration?.stateAutomationPolicy ?? 'manual';
  if (stateAutomationPolicy === 'manual') return;
  if (
    stateAutomationPolicy === 'github' &&
    issue.kind === 'work' &&
    issue.completionPolicy !== 'github'
  )
    return;

  const links = await ctx.db
    .query('githubArtifactLinks')
    .withIndex('by_issue_active', q =>
      q.eq('issueId', issueId).eq('active', true),
    )
    .collect();

  if (stateAutomationPolicy === 'github' && issue.kind === 'work') {
    await applyTaskScopedWorkflowAutomation(ctx, issue, links);
  }
  const workflowLinks =
    issue.kind === 'work' ? links.filter(link => !link.taskId) : links;
  if (workflowLinks.length === 0) return;

  const { pullRequests, githubIssues } = await loadWorkflowEvidence(
    ctx,
    workflowLinks,
  );

  const targetType =
    selectWorkflowTypeFromPullRequests(pullRequests.map(pr => pr.state)) ??
    selectWorkflowTypeFromGitHubIssues(githubIssues.map(pr => pr.state));

  if (!targetType) {
    if (
      issue.kind === 'work' &&
      issue.ownerId &&
      pullRequests.length > 0 &&
      pullRequests.every(pr => pr.state === 'closed')
    ) {
      const organization = await ctx.db.get(
        'organizations',
        issue.organizationId,
      );
      await createNotificationEvent(ctx, {
        type: 'github_action_required',
        organizationId: issue.organizationId,
        issueId: issue._id,
        payload: {
          workKey: issue.key,
          workTitle: issue.title,
          href: organization
            ? `/${organization.slug}/work/${issue.key}`
            : undefined,
        },
        recipients: [{ userId: issue.ownerId }],
        dedupeKey: `github-closed-unmerged:${issue._id}:${pullRequests
          .map(pr => pr._id)
          .sort()
          .join(',')}`,
      });
    }
    return;
  }

  if (stateAutomationPolicy === 'evidence') {
    const recipientId = issue.ownerId ?? issue.createdBy ?? issue.reporterId;
    if (issue.kind === 'work' && recipientId && targetType === 'done') {
      const organization = await ctx.db.get(
        'organizations',
        issue.organizationId,
      );
      const evidenceVersion = [
        ...pullRequests.map(
          pr => `${pr._id}:${pr.state}:${pr.mergedAt ?? pr.closedAt ?? ''}`,
        ),
        ...githubIssues.map(
          ghIssue =>
            `${ghIssue._id}:${ghIssue.state}:${ghIssue.closedAt ?? ''}`,
        ),
      ]
        .sort()
        .join(',');
      await createNotificationEvent(ctx, {
        type: 'github_action_required',
        organizationId: issue.organizationId,
        issueId: issue._id,
        payload: {
          workKey: issue.key,
          workTitle: issue.title,
          href: organization
            ? `/${organization.slug}/work/${issue.key}`
            : undefined,
        },
        recipients: [{ userId: recipientId }],
        dedupeKey: `github-terminal-evidence:${issue._id}:${evidenceVersion}`,
      });
    }
    return;
  }
  // Agent attachment and GitHub activity never imply that a person has
  // intentionally started Work. GitHub opt-in only handles terminal evidence.
  if (issue.kind === 'work' && targetType !== 'done') return;

  const nextStateId = await getIssueStateIdByType(
    ctx,
    issue.organizationId,
    targetType,
  );

  if (!nextStateId) {
    return;
  }

  const previousState = issue.workflowStateId
    ? await ctx.db.get('issueStates', issue.workflowStateId)
    : null;
  const nextState = await ctx.db.get('issueStates', nextStateId);
  const assignments = await ctx.db
    .query('issueAssignees')
    .withIndex('by_issue', q => q.eq('issueId', issueId))
    .collect();
  const nextClosedAt =
    targetType === 'done' || targetType === 'canceled' ? Date.now() : undefined;
  const issueNeedsPatch =
    issue.workflowStateId !== nextStateId ||
    (issue.kind === 'work' &&
      issue.workStatus !==
        (targetType === 'done' ? 'completed' : 'canceled')) ||
    (targetType === 'done' || targetType === 'canceled'
      ? issue.closedAt === undefined
      : issue.closedAt !== undefined);
  const assignmentsOutOfSync =
    assignments.length === 0 ||
    assignments.some(assignment => assignment.stateId !== nextStateId);

  if (!issueNeedsPatch && !assignmentsOutOfSync) {
    return;
  }

  if (issueNeedsPatch) {
    await ctx.db.patch('issues', issueId, {
      workflowStateId: nextStateId,
      closedAt: nextClosedAt,
      workStatus:
        issue.kind === 'work'
          ? targetType === 'done'
            ? 'completed'
            : 'canceled'
          : issue.workStatus,
      focusRank:
        issue.kind === 'work'
          ? workFocusRank(
              targetType === 'done' ? 'completed' : 'canceled',
              issue.effort ?? 'unknown',
            )
          : issue.focusRank,
      lastMeaningfulActivityAt: Date.now(),
      lastActivityEventType: 'github_state_automation',
    });
  }

  if (assignmentsOutOfSync && assignments.length === 0) {
    await ctx.db.insert('issueAssignees', {
      issueId,
      assigneeId: undefined,
      stateId: nextStateId,
    });
  } else if (assignmentsOutOfSync) {
    for (const assignment of assignments) {
      if (assignment.stateId === nextStateId) continue;
      await ctx.db.patch('issueAssignees', assignment._id, {
        stateId: nextStateId,
      });
    }
  }

  const actorId = issue.createdBy ?? issue.reporterId ?? undefined;
  if (issueNeedsPatch && actorId && nextState) {
    await recordActivity(ctx, {
      scope: resolveIssueScope(issue),
      actorId,
      entityType: 'issue',
      eventType: 'issue_workflow_state_changed',
      details: {
        field: 'workflow_state',
        fromId: issue.workflowStateId,
        fromLabel: previousState?.name,
        toId: nextState._id,
        toLabel: nextState.name,
      },
      snapshot: snapshotForIssue(issue),
    });
  }

  if (issue.kind === 'work' && targetType === 'done') {
    const links = await ctx.db
      .query('requestWorkLinks')
      .withIndex('by_work', query => query.eq('workId', issue._id))
      .collect();
    for (const link of links) {
      if (link.relation !== 'fulfills') continue;
      const request = await ctx.db.get('requests', link.requestId);
      if (
        !request ||
        ['ready_for_review', 'completed', 'declined', 'duplicate'].includes(
          request.status,
        )
      )
        continue;
      const requestLinks = await ctx.db
        .query('requestWorkLinks')
        .withIndex('by_request', query => query.eq('requestId', request._id))
        .collect();
      const fulfillingLinks = requestLinks.filter(
        requestLink => requestLink.relation === 'fulfills',
      );
      if (fulfillingLinks.length === 0) continue;
      const linkedWork = await Promise.all(
        fulfillingLinks.map(requestLink =>
          ctx.db.get('issues', requestLink.workId),
        ),
      );
      if (
        !linkedWork.every(
          work =>
            work &&
            ['ready_for_review', 'completed'].includes(work.workStatus ?? ''),
        )
      )
        continue;
      const now = Date.now();
      await ctx.db.patch('requests', request._id, {
        status: 'ready_for_review',
        focusRank: requestFocusRank('ready_for_review'),
        readyForReviewAt: now,
        updatedAt: now,
      });
      const recipients = new Set<Id<'users'>>();
      if (request.requesterId) recipients.add(request.requesterId);
      if (request.createdBy) recipients.add(request.createdBy);
      const organization = await ctx.db.get(
        'organizations',
        request.organizationId,
      );
      await createNotificationEvent(ctx, {
        type: 'request_ready_for_review',
        organizationId: request.organizationId,
        requestId: request._id,
        issueId: issue._id,
        payload: {
          requestKey: request.key,
          requestTitle: request.title,
          workKey: issue.key,
          workTitle: issue.title,
          href: organization
            ? getRequestHref(organization.slug, request.key)
            : undefined,
        },
        recipients: Array.from(recipients).map(userId => ({ userId })),
        dedupeKey: `request-ready:${request._id}:${now}`,
      });
    }
  }
}

async function autoAssignFromGitHubLogins(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  issueId: Id<'issues'>,
  identities: Array<{
    githubUserId?: number | null;
    githubUsername?: string | null;
    email?: string | null;
  }>,
) {
  if (identities.length === 0) return;

  const integration = await ctx.db
    .query('githubIntegrations')
    .withIndex('by_org_provider', q =>
      q.eq('organizationId', organizationId).eq('provider', 'github'),
    )
    .first();
  if (
    (integration?.identityContributionPolicy ?? 'contributors') !==
    'contributors'
  )
    return;

  const issue = await ctx.db.get('issues', issueId);
  if (!issue) return;

  const defaultState =
    issue.kind === 'work'
      ? null
      : await getDefaultAssignmentState(ctx, organizationId);
  if (issue.kind !== 'work' && !defaultState) return;

  const existingAssignments = await ctx.db
    .query('issueAssignees')
    .withIndex('by_issue', q => q.eq('issueId', issueId))
    .collect();

  for (const identity of identities) {
    const vectorUser = await resolveOrgMemberByGitHubIdentity(
      ctx,
      organizationId,
      identity,
    );
    if (!vectorUser) continue;

    if (issue.kind === 'work') {
      const contributor = await ctx.db
        .query('workContributors')
        .withIndex('by_work_user', q =>
          q.eq('workId', issue._id).eq('userId', vectorUser._id),
        )
        .first();
      if (!contributor) {
        await ctx.db.insert('workContributors', {
          workId: issue._id,
          userId: vectorUser._id,
          addedAt: Date.now(),
        });
      }
      continue;
    }

    if (!defaultState) continue;

    // Check not already assigned
    const existingAssignment = existingAssignments.find(
      assignment => assignment.assigneeId === vectorUser._id,
    );
    if (existingAssignment) {
      if (existingAssignment.stateId !== defaultState._id) {
        await ctx.db.patch('issueAssignees', existingAssignment._id, {
          stateId: defaultState._id,
        });
      }
      continue;
    }

    const unassignedAssignment = existingAssignments.find(
      assignment => !assignment.assigneeId,
    );
    if (unassignedAssignment) {
      await ctx.db.patch('issueAssignees', unassignedAssignment._id, {
        assigneeId: vectorUser._id,
        stateId: defaultState._id,
      });
      unassignedAssignment.assigneeId = vectorUser._id;
      unassignedAssignment.stateId = defaultState._id;
    } else {
      const assignmentId = await ctx.db.insert('issueAssignees', {
        issueId,
        assigneeId: vectorUser._id,
        stateId: defaultState._id,
      });
      existingAssignments.push({
        _id: assignmentId,
        _creationTime: Date.now(),
        issueId,
        assigneeId: vectorUser._id,
        stateId: defaultState._id,
      } as Doc<'issueAssignees'>);
    }

    // Record activity
    const actorId = issue.createdBy ?? issue.reporterId ?? undefined;
    if (actorId) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(issue),
        actorId,
        entityType: 'issue',
        eventType: 'issue_assignees_changed',
        details: {
          addedUserNames: [
            vectorUser.name ??
              identity.githubUsername ??
              identity.email ??
              'GitHub user',
          ],
          removedUserNames: [],
        },
        snapshot: snapshotForIssue(issue),
      });
    }
  }
}

/**
 * Auto-assign Vector users to an issue based on the linked PR's author and assignees.
 * Only assigns users who have linked their GitHub account and are org members.
 */
async function autoAssignFromPullRequest(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  issueId: Id<'issues'>,
  pullRequestId: Id<'githubPullRequests'>,
) {
  const pr = await ctx.db.get('githubPullRequests', pullRequestId);
  if (!pr) return;

  const identities: Array<{
    githubUserId?: number | null;
    githubUsername?: string | null;
  }> = [];
  const seenIdentities = new Set<string>();

  const pushIdentity = (identity: {
    githubUserId?: number | null;
    githubUsername?: string | null;
  }) => {
    const key = `${identity.githubUserId ?? 'none'}:${identity.githubUsername ?? 'none'}`;
    if (seenIdentities.has(key)) return;
    seenIdentities.add(key);
    identities.push(identity);
  };

  if (pr.assigneeLogins || pr.assigneeGitHubUserIds) {
    const count = Math.max(
      pr.assigneeLogins?.length ?? 0,
      pr.assigneeGitHubUserIds?.length ?? 0,
    );
    for (let index = 0; index < count; index += 1) {
      pushIdentity({
        githubUserId: pr.assigneeGitHubUserIds?.[index] ?? null,
        githubUsername: pr.assigneeLogins?.[index] ?? null,
      });
    }
  }
  if (pr.authorLogin || pr.authorGitHubUserId) {
    pushIdentity({
      githubUserId: pr.authorGitHubUserId ?? null,
      githubUsername: pr.authorLogin ?? null,
    });
  }

  await autoAssignFromGitHubLogins(ctx, organizationId, issueId, identities);
}

async function autoAssignFromGitHubIssue(
  ctx: MutationCtx,
  organizationId: Id<'organizations'>,
  issueId: Id<'issues'>,
  githubIssueId: Id<'githubIssues'>,
) {
  const githubIssue = await ctx.db.get('githubIssues', githubIssueId);
  if (!githubIssue) return;

  const identities: Array<{
    githubUserId?: number | null;
    githubUsername?: string | null;
  }> = [];
  const seenIdentities = new Set<string>();

  const pushIdentity = (identity: {
    githubUserId?: number | null;
    githubUsername?: string | null;
  }) => {
    const key = `${identity.githubUserId ?? 'none'}:${identity.githubUsername ?? 'none'}`;
    if (seenIdentities.has(key)) return;
    seenIdentities.add(key);
    identities.push(identity);
  };

  if (githubIssue.assigneeLogins || githubIssue.assigneeGitHubUserIds) {
    const count = Math.max(
      githubIssue.assigneeLogins?.length ?? 0,
      githubIssue.assigneeGitHubUserIds?.length ?? 0,
    );
    for (let index = 0; index < count; index += 1) {
      pushIdentity({
        githubUserId: githubIssue.assigneeGitHubUserIds?.[index] ?? null,
        githubUsername: githubIssue.assigneeLogins?.[index] ?? null,
      });
    }
  }
  if (githubIssue.authorLogin || githubIssue.authorGitHubUserId) {
    pushIdentity({
      githubUserId: githubIssue.authorGitHubUserId ?? null,
      githubUsername: githubIssue.authorLogin ?? null,
    });
  }

  await autoAssignFromGitHubLogins(ctx, organizationId, issueId, identities);
}

async function syncArtifactLinksForIssues(args: {
  ctx: MutationCtx;
  organizationId: Id<'organizations'>;
  artifactType: GitHubArtifactType;
  artifactId:
    Id<'githubPullRequests'> | Id<'githubIssues'> | Id<'githubCommits'>;
  repoFullName: string;
  identifier: string | number;
  issueKeys: string[];
  source: 'auto' | 'manual';
  preserveExistingWhenEmpty?: boolean;
  actorId?: Id<'users'>;
}) {
  const {
    ctx,
    organizationId,
    artifactType,
    artifactId,
    repoFullName,
    identifier,
  } = args;
  const externalKey = buildArtifactExternalKey(
    artifactType,
    repoFullName,
    identifier,
  );

  const resolvedTargets = await Promise.all(
    Array.from(new Set(args.issueKeys.map(normalizeIssueKey))).map(
      async key => {
        const issue = await ctx.db
          .query('issues')
          .withIndex('by_org_key', q =>
            q.eq('organizationId', organizationId).eq('key', key),
          )
          .first();
        if (!issue) return null;
        if (issue.kind !== 'legacy_task_source')
          return { issueId: issue._id, taskId: undefined };
        const task = await ctx.db
          .query('tasks')
          .withIndex('by_legacy_issue', q => q.eq('legacyIssueId', issue._id))
          .first();
        return task ? { issueId: task.workId, taskId: task._id } : null;
      },
    ),
  ).then(targets =>
    targets.filter(
      (
        target,
      ): target is { issueId: Id<'issues'>; taskId: Id<'tasks'> | undefined } =>
        target !== null,
    ),
  );

  const existingLinks = await (artifactType === 'pull_request'
    ? ctx.db
        .query('githubArtifactLinks')
        .withIndex('by_pr', q =>
          q.eq('pullRequestId', artifactId as Id<'githubPullRequests'>),
        )
        .collect()
    : artifactType === 'issue'
      ? ctx.db
          .query('githubArtifactLinks')
          .withIndex('by_gh_issue', q =>
            q.eq('githubIssueId', artifactId as Id<'githubIssues'>),
          )
          .collect()
      : ctx.db
          .query('githubArtifactLinks')
          .withIndex('by_commit', q =>
            q.eq('commitId', artifactId as Id<'githubCommits'>),
          )
          .collect());

  let targets: Array<{
    issueId: Id<'issues'>;
    taskId?: Id<'tasks'>;
  }> = [];
  if (
    args.source === 'auto' &&
    args.preserveExistingWhenEmpty &&
    resolvedTargets.length === 0 &&
    existingLinks.some(link => link.active)
  ) {
    const seen = new Set<string>();
    targets = existingLinks
      .filter(link => link.active)
      .map(link => ({ issueId: link.issueId, taskId: link.taskId }))
      .filter(target => {
        const key = `${target.issueId}:${target.taskId ?? ''}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  } else {
    for (const target of resolvedTargets) {
      const suppression = await ctx.db
        .query('githubArtifactSuppressions')
        .withIndex('by_issue_task_external', q =>
          q
            .eq('issueId', target.issueId)
            .eq('taskId', target.taskId)
            .eq('artifactType', artifactType)
            .eq('externalKey', externalKey),
        )
        .first();
      if (suppression && args.source === 'manual') {
        // An explicit manual attachment is the user's decision to reverse a
        // previous suppression for this exact Work/Task scope.
        await ctx.db.delete('githubArtifactSuppressions', suppression._id);
      } else if (suppression) {
        continue;
      }
      targets.push(target);
    }
  }

  const targetSet = new Set(
    targets.map(target => `${target.issueId}:${target.taskId ?? ''}`),
  );
  for (const link of existingLinks) {
    if (link.source !== 'auto') continue;
    if (targetSet.has(`${link.issueId}:${link.taskId ?? ''}`)) continue;
    if (link.active) {
      await ctx.db.patch('githubArtifactLinks', link._id, {
        active: false,
        updatedAt: Date.now(),
      });
    }
  }

  for (const target of targets) {
    const existing = existingLinks.find(
      link => link.issueId === target.issueId && link.taskId === target.taskId,
    );
    if (existing) {
      if (!existing.active) {
        await ctx.db.patch('githubArtifactLinks', existing._id, {
          active: true,
          updatedAt: Date.now(),
        });
      }
    } else {
      await ctx.db.insert('githubArtifactLinks', {
        organizationId,
        issueId: target.issueId,
        taskId: target.taskId,
        artifactType,
        pullRequestId:
          artifactType === 'pull_request'
            ? (artifactId as Id<'githubPullRequests'>)
            : undefined,
        githubIssueId:
          artifactType === 'issue'
            ? (artifactId as Id<'githubIssues'>)
            : undefined,
        commitId:
          artifactType === 'commit'
            ? (artifactId as Id<'githubCommits'>)
            : undefined,
        source: args.source,
        active: true,
        matchReason: externalKey,
        createdBy: args.actorId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }
  }

  // Auto-assign users from PR author/assignees when linking pull requests
  if (artifactType === 'pull_request') {
    for (const { issueId } of targets) {
      await autoAssignFromPullRequest(
        ctx,
        organizationId,
        issueId,
        artifactId as Id<'githubPullRequests'>,
      );
    }
    if (targets.length > 0) {
      const inbox = await ctx.db
        .query('githubDevelopmentInbox')
        .withIndex('by_pull_request', query =>
          query.eq('pullRequestId', artifactId as Id<'githubPullRequests'>),
        )
        .first();
      if (inbox && inbox.status !== 'linked') {
        await ctx.db.patch('githubDevelopmentInbox', inbox._id, {
          status: 'linked',
          updatedAt: Date.now(),
        });
      } else if (!inbox && args.source === 'manual') {
        await ctx.db.insert('githubDevelopmentInbox', {
          organizationId,
          pullRequestId: artifactId as Id<'githubPullRequests'>,
          status: 'linked',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  }

  if (artifactType === 'issue') {
    for (const { issueId } of targets) {
      await autoAssignFromGitHubIssue(
        ctx,
        organizationId,
        issueId,
        artifactId as Id<'githubIssues'>,
      );
    }
    if (targets.length > 0) {
      const inbox = await ctx.db
        .query('githubDevelopmentInbox')
        .withIndex('by_github_issue', query =>
          query.eq('githubIssueId', artifactId as Id<'githubIssues'>),
        )
        .first();
      if (inbox && inbox.status !== 'linked') {
        await ctx.db.patch('githubDevelopmentInbox', inbox._id, {
          status: 'linked',
          updatedAt: Date.now(),
        });
      } else if (!inbox && args.source === 'manual') {
        await ctx.db.insert('githubDevelopmentInbox', {
          organizationId,
          githubIssueId: artifactId as Id<'githubIssues'>,
          status: 'linked',
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }
  }

  const affectedIssueIds = new Set([
    ...existingLinks.map(link => link.issueId),
    ...targets.map(target => target.issueId),
  ]);

  for (const issueId of affectedIssueIds) {
    await applyWorkflowAutomationForIssue(ctx, issueId);
  }

  if (artifactType === 'pull_request') {
    for (const issueId of affectedIssueIds) {
      await ctx.scheduler.runAfter(
        0,
        internal.github.actions.refreshIssuePullRequestSummary,
        {
          organizationId,
          issueId,
        },
      );
    }
  }
}

export const upsertInstallationConnection = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    connectionMode: v.union(
      v.literal('app'),
      v.literal('token'),
      v.literal('hybrid'),
    ),
    installationId: v.optional(v.number()),
    installationAccountLogin: v.optional(v.string()),
    installationAccountType: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    await ctx.db.patch('githubIntegrations', integration!._id, {
      connectionMode: args.connectionMode,
      installationId: args.installationId,
      installationAccountLogin: args.installationAccountLogin,
      installationAccountType: args.installationAccountType,
      connectedAt: Date.now(),
      updatedAt: Date.now(),
    });
    return integration!._id;
  },
});

export const setWebhookSecret = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    encryptedWebhookSecret: v.optional(v.string()),
    webhookSecretFingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    await ctx.db.patch('githubIntegrations', integration!._id, {
      connectionMode:
        integration!.installationId || integration!.encryptedToken
          ? integration!.connectionMode
          : 'webhook',
      encryptedWebhookSecret: args.encryptedWebhookSecret,
      webhookSecretFingerprint: args.webhookSecretFingerprint,
      webhookSecretLastUpdatedAt: args.encryptedWebhookSecret
        ? Date.now()
        : undefined,
      updatedAt: Date.now(),
    });
    return integration!._id;
  },
});

export const setAutoLinkEnabled = mutation({
  args: {
    orgSlug: v.string(),
    enabled: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_SETTINGS);

    const integration = await getOrCreateIntegration(ctx, org._id);
    await ctx.db.patch('githubIntegrations', integration!._id, {
      autoLinkEnabled: args.enabled,
      keyLinkEnabled: args.enabled,
      aiMatchEnabled: args.enabled,
      updatedAt: Date.now(),
    });

    return { success: true, actorId: userId } as const;
  },
});

export const setAutomationPolicies = mutation({
  args: {
    orgSlug: v.string(),
    keyLinkEnabled: v.boolean(),
    aiMatchEnabled: v.boolean(),
    unmatchedArtifactPolicy: v.union(
      v.literal('development_inbox'),
      v.literal('create_request'),
      v.literal('create_work'),
      v.literal('ignore'),
    ),
    stateAutomationPolicy: v.union(
      v.literal('manual'),
      v.literal('evidence'),
      v.literal('github'),
    ),
    identityContributionPolicy: v.union(
      v.literal('none'),
      v.literal('contributors'),
    ),
    githubNotificationPolicy: v.union(
      v.literal('action_only'),
      v.literal('all'),
      v.literal('none'),
    ),
  },
  handler: async (ctx, args) => {
    await requireAuthUser(ctx);
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_SETTINGS);
    const integration = await getOrCreateIntegration(ctx, org._id);
    const { orgSlug: _orgSlug, ...policies } = args;
    await ctx.db.patch('githubIntegrations', integration!._id, {
      ...policies,
      autoLinkEnabled: args.keyLinkEnabled || args.aiMatchEnabled,
      updatedAt: Date.now(),
    });
    return { success: true } as const;
  },
});

export const setEncryptedToken = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    encryptedToken: v.optional(v.string()),
    tokenFingerprint: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    await ctx.db.patch('githubIntegrations', integration!._id, {
      connectionMode: integration!.installationId ? 'hybrid' : 'token',
      encryptedToken: args.encryptedToken,
      tokenFingerprint: args.tokenFingerprint,
      tokenLastUpdatedAt: args.encryptedToken ? Date.now() : undefined,
      updatedAt: Date.now(),
    });
    return integration!._id;
  },
});

export const upsertWebhookRepository = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    githubRepoId: v.number(),
    nodeId: v.optional(v.string()),
    owner: v.string(),
    name: v.string(),
    fullName: v.string(),
    defaultBranch: v.optional(v.string()),
    private: v.boolean(),
    lastPushedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    const existing = await ctx.db
      .query('githubRepositories')
      .withIndex('by_org_repo', q =>
        q
          .eq('organizationId', args.organizationId)
          .eq('githubRepoId', args.githubRepoId),
      )
      .first();

    const patch = {
      integrationId: integration!._id,
      nodeId: args.nodeId,
      owner: args.owner,
      name: args.name,
      fullName: args.fullName,
      defaultBranch: args.defaultBranch,
      private: args.private,
      installationAccessible: true,
      selected: true,
      lastPushedAt: args.lastPushedAt,
      lastSyncedAt: Date.now(),
      updatedAt: Date.now(),
    };

    if (existing) {
      await ctx.db.patch('githubRepositories', existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert('githubRepositories', {
      organizationId: args.organizationId,
      githubRepoId: args.githubRepoId,
      ...patch,
    });
  },
});

export const replaceRepositories = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    repositories: v.array(
      v.object({
        githubRepoId: v.number(),
        nodeId: v.optional(v.string()),
        owner: v.string(),
        name: v.string(),
        fullName: v.string(),
        defaultBranch: v.optional(v.string()),
        private: v.boolean(),
        installationAccessible: v.boolean(),
        lastPushedAt: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    const existing = await ctx.db
      .query('githubRepositories')
      .withIndex('by_integration', q => q.eq('integrationId', integration!._id))
      .collect();

    for (const repo of args.repositories) {
      const current = existing.find(
        item => item.githubRepoId === repo.githubRepoId,
      );
      if (current) {
        await ctx.db.patch('githubRepositories', current._id, {
          ...repo,
          updatedAt: Date.now(),
          lastSyncedAt: Date.now(),
        });
      } else {
        await ctx.db.insert('githubRepositories', {
          organizationId: args.organizationId,
          integrationId: integration!._id,
          ...repo,
          selected: false,
          updatedAt: Date.now(),
          lastSyncedAt: Date.now(),
        });
      }
    }

    const incomingRepoIds = new Set(
      args.repositories.map(repo => repo.githubRepoId),
    );
    for (const repo of existing) {
      if (incomingRepoIds.has(repo.githubRepoId)) continue;
      await ctx.db.patch('githubRepositories', repo._id, {
        installationAccessible: false,
        selected: false,
        updatedAt: Date.now(),
      });
    }
  },
});

export const toggleRepositorySelection = mutation({
  args: {
    orgSlug: v.string(),
    repositoryId: v.id('githubRepositories'),
    selected: v.boolean(),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    const org = await getOrganizationBySlug(ctx, args.orgSlug);
    await requireOrgPermission(ctx, org._id, PERMISSIONS.ORG_MANAGE_SETTINGS);

    const repository = await ctx.db.get(
      'githubRepositories',
      args.repositoryId,
    );
    if (!repository || repository.organizationId !== org._id) {
      throw new ConvexError('REPOSITORY_NOT_FOUND');
    }

    await ctx.db.patch('githubRepositories', repository._id, {
      selected: args.selected,
      updatedAt: Date.now(),
    });

    return { success: true, actorId: userId } as const;
  },
});

export const upsertPullRequest = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    repositoryId: v.id('githubRepositories'),
    githubPullRequestId: v.number(),
    nodeId: v.optional(v.string()),
    number: v.number(),
    title: v.string(),
    body: v.optional(v.string()),
    url: v.string(),
    state: v.union(
      v.literal('draft'),
      v.literal('open'),
      v.literal('closed'),
      v.literal('merged'),
    ),
    isDraft: v.boolean(),
    headRefName: v.optional(v.string()),
    baseRefName: v.optional(v.string()),
    authorGitHubUserId: v.optional(v.number()),
    authorLogin: v.optional(v.string()),
    authorAvatarUrl: v.optional(v.string()),
    assigneeGitHubUserIds: v.optional(v.array(v.number())),
    assigneeLogins: v.optional(v.array(v.string())),
    mergedAt: v.optional(v.number()),
    closedAt: v.optional(v.number()),
    lastActivityAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('githubPullRequests')
      .withIndex('by_org_external', q =>
        q
          .eq('organizationId', args.organizationId)
          .eq('githubPullRequestId', args.githubPullRequestId),
      )
      .first();

    if (existing) {
      const previousTitle = existing.title;
      const previousBody = existing.body ?? undefined;
      await ctx.db.patch('githubPullRequests', existing._id, {
        ...args,
        lastSyncedAt: Date.now(),
      });
      return {
        pullRequestId: existing._id,
        previousTitle,
        previousBody,
      } as const;
    }

    const pullRequestId = await ctx.db.insert('githubPullRequests', {
      ...args,
      lastSyncedAt: Date.now(),
    });
    return {
      pullRequestId,
      previousTitle: undefined,
      previousBody: undefined,
    } as const;
  },
});

export const upsertGitHubIssue = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    repositoryId: v.id('githubRepositories'),
    githubIssueId: v.number(),
    nodeId: v.optional(v.string()),
    number: v.number(),
    title: v.string(),
    body: v.optional(v.string()),
    url: v.string(),
    state: v.union(v.literal('open'), v.literal('closed')),
    authorGitHubUserId: v.optional(v.number()),
    authorLogin: v.optional(v.string()),
    authorAvatarUrl: v.optional(v.string()),
    assigneeGitHubUserIds: v.optional(v.array(v.number())),
    assigneeLogins: v.optional(v.array(v.string())),
    closedAt: v.optional(v.number()),
    lastActivityAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('githubIssues')
      .withIndex('by_org_external', q =>
        q
          .eq('organizationId', args.organizationId)
          .eq('githubIssueId', args.githubIssueId),
      )
      .first();

    if (existing) {
      await ctx.db.patch('githubIssues', existing._id, {
        ...args,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('githubIssues', {
      ...args,
      lastSyncedAt: Date.now(),
    });
  },
});

export const upsertCommit = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    repositoryId: v.id('githubRepositories'),
    sha: v.string(),
    shortSha: v.string(),
    messageHeadline: v.string(),
    messageBody: v.optional(v.string()),
    url: v.string(),
    authorName: v.optional(v.string()),
    authorEmail: v.optional(v.string()),
    committedAt: v.optional(v.number()),
    authoredAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query('githubCommits')
      .withIndex('by_org_sha', q =>
        q.eq('organizationId', args.organizationId).eq('sha', args.sha),
      )
      .first();

    if (existing) {
      await ctx.db.patch('githubCommits', existing._id, {
        ...args,
        lastSyncedAt: Date.now(),
      });
      return existing._id;
    }

    return await ctx.db.insert('githubCommits', {
      ...args,
      lastSyncedAt: Date.now(),
    });
  },
});

export const syncPullRequestLinks = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    pullRequestId: v.id('githubPullRequests'),
    repoFullName: v.string(),
    number: v.number(),
    issueKeys: v.array(v.string()),
    preserveExistingWhenEmpty: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'pull_request',
      artifactId: args.pullRequestId,
      repoFullName: args.repoFullName,
      identifier: args.number,
      issueKeys: args.issueKeys,
      source: 'auto',
      preserveExistingWhenEmpty: args.preserveExistingWhenEmpty,
    });
  },
});

export const syncLinkedIssueContentFromPullRequest = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    pullRequestId: v.id('githubPullRequests'),
    repoFullName: v.string(),
    previousTitle: v.optional(v.string()),
    previousBody: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [organization, pullRequest] = await Promise.all([
      ctx.db.get('organizations', args.organizationId),
      ctx.db.get('githubPullRequests', args.pullRequestId),
    ]);
    if (
      !organization ||
      !pullRequest ||
      pullRequest.organizationId !== args.organizationId
    ) {
      throw new ConvexError('PULL_REQUEST_NOT_FOUND');
    }
    const links = await ctx.db
      .query('githubArtifactLinks')
      .withIndex('by_pr', q => q.eq('pullRequestId', args.pullRequestId))
      .collect();

    for (const link of links) {
      if (!link.active) continue;
      const issue = await ctx.db.get('issues', link.issueId);
      if (!issue || issue.organizationId !== args.organizationId) continue;
      if (issue.kind === 'work') continue;

      const patch: Partial<Doc<'issues'>> = {};
      if (args.previousTitle && issue.title === args.previousTitle) {
        patch.title = pullRequest.title;
      }

      if (Object.keys(patch).length > 0) {
        await ctx.db.patch('issues', issue._id, {
          ...patch,
          searchText: buildIssueSearchText({
            key: issue.key,
            title: patch.title ?? issue.title,
            description:
              patch.description !== undefined
                ? patch.description
                : (issue.description ?? ''),
          }),
        });
      }

      await ctx.scheduler.runAfter(
        0,
        internal.github.actions.refreshIssuePullRequestSummary,
        {
          organizationId: args.organizationId,
          issueId: issue._id,
        },
      );

      await queueIssueDescriptionRefreshForAssistantThreads(ctx, {
        organization,
        issue: Object.keys(patch).length
          ? ({ ...issue, ...patch } as Doc<'issues'>)
          : issue,
        pullRequest,
        repoFullName: args.repoFullName,
        previousImportedDescription: buildImportedPullRequestDescription({
          repoFullName: args.repoFullName,
          number: pullRequest.number,
          url: pullRequest.url,
          body: args.previousBody ?? undefined,
        }),
        nextImportedDescription: buildImportedPullRequestDescription({
          repoFullName: args.repoFullName,
          number: pullRequest.number,
          url: pullRequest.url,
          body: pullRequest.body ?? undefined,
        }),
      });
    }
  },
});

export const applyPullRequestSummaryToIssue = internalMutation({
  args: {
    issueId: v.id('issues'),
    legacyImportedDescriptions: v.optional(v.array(v.string())),
    summaryMarkdown: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue) {
      return { updated: false } as const;
    }
    if (issue.kind === 'work') {
      return { updated: false } as const;
    }

    const description = mergeIssueDescriptionWithPullRequestSummary({
      currentDescription: issue.description,
      legacyImportedDescriptions: args.legacyImportedDescriptions,
      summaryMarkdown: args.summaryMarkdown,
    });

    if (description === (issue.description ?? '')) {
      return { updated: false } as const;
    }

    await ctx.db.patch('issues', issue._id, {
      description: description || undefined,
      searchText: buildIssueSearchText({
        key: issue.key,
        title: issue.title,
        description,
      }),
    });

    return { updated: true } as const;
  },
});

export const createIssueFromPullRequestIfNeeded = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    pullRequestId: v.id('githubPullRequests'),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    const unmatchedPolicy =
      integration?.unmatchedArtifactPolicy ?? 'development_inbox';
    if (unmatchedPolicy === 'ignore') {
      return { created: false } as const;
    }

    const existingLinks = await ctx.db
      .query('githubArtifactLinks')
      .withIndex('by_pr', q => q.eq('pullRequestId', args.pullRequestId))
      .collect();
    if (existingLinks.some(link => link.active)) {
      return { created: false } as const;
    }

    const [organization, pullRequest] = await Promise.all([
      ctx.db.get('organizations', args.organizationId),
      ctx.db.get('githubPullRequests', args.pullRequestId),
    ]);
    if (!organization || !pullRequest) {
      throw new ConvexError('PULL_REQUEST_NOT_FOUND');
    }
    if (!['open', 'draft'].includes(pullRequest.state)) {
      return { created: false } as const;
    }

    const repository = await ctx.db.get(
      'githubRepositories',
      pullRequest.repositoryId,
    );
    if (!repository || repository.organizationId !== args.organizationId) {
      throw new ConvexError('REPOSITORY_NOT_CONNECTED');
    }

    const linkedUser = await resolveOrgMemberByGitHubIdentity(
      ctx,
      args.organizationId,
      {
        githubUserId: pullRequest.authorGitHubUserId ?? null,
        githubUsername: pullRequest.authorLogin ?? null,
      },
    );

    const existingInbox = await ctx.db
      .query('githubDevelopmentInbox')
      .withIndex('by_pull_request', q => q.eq('pullRequestId', pullRequest._id))
      .first();

    if (existingInbox?.status === 'dismissed') {
      return { created: false, inboxed: false } as const;
    }

    if (existingInbox?.createdWorkId) {
      return {
        created: false,
        issueId: existingInbox.createdWorkId,
      } as const;
    }

    if (unmatchedPolicy !== 'create_work') {
      let createdRequestId = existingInbox?.createdRequestId;
      if (unmatchedPolicy === 'create_request' && !createdRequestId) {
        const next = await nextRequestKey(ctx, organization);
        const expectedOutput = `Review ${repository.fullName}#${pullRequest.number} and decide the delivered outcome.`;
        createdRequestId = await ctx.db.insert('requests', {
          organizationId: args.organizationId,
          key: next.key,
          sequenceNumber: next.sequenceNumber,
          title:
            pullRequest.title.trim() ||
            `${repository.fullName}#${pullRequest.number}`,
          description: pullRequest.body ?? undefined,
          expectedOutput,
          searchText: requestSearchText({
            key: next.key,
            title: pullRequest.title,
            description: pullRequest.body ?? undefined,
            expectedOutput,
          }),
          status: 'new',
          focusRank: requestFocusRank('new'),
          source: 'github',
          requesterId: linkedUser?._id,
          requesterName: pullRequest.authorLogin,
          visibility: 'organization',
          createdBy: linkedUser?._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
      if (!existingInbox) {
        await ctx.db.insert('githubDevelopmentInbox', {
          organizationId: args.organizationId,
          pullRequestId: pullRequest._id,
          status: createdRequestId ? 'linked' : 'untriaged',
          createdRequestId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else if (createdRequestId && !existingInbox.createdRequestId) {
        await ctx.db.patch('githubDevelopmentInbox', existingInbox._id, {
          status: 'linked',
          createdRequestId,
          updatedAt: Date.now(),
        });
      } else if (
        existingInbox &&
        !createdRequestId &&
        existingInbox.status === 'linked'
      ) {
        await ctx.db.patch('githubDevelopmentInbox', existingInbox._id, {
          status: 'untriaged',
          updatedAt: Date.now(),
        });
      }
      return { created: false, inboxed: true, createdRequestId } as const;
    }

    // The inbox row is a durable idempotency marker. Automatic links can be
    // intentionally suppressed or disappear after a later matching pass; that
    // must not create another Work for the same GitHub artifact or bypass an
    // already-created Request after a workspace policy change.
    if (existingInbox?.createdRequestId) {
      return {
        created: false,
        createdRequestId: existingInbox.createdRequestId,
      } as const;
    }

    const defaultState = await getDefaultAssignmentState(
      ctx,
      args.organizationId,
    );

    const nextIssueKey = await getNextAvailableIssueKey(ctx, {
      organizationId: args.organizationId,
      prefix: organization.slug.toUpperCase(),
      startingSequenceNumber: await getNextSequenceSeed(
        ctx,
        args.organizationId,
        undefined,
      ),
    });
    const nextNumber = nextIssueKey.sequenceNumber;
    const issueKey = nextIssueKey.key;
    const title =
      pullRequest.title.trim() ||
      `${repository.fullName}#${pullRequest.number}`;
    const description = buildImportedPullRequestDescription({
      repoFullName: repository.fullName,
      number: pullRequest.number,
      url: pullRequest.url,
      body: pullRequest.body ?? undefined,
    });

    const issueId = await ctx.db.insert('issues', {
      organizationId: args.organizationId,
      key: issueKey,
      sequenceNumber: nextNumber,
      title,
      description,
      searchText: buildIssueSearchText({
        key: issueKey,
        title,
        description,
      }),
      workflowStateId: defaultState?._id,
      reporterId: linkedUser?._id,
      visibility: 'organization',
      createdBy: linkedUser?._id,
      kind: 'work',
      workStatus: 'planned',
      focusRank: workFocusRank('planned', 'unknown'),
      taskTotal: 0,
      taskDone: 0,
      effort: 'unknown',
      completionPolicy: 'manual',
      agentTaskCreationPolicy: 'allow',
      creationSource: 'github',
      ownerId: undefined,
      updatedAt: Date.now(),
      lastMeaningfulActivityAt: Date.now(),
      lastActivityEventType: 'work_created',
    });

    if (defaultState) {
      await ctx.db.insert('issueAssignees', {
        issueId,
        assigneeId: undefined,
        stateId: defaultState._id,
      });
    }

    const createdIssue = await ctx.db.get('issues', issueId);
    if (createdIssue && linkedUser?._id) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(createdIssue),
        actorId: linkedUser._id,
        entityType: 'work',
        eventType: 'work_created',
        snapshot: snapshotForIssue(createdIssue),
      });
    }

    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'pull_request',
      artifactId: args.pullRequestId,
      repoFullName: repository.fullName,
      identifier: pullRequest.number,
      issueKeys: [issueKey],
      source: 'auto',
      actorId: linkedUser?._id,
    });

    if (existingInbox) {
      await ctx.db.patch('githubDevelopmentInbox', existingInbox._id, {
        status: 'linked',
        createdWorkId: issueId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('githubDevelopmentInbox', {
        organizationId: args.organizationId,
        pullRequestId: pullRequest._id,
        status: 'linked',
        createdWorkId: issueId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return {
      created: true,
      issueId,
      issueKey,
    } as const;
  },
});

export const triageUnmatchedGitHubIssue = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    githubIssueId: v.id('githubIssues'),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    const unmatchedPolicy =
      integration?.unmatchedArtifactPolicy ?? 'development_inbox';
    if (unmatchedPolicy === 'ignore') {
      return { created: false } as const;
    }

    const existingLinks = await ctx.db
      .query('githubArtifactLinks')
      .withIndex('by_gh_issue', q => q.eq('githubIssueId', args.githubIssueId))
      .collect();
    if (existingLinks.some(link => link.active)) {
      return { created: false } as const;
    }

    const [organization, githubIssue] = await Promise.all([
      ctx.db.get('organizations', args.organizationId),
      ctx.db.get('githubIssues', args.githubIssueId),
    ]);
    if (
      !organization ||
      !githubIssue ||
      githubIssue.organizationId !== args.organizationId
    ) {
      throw new ConvexError('GITHUB_ISSUE_NOT_FOUND');
    }
    if (githubIssue.state !== 'open') {
      return { created: false } as const;
    }

    const repository = await ctx.db.get(
      'githubRepositories',
      githubIssue.repositoryId,
    );
    if (!repository || repository.organizationId !== args.organizationId) {
      throw new ConvexError('REPOSITORY_NOT_CONNECTED');
    }

    const linkedUser = await resolveOrgMemberByGitHubIdentity(
      ctx,
      args.organizationId,
      {
        githubUserId: githubIssue.authorGitHubUserId ?? null,
        githubUsername: githubIssue.authorLogin ?? null,
      },
    );
    const existingInbox = await ctx.db
      .query('githubDevelopmentInbox')
      .withIndex('by_github_issue', q => q.eq('githubIssueId', githubIssue._id))
      .first();

    if (existingInbox?.status === 'dismissed') {
      return { created: false, inboxed: false } as const;
    }

    if (existingInbox?.createdWorkId) {
      return {
        created: false,
        issueId: existingInbox.createdWorkId,
      } as const;
    }

    if (unmatchedPolicy !== 'create_work') {
      let createdRequestId = existingInbox?.createdRequestId;
      if (unmatchedPolicy === 'create_request' && !createdRequestId) {
        const next = await nextRequestKey(ctx, organization);
        const expectedOutput = `Resolve ${repository.fullName}#${githubIssue.number} and confirm the requested outcome.`;
        createdRequestId = await ctx.db.insert('requests', {
          organizationId: args.organizationId,
          key: next.key,
          sequenceNumber: next.sequenceNumber,
          title:
            githubIssue.title.trim() ||
            `${repository.fullName}#${githubIssue.number}`,
          description: githubIssue.body ?? undefined,
          expectedOutput,
          searchText: requestSearchText({
            key: next.key,
            title: githubIssue.title,
            description: githubIssue.body ?? undefined,
            expectedOutput,
          }),
          status: 'new',
          focusRank: requestFocusRank('new'),
          source: 'github',
          requesterId: linkedUser?._id,
          requesterName: githubIssue.authorLogin,
          visibility: 'organization',
          createdBy: linkedUser?._id,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }

      if (!existingInbox) {
        await ctx.db.insert('githubDevelopmentInbox', {
          organizationId: args.organizationId,
          githubIssueId: githubIssue._id,
          status: createdRequestId ? 'linked' : 'untriaged',
          createdRequestId,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      } else if (createdRequestId && !existingInbox.createdRequestId) {
        await ctx.db.patch('githubDevelopmentInbox', existingInbox._id, {
          status: 'linked',
          createdRequestId,
          updatedAt: Date.now(),
        });
      } else if (
        !createdRequestId &&
        existingInbox.status === 'linked' &&
        !existingInbox.createdWorkId
      ) {
        await ctx.db.patch('githubDevelopmentInbox', existingInbox._id, {
          status: 'untriaged',
          updatedAt: Date.now(),
        });
      }
      return { created: false, inboxed: true, createdRequestId } as const;
    }

    if (existingInbox?.createdRequestId) {
      return {
        created: false,
        createdRequestId: existingInbox.createdRequestId,
      } as const;
    }

    const defaultState = await getDefaultAssignmentState(
      ctx,
      args.organizationId,
    );
    const nextIssueKey = await getNextAvailableIssueKey(ctx, {
      organizationId: args.organizationId,
      prefix: organization.slug.toUpperCase(),
      startingSequenceNumber: await getNextSequenceSeed(
        ctx,
        args.organizationId,
        undefined,
      ),
    });
    const title =
      githubIssue.title.trim() ||
      `${repository.fullName}#${githubIssue.number}`;
    const description = buildImportedGitHubIssueDescription({
      repoFullName: repository.fullName,
      number: githubIssue.number,
      url: githubIssue.url,
      body: githubIssue.body,
    });
    const now = Date.now();
    const issueId = await ctx.db.insert('issues', {
      organizationId: args.organizationId,
      key: nextIssueKey.key,
      sequenceNumber: nextIssueKey.sequenceNumber,
      title,
      description,
      searchText: buildIssueSearchText({
        key: nextIssueKey.key,
        title,
        description,
      }),
      workflowStateId: defaultState?._id,
      reporterId: linkedUser?._id,
      visibility: 'organization',
      createdBy: linkedUser?._id,
      kind: 'work',
      workStatus: 'planned',
      focusRank: workFocusRank('planned', 'unknown'),
      taskTotal: 0,
      taskDone: 0,
      effort: 'unknown',
      completionPolicy: 'manual',
      agentTaskCreationPolicy: 'allow',
      creationSource: 'github',
      ownerId: undefined,
      updatedAt: now,
      lastMeaningfulActivityAt: now,
      lastActivityEventType: 'work_created',
    });

    if (defaultState) {
      await ctx.db.insert('issueAssignees', {
        issueId,
        assigneeId: undefined,
        stateId: defaultState._id,
      });
    }
    const createdIssue = await ctx.db.get('issues', issueId);
    if (createdIssue && linkedUser?._id) {
      await recordActivity(ctx, {
        scope: resolveIssueScope(createdIssue),
        actorId: linkedUser._id,
        entityType: 'work',
        eventType: 'work_created',
        snapshot: snapshotForIssue(createdIssue),
      });
    }

    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'issue',
      artifactId: githubIssue._id,
      repoFullName: repository.fullName,
      identifier: githubIssue.number,
      issueKeys: [nextIssueKey.key],
      source: 'auto',
      actorId: linkedUser?._id,
    });

    if (existingInbox) {
      await ctx.db.patch('githubDevelopmentInbox', existingInbox._id, {
        status: 'linked',
        createdWorkId: issueId,
        updatedAt: Date.now(),
      });
    } else {
      await ctx.db.insert('githubDevelopmentInbox', {
        organizationId: args.organizationId,
        githubIssueId: githubIssue._id,
        status: 'linked',
        createdWorkId: issueId,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    return {
      created: true,
      issueId,
      issueKey: nextIssueKey.key,
    } as const;
  },
});

export const syncGitHubIssueLinks = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    githubIssueId: v.id('githubIssues'),
    repoFullName: v.string(),
    number: v.number(),
    issueKeys: v.array(v.string()),
    preserveExistingWhenEmpty: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'issue',
      artifactId: args.githubIssueId,
      repoFullName: args.repoFullName,
      identifier: args.number,
      issueKeys: args.issueKeys,
      source: 'auto',
      preserveExistingWhenEmpty: args.preserveExistingWhenEmpty,
    });
  },
});

export const syncCommitLinks = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    commitId: v.id('githubCommits'),
    repoFullName: v.string(),
    sha: v.string(),
    issueKeys: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'commit',
      artifactId: args.commitId,
      repoFullName: args.repoFullName,
      identifier: args.sha,
      issueKeys: args.issueKeys,
      source: 'auto',
    });
  },
});

export const linkPullRequestManually = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    issueId: v.id('issues'),
    pullRequestId: v.id('githubPullRequests'),
    repoFullName: v.string(),
    number: v.number(),
    actorId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue || issue.organizationId !== args.organizationId) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'pull_request',
      artifactId: args.pullRequestId,
      repoFullName: args.repoFullName,
      identifier: args.number,
      issueKeys: [issue.key],
      source: 'manual',
      actorId: args.actorId,
    });
    await recordGithubLinkActivity(
      ctx,
      issue,
      args.actorId,
      'issue_github_artifact_linked',
      `${args.repoFullName}#${args.number}`,
    );
  },
});

export const linkGitHubIssueManually = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    issueId: v.id('issues'),
    githubIssueId: v.id('githubIssues'),
    repoFullName: v.string(),
    number: v.number(),
    actorId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue || issue.organizationId !== args.organizationId) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'issue',
      artifactId: args.githubIssueId,
      repoFullName: args.repoFullName,
      identifier: args.number,
      issueKeys: [issue.key],
      source: 'manual',
      actorId: args.actorId,
    });
    await recordGithubLinkActivity(
      ctx,
      issue,
      args.actorId,
      'issue_github_artifact_linked',
      `${args.repoFullName}#${args.number}`,
    );
  },
});

export const linkCommitManually = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    issueId: v.id('issues'),
    commitId: v.id('githubCommits'),
    repoFullName: v.string(),
    sha: v.string(),
    actorId: v.optional(v.id('users')),
  },
  handler: async (ctx, args) => {
    const issue = await ctx.db.get('issues', args.issueId);
    if (!issue || issue.organizationId !== args.organizationId) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }
    await syncArtifactLinksForIssues({
      ctx,
      organizationId: args.organizationId,
      artifactType: 'commit',
      artifactId: args.commitId,
      repoFullName: args.repoFullName,
      identifier: args.sha,
      issueKeys: [issue.key],
      source: 'manual',
      actorId: args.actorId,
    });
    await recordGithubLinkActivity(
      ctx,
      issue,
      args.actorId,
      'issue_github_artifact_linked',
      `${args.repoFullName}@${args.sha.slice(0, 7)}`,
    );
  },
});

export const upsertSyncHealth = internalMutation({
  args: {
    organizationId: v.id('organizations'),
    lastWebhookAt: v.optional(v.number()),
    lastWebhookEvent: v.optional(v.string()),
    lastReconciledAt: v.optional(v.number()),
    lastSyncFailureAt: v.optional(v.number()),
    lastSyncFailureMessage: v.optional(v.string()),
    clearFailure: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const integration = await getOrCreateIntegration(ctx, args.organizationId);
    const patch: Partial<Doc<'githubIntegrations'>> = {
      updatedAt: Date.now(),
    };

    if (args.lastWebhookAt !== undefined) {
      patch.lastWebhookAt = args.lastWebhookAt;
    }
    if (args.lastWebhookEvent !== undefined) {
      patch.lastWebhookEvent = args.lastWebhookEvent;
    }
    if (args.lastReconciledAt !== undefined) {
      patch.lastReconciledAt = args.lastReconciledAt;
    }
    if (args.lastSyncFailureAt !== undefined) {
      patch.lastSyncFailureAt = args.lastSyncFailureAt;
      patch.appWebhookStatus = 'failing';
    }
    if (args.lastSyncFailureMessage !== undefined) {
      patch.lastSyncFailureMessage = args.lastSyncFailureMessage;
      patch.appWebhookStatus = 'failing';
    }
    if (args.clearFailure) {
      patch.lastSyncFailureAt = undefined;
      patch.lastSyncFailureMessage = undefined;
      patch.appWebhookStatus = 'active';
    }

    await ctx.db.patch('githubIntegrations', integration!._id, patch);
  },
});

export const unlinkArtifact = mutation({
  args: {
    linkId: v.id('githubArtifactLinks'),
    suppress: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const userId = await requireAuthUser(ctx);
    const link = await ctx.db.get('githubArtifactLinks', args.linkId);
    if (!link) {
      throw new ConvexError('LINK_NOT_FOUND');
    }

    const issue = await ctx.db.get('issues', link.issueId);
    if (!issue) {
      throw new ConvexError('ISSUE_NOT_FOUND');
    }
    if (!(await canEditIssue(ctx, issue))) {
      throw new ConvexError('FORBIDDEN');
    }

    await ctx.db.patch('githubArtifactLinks', link._id, {
      active: false,
      updatedAt: Date.now(),
    });

    let suppressionId: Id<'githubArtifactSuppressions'> | null = null;
    let externalKey: string | null = null;
    if (link.pullRequestId) {
      const pr = await ctx.db.get('githubPullRequests', link.pullRequestId);
      const repo = pr
        ? await ctx.db.get('githubRepositories', pr.repositoryId)
        : null;
      if (pr && repo) {
        externalKey = buildArtifactExternalKey(
          'pull_request',
          repo.fullName,
          pr.number,
        );
      }
    } else if (link.githubIssueId) {
      const ghIssue = await ctx.db.get('githubIssues', link.githubIssueId);
      const repo = ghIssue
        ? await ctx.db.get('githubRepositories', ghIssue.repositoryId)
        : null;
      if (ghIssue && repo) {
        externalKey = buildArtifactExternalKey(
          'issue',
          repo.fullName,
          ghIssue.number,
        );
      }
    } else if (link.commitId) {
      const commit = await ctx.db.get('githubCommits', link.commitId);
      const repo = commit
        ? await ctx.db.get('githubRepositories', commit.repositoryId)
        : null;
      if (commit && repo) {
        externalKey = buildArtifactExternalKey(
          'commit',
          repo.fullName,
          commit.sha,
        );
      }
    }

    if (externalKey) {
      const existingSuppression = await ctx.db
        .query('githubArtifactSuppressions')
        .withIndex('by_issue_task_external', q =>
          q
            .eq('issueId', issue._id)
            .eq('taskId', link.taskId)
            .eq('artifactType', link.artifactType)
            .eq('externalKey', externalKey),
        )
        .first();
      suppressionId =
        existingSuppression?._id ??
        (await ctx.db.insert('githubArtifactSuppressions', {
          organizationId: issue.organizationId,
          issueId: issue._id,
          taskId: link.taskId,
          artifactType: link.artifactType,
          externalKey,
          reason: args.suppress ? 'manual_suppress' : 'manual_unlink',
          createdBy: userId,
          createdAt: Date.now(),
        }));
    }

    if (link.pullRequestId || link.githubIssueId) {
      const siblingLinks = link.pullRequestId
        ? await ctx.db
            .query('githubArtifactLinks')
            .withIndex('by_pr', q => q.eq('pullRequestId', link.pullRequestId))
            .collect()
        : await ctx.db
            .query('githubArtifactLinks')
            .withIndex('by_gh_issue', q =>
              q.eq('githubIssueId', link.githubIssueId),
            )
            .collect();
      const inboxStatus = siblingLinks.some(
        sibling => sibling._id !== link._id && sibling.active,
      )
        ? 'linked'
        : 'dismissed';
      const inbox = link.pullRequestId
        ? await ctx.db
            .query('githubDevelopmentInbox')
            .withIndex('by_pull_request', q =>
              q.eq('pullRequestId', link.pullRequestId),
            )
            .first()
        : await ctx.db
            .query('githubDevelopmentInbox')
            .withIndex('by_github_issue', q =>
              q.eq('githubIssueId', link.githubIssueId),
            )
            .first();
      if (inbox) {
        await ctx.db.patch('githubDevelopmentInbox', inbox._id, {
          status: inboxStatus,
          updatedAt: Date.now(),
        });
      } else {
        await ctx.db.insert('githubDevelopmentInbox', {
          organizationId: issue.organizationId,
          pullRequestId: link.pullRequestId,
          githubIssueId: link.githubIssueId,
          status: inboxStatus,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      }
    }

    await recordGithubLinkActivity(
      ctx,
      issue,
      userId,
      args.suppress
        ? 'issue_github_artifact_suppressed'
        : 'issue_github_artifact_unlinked',
      link.artifactType,
    );
    await applyWorkflowAutomationForIssue(ctx, issue._id);

    return { success: true, suppressionId } as const;
  },
});
