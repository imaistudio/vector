'use client';

import { useState } from 'react';
import { useQuery, useMutation } from 'convex/react';
import { api } from '@/lib/convex';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogTrigger,
} from '@/components/ui/responsive-dialog';
import {
  VisibilitySelector,
  type VisibilityOption,
} from '@/components/ui/visibility-selector';
import {
  TeamSelector,
  ProjectSelector,
  StateSelector,
  PrioritySelector,
} from '@/components/issues/issue-selectors';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';

interface CreateViewDialogProps {
  orgSlug: string;
  trigger?: React.ReactNode;
  className?: string;
}

export function CreateViewDialog({
  orgSlug,
  trigger,
  className,
}: CreateViewDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] =
    useState<VisibilityOption>('organization');
  const [selectedTeam, setSelectedTeam] = useState('');
  const [selectedProject, setSelectedProject] = useState('');
  const [selectedPriorities, setSelectedPriorities] = useState<string[]>([]);
  const [selectedStates, setSelectedStates] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const teams = useQuery(api.organizations.queries.listTeams, { orgSlug });
  const projects = useQuery(api.organizations.queries.listProjects, {
    orgSlug,
  });
  const states = useQuery(api.organizations.queries.listIssueStates, {
    orgSlug,
  });
  const priorities = useQuery(api.organizations.queries.listIssuePriorities, {
    orgSlug,
  });

  const createView = useMutation(api.views.mutations.createView);

  const resetForm = () => {
    setName('');
    setDescription('');
    setVisibility('organization');
    setSelectedTeam('');
    setSelectedProject('');
    setSelectedPriorities([]);
    setSelectedStates([]);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await createView({
        orgSlug,
        name: name.trim(),
        description: description.trim() || undefined,
        filters: {
          teamId: selectedTeam ? (selectedTeam as Id<'teams'>) : undefined,
          projectId: selectedProject
            ? (selectedProject as Id<'projects'>)
            : undefined,
          priorityIds: selectedPriorities.length
            ? (selectedPriorities as Id<'issuePriorities'>[])
            : undefined,
          workflowStateIds: selectedStates.length
            ? (selectedStates as Id<'issueStates'>[])
            : undefined,
        },
        visibility,
      });
      toast.success('View created');
      resetForm();
      setOpen(false);
    } catch {
      toast.error('Failed to create view');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={setOpen}>
      <ResponsiveDialogTrigger asChild>
        {trigger ?? (
          <Button size='sm' className={className}>
            <Plus className='size-4' />
            New View
          </Button>
        )}
      </ResponsiveDialogTrigger>
      <ResponsiveDialogContent>
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Create View</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>
        <form onSubmit={handleSubmit} className='space-y-4 p-2'>
          <Input
            placeholder='View name'
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
            maxLength={100}
          />
          <Input
            placeholder='Description (optional)'
            value={description}
            onChange={e => setDescription(e.target.value)}
            maxLength={500}
          />

          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs font-medium uppercase'>
              Visibility
            </div>
            <VisibilitySelector
              value={visibility}
              onValueChange={setVisibility}
            />
          </div>

          <div className='space-y-2'>
            <div className='text-muted-foreground text-xs font-medium uppercase'>
              Filters
            </div>
            <div className='flex flex-wrap gap-2'>
              <TeamSelector
                teams={teams ?? []}
                selectedTeam={selectedTeam}
                onTeamSelect={v => setSelectedTeam(v === selectedTeam ? '' : v)}
                displayMode='iconWhenUnselected'
              />
              <ProjectSelector
                projects={projects ?? []}
                selectedProject={selectedProject}
                onProjectSelect={v =>
                  setSelectedProject(v === selectedProject ? '' : v)
                }
                displayMode='iconWhenUnselected'
              />
              <PrioritySelector
                priorities={priorities ?? []}
                selectedPriority={selectedPriorities[0] ?? ''}
                selectedPriorities={selectedPriorities}
                onPrioritySelect={v =>
                  setSelectedPriorities(prev =>
                    prev.includes(v)
                      ? prev.filter(id => id !== v)
                      : [...prev, v],
                  )
                }
                displayMode='iconWhenUnselected'
              />
              <StateSelector
                states={states ?? []}
                selectedState={selectedStates[0] ?? ''}
                selectedStates={selectedStates}
                onStateSelect={v =>
                  setSelectedStates(prev =>
                    prev.includes(v)
                      ? prev.filter(id => id !== v)
                      : [...prev, v],
                  )
                }
                displayMode='iconWhenUnselected'
              />
            </div>
          </div>

          <div className='flex justify-end gap-2 pt-2'>
            <Button
              type='button'
              variant='outline'
              size='sm'
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              size='sm'
              disabled={!name.trim() || isSubmitting}
            >
              {isSubmitting ? 'Creating...' : 'Create View'}
            </Button>
          </div>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
