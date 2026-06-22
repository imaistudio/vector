import { PERMISSIONS } from '@/convex/_shared/permissions';

export interface PermissionGroupItem {
  id: (typeof PERMISSIONS)[keyof typeof PERMISSIONS];
  label: string;
  description: string;
}

export interface PermissionGroup {
  group: string;
  permissions: PermissionGroupItem[];
}

export const ALL_PERMISSIONS_WITH_GROUP: PermissionGroup[] = [
  {
    group: 'Organization',
    permissions: [
      {
        id: PERMISSIONS.ORG_VIEW,
        label: 'View Organization',
        description: 'See the organization and its workspace.',
      },
      {
        id: PERMISSIONS.ORG_MANAGE_SETTINGS,
        label: 'Manage Settings',
        description: 'Edit organization name, logo, states, and priorities.',
      },
      {
        id: PERMISSIONS.ORG_MANAGE_BILLING,
        label: 'Manage Billing',
        description: 'View and change the billing plan.',
      },
      {
        id: PERMISSIONS.ORG_MANAGE_MEMBERS,
        label: 'Manage Members',
        description: 'Invite, remove, and change the role of members.',
      },
      {
        id: PERMISSIONS.ORG_MANAGE_ROLES,
        label: 'Manage Roles',
        description: 'Create, edit, assign, and delete custom roles.',
      },
    ],
  },
  {
    group: 'Projects',
    permissions: [
      {
        id: PERMISSIONS.PROJECT_VIEW,
        label: 'View Project',
        description: 'See projects and their details.',
      },
      {
        id: PERMISSIONS.PROJECT_CREATE,
        label: 'Create Project',
        description: 'Start new projects.',
      },
      {
        id: PERMISSIONS.PROJECT_EDIT,
        label: 'Edit Project',
        description: 'Change project name, status, and settings.',
      },
      {
        id: PERMISSIONS.PROJECT_DELETE,
        label: 'Delete Project',
        description: 'Permanently delete projects.',
      },
      {
        id: PERMISSIONS.PROJECT_MEMBER_ADD,
        label: 'Add Project Member',
        description: 'Add people to a project.',
      },
      {
        id: PERMISSIONS.PROJECT_MEMBER_REMOVE,
        label: 'Remove Project Member',
        description: 'Remove people from a project.',
      },
      {
        id: PERMISSIONS.PROJECT_MEMBER_UPDATE,
        label: 'Update Project Member',
        description: "Change a project member's role.",
      },
      {
        id: PERMISSIONS.PROJECT_LEAD_UPDATE,
        label: 'Set Project Lead',
        description: 'Assign or change the project lead.',
      },
    ],
  },
  {
    group: 'Teams',
    permissions: [
      {
        id: PERMISSIONS.TEAM_VIEW,
        label: 'View Team',
        description: 'See teams and their details.',
      },
      {
        id: PERMISSIONS.TEAM_CREATE,
        label: 'Create Team',
        description: 'Start new teams.',
      },
      {
        id: PERMISSIONS.TEAM_EDIT,
        label: 'Edit Team',
        description: 'Change team name, icon, and settings.',
      },
      {
        id: PERMISSIONS.TEAM_DELETE,
        label: 'Delete Team',
        description: 'Permanently delete teams.',
      },
      {
        id: PERMISSIONS.TEAM_MEMBER_ADD,
        label: 'Add Team Member',
        description: 'Add people to a team.',
      },
      {
        id: PERMISSIONS.TEAM_MEMBER_REMOVE,
        label: 'Remove Team Member',
        description: 'Remove people from a team.',
      },
      {
        id: PERMISSIONS.TEAM_MEMBER_UPDATE,
        label: 'Update Team Member',
        description: "Change a team member's role.",
      },
      {
        id: PERMISSIONS.TEAM_LEAD_UPDATE,
        label: 'Set Team Lead',
        description: 'Assign or change the team lead.',
      },
    ],
  },
  {
    group: 'Issues',
    permissions: [
      {
        id: PERMISSIONS.ISSUE_VIEW,
        label: 'View Issue',
        description: 'See issues and their details.',
      },
      {
        id: PERMISSIONS.ISSUE_CREATE,
        label: 'Create Issue',
        description: 'Create new issues.',
      },
      {
        id: PERMISSIONS.ISSUE_EDIT,
        label: 'Edit Issue',
        description: 'Edit issue title, description, and labels.',
      },
      {
        id: PERMISSIONS.ISSUE_DELETE,
        label: 'Delete Issue',
        description: 'Permanently delete issues.',
      },
      {
        id: PERMISSIONS.ISSUE_ASSIGN,
        label: 'Assign Issue',
        description: 'Assign issues to people.',
      },
      {
        id: PERMISSIONS.ISSUE_ASSIGNMENT_UPDATE,
        label: 'Update Assignment',
        description: 'Change who an issue is assigned to.',
      },
      {
        id: PERMISSIONS.ISSUE_RELATION_UPDATE,
        label: 'Update Relations',
        description: 'Link, block, and relate issues to each other.',
      },
      {
        id: PERMISSIONS.ISSUE_STATE_UPDATE,
        label: 'Update Status',
        description: 'Move issues between workflow states.',
      },
      {
        id: PERMISSIONS.ISSUE_PRIORITY_UPDATE,
        label: 'Update Priority',
        description: 'Change issue priority.',
      },
    ],
  },
  {
    group: 'Documents',
    permissions: [
      {
        id: PERMISSIONS.DOCUMENT_VIEW,
        label: 'View Document',
        description: 'Read documents.',
      },
      {
        id: PERMISSIONS.DOCUMENT_CREATE,
        label: 'Create Document',
        description: 'Create new documents.',
      },
      {
        id: PERMISSIONS.DOCUMENT_EDIT,
        label: 'Edit Document',
        description: 'Edit document content.',
      },
      {
        id: PERMISSIONS.DOCUMENT_DELETE,
        label: 'Delete Document',
        description: 'Permanently delete documents.',
      },
    ],
  },
  {
    group: 'Views',
    permissions: [
      {
        id: PERMISSIONS.VIEW_VIEW,
        label: 'View Saved Views',
        description: 'Open shared saved views.',
      },
      {
        id: PERMISSIONS.VIEW_CREATE,
        label: 'Create Views',
        description: 'Create and save new views.',
      },
      {
        id: PERMISSIONS.VIEW_EDIT,
        label: 'Edit Shared Views',
        description: 'Edit views shared with the organization.',
      },
      {
        id: PERMISSIONS.VIEW_DELETE,
        label: 'Delete Views',
        description: 'Delete shared views.',
      },
    ],
  },
];
