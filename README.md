# Vector

Vector is an open source project management platform built with Next.js, Convex, and Better Auth. It is designed for teams that want projects, issues, permissions, and organization-level workflows in one codebase.

## Features

- Multi-tenant organizations and workspaces
- Projects, issues, teams, and role-based permissions
- Real-time data updates with Convex
- Better Auth integration with Convex-backed user data
- Type-safe frontend and backend with TypeScript

## Stack

- Next.js 16 and React 19
- Convex for database, functions, realtime, and storage
- Better Auth with the Convex adapter
- Tailwind CSS v4, Radix UI, and shadcn/ui
- ESLint, Prettier, Husky, and pnpm

## Project Status

Vector is under active development. The top-level docs in this repository reflect the current contributor workflow. Some files under `docs/migration/` remain as historical implementation notes from earlier architecture work and should not be treated as onboarding documentation.

## Quick Start

1. Install dependencies.

   ```bash
   pnpm install
   ```

2. Create local environment variables.

   ```bash
   cp sample.env .env.local
   ```

3. Update `.env.local` with your local values.

   Minimum local setup usually includes:
   - `NEXT_PUBLIC_APP_URL=http://localhost:3000`
   - `BETTER_AUTH_SECRET=<your-secret>`
   - `NEXT_PUBLIC_CONVEX_URL=<your-local-convex-url>`

4. Start Convex in one terminal.

   ```bash
   pnpm run convex:dev
   ```

5. Start Next.js in another terminal.

   ```bash
   pnpm run dev
   ```

6. Open `http://localhost:3000`.

   On a fresh local instance, visit `/setup-admin` to create the first administrator account.

## Environment Variables

Copy `sample.env` to `.env.local` and update the values. All `NEXT_PUBLIC_` variables are exposed to the browser.

### Required

| Variable                 | Description                                                                 |
| ------------------------ | --------------------------------------------------------------------------- |
| `NEXT_PUBLIC_CONVEX_URL` | Convex deployment HTTP endpoint. Local default: `http://127.0.0.1:3210`     |
| `NEXT_PUBLIC_APP_URL`    | Public base URL of the app. Local default: `http://localhost:3000`          |
| `BETTER_AUTH_SECRET`     | Secret key for signing auth tokens. Generate with `openssl rand -base64 32` |

### Authentication

| Variable                      | Description                                                                       |
| ----------------------------- | --------------------------------------------------------------------------------- |
| `AUTH_SECRET`                 | Backward-compatible fallback for `BETTER_AUTH_SECRET`                             |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated allowed origins for auth callbacks (e.g. `http://localhost:3000`) |

### Convex

| Variable                      | Description                                                          |
| ----------------------------- | -------------------------------------------------------------------- |
| `CONVEX_URL`                  | Convex URL for CLI scripts. Defaults to `http://localhost:8000`      |
| `CONVEX_SITE_URL`             | Convex site/auth helper URL. Local default: `http://127.0.0.1:3211`  |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Public version of the site URL. Fallback for `CONVEX_SITE_URL`       |
| `NEXT_PUBLIC_SITE_URL`        | Optional fallback for `NEXT_PUBLIC_APP_URL`                          |
| `CONVEX_DEPLOYMENT`           | Convex deployment identifier (set automatically by `npx convex dev`) |
| `CONVEX_ADMIN_KEY`            | Admin API key, only needed for running permission migrations         |

### SMTP (Optional)

Email notifications. If unset, emails are logged to the console.

| Variable    | Description                                   |
| ----------- | --------------------------------------------- |
| `SMTP_HOST` | SMTP server hostname (e.g. `smtp.resend.com`) |
| `SMTP_PORT` | SMTP port. Defaults to `587`                  |
| `SMTP_USER` | SMTP username                                 |
| `SMTP_PASS` | SMTP password or API key                      |
| `SMTP_FROM` | From address for outgoing email               |

### Web Push Notifications (Optional)

Required for PWA push notifications. Generate VAPID keys with `npx web-push generate-vapid-keys`.

| Variable                       | Description                                                   |
| ------------------------------ | ------------------------------------------------------------- |
| `VAPID_PUBLIC_KEY`             | VAPID public key (server-side)                                |
| `VAPID_PRIVATE_KEY`            | VAPID private key (server-side)                               |
| `VAPID_SUBJECT`                | VAPID subject, e.g. `mailto:notifications@example.com`        |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | VAPID public key (client-side, must match `VAPID_PUBLIC_KEY`) |

## Development

- `pnpm run dev` starts the Next.js development server
- `pnpm run convex:dev` runs the local Convex backend and code generation
- `pnpm run lint` runs ESLint
- `pnpm run build` builds the production app
- `pnpm run format` formats the repository with Prettier

## Documentation

- Contributor docs: [docs/index.md](docs/index.md)
- Local setup: [docs/getting-started/01-local-setup.md](docs/getting-started/01-local-setup.md)
- Environment variables: [docs/getting-started/02-environment-variables.md](docs/getting-started/02-environment-variables.md)
- Common commands: [docs/getting-started/04-common-commands.md](docs/getting-started/04-common-commands.md)

## Contributing

Contributions are welcome. Start with [CONTRIBUTING.md](CONTRIBUTING.md), then check [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) and [SECURITY.md](SECURITY.md) for the expected collaboration and reporting process.

## License

This project is licensed under the Apache License 2.0. See [LICENSE](LICENSE).
