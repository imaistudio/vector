# Common Commands

This project uses `pnpm` as its package manager and `husky` for git hooks. Here are some of the most common scripts you will use during development.

| Script                   | Description                                                       |
| ------------------------ | ----------------------------------------------------------------- |
| `pnpm dev`               | Starts the Next.js dev server with Turbopack.                     |
| `pnpm build`             | Builds the production app.                                        |
| `pnpm start`             | Starts the built app in production mode.                          |
| `pnpm lint`              | Runs ESLint across the repository.                                |
| `pnpm lint:fix`          | Runs ESLint with automatic fixes where possible.                  |
| `pnpm format`            | Formats the repository with Prettier.                             |
| `pnpm format:check`      | Checks formatting without changing files.                         |
| `pnpm run convex:dev`    | Starts the local Convex backend and refreshes generated bindings. |
| `pnpm run auth:generate` | Runs the Better Auth code generator for the Convex adapter setup. |
| `pnpm run generate:keys` | Generates local keys for development workflows that need them.    |
| `pnpm run project:setup` | Installs dependencies, prepares Git hooks, and prints next steps. |
| `pnpm prepare`           | Installs Husky git hooks.                                         |

## Package Management

- To add a runtime dependency: `pnpm add <package-name>`
- To add a development dependency: `pnpm add -D <package-name>`
