# Vector Native iOS Plan

## Product Positioning

The iOS app should be a focused companion for day-to-day project work, not a full replacement for the web app. The mobile surface should prioritize fast scanning, triage, comments, assignments, status/priority edits, and opening the web app for heavier workspace administration.

The hosted Vector public roadmap at `https://vector.imai.studio` shows the mobile direction clearly: compact identity header, dense metadata pills, primary action buttons, and horizontally scrollable status columns with tight issue rows. The authenticated native app should preserve that density while using platform-native navigation, lists, segmented controls, and sheets.

## Native Scope

First-class mobile screens:

- Issues: mine/related/all scopes, search, list/board/timeline layouts, detail page, comments, assignments, status, priority, team, project, visibility, due date, and web fallback.
- Projects: mine/all scopes, status filtering, list and board summaries, project detail with issues, activity, and members.
- Teams: mine/all scopes, team detail with issues, projects, members, documents entry point, and activity.
- Personal settings: profile/status/device/session-oriented settings that are useful on mobile.
- Status settings: issue states, priorities, project statuses, and kanban border tags as a compact management surface after the core app is live.

Web-only or web-first:

- Workspace creation and destructive workspace settings.
- Organization roles, custom permission matrices, GitHub integration setup, branding, public landing configuration, and other administration-heavy flows.
- Document editor authoring. Mobile can list and open documents, but rich document editing should stay web-first until the editor has a native design.

## Convex Swift Integration

Current researched baseline:

- Use the official `ConvexMobile` Swift package from `https://github.com/get-convex/convex-swift`.
- Pin the package exactly at `0.8.1` for the first implementation slice. The 0.x series has shipped breaking auth-provider changes, so exact pinning avoids accidental SDK drift.
- Keep one `ConvexClient` or `ConvexClientWithAuth` instance for the app process lifetime.
- Use `subscribe(to:with:yielding:)` for live query data and Combine publishers in view models.
- Use `mutation(_:with:)` and `action(_:with:)` for edits and action calls.
- Use `watchWebSocketState()` to expose connection state in the UI.
- Use Convex numeric wrappers such as `@ConvexFloat`, `@OptionalConvexFloat`, and `@ConvexInt` in `Decodable` models.

Version and shape mismatch handling:

- Centralize function names in `VectorConvexFunctions` rather than scattering string literals through views.
- Keep Swift models tolerant of new optional fields but strict on identity and primary display fields.
- Treat decoding errors as contract mismatches and surface a non-blocking error state with an "Open Web" escape hatch.
- Add tests for representative Convex payload decoding and function-name constants.
- Prefer adding narrow mobile-specific Convex queries later if existing web queries become too broad or unstable for mobile.

Auth notes:

- Vector currently uses Better Auth on web. The official Convex Swift helper integrations cover Auth0 and Clerk, while custom providers can implement the SDK `AuthProvider` protocol.
- The first slice keeps auth behind a repository boundary. The next auth slice should decide between a custom Better Auth OIDC/token bridge and a web sign-in handoff, then wire `ConvexClientWithAuth`.

## Increment Plan

1. Native shell and data boundary
   - Swift package under `apps/ios`.
   - Dense SwiftUI screens for issues, projects, teams, settings, and web fallback.
   - Mock repository and Convex repository boundary.
   - Model decoding tests.

2. Xcode app target and auth spike
   - Add a runnable iOS app target.
   - Implement sign-in/session restoration.
   - Connect the shell to production/dev Convex deployments.

3. Issue workflow
   - Live issue list with list, board, and timeline modes.
   - Issue detail, comments, assignments, and optimistic status/priority edits.

4. Projects and teams
   - Live project/team lists and detail tabs.
   - Member/activity sections.
   - Native create/edit flows where they are fast and scoped.

5. Settings and polish
   - Personal settings and status settings.
   - Push notification strategy.
   - Offline/reconnect states.
   - Deep links into web-only routes.
