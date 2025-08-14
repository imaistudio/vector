# API and Routing

This document covers conventions for creating tRPC routers and API endpoints.

## tRPC Routers

- **File Naming**: All tRPC router source files must have the `.router.ts` suffix (e.g., `project.router.ts`). This is important for automatic code generation and tooling.
- **Static Imports**: Always use static `import` statements at the top of your router files. Avoid dynamic `await import()` as it prevents proper type checking and tree-shaking.

  ```typescript
  // Good
  import { projectRouter } from './project.router';

  // Bad
  const projectRouter = await import('./project.router');
  ```

## Route Convention

- **Organization-Scoped Routes**: All routes that belong to a specific organization should be nested under the `/[orgId]/` dynamic segment in the App Router.
  - Example: `/<orgId>/dashboard`, `/<orgId>/projects/[projectId]`
- **Global Routes**: Routes that are not specific to an organization (e.g., user profile settings, authentication pages) should live outside of the `/[orgId]/` segment.
  - Example: `/settings/profile`, `/auth/login`
- **Middleware**: The `src/middleware.ts` file contains logic to protect organization-scoped routes and redirect unauthenticated users to the login page.
