# iOS Signing and TestFlight Setup

This repo now has the same signing shape as Cells: CI imports Apple signing material into a temporary keychain and never commits certificates or provisioning profiles.

## Current State

The iOS increment now includes a Swift package and a runnable `apps/ios/Vector.xcodeproj` app target. The `iOS` workflow runs package tests, a Simulator app build, and can produce a signed App Store Connect IPA for TestFlight.

The signing setup is intended for GitHub-hosted or otherwise ephemeral macOS runners. It imports certificates into the user keychain search list and installs a provisioning profile under `~/Library/MobileDevice`, so do not run it unchanged on a shared self-hosted runner.

## Apple Setup

1. Join or use an existing Apple Developer Program team.
2. Create a bundle identifier for the native app. The workflow default is `studio.imai.vector`; change the workflow dispatch input if the final bundle ID differs.
3. Create the app record in App Store Connect with the same bundle ID.
4. Create an Apple Distribution certificate for release/TestFlight builds.
5. Export that certificate and private key as a `.p12` from Keychain Access.
6. Create an App Store provisioning profile for the bundle ID and distribution certificate.
7. Create an App Store Connect API key with enough access to upload builds, usually Developer or App Manager.
8. Enable the Push Notifications capability for the bundle identifier if mobile push delivery should work.

## GitHub Secrets

Set these repository secrets before running a signed archive:

- `IOS_CERTIFICATE_P12_BASE64`: base64 of the exported `.p12`.
- `IOS_CERTIFICATE_PASSWORD`: password used when exporting the `.p12`.
- `IOS_PROVISIONING_PROFILE_BASE64`: base64 of the `.mobileprovision` profile.
- `APPLE_API_KEY`: raw contents of the App Store Connect `.p8` key file.
- `APPLE_API_KEY_ID`: App Store Connect API key ID.
- `APPLE_API_ISSUER`: App Store Connect issuer ID.

Optional:

- `APPLE_TEAM_ID`: Apple Developer team ID. If omitted, CI tries to read the team from the provisioning profile.

Convex push delivery also requires deployment environment variables:

- `APNS_TEAM_ID`: Apple Developer team ID.
- `APNS_KEY_ID`: Apple Push Notifications Auth Key ID.
- `APNS_PRIVATE_KEY`: Raw `.p8` key contents. Escaped `\n` line breaks are accepted.
- `APNS_TOPIC` or `APNS_BUNDLE_ID`: Bundle ID, currently `studio.imai.vector`.

Useful commands for creating the base64 secrets:

```bash
base64 -i path/to/certificate.p12 | pbcopy
base64 -i path/to/profile.mobileprovision | pbcopy
```

## Running the Workflow

Use GitHub Actions -> iOS -> Run workflow.

For normal package verification, leave `signed_archive` off.

For a signed IPA after the app target exists:

- `signed_archive`: true
- `project_path`: `apps/ios/Vector.xcodeproj` unless the target lives elsewhere
- `scheme`: the app scheme, expected to be `Vector`
- `configuration`: `Release`
- `bundle_id`: the App Store Connect bundle ID
- `export_method`: `app-store-connect` for TestFlight/App Store distribution. Other current Xcode methods include `release-testing`, `enterprise`, and `debugging`.
- `upload_testflight`: true when `signed_archive` is also true and the App Store Connect API key secrets are present

The workflow uploads the `.xcarchive` and `.ipa` as GitHub artifacts even when `upload_testflight` is false.

## Simulator Testing

The app target can be installed and launched in Simulator after a local build:

```bash
cd apps/ios
xcodebuild -project Vector.xcodeproj -scheme Vector -destination 'generic/platform=iOS Simulator' -derivedDataPath /tmp/vector-ios-derived CODE_SIGNING_ALLOWED=NO build
xcrun simctl install booted /tmp/vector-ios-derived/Build/Products/Debug-iphonesimulator/Vector.app
xcrun simctl launch booted studio.imai.vector
```

Use the Simulator through the Computer Use plugin for visual checks of SwiftUI UI slices before merging UI-heavy changes.
