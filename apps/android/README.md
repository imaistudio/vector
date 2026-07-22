# Vector for Android

Native Android 16+ client for Vector, built with Kotlin, Jetpack Compose, Material 3, Better Auth, and the official Convex Android SDK.

## Requirements

- JDK 17
- Android SDK Platform 36
- Android SDK Build Tools 36.0.0

Create an untracked `local.properties` containing your SDK path if Android Studio does not create it automatically:

```properties
sdk.dir=/absolute/path/to/Android/sdk
```

Build and test from this directory:

```sh
./gradlew :app:testDebugUnitTest :app:assembleDebug :app:lintDebug
```

The app defaults to `https://imai.tech`, but the instance can be changed on the sign-in screen. Remote instances must use HTTPS; plain HTTP is accepted only for loopback development. Passwords are submitted directly to the selected Vector instance and are never persisted. Session cookies and workspace selection are encrypted with Android Keystore.

## Product coverage

- Requests: scopes, server search across title/description/output, persisted grouping by priority or status, priority-aware creation, details, claim, approval, request-changes notes, and permission-aware deletion.
- Work: scopes, detail, live agent session titles/history, and message sending when the backend marks a session interactive.
- Workspace: documents, projects, and teams. Small documents render inline; large documents fetch Convex content chunks page-by-page and render ordered segments with `LazyColumn` rather than building one giant string.
- Inbox and Settings: workspace switching, session details, and sign-out.

## Release configuration

No credentials or signing material belong in the repository. Release builds accept these environment variables:

```text
VECTOR_ANDROID_VERSION_CODE
VECTOR_ANDROID_VERSION_NAME
ANDROID_UPLOAD_KEYSTORE_FILE
ANDROID_UPLOAD_KEY_ALIAS
ANDROID_UPLOAD_KEY_PASSWORD
ANDROID_UPLOAD_STORE_PASSWORD
```

`VECTOR_ANDROID_VERSION_CODE` defaults to `1` only when absent or blank; an explicitly invalid value fails the build. All four signing variables must be present to sign a release bundle.

The application ID is `studio.imai.vector`, with `minSdk`, `targetSdk`, and `compileSdk` set to API 36.
