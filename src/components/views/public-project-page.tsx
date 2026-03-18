'use client';

import { api, useCachedQuery } from '@/lib/convex';
import { Lock, Globe, Calendar } from 'lucide-react';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDateHuman } from '@/lib/date';
import { UserAvatar } from '@/components/user-avatar';
import { PublicListView } from '@/components/views/public-issues';

interface PublicProjectPageProps {
  orgSlug: string;
  projectKey: string;
}

export function PublicProjectPage({
  orgSlug,
  projectKey,
}: PublicProjectPageProps) {
  const project = useCachedQuery(api.og.queries.getPublicProjectFull, {
    orgSlug,
    projectKey,
  });

  if (project === undefined) {
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

  if (project === null) {
    return (
      <div className='flex min-h-[60vh] flex-col items-center justify-center gap-2'>
        <Lock className='text-muted-foreground size-10 opacity-30' />
        <p className='text-muted-foreground text-sm'>
          This project is not available or is private.
        </p>
      </div>
    );
  }

  return (
    <div className='mx-auto max-w-4xl p-6'>
      {/* Breadcrumb */}
      <div className='text-muted-foreground mb-4 flex items-center gap-1.5 text-xs'>
        <Globe className='size-3 text-emerald-500' />
        <span>{project.orgName}</span>
      </div>

      {/* Header */}
      <div className='mb-6 space-y-2'>
        <div className='flex items-center gap-2'>
          <h1 className='text-xl font-semibold'>{project.name}</h1>
          {project.status && (
            <span
              className='rounded px-2 py-0.5 text-xs font-medium'
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
        </div>
        {project.description && (
          <p className='text-muted-foreground text-sm'>{project.description}</p>
        )}
      </div>

      {/* Meta */}
      <div className='mb-6 flex flex-wrap gap-4'>
        {project.team && (
          <div className='text-muted-foreground flex items-center gap-1.5 text-sm'>
            {project.team.icon && (
              <DynamicIcon
                name={project.team.icon}
                className='size-3.5'
                style={{ color: project.team.color ?? undefined }}
              />
            )}
            {project.team.name}
          </div>
        )}
        {project.lead && (
          <div className='flex items-center gap-1.5 text-sm'>
            <UserAvatar
              name={project.lead.name}
              image={project.lead.image}
              size='sm'
            />
            <span className='text-muted-foreground'>{project.lead.name}</span>
          </div>
        )}
        {(project.startDate || project.dueDate) && (
          <div className='text-muted-foreground flex items-center gap-1.5 text-sm'>
            <Calendar className='size-3.5' />
            {project.startDate && formatDateHuman(project.startDate)}
            {project.startDate && project.dueDate && ' → '}
            {project.dueDate && formatDateHuman(project.dueDate)}
          </div>
        )}
        <span className='text-muted-foreground text-sm'>
          {project.totalIssues} issue{project.totalIssues !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Issues */}
      {project.issues.length > 0 ? (
        <div className='space-y-2'>
          <h2 className='text-muted-foreground text-xs font-medium tracking-wider uppercase'>
            Issues
          </h2>
          <div className='rounded-lg border p-2'>
            <PublicListView
              issues={project.issues}
              orgSlug={orgSlug}
              groupBy='none'
            />
          </div>
        </div>
      ) : (
        <p className='text-muted-foreground py-8 text-center text-sm'>
          No issues in this project.
        </p>
      )}
    </div>
  );
}
