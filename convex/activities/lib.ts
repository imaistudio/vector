import type { Doc, Id } from '../_generated/dataModel';
import type { MutationCtx, QueryCtx } from '../_generated/server';
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
  documentId?: Id<'documents'>;
  viewId?: Id<'views'>;
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
  documentId?: Id<'documents'>;
  viewId?: Id<'views'>;
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
    viaAgent?: boolean;
    // Agent bridge live activity metadata
    liveActivityId?: Id<'issueLiveActivities'>;
    agentProvider?: string;
    agentProviderLabel?: string;
    deviceName?: string;
    workspaceLabel?: string;
  };
  snapshot?: {
    entityKey?: string;
    entityName?: string;
  };
}

export type ActivityEventDoc = Doc<'activityEvents'>;

export interface ActivityEventFilters {
  entityType?: ActivityEntityType;
  eventType?: ActivityEventType;
  actorId?: Id<'users'>;
  field?: ActivityField;
  fromLabel?: string;
  toLabel?: string;
  since?: number;
  until?: number;
}

function normalizeActivityLabel(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? null;
}

export function matchesActivityEventFilters(
  event: ActivityEventDoc,
  filters: ActivityEventFilters,
) {
  if (filters.since != null && event._creationTime < filters.since) {
    return false;
  }

  if (filters.until != null && event._creationTime > filters.until) {
    return false;
  }

  if (filters.entityType && event.entityType !== filters.entityType) {
    return false;
  }

  if (filters.eventType && event.eventType !== filters.eventType) {
    return false;
  }

  if (filters.actorId && event.actorId !== filters.actorId) {
    return false;
  }

  if (filters.field && event.details.field !== filters.field) {
    return false;
  }

  const fromLabel = normalizeActivityLabel(filters.fromLabel);
  if (
    fromLabel &&
    normalizeActivityLabel(event.details.fromLabel) !== fromLabel
  ) {
    return false;
  }

  const toLabel = normalizeActivityLabel(filters.toLabel);
  if (toLabel && normalizeActivityLabel(event.details.toLabel) !== toLabel) {
    return false;
  }

  return true;
}

function applyCreationTimeRange<T extends { gte: Function; lte: Function }>(
  builder: T,
  since?: number,
  until?: number,
) {
  let next: T = builder;

  if (since != null) {
    next = next.gte('_creationTime', since);
  }

  if (until != null) {
    next = next.lte('_creationTime', until);
  }

  return next;
}

export async function queryOrganizationActivityPage(
  ctx: QueryCtx,
  organizationId: Id<'organizations'>,
  args: ActivityEventFilters & {
    cursor?: string | null;
    numItems: number;
  },
) {
  const cursor = args.cursor ?? null;

  if (args.entityType && args.eventType) {
    return await ctx.db
      .query('activityEvents')
      .withIndex('by_organization_entity_event_type', q =>
        applyCreationTimeRange(
          q
            .eq('organizationId', organizationId)
            .eq('entityType', args.entityType!)
            .eq('eventType', args.eventType!),
          args.since,
          args.until,
        ),
      )
      .order('desc')
      .paginate({ cursor, numItems: args.numItems });
  }

  if (args.entityType) {
    return await ctx.db
      .query('activityEvents')
      .withIndex('by_organization_entity_type', q =>
        applyCreationTimeRange(
          q
            .eq('organizationId', organizationId)
            .eq('entityType', args.entityType!),
          args.since,
          args.until,
        ),
      )
      .order('desc')
      .paginate({ cursor, numItems: args.numItems });
  }

  if (args.eventType) {
    return await ctx.db
      .query('activityEvents')
      .withIndex('by_organization_event_type', q =>
        applyCreationTimeRange(
          q
            .eq('organizationId', organizationId)
            .eq('eventType', args.eventType!),
          args.since,
          args.until,
        ),
      )
      .order('desc')
      .paginate({ cursor, numItems: args.numItems });
  }

  if (args.actorId) {
    return await ctx.db
      .query('activityEvents')
      .withIndex('by_organization_actor', q =>
        applyCreationTimeRange(
          q.eq('organizationId', organizationId).eq('actorId', args.actorId!),
          args.since,
          args.until,
        ),
      )
      .order('desc')
      .paginate({ cursor, numItems: args.numItems });
  }

  return await ctx.db
    .query('activityEvents')
    .withIndex('by_organization', q =>
      applyCreationTimeRange(
        q.eq('organizationId', organizationId),
        args.since,
        args.until,
      ),
    )
    .order('desc')
    .paginate({ cursor, numItems: args.numItems });
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

export function getDocumentSnapshot(doc: Doc<'documents'> | null | undefined) {
  if (!doc) return {};
  return {
    entityKey: doc._id,
    entityName: doc.title,
  };
}

export function resolveDocumentScope(doc: Doc<'documents'>): ActivityScope {
  return {
    organizationId: doc.organizationId,
    teamId: doc.teamId ?? undefined,
    projectId: doc.projectId ?? undefined,
    documentId: doc._id,
  };
}

export function getViewSnapshot(view: Doc<'views'> | null | undefined) {
  if (!view) return {};
  return {
    entityKey: view._id,
    entityName: view.name,
  };
}

export function resolveViewScope(view: Doc<'views'>): ActivityScope {
  return {
    organizationId: view.organizationId,
    viewId: view._id,
  };
}

export const snapshotForView = getViewSnapshot;
export const snapshotForTeam = getTeamSnapshot;
export const snapshotForProject = getProjectSnapshot;
export const snapshotForIssue = getIssueSnapshot;
export const snapshotForDocument = getDocumentSnapshot;

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
    documentId: event.documentId,
    viewId: event.viewId,
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
    documentId: scope.documentId,
    viewId: scope.viewId,
    subjectUserId: event.subjectUserId,
    details: event.details ?? {},
    snapshot: event.snapshot ?? {},
  });

  // Touch the issue's updatedAt and cache the latest activity event type
  if (scope.issueId && event.entityType === 'issue') {
    await ctx.db.patch('issues', scope.issueId, {
      updatedAt: Date.now(),
      lastActivityEventType: event.eventType,
    });
  }
}
