# iOS Signing and TestFlight Setup

This repo now has the same signing shape as Cells: CI imports Apple signing material into a temporary keychain and never commits certificates or provisioning profiles.

## Current State

The first iOS increment is still a Swift package, not a runnable app target. The `iOS` workflow can already run package tests and simulator builds. The signed archive and TestFlight upload job is ready, but it will intentionally fail with a clear message until an Xcode app target such as `apps/ios/Vector.xcodeproj` is added.

The signing setup is intended for GitHub-hosted or otherwise ephemeral macOS runners. It imports certificates into the user keychain search list and installs a provisioning profile under `~/Library/MobileDevice`, so do not run it unchanged on a shared self-hosted runner.

## Apple Setup

1. Join or use an existing Apple Developer Program team.
2. Create a bundle identifier for the native app. The workflow default is `studio.imai.vector`; change the workflow dispatch input if the final bundle ID differs.
3. Create the app record in App Store Connect with the same bundle ID.
4. Create an Apple Distribution certificate for release/TestFlight builds.
5. Export that certificate and private key as a `.p12` from Keychain Access.
6. Create an App Store provisioning profile for the bundle ID and distribution certificate.
7. Create an App Store Connect API key with enough access to upload builds, usually Developer or App Manager.

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

Simulator testing is blocked until the runnable app target exists. Once it does, the next slice should:

- Add an app scheme that installs on iOS Simulator.
- Add a UI smoke-test workflow step using `xcodebuild test` or `xcodebuild build` plus `simctl install/launch`.
- Use the Simulator through the Computer Use plugin for visual checks of the SwiftUI shell before merging UI-heavy slices.
