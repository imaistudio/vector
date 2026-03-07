# Environment Variables

Vector currently reads a small set of auth, frontend, and Convex environment variables directly at runtime. Optional SMTP settings are validated through `src/env.ts` for notification delivery.

## Local Setup (`.env.local`)

For local development, create a `.env.local` file in the root of the project. You can start by copying `sample.env`.

```bash
cp sample.env .env.local
```

### Required Variables

| Variable                      | Description                                                     | Example                             |
| ----------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_APP_URL`         | Public app URL used by auth and frontend code.                  | `http://localhost:3000`             |
| `BETTER_AUTH_SECRET`          | Secret used to sign Better Auth tokens.                         | `replace-with-a-long-random-secret` |
| `NEXT_PUBLIC_CONVEX_URL`      | Local or deployed Convex HTTP URL used by the frontend.         | `http://127.0.0.1:3210`             |
| `CONVEX_SITE_URL`             | Convex site/auth helper URL used by server-side auth utilities. | `http://127.0.0.1:3211`             |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | Public version of the Convex site/auth helper URL.              | `http://127.0.0.1:3211`             |

### Optional Variables

| Variable                      | Description                                                             | Example                             |
| ----------------------------- | ----------------------------------------------------------------------- | ----------------------------------- |
| `NEXT_PUBLIC_SITE_URL`        | Optional fallback base URL used by auth code.                           | `http://localhost:3000`             |
| `AUTH_SECRET`                 | Backward-compatible auth secret fallback.                               | `replace-with-a-long-random-secret` |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated allowlist for auth callback origins.                    | `http://localhost:3000`             |
| `CONVEX_URL`                  | Direct Convex URL used by local scripts such as permission migrations.  | `http://127.0.0.1:3210`             |
| `SMTP_HOST`                   | Hostname for email delivery. Leave unset to log email payloads locally. | `smtp.resend.com`                   |
| `SMTP_PORT`                   | SMTP port.                                                              | `465`                               |
| `SMTP_USER`                   | SMTP username.                                                          | `resend`                            |
| `SMTP_PASS`                   | SMTP password or API key.                                               | `your_resend_api_key`               |
| `SMTP_FROM`                   | From address for outgoing email.                                        | `"Vector" <noreply@example.com>`    |

## Adding New Variables

1. Add the variable to the runtime code that uses it.
2. If the variable should be validated centrally, add it to `src/env.ts`.
3. Add it to `sample.env` with a safe local placeholder.
4. Update this documentation.
