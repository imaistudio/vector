'use client';

import { api, useCachedQuery } from '@/lib/convex';
import { Lock, Globe, Users } from 'lucide-react';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { Skeleton } from '@/components/ui/skeleton';
import { UserAvatar } from '@/components/user-avatar';
import { PublicListView } from '@/components/views/public-issues';

interface PublicTeamPageProps {
  orgSlug: string;
  teamKey: string;
}

export function PublicTeamPage({ orgSlug, teamKey }: PublicTeamPageProps) {
  const team = useCachedQuery(api.og.queries.getPublicTeamFull, {
    orgSlug,
    teamKey,
  });

  if (team === undefined) {
    return (
      <div className='mx-auto max-w-4xl space-y-4 p-6'>
        <Skeleton className='h-8 w-48' />
        <Skeleton className='h-4 w-64' />
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className='h-12 w-full' />
        ))}
      </div>
    );
  }

  if (team === null) {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center gap-2'>
        <Lock className='text-muted-foreground size-10 opacity-30' />
        <p className='text-muted-foreground text-sm'>
          This team is not available or is private.
        </p>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-4xl p-6'>
      {/* Breadcrumb */}
      <div className='text-muted-foreground mb-4 flex items-center gap-1.5 text-xs'>
        <Globe className='size-3 text-emerald-500' />
        <span>{team.orgName}</span>
      </div>

      {/* Header */}
      <div className='mb-6 space-y-2'>
        <div className='flex items-center gap-2'>
          {team.icon && (
            <DynamicIcon
              name={team.icon}
              className='size-5'
              style={{ color: team.color ?? undefined }}
            />
          )}
          <h1 className='text-xl font-semibold'>{team.name}</h1>
        </div>
        {team.description && (
          <p className='text-muted-foreground text-sm'>{team.description}</p>
        )}
      </div>

      {/* Meta */}
      <div className='mb-6 flex flex-wrap gap-4'>
        {team.lead && (
          <div className='flex items-center gap-1.5 text-sm'>
            <UserAvatar
              name={team.lead.name}
              image={team.lead.image}
              size='sm'
            />
            <span className='text-muted-foreground'>
              Lead: {team.lead.name}
            </span>
          </div>
        )}
        <div className='text-muted-foreground flex items-center gap-1.5 text-sm'>
          <Users className='size-3.5' />
          {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Public Projects */}
      {team.projects.length > 0 && (
        <div className='mb-8 space-y-2'>
          <h2 className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            Projects
          </h2>
          <div className='divide-border divide-y rounded-md border'>
            {team.projects.map(project => (
              <a
                key={project.key}
                href={`/${orgSlug}/projects/${project.key}/public`}
                className='hover:bg-muted/50 flex items-center gap-3 px-3 py-2.5 transition-colors'
              >
                <span className='text-sm font-medium'>{project.name}</span>
                {project.status && (
                  <span
                    className='rounded px-1.5 py-0.5 text-xs'
                    style={{
                      color: project.status.color ?? undefined,
                      backgroundColor: project.status.color
                        ? `${project.status.color}15`
                        : undefined,
                    }}
                  >
                    {project.status.name}
                  </span>
                )}
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Issues */}
      {team.issues.length > 0 ? (
        <div className='space-y-2'>
          <h2 className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            Issues ({team.totalIssues})
          </h2>
          <div className='rounded-lg border p-2'>
            <PublicListView
              issues={team.issues}
              orgSlug={orgSlug}
              groupBy='none'
            />
          </div>
        </div>
      ) : (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          No issues in this team.
        </p>
      )}
    </div>
  );
}
