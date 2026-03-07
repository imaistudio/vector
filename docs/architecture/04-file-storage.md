# File Storage and Access Control

Vector stores uploaded assets, such as organization logos, in Convex storage and references them by storage ID in application records.

## Access Control Mechanism

The current file flow is simple and centered around Convex:

1. **Upload URL generation**: The frontend requests an upload URL from Convex before sending the file.
2. **Storage ID persistence**: The returned Convex storage ID is saved on the owning record, such as an organization.
3. **Temporary URL resolution**: Reads go through a Next.js API route at `/api/files/<storageId>`, which asks Convex for a temporary file URL and redirects the browser.

This keeps storage concerns out of the UI layer and lets the application use stable storage IDs instead of hard-coding provider-specific URLs.

## Local Development

Keep `pnpm run convex:dev` running while working locally so storage APIs and generated bindings stay in sync. For broader runtime configuration, see [Environment Variables](./../getting-started/02-environment-variables.md).
