# Contributing to Vector

Thanks for contributing. This repository is intended to be friendly to outside contributors, but changes still need to be easy to review and safe to ship.

## Before You Start

- Check existing issues and pull requests before starting duplicate work.
- For substantial changes, open an issue first so the direction can be discussed before implementation.
- Keep pull requests focused. Small, reviewable changes move faster than broad refactors.

## Local Development

1. Install dependencies with `pnpm install`.
2. Copy `sample.env` to `.env.local`.
3. Start Convex with `pnpm run convex:dev`.
4. Start the app with `pnpm run dev`.
5. If this is a brand-new instance, visit `/setup-admin` to create the first administrator account.

## Development Expectations

- Use TypeScript consistently and prefer explicit, readable code over clever abstractions.
- Keep generated Convex files up to date by running `pnpm run convex:dev` while developing.
- Run `pnpm lint` before opening a pull request.
- Run `pnpm format` if you touched Markdown, JSON, or style-heavy files.
- Update docs when setup, behavior, or public APIs change.

## Pull Requests

- Use a clear title and explain the user-facing or developer-facing impact.
- Link related issues when applicable.
- Include screenshots or short recordings for UI changes.
- Call out schema, auth, permissions, or migration risks explicitly.
- Do not mix unrelated cleanup into the same pull request.

## Commit Style

- Write short, descriptive commit messages.
- Prefer one logical change per commit when possible.

## Reporting Security Issues

Do not open public issues for vulnerabilities. Follow the reporting guidance in [SECURITY.md](SECURITY.md).

## Licensing

By submitting a contribution, you agree that your work will be licensed under the Apache License 2.0 that applies to this repository.
