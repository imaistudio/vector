'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useQuery } from 'convex/react';
import { api } from '@/lib/convex';
import { DynamicIcon } from '@/lib/dynamic-icons';
import { FileText, FolderKanban, Users } from 'lucide-react';
import type { Id } from '@/convex/_generated/dataModel';

function CardSkeleton() {
  return (
    <div className='bg-muted/30 flex max-w-full min-w-0 animate-pulse items-center gap-2.5 overflow-hidden rounded-lg border px-3 py-2'>
      <div className='bg-muted size-4 rounded' />
      <div className='bg-muted h-3 w-12 rounded' />
      <div className='bg-muted h-3 flex-1 rounded' />
    </div>
  );
}

function EntityUnavailableCard({
  icon,
  label,
  message,
}: {
  icon: React.ReactNode;
  label: string;
  message: string;
}) {
  return (
    <div className='bg-muted/20 text-muted-foreground flex max-w-full min-w-0 items-start gap-2.5 overflow-hidden rounded-lg border border-dashed px-3 py-2 text-xs'>
      <div className='mt-0.5 shrink-0'>{icon}</div>
      <div className='min-w-0 flex-1'>
        <div className='font-mono text-[11px]'>{label}</div>
        <div className='min-w-0 break-words'>{message}</div>
      </div>
    </div>
  );
}

// ─── Project Card ───

export function AssistantProjectCard({ projectKey }: { projectKey: string }) {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const projects = useQuery(api.organizations.queries.listProjects, {
    orgSlug,
  });
  const project = projects?.find(p => p.key === projectKey);

  if (projects === undefined) return <CardSkeleton />;
  if (!project) {
    return (
      <EntityUnavailableCard
        icon={<FolderKanban className='text-muted-foreground/60 size-3.5' />}
        label={projectKey}
        message='Project probably deleted'
      />
    );
  }

  const statusColor = project.statusColor ?? '#94a3b8';
  const statusIcon = project.statusIcon;

  return (
    <Link
      href={`/${orgSlug}/projects/${project.key}`}
      className='group block max-w-full min-w-0'
    >
      <div className='bg-background hover:bg-muted/30 flex max-w-full min-w-0 items-start gap-2.5 overflow-hidden rounded-lg border px-3 py-2 transition-colors'>
        {statusIcon ? (
          <DynamicIcon
            name={statusIcon}
            className='mt-0.5 size-3.5 shrink-0'
            style={{ color: statusColor }}
          />
        ) : (
          <FolderKanban className='text-muted-foreground/60 mt-0.5 size-3.5 shrink-0' />
        )}
        <div className='min-w-0 flex-1'>
          <div className='group-hover:text-primary min-w-0 truncate text-sm font-medium transition-colors'>
            {project.name}
          </div>
          <div className='text-muted-foreground/60 mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]'>
            <span className='font-mono text-[11px]'>{project.key}</span>
            {project.visibility === 'private' ? <span>Private</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Team Card ───

export function AssistantTeamCard({ teamKey }: { teamKey: string }) {
  const params = useParams();
  const orgSlug = params.orgSlug as string;

  const teams = useQuery(api.organizations.queries.listTeams, { orgSlug });
  const team = teams?.find(t => t.key === teamKey);

  if (teams === undefined) return <CardSkeleton />;
  if (!team) {
    return (
      <EntityUnavailableCard
        icon={<Users className='text-muted-foreground/60 size-3.5' />}
        label={teamKey}
        message='Team probably deleted'
      />
    );
  }

  return (
    <Link
      href={`/${orgSlug}/teams/${team.key}`}
      className='group block max-w-full min-w-0'
    >
      <div className='bg-background hover:bg-muted/30 flex max-w-full min-w-0 items-start gap-2.5 overflow-hidden rounded-lg border px-3 py-2 transition-colors'>
        {team.icon ? (
          <DynamicIcon
            name={team.icon}
            className='mt-0.5 size-3.5 shrink-0'
            style={{ color: team.color ?? undefined }}
          />
        ) : (
          <Users className='text-muted-foreground/60 mt-0.5 size-3.5 shrink-0' />
        )}
        <div className='min-w-0 flex-1'>
          <div className='group-hover:text-primary min-w-0 truncate text-sm font-medium transition-colors'>
            {team.name}
          </div>
          <div className='text-muted-foreground/60 mt-0.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]'>
            <span className='font-mono text-[11px]'>{team.key}</span>
            {team.visibility === 'private' ? <span>Private</span> : null}
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Document Card ───

export function AssistantDocumentCard({ documentId }: { documentId: string }) {
  const params = useParams();
  const orgSlug = params.orgSlug as string;
  const document = useQuery(api.documents.queries.getById, {
    documentId: documentId as Id<'documents'>,
  });

  if (document === undefined) return <CardSkeleton />;
  if (document === null) {
    return (
      <EntityUnavailableCard
        icon={<FileText className='text-muted-foreground/60 size-3.5' />}
        label='Document'
        message='Document probably deleted'
      />
    );
  }

  return (
    <Link
      href={`/${orgSlug}/documents/${documentId}`}
      className='group block max-w-full min-w-0'
    >
      <div className='bg-background hover:bg-muted/30 flex max-w-full min-w-0 items-start gap-2.5 overflow-hidden rounded-lg border px-3 py-2 transition-colors'>
        <FileText className='text-muted-foreground/60 mt-0.5 size-3.5 shrink-0' />
        <span className='group-hover:text-primary min-w-0 flex-1 text-sm font-medium break-words transition-colors'>
          {document.title || 'View document'}
        </span>
      </div>
    </Link>
  );
}
