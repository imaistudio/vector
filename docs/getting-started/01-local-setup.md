# Local Setup

This guide walks through the current local development setup for Vector.

## Prerequisites

- Node.js `24.x`
- `pnpm`
- A local Convex development deployment

## Installation

1.  **Install dependencies**

    ```bash
    pnpm install
    ```

2.  **Set up environment variables**

    Copy the sample environment file to a new `.env.local` file:

    ```bash
    cp sample.env .env.local
    ```

    Update the values in `.env.local` for your local environment. See [Environment Variables](./02-environment-variables.md) for details.

3.  **Start Convex**

    Run the local Convex backend in a separate terminal:

    ```bash
    pnpm run convex:dev
    ```

    This handles local Convex development and keeps generated files up to date.

4.  **Start Next.js**

    In another terminal, start the app:

    ```bash
    pnpm dev
    ```

    The application will be available at [http://localhost:3000](http://localhost:3000).

5.  **Bootstrap the first admin**

    On a fresh local instance, open [http://localhost:3000/setup-admin](http://localhost:3000/setup-admin) to create the initial administrator account.

---

## Notes

- `pnpm run project:setup` is available as a lightweight bootstrap helper for dependencies and Git hooks.
- If you change Convex functions or schema, keep `pnpm run convex:dev` running so generated bindings stay current.
- Optional SMTP settings can be left unset during local development.
