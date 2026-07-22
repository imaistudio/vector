# Android Signing and Google Play Internal Testing

Vector's Android pipeline verifies every change under `apps/android` and can
build a signed Android App Bundle (`.aab`) for Google Play. Uploads are manual
workflow dispatches and are hard-limited to the Play **internal** track.

## Permanent identifiers and account gates

The workflow and Android app are fixed to the application ID
`studio.imai.vector`; it is not a workflow input. Confirm that the ID is
available and belongs in the intended Play developer account before the first
upload. A Google Play package/application ID is permanent: it cannot be reused
after publication, and changing it creates a different app. Keep the Gradle
`namespace` and `applicationId` equal and explicit.

The Play account owner must complete these one-time gates in Play Console:

1. Finish developer identity and contact verification, including any current
   Android developer verification prompts.
2. Create the free `Vector` app with the final application ID.
3. Accept the Developer Program, export-law, and Play App Signing terms.
4. Decide who can manage releases and enforce two-step verification.
5. Register `studio.imai.vector` and its signing key in the Play Console
   Android developer verification flow before the first upload. Treat this as
   a required release gate, not an optional follow-up.

A service account cannot accept owner-only terms or bootstrap a missing Play
app. Complete those steps interactively before enabling automated uploads.

## Android SDK license gate

Building requires JDK 17, Android SDK Platform 36, and Android SDK Build-Tools
36.0.0. Review and accept the Android SDK licenses before using the packages:

```bash
sdkmanager --licenses
sdkmanager 'platforms;android-36' 'build-tools;36.0.0'
```

The workflow never runs `sdkmanager --licenses` or silently accepts terms. It
installs the required packages only when the runner already has the applicable
licenses. Otherwise it fails closed until the account owner has reviewed and
authorized the license setup for the build environment.

## Create the upload key and enable Play App Signing

Use a dedicated upload key, separate from the app-signing key that Google Play
holds. Create it once in Android Studio or with `keytool`:

```bash
keytool -genkeypair \
  -keystore vector-upload.jks \
  -alias vector-upload \
  -keyalg RSA \
  -keysize 4096 \
  -validity 10000
```

For a new app, allow Play App Signing to generate and protect the app-signing
key. The local upload key signs AAB uploads; Play validates that signature and
signs installable APKs with the separately protected app-signing key.

Never commit a keystore, passwords, or service-account JSON. Keep an encrypted
offline backup of the upload keystore and record its alias and recovery owner.

## Required GitHub Actions secrets

Configure these repository or protected-environment secrets:

- `ANDROID_UPLOAD_KEYSTORE_BASE64`: standard base64 of the upload keystore.
- `ANDROID_UPLOAD_KEY_ALIAS`: upload private-key alias.
- `ANDROID_UPLOAD_STORE_PASSWORD`: keystore password.
- `ANDROID_UPLOAD_KEY_PASSWORD`: private-key password.
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`: raw JSON for a narrowly scoped Google
  Play Developer API service account. This is required only for Play uploads.

Create the encoded keystore on macOS without copying it into the repository:

```bash
base64 -i /secure/path/vector-upload.jks | pbcopy
```

The workflow decodes the keystore into a mode-`0600` file under the ephemeral
runner temporary directory. It validates the alias using `keytool`, exports only
the temporary path, and deletes the runner after the job. Secret values are not
printed or included in the uploaded artifact.

For Play API access, create a Google Cloud service account, enable the Google
Play Developer API, invite the service-account email in Play Console, and grant
only the app-level permissions needed to create releases on the internal track.
Do not grant financial, user-management, or production-release permissions.

## Bootstrap the internal test

Bootstrap the app in Play Console before relying on automation:

1. Create the app and confirm `studio.imai.vector` is the Gradle
   `applicationId` and the package registered in Play Console.
2. Open **Testing > Internal testing**, create an email tester list, and provide
   a feedback email or URL.
3. Create the upload key and export all four `ANDROID_UPLOAD_*` variables from
   the signing section below. Do not continue until
   `node scripts/prepare-android-signing.mjs` reports that the keystore, alias,
   and private-key password are valid.
4. Build the first signed AAB locally with `VECTOR_ANDROID_VERSION_CODE=1` so
   the bootstrap release has `versionCode` 1.
5. Upload that AAB in Play Console, accept Play App Signing, resolve every
   blocking declaration, and start the internal rollout.
6. Copy the tester opt-in link and verify installation with an invited Google
   account. First-time test links or temporary listing names can take time to
   propagate.
7. Before enabling automated internal uploads, verify that the next computed
   workflow version code (`run number × 100 + run attempt`) is greater than the
   bootstrap AAB's version code. Play rejects a duplicate or lower version
   code. Once that check passes and the service account has access, enable
   automated internal uploads.

An app that exists exclusively on the internal track may have reduced listing
and Data safety setup requirements, but complete all Play Console tasks before
promoting it to closed, open, or production tracks.

## Run the GitHub workflow

Open **Actions > Android > Run workflow** on `main`:

- `signed_bundle`: builds and retains a signed AAB for 14 days.
- `upload_google_play`: uploads that AAB only to the `internal` track. The job
  fails closed if `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON` is absent.
- `version_name`: optional display version; leave empty to use the app default.

The workflow computes Android `versionCode` as GitHub run number × 100 plus run
attempt. This keeps a retried workflow unique while preserving monotonic order
across later runs. Never reuse or decrease a version code already uploaded to
Play. The bootstrap AAB should use version code 1; verify that the first
automated value is higher before requesting its upload. Neither the package ID
nor the Play track is an input: they are fixed to `studio.imai.vector` and
`internal`, respectively.

## Local verification and release commands

Android Studio's bundled JDK can be used by setting `JAVA_HOME` appropriately.
From `apps/android`:

```bash
./gradlew --version
./gradlew --no-daemon test lint assembleDebug
./gradlew --no-daemon connectedDebugAndroidTest
```

For a local signed bundle, keep the keystore outside the repository and export
the same variables consumed by Gradle:

```bash
export ANDROID_UPLOAD_KEYSTORE_FILE=/secure/path/vector-upload.jks
export ANDROID_UPLOAD_KEY_ALIAS=vector-upload
export ANDROID_UPLOAD_STORE_PASSWORD='use-a-secret-source'
export ANDROID_UPLOAD_KEY_PASSWORD='use-a-secret-source'
export VECTOR_ANDROID_VERSION_CODE=1
./gradlew --no-daemon :app:bundleRelease
jarsigner -verify app/build/outputs/bundle/release/app-release.aab
```

Avoid placing real passwords in shell history. Prefer a password manager or a
temporary, access-controlled environment file outside the checkout.

## Rollback and key recovery

- **Bad internal release:** deactivate or supersede it in Play Console and
  upload a corrected AAB with a higher `versionCode`. Android/Play does not
  permit overwriting an uploaded version code.
- **Lost or compromised upload key:** an account owner or appropriately
  permissioned administrator can request an upload-key reset under Play App
  Signing. Generate a new upload key, register its public certificate, rotate
  all four Android signing secrets, and revoke the old upload key.
- **App-signing key concern:** use Play Console's app-signing-key upgrade and
  recovery options. Do not attempt to replace the package or upload an AAB
  signed with an unrelated app-signing key.
- **Service-account compromise:** disable/delete its key in Google Cloud,
  remove or suspend the Play Console user, rotate
  `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`, and audit Play activity before resuming.
- **Package mistake:** stop before the first rollout. Once published, the
  package ID is permanent; correcting it requires creating a separate Play app.

Keep the tester opt-in URL, Play developer account owner, upload-key recovery
owner, and service-account rotation procedure in the team's credential runbook.

## Official references

- [Configure the Android application ID and namespace](https://developer.android.com/build/configure-app-module)
- [Set up the Android 16 SDK](https://developer.android.com/about/versions/16/setup-sdk)
- [Use Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)
- [Set up an internal test](https://support.google.com/googleplay/android-developer/answer/9845334)
- [Configure Google Play Developer API access](https://developers.google.com/android-publisher/getting_started)
