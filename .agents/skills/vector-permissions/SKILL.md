---
name: vector-permissions
description: Vector permission and RBAC guide. Use this for any work on backend authorization, Convex permission checks, role tables, scoped roles, migrations, frontend permission hooks, PermissionAware wrappers, or documenting how permissions work in Vector.
---

# Vector Permissions

Use this skill for any permission or RBAC work in Vector.

## What To Read

Start with:

- [permissions-system.md](../../../docs/architecture/permissions-system.md)

Open source files only as needed:

- backend resolver: `convex/authz.ts`
- entity-aware checks: `convex/access.ts`
- shared permission catalog: `convex/_shared/permissions.ts`
- public permission queries: `convex/permissions/utils.ts`
- role management: `convex/roles/index.ts`
- frontend hooks: `src/hooks/use-permissions.tsx`
- frontend wrappers: `src/components/ui/permission-aware.tsx`

## Backend Rules

- For hard enforcement, prefer:
  - `requireOrgPermission`
  - `requireScopedPermission`
  - `requireAuthUser`
- For resource-aware checks, prefer `convex/access.ts` helpers such as:
  - `canViewProject`
  - `canEditTeam`
  - `canManageProjectMembers`
- Never hardcode raw permission strings. Import from `PERMISSIONS`.
- Validate scope ownership for every foreign ID that can cross org boundaries.
- When storing custom-role permissions, use `permissionValidator`.

## Frontend Rules

- For simple checks, use `useScopedPermission`.
- For multiple checks in one scope, use `useScopedPermissions`.
- For inline editable controls, wrap with `PermissionAwareSelector`.
- Prefer permission checks over role-name checks in UI code.

## Role Model Rules

- Unified custom roles live in `roles`, `rolePermissions`, and `roleAssignments`.
- Membership tables still matter for built-in role bundles:
  - `members`
  - `teamMembers`
  - `projectMembers`
- Legacy custom-role tables still exist during cutover. Do not remove compatibility without handling migration and cutover together.

## When Membership Changes

- Sync built-in assignments with:
  - `syncOrganizationRoleAssignment`
  - `syncTeamRoleAssignment`
  - `syncProjectRoleAssignment`
- On removal, clean up scoped role assignments too.

## Validation

If you changed anything under `convex/`, also use the `convex-typecheck-guard` skill and run:

```bash
pnpm convex typecheck
```

If permission changes affect UI data shapes or hooks, also run:

```bash
pnpm build
```

## Expected Outcome

Any permission change should leave:

- backend enforcement explicit
- scope validation explicit
- frontend checks reactive and permission-based
- no new hardcoded role-name authorization in UI
