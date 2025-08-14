# Database Changes

This guide explains how to make changes to the database schema using Drizzle ORM.

## Schema Definition

- **One-file-per-feature**: All tables for a single feature should be defined in a single file within `src/db/schema/`. For example, all blog-related tables would go into `src/db/schema/blog.ts`.
- **Index File**: After creating a new schema file, you must export it from the main index file at `src/db/schema/index.ts` to make it available to Drizzle Kit.

  ```typescript
  // src/db/schema/index.ts
  export * from './users-and-auth';
  export * from './projects';
  export * from './teams';
  // ...
  export * from './blog'; // Add your new schema here
  ```

## Generating Migrations

After you have modified a schema file, you need to generate a SQL migration file.

```bash
pnpm run db:generate
```

This command will compare the current state of your schema with the last snapshot and generate a new SQL file in the `drizzle/` directory. You should review the generated SQL to ensure it matches your intended changes and then commit it to version control.

## Applying Migrations

To apply the generated migrations to your local database, run:

```bash
pnpm run db:push
```

This command will execute the pending migration files against the database configured in your `.env.local` file.
