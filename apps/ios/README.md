# Vector iOS

Native SwiftUI companion app for Vector.

This first increment is a read-only Swift package that contains the mobile shell, models, mock data, and Convex repository boundary. It is intentionally buildable without an Xcode app target so the core UI and data contracts can iterate quickly. A runnable iOS app target and native write flows will be added in later increments.

## Build

```bash
cd apps/ios
swift test
```

## Convex SDK

The package pins `ConvexMobile` to `0.8.1`. Keep that exact pin until the auth and live-data slices are stable; the Swift SDK is still pre-1.0 and has shipped breaking auth-provider changes.

## CI, Signing, and TestFlight

The `iOS` GitHub workflow runs package tests and an iOS Simulator package build for changes under `apps/ios`. It also includes a manual signed-archive job that imports Apple signing material into a temporary keychain and can upload the exported IPA to TestFlight once the runnable app target exists.

See `docs/product/ios-signing-testflight.md` for the required Apple Developer setup, GitHub secrets, and workflow inputs.
