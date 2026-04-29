'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  type LucideIcon,
  CheckSquare,
  FileText,
  FolderOpen,
  Circle,
  LayoutList,
  Columns3,
  Clock,
  Globe,
  Building,
  Lock,
  Plus,
  ChevronRight,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { CreateIssueDialog } from '@/components/issues/create-issue-dialog';
import { CreateTeamButton } from '@/components/teams/create-team-button';
import { CreateProjectButton } from '@/components/projects/create-project-button';
import { ScopedPermissionGate } from '@/hooks/use-permissions';
import { PERMISSIONS } from '@/convex/_shared/permissions';
import { api, useCachedPaginatedQuery, useMutation } from '@/lib/convex';
import { withIds } from '@/lib/convex-helpers';
import { useState, type ReactNode } from 'react';
import { useRouter } from 'nextjs-toploader/app';
import { DynamicIcon } from '@/lib/dynamic-icons';
import Avvvatars from 'avvvatars-react';
import { CreateDocumentDialog } from '@/components/documents/create-document-dialog';
import { CreateViewDialog } from '@/components/views/create-view-dialog';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Optional create button element shown at the end of the row */
  createElement?: ReactNode;
}

interface OrgSidebarProps {
  orgSlug: string;
  onNavigate?: () => void;
}

/** Collapsible sidebar section with chevron toggle and linked label. */
function SidebarSection({
  label,
  href,
  action,
  children,
  onNavigate,
  defaultOpen = true,
}: {
  label: string;
  /** URL the section label links to (the "view all" page). */
  href: string;
  action: ReactNode;
  children: ReactNode;
  onNavigate?: () => void;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className='space-y-1'>
      <div className='flex items-center justify-between pr-1 pl-2'>
        <div className='flex items-center gap-1'>
          <Link
            href={href}
            onClick={onNavigate}
            className='text-muted-foreground hover:text-foreground text-xs font-normal tracking-wider uppercase transition-colors'
          >
            {label}
          </Link>
          <button
            type='button'
            onClick={() => setOpen(o => !o)}
            className='text-muted-foreground hover:text-foreground transition-colors'
          >
            <ChevronRight
              className={cn(
                'size-3 transition-transform duration-150',
                open && 'rotate-90',
              )}
            />
          </button>
        </div>
        <div className='flex items-center gap-1'>{action}</div>
      </div>

      {open && <div className='space-y-1'>{children}</div>}
    </div>
  );
}

function SidebarItemsSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className='space-y-1' aria-hidden='true'>
      {Array.from({ length: rows }).map((_, index) => (
        <div
          key={index}
          className='flex items-center gap-2 rounded-md py-1.5 pr-1 pl-2'
        >
          <Skeleton className='size-3 shrink-0 rounded-sm' />
          <Skeleton
            className={cn(
              'h-3 flex-1',
              index === 0 && 'max-w-32',
              index === 1 && 'max-w-24',
              index === 2 && 'max-w-28',
            )}
          />
        </div>
      ))}
    </div>
  );
}

function CreateThreadButton({
  orgSlug,
  onNavigate,
}: {
  orgSlug: string;
  onNavigate?: () => void;
}) {
  const router = useRouter();
  const createThread = useMutation(api.ai.mutations.createThread);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const thread = await createThread({ orgSlug });
      if (thread?._id) {
        onNavigate?.();
        router.push(`/${orgSlug}/threads/${thread._id}`);
      }
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <Button
      variant='outline'
      size='sm'
      className='h-6 w-6 border-0 p-0 shadow-none'
      onClick={handleCreate}
      disabled={isCreating}
    >
      {isCreating ? (
        <Loader2 className='size-3.5 animate-spin' />
      ) : (
        <Plus className='size-3.5' />
      )}
    </Button>
  );
}

export function OrgSidebar({ orgSlug, onNavigate }: OrgSidebarProps) {
  const pathname = usePathname();

  const userTeamsPage = useCachedPaginatedQuery(
    api.teams.queries.listPage,
    { orgSlug, scope: 'mine' },
    { initialNumItems: 4 },
  );
  const userTeamsLoading = userTeamsPage.status === 'LoadingFirstPage';

  const userProjectsPage = useCachedPaginatedQuery(
    api.projects.queries.listPage,
    { orgSlug, scope: 'mine' },
    { initialNumItems: 4 },
  );
  const userProjectsLoading = userProjectsPage.status === 'LoadingFirstPage';

  const userDocumentsPage = useCachedPaginatedQuery(
    api.documents.queries.listPage,
    { orgSlug, scope: 'mine' },
    { initialNumItems: 4 },
  );
  const userDocumentsLoading = userDocumentsPage.status === 'LoadingFirstPage';

  const visibleViewsPage = useCachedPaginatedQuery(
    api.views.queries.listViewsPage,
    { orgSlug, scope: 'all' },
    { initialNumItems: 4 },
  );
  const visibleViewsLoading = visibleViewsPage.status === 'LoadingFirstPage';

  const threadsPage = useCachedPaginatedQuery(
    api.ai.queries.listOrgThreads,
    { orgSlug },
    { initialNumItems: 4 },
  );
  const threadsLoading = threadsPage.status === 'LoadingFirstPage';

  // Transform data to maintain frontend compatibility.
  const userTeams = withIds(userTeamsPage.results);
  const userProjects = withIds(userProjectsPage.results);
  const userDocuments = userDocumentsPage.results;
  const visibleViews = visibleViewsPage.results;
  const threads = threadsPage.results;

  const hasMoreTeams =
    userTeams.length > 3 || userTeamsPage.status === 'CanLoadMore';
  const hasMoreProjects =
    userProjects.length > 3 || userProjectsPage.status === 'CanLoadMore';
  const hasMoreDocuments =
    userDocuments.length > 3 || userDocumentsPage.status === 'CanLoadMore';
  const hasMoreViews =
    visibleViews.length > 3 || visibleViewsPage.status === 'CanLoadMore';
  const hasMoreThreads =
    threads.length > 3 || threadsPage.status === 'CanLoadMore';

  const navItems: NavItem[] = [
    {
      label: 'My Issues',
      href: `/${orgSlug}/issues`,
      icon: CheckSquare,
      createElement: (
        <ScopedPermissionGate
          scope={{ orgSlug }}
          permission={PERMISSIONS.ISSUE_CREATE}
        >
          <CreateIssueDialog
            orgSlug={orgSlug}
            variant='default'
            className='h-6 w-6 border-0 p-0 shadow-none'
          />
        </ScopedPermissionGate>
      ),
    },
  ];

  return (
    <>
      <nav className='space-y-4 p-2 pt-0'>
        {/* Main navigation items */}
        <div className='space-y-1'>
          {navItems.map(item => {
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + '/');

            return (
              <div
                key={item.href}
                className={cn(
                  'group flex h-8 items-center justify-between gap-2 rounded-md py-1 pr-1 pl-2 text-sm font-medium transition-colors',
                  'hover:bg-foreground/5 text-foreground',
                  {
                    'bg-foreground/5': isActive,
                  },
                )}
              >
                {/* Clickable area */}
                <Link
                  href={item.href}
                  className='flex flex-1 items-center gap-2 outline-none'
                  onClick={onNavigate}
                >
                  <item.icon className='size-4' />
                  <span>{item.label}</span>
                </Link>

                {/* Create button (if any) */}
                {item.createElement && (
                  <div
                    className='flex-shrink-0'
                    onClick={e => {
                      // Prevent row hover click-through
                      e.stopPropagation();
                    }}
                  >
                    {item.createElement}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Teams Section */}
        <SidebarSection
          label='My Teams'
          href={`/${orgSlug}/teams`}
          onNavigate={onNavigate}
          action={
            <CreateTeamButton
              orgSlug={orgSlug}
              size='sm'
              className='h-6 w-6 border-0 p-0 shadow-none'
            />
          }
        >
          {userTeamsLoading ? (
            <SidebarItemsSkeleton />
          ) : userTeams.length > 0 ? (
            userTeams.slice(0, 3).map(team => {
              const teamHref = `/${orgSlug}/teams/${team.key}`;
              const isActive =
                pathname === teamHref || pathname.startsWith(teamHref + '/');

              return (
                <Link
                  key={team.id}
                  href={teamHref}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 rounded-md py-1.5 pr-1 pl-2 text-sm font-medium transition-colors',
                    'hover:bg-foreground/5 text-foreground',
                    {
                      'bg-foreground/5': isActive,
                    },
                  )}
                >
                  <DynamicIcon
                    name={team.icon}
                    fallback={Circle}
                    className='size-3 flex-shrink-0'
                    style={{ color: team.color || '#6b7280' }}
                  />
                  <span className='truncate'>{team.name}</span>
                </Link>
              );
            })
          ) : (
            <div className='text-muted-foreground py-1.5 pr-1 pl-2 text-xs'>
              No teams yet
            </div>
          )}

          {!userTeamsLoading && hasMoreTeams && (
            <Link
              href={`/${orgSlug}/teams`}
              onClick={onNavigate}
              className='text-muted-foreground hover:text-foreground block py-1.5 pr-1 pl-2 text-xs transition-colors'
            >
              View all teams
            </Link>
          )}
        </SidebarSection>

        {/* Projects Section */}
        <SidebarSection
          label='My Projects'
          href={`/${orgSlug}/projects`}
          onNavigate={onNavigate}
          action={
            <CreateProjectButton
              orgSlug={orgSlug}
              size='sm'
              className='h-6 w-6 border-0 p-0 shadow-none'
            />
          }
        >
          {userProjectsLoading ? (
            <SidebarItemsSkeleton />
          ) : userProjects.length > 0 ? (
            userProjects.slice(0, 3).map(project => {
              const projectHref = `/${orgSlug}/projects/${project.key}`;
              const isActive =
                pathname === projectHref ||
                pathname.startsWith(projectHref + '/');

              return (
                <Link
                  key={project.id}
                  href={projectHref}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 rounded-md py-1.5 pr-1 pl-2 text-sm font-medium transition-colors',
                    'hover:bg-foreground/5 text-foreground',
                    {
                      'bg-foreground/5': isActive,
                    },
                  )}
                >
                  <DynamicIcon
                    name={project.icon || project.status?.icon}
                    fallback={FolderOpen}
                    className='size-3 flex-shrink-0'
                    style={{
                      color:
                        project.color || project.status?.color || '#6b7280',
                    }}
                  />
                  <span className='flex-1 truncate'>{project.name}</span>
                  {project.status?.icon && (
                    <div className='flex w-6 shrink-0 items-center justify-center'>
                      <DynamicIcon
                        name={project.status.icon}
                        className='size-3'
                        style={{ color: project.status.color || '#6b7280' }}
                      />
                    </div>
                  )}
                </Link>
              );
            })
          ) : (
            <div className='text-muted-foreground py-1.5 pr-1 pl-2 text-xs'>
              No projects yet
            </div>
          )}

          {!userProjectsLoading && hasMoreProjects && (
            <Link
              href={`/${orgSlug}/projects`}
              onClick={onNavigate}
              className='text-muted-foreground hover:text-foreground block py-1.5 pr-1 pl-2 text-xs transition-colors'
            >
              View all projects
            </Link>
          )}
        </SidebarSection>

        {/* Views Section */}
        <SidebarSection
          label='Views'
          href={`/${orgSlug}/views`}
          onNavigate={onNavigate}
          action={
            <ScopedPermissionGate
              scope={{ orgSlug }}
              permission={PERMISSIONS.VIEW_CREATE}
            >
              <CreateViewDialog
                orgSlug={orgSlug}
                trigger={
                  <Button
                    variant='outline'
                    size='sm'
                    className='h-6 w-6 border-0 p-0 shadow-none'
                  >
                    <Plus className='size-3.5' />
                  </Button>
                }
              />
            </ScopedPermissionGate>
          }
        >
          {visibleViewsLoading ? (
            <SidebarItemsSkeleton />
          ) : visibleViews.length > 0 ? (
            visibleViews.slice(0, 3).map(view => {
              const viewHref = `/${orgSlug}/views/${view._id}`;
              const isActive =
                pathname === viewHref || pathname.startsWith(viewHref + '/');
              const VisibilityIcon =
                view.visibility === 'public'
                  ? Globe
                  : view.visibility === 'private'
                    ? Lock
                    : Building;
              const viewMode = view.layout?.viewMode ?? 'table';
              const ViewModeIcon =
                viewMode === 'kanban'
                  ? Columns3
                  : viewMode === 'timeline'
                    ? Clock
                    : LayoutList;

              return (
                <Link
                  key={view._id}
                  href={viewHref}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 rounded-md py-1.5 pr-1 pl-2 text-sm font-medium transition-colors',
                    'hover:bg-foreground/5 text-foreground',
                    {
                      'bg-foreground/5': isActive,
                    },
                  )}
                >
                  <ViewModeIcon className='text-muted-foreground size-3 flex-shrink-0' />
                  <span className='flex-1 truncate'>{view.name}</span>
                  <div className='flex w-6 shrink-0 items-center justify-center'>
                    <VisibilityIcon
                      className={cn('size-3', {
                        'text-emerald-500': view.visibility === 'public',
                        'text-purple-500': view.visibility === 'private',
                        'text-blue-500': view.visibility === 'organization',
                      })}
                    />
                  </div>
                </Link>
              );
            })
          ) : (
            <div className='text-muted-foreground py-1.5 pr-1 pl-2 text-xs'>
              No views yet
            </div>
          )}

          {!visibleViewsLoading && hasMoreViews && (
            <Link
              href={`/${orgSlug}/views`}
              onClick={onNavigate}
              className='text-muted-foreground hover:text-foreground block py-1.5 pr-1 pl-2 text-xs transition-colors'
            >
              View all views
            </Link>
          )}
        </SidebarSection>

        {/* Threads Section */}
        <SidebarSection
          label='Threads'
          href={`/${orgSlug}/threads`}
          onNavigate={onNavigate}
          action={
            <CreateThreadButton orgSlug={orgSlug} onNavigate={onNavigate} />
          }
        >
          {threadsLoading ? (
            <SidebarItemsSkeleton />
          ) : threads.length > 0 ? (
            threads.slice(0, 3).map(thread => {
              const threadHref = `/${orgSlug}/threads/${thread._id}`;
              const isActive =
                pathname === threadHref ||
                pathname.startsWith(threadHref + '/');

              return (
                <Link
                  key={thread._id}
                  href={threadHref}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 rounded-md py-1.5 pr-1 pl-2 text-sm font-medium transition-colors',
                    'hover:bg-foreground/5 text-foreground',
                    {
                      'bg-foreground/5': isActive,
                    },
                  )}
                >
                  <Avvvatars
                    value={`thread-${thread._id}`.toLowerCase()}
                    style='shape'
                    size={16}
                    shadow={false}
                    radius={999}
                  />
                  <span className='truncate'>
                    {thread.title || 'Untitled Thread'}
                  </span>
                </Link>
              );
            })
          ) : (
            <div className='text-muted-foreground py-1.5 pr-1 pl-2 text-xs'>
              No threads yet
            </div>
          )}

          {!threadsLoading && hasMoreThreads && (
            <Link
              href={`/${orgSlug}/threads`}
              onClick={onNavigate}
              className='text-muted-foreground hover:text-foreground block py-1.5 pr-1 pl-2 text-xs transition-colors'
            >
              View all threads
            </Link>
          )}
        </SidebarSection>

        {/* Documents Section */}
        <SidebarSection
          label='My Docs'
          href={`/${orgSlug}/documents`}
          onNavigate={onNavigate}
          action={
            <CreateDocumentDialog
              orgSlug={orgSlug}
              className='h-6 w-6 border-0 p-0 shadow-none'
            />
          }
        >
          {userDocumentsLoading ? (
            <SidebarItemsSkeleton />
          ) : userDocuments.length > 0 ? (
            userDocuments.slice(0, 3).map(doc => {
              const docHref = `/${orgSlug}/documents/${doc._id}`;
              const isActive =
                pathname === docHref || pathname.startsWith(docHref + '/');

              return (
                <Link
                  key={doc._id}
                  href={docHref}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 rounded-md py-1.5 pr-1 pl-2 text-sm font-medium transition-colors',
                    'hover:bg-foreground/5 text-foreground',
                    {
                      'bg-foreground/5': isActive,
                    },
                  )}
                >
                  {doc.icon ? (
                    <DynamicIcon
                      name={doc.icon}
                      fallback={FileText}
                      className='size-3 flex-shrink-0'
                      style={{ color: doc.color || '#6b7280' }}
                    />
                  ) : (
                    <FileText
                      className='size-3 flex-shrink-0'
                      style={{ color: doc.color || '#6b7280' }}
                    />
                  )}
                  <span className='truncate'>{doc.title}</span>
                </Link>
              );
            })
          ) : (
            <div className='text-muted-foreground py-1.5 pr-1 pl-2 text-xs'>
              No documents yet
            </div>
          )}

          {!userDocumentsLoading && hasMoreDocuments && (
            <Link
              href={`/${orgSlug}/documents`}
              onClick={onNavigate}
              className='text-muted-foreground hover:text-foreground block py-1.5 pr-1 pl-2 text-xs transition-colors'
            >
              View all documents
            </Link>
          )}
        </SidebarSection>
      </nav>
    </>
  );
}
