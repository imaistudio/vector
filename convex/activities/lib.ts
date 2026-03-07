import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx } from '../_generated/server';
import type {
  ActivityEntityType,
  ActivityEventType,
  ActivityField,
} from '../_shared/activity';

export interface ActivityScope {
  organizationId: Id<'organizations'>;
  teamId?: Id<'teams'>;
  projectId?: Id<'projects'>;
  issueId?: Id<'issues'>;
}

export interface ActivityWrite {
  scope?: ActivityScope;
  organizationId?: Id<'organizations'>;
  actorId: Id<'users'>;
  entityType: ActivityEntityType;
  eventType: ActivityEventType;
  teamId?: Id<'teams'>;
  projectId?: Id<'projects'>;
  issueId?: Id<'issues'>;
  subjectUserId?: Id<'users'>;
  details?: {
    field?: ActivityField;
    fromId?:
      | null
      | string
      | Id<'users'>
      | Id<'teams'>
      | Id<'projects'>
      | Id<'issues'>
      | Id<'projectStatuses'>
      | Id<'issueStates'>
      | Id<'issuePriorities'>;
    fromLabel?: string;
    toId?:
      | null
      | string
      | Id<'users'>
      | Id<'teams'>
      | Id<'projects'>
      | Id<'issues'>
      | Id<'projectStatuses'>
      | Id<'issueStates'>
      | Id<'issuePriorities'>;
    toLabel?: string;
    subjectUserName?: string;
    roleName?: string;
    roleKey?: string;
    commentId?: Id<'comments'>;
    commentPreview?: string;
    addedUserNames?: string[];
    removedUserNames?: string[];
  };
  snapshot?: {
    entityKey?: string;
    entityName?: string;
  };
}

export function getUserDisplayName(
  user: Pick<Doc<'users'>, 'name' | 'email' | 'username'> | null | undefined,
  fallback = 'Unknown user',
) {
  return user?.name ?? user?.username ?? user?.email ?? fallback;
}

export function getVisibilityLabel(
  visibility: 'private' | 'organization' | 'public' | undefined,
) {
  switch (visibility) {
    case 'private':
      return 'Private';
    case 'public':
      return 'Public';
    case 'organization':
    default:
      return 'Organization';
  }
}

export function getTeamSnapshot(team: Doc<'teams'> | null | undefined) {
  if (!team) return {};
  return {
    entityKey: team.key,
    entityName: team.name,
  };
}

export function getProjectSnapshot(
  project: Doc<'projects'> | null | undefined,
) {
  if (!project) return {};
  return {
    entityKey: project.key,
    entityName: project.name,
  };
}

export function getIssueSnapshot(issue: Doc<'issues'> | null | undefined) {
  if (!issue) return {};
  return {
    entityKey: issue.key,
    entityName: issue.title,
  };
}

export function resolveTeamScope(team: Doc<'teams'>): ActivityScope {
  return {
    organizationId: team.organizationId,
    teamId: team._id,
  };
}

export function resolveProjectScope(project: Doc<'projects'>): ActivityScope {
  return {
    organizationId: project.organizationId,
    teamId: project.teamId ?? undefined,
    projectId: project._id,
  };
}

export function resolveIssueScope(issue: Doc<'issues'>): ActivityScope {
  return {
    organizationId: issue.organizationId,
    teamId: issue.teamId ?? undefined,
    projectId: issue.projectId ?? undefined,
    issueId: issue._id,
  };
}

export const snapshotForTeam = getTeamSnapshot;
export const snapshotForProject = getProjectSnapshot;
export const snapshotForIssue = getIssueSnapshot;

export function getCommentPreview(body: string, maxLength = 140) {
  const compact = body.replace(/\s+/g, ' ').trim();
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, maxLength - 1)}…`;
}

export async function recordActivity(
  ctx: Pick<MutationCtx, 'db'>,
  event: ActivityWrite,
) {
  const scope = event.scope ?? {
    organizationId: event.organizationId,
    teamId: event.teamId,
    projectId: event.projectId,
    issueId: event.issueId,
  };

  if (!scope.organizationId) {
    throw new Error('recordActivity requires an organizationId');
  }

  await ctx.db.insert('activityEvents', {
    organizationId: scope.organizationId,
    actorId: event.actorId,
    entityType: event.entityType,
    eventType: event.eventType,
    teamId: scope.teamId,
    projectId: scope.projectId,
    issueId: scope.issueId,
    subjectUserId: event.subjectUserId,
    details: event.details ?? {},
    snapshot: event.snapshot ?? {},
  });
}
