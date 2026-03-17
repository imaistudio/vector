import {
  ArrowRightLeft,
  CircleDot,
  Eye,
  FileText,
  FolderOpen,
  GitBranch,
  Plus,
  Type,
  Users,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * Returns the icon and color class for a given activity event type.
 * Used by the issue activity timeline (comments section) and issues timeline view.
 */
export function getActivityIcon(eventType: string): {
  Icon: LucideIcon;
  color: string;
} {
  switch (eventType) {
    case 'issue_created':
      return { Icon: Plus, color: 'text-violet-500' };
    case 'issue_workflow_state_changed':
    case 'issue_assignment_state_changed':
      return { Icon: CircleDot, color: 'text-green-500' };
    case 'issue_title_changed':
    case 'issue_description_changed':
      return { Icon: Type, color: 'text-muted-foreground' };
    case 'issue_priority_changed':
      return { Icon: ArrowRightLeft, color: 'text-orange-500' };
    case 'issue_assignees_changed':
      return { Icon: Users, color: 'text-blue-500' };
    case 'issue_team_changed':
    case 'issue_team_added':
    case 'issue_team_removed':
      return { Icon: Users, color: 'text-muted-foreground' };
    case 'issue_project_changed':
    case 'issue_project_added':
    case 'issue_project_removed':
      return { Icon: FolderOpen, color: 'text-muted-foreground' };
    case 'issue_visibility_changed':
      return { Icon: Eye, color: 'text-muted-foreground' };
    case 'issue_sub_issue_created':
      return { Icon: GitBranch, color: 'text-violet-500' };
    case 'issue_comment_added':
      return { Icon: FileText, color: 'text-blue-500' };
    case 'issue_github_artifact_linked':
    case 'issue_github_artifact_unlinked':
    case 'issue_github_artifact_suppressed':
    case 'issue_github_artifact_status_changed':
      return { Icon: GitBranch, color: 'text-muted-foreground' };
    default:
      return { Icon: FileText, color: 'text-muted-foreground' };
  }
}
