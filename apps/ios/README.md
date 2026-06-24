# Vector iOS

Native SwiftUI companion app for Vector.

This increment includes both the reusable `VectorMobile` Swift package and a runnable `Vector` app target for local Simulator builds and TestFlight archives. The app is still a focused mobile companion: core issue, project, team, status, comment, assignment, and mobile settings surfaces live natively, while deeper workspace administration stays on the web entry points.

## Instance Setup

The app does not bake in a Vector deployment. On first launch, enter the Vector app URL for the instance you want to use, then sign in with an email or username and password. This mirrors the CLI flow:

1. Normalize and resolve the app URL.
2. Fetch `GET /api/config` from that app URL.
3. Use the returned `convexUrl` to create the Convex Swift client.
4. Sign in through the Better Auth endpoints.
5. Fetch `GET /api/auth/convex/token` and pass it through `ConvexClientWithAuth`.

Session cookies and the selected workspace slug are stored in the iOS Keychain. The password is never stored. If a user has more than one workspace, the optional workspace slug field can force a specific workspace; otherwise the first workspace returned by `users:getOrganizations` is used. Sample data is only available through the explicit preview button on the setup screen.

## Build

```bash
cd apps/ios
swift test
xcodebuild -project Vector.xcodeproj -scheme Vector -destination 'generic/platform=iOS Simulator' CODE_SIGNING_ALLOWED=NO build
```

The Convex Swift SDK package currently ships an arm64 Simulator slice but not an x86_64 Simulator slice. The app target excludes x86_64 only for Simulator builds, and the GitHub workflow runs on Apple's arm64 macOS runner label.

## Convex SDK

The package pins `ConvexMobile` to `0.8.1`. Keep that exact pin until the auth and live-data slices are stable; the Swift SDK is still pre-1.0 and has shipped breaking auth-provider changes. This app uses `ConvexClientWithAuth`, so reconnects and forced token refreshes go through the SDK auth-provider callback instead of relying on a one-time token.

## CI, Signing, and TestFlight

The `iOS` GitHub workflow runs package tests and an app target Simulator build for changes under `apps/ios`. The manual signed-archive job imports Apple signing material into a temporary keychain, stamps the archive build number from the GitHub run number, exports an App Store Connect IPA, and can upload it to TestFlight.

See `docs/product/ios-signing-testflight.md` for the required Apple Developer setup, GitHub secrets, and workflow inputs.
