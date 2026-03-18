'use client';

import { api, useCachedQuery, useMutation } from '@/lib/convex';
import { Globe, Eye, EyeOff, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { toast } from 'sonner';
import type { Id } from '@/convex/_generated/dataModel';

interface IssueViewVisibilityCalloutProps {
  issueId: Id<'issues'>;
}

export function IssueViewVisibilityCallout({
  issueId,
}: IssueViewVisibilityCalloutProps) {
  const matchingViews = useCachedQuery(
    api.views.queries.getViewsContainingIssue,
    {
      issueId,
    },
  );
  const excludeIssue = useMutation(api.views.mutations.excludeIssueFromView);
  const includeIssue = useMutation(api.views.mutations.includeIssueInView);

  if (!matchingViews || matchingViews.length === 0) return null;

  const publicViews = matchingViews.filter(v => v.visibility === 'public');
  const orgViews = matchingViews.filter(v => v.visibility === 'organization');

  const handleExclude = async (viewId: Id<'views'>, viewName: string) => {
    await excludeIssue({ viewId, issueId });
    toast.success(`Excluded from "${viewName}"`);
  };

  const handleInclude = async (viewId: Id<'views'>, viewName: string) => {
    await includeIssue({ viewId, issueId });
    toast.success(`Re-included in "${viewName}"`);
  };

  const hasPublic = publicViews.some(v => !v.isExcluded);
  const hasOrg = orgViews.some(v => !v.isExcluded);
  const label = hasPublic
    ? 'Public view'
    : hasOrg
      ? 'Shared view'
      : 'Excluded from views';

  return (
    <Popover>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <Button variant='ghost' size='sm' className='h-6 w-6 p-0'>
                {hasPublic ? (
                  <Globe className='size-3.5 text-emerald-500' />
                ) : (
                  <Eye className='size-3.5 text-blue-500' />
                )}
              </Button>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side='bottom'>
            <p className='text-xs'>{label}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <PopoverContent align='end' className='w-64 p-0'>
        <div className='space-y-0'>
          {publicViews.length > 0 && (
            <div className='border-b px-3 py-2'>
              <div className='mb-1.5 flex items-center gap-2'>
                <Globe className='size-3 flex-shrink-0 text-emerald-500' />
                <span className='text-xs font-medium text-emerald-600 dark:text-emerald-400'>
                  Public view{publicViews.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className='space-y-1'>
                {publicViews.map(v => (
                  <div
                    key={v._id}
                    className='flex items-center justify-between gap-2'
                  >
                    <span
                      className={`text-xs ${v.isExcluded ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground'}`}
                    >
                      {v.name}
                    </span>
                    {v.isExcluded ? (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-5 gap-1 px-1.5 text-xs text-emerald-600 hover:text-emerald-700'
                        onClick={() => void handleInclude(v._id, v.name)}
                      >
                        <RotateCcw className='size-3' />
                        Re-include
                      </Button>
                    ) : (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-muted-foreground h-5 gap-1 px-1.5 text-xs'
                        onClick={() => void handleExclude(v._id, v.name)}
                      >
                        <EyeOff className='size-3' />
                        Exclude
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
          {orgViews.length > 0 && (
            <div className='px-3 py-2'>
              <div className='mb-1.5 flex items-center gap-2'>
                <Eye className='size-3 flex-shrink-0 text-blue-500' />
                <span className='text-xs font-medium text-blue-600 dark:text-blue-400'>
                  Shared view{orgViews.length > 1 ? 's' : ''}
                </span>
              </div>
              <div className='space-y-1'>
                {orgViews.map(v => (
                  <div
                    key={v._id}
                    className='flex items-center justify-between gap-2'
                  >
                    <span
                      className={`text-xs ${v.isExcluded ? 'text-muted-foreground/50 line-through' : 'text-muted-foreground'}`}
                    >
                      {v.name}
                    </span>
                    {v.isExcluded ? (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='h-5 gap-1 px-1.5 text-xs text-blue-600 hover:text-blue-700'
                        onClick={() => void handleInclude(v._id, v.name)}
                      >
                        <RotateCcw className='size-3' />
                        Re-include
                      </Button>
                    ) : (
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-muted-foreground h-5 gap-1 px-1.5 text-xs'
                        onClick={() => void handleExclude(v._id, v.name)}
                      >
                        <EyeOff className='size-3' />
                        Exclude
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
