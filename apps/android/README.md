# Manager for Android

Native Android client for Manager. Kotlin + Jetpack Compose, with the same
pure-domain / backend-adapter split as [the Apple client](../apple/README.md).

This is a standalone Gradle build under `apps/android/`, deliberately outside
the pnpm workspace. The release workflow builds it alongside the other clients;
see `.github/workflows/release.yml`.

## Layout

| Android module | Apple counterpart | Contents |
| --- | --- | --- |
| `app/` | `apps/apple/Manager` | `Application`, `MainActivity`, auth gate, Clerk `AuthView` / `UserButton`, BuildConfig injection |
| `managerkit/` | `ManagerKit` / `ManagerCore` | Pure models, `TaskBackend` interface, `TaskBoardModel`, Compose theme + screen, `InMemoryTaskBackend` for tests/previews |
| `managerdata/` | `ManagerData` | Convex `TaskBackend` implementation, wire records, tagged-number decoding, `ManagerServices`, Clerk↔Convex client construction |

`managerkit` has **no Convex or Clerk imports**. `managerdata` has no UI. The
app is the only module that knows about Clerk's prebuilt composables. This is
the same boundary as `ManagerKit` / `ManagerData` in Swift.

## Backend functions used

The Convex functions in `packages/backend/convex/` are used unchanged:

| Call | Purpose |
| --- | --- |
| `users:ensure` | Provisions the current Clerk identity's `users` row before subscribing (same as Apple). |
| `tasks:list` | Reactive `subscribe`; a change from web/MCP appears without polling. |
| `tasks:create` | `{ title, dueAt? }`. `dueAt` is sent as a JS number (a `Double`), not a BigInt. |
| `tasks:setDone` | `{ id, done }` explicit setter. The UI derives the target value but never sends a toggle. |
| `tasks:remove` | `{ id }`; expects `{ success, id }`. |

`users:me` is not needed: ownership is enforced server-side from the auth
identity. The client never sends `ownerId`.

`dueAt` is epoch milliseconds for the start of the selected local day. Convex
encodes JavaScript numbers as tagged `$float` JSON objects, so `TaskRecord.dueAt`
is a `Float64?` (Convex's contextual Double typealias), **not** a plain
`Double?`. `TaskRecordParsingTest` decodes a real `{"$float":"…"}` fixture and
also asserts that a plain `Double` cannot decode it. This is the Kotlin
equivalent of Swift's `@OptionalConvexFloat`.

## Setup

The app only needs **public** config. Both values are already present in the
web/backend env files; they are not secrets.

1. Copy the example config:

   ```sh
   cd apps/android
   cp local.properties.example local.properties
   ```

2. Fill in:

   ```properties
   manager.convex.url=https://your-deployment.convex.cloud
   manager.clerk.publishableKey=pk_test_xxx
   ```

   Use `CONVEX_URL` from `packages/backend/.env.local` and
   `VITE_CLERK_PUBLISHABLE_KEY` from `apps/web/.env.local`.

   Environment variables work too and take precedence over `local.properties`:

   - `MANAGER_CONVEX_URL` (or `CONVEX_URL`)
   - `MANAGER_CLERK_PUBLISHABLE_KEY` (or `CLERK_PUBLISHABLE_KEY`)

   `local.properties` is gitignored by `apps/android/.gitignore`. Never put an
   `sk_*` key in it: validation rejects secret keys.

3. In the Clerk dashboard for this app:

   - Enable **email address** with **password** and **email verification code**.
     Disable magic links / one-time links; they are not used here.
   - Enable **Google** as a social provider so `AuthView` can start a browser
     OAuth flow. `preferGoogleOneTap = false` keeps the behavior aligned with
     web/desktop.
   - Add the redirect URL `dev.labdm.manager://callback`. This custom scheme is
     already used by the desktop app. The Clerk Android SDK also registers
     `clerk://dev.labdm.manager.callback` and
     `clerk://dev.labdm.manager.oauth` through its own manifest; add those if
     the dashboard lists required mobile redirect URIs.
   - Keep the Convex integration / `convex` JWT template enabled. The
     `clerk-convex-kotlin` bridge handles session tokens and refresh; the app
     never reads or forwards a bearer token.

## Build and test

The local toolchain used here was the Android Studio JBR and SDK in
`$HOME/Library/Android/sdk`. The wrapper pins Gradle 9.8.2; AGP is 9.4.1 and
Kotlin is 2.4.21.

```sh
cd apps/android

JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
ANDROID_HOME="$HOME/Library/Android/sdk" \
./gradlew test
```

Unit tests need **no config** and no emulator. They cover:

- title normalization / day-start math / config validation (`managerkit`)
- the optimistic board state machine, explicit `setDone`, rollback, and composer
  behavior against an in-memory backend (`managerkit`)
- Convex tagged-number decoding for `dueAt` (`managerdata`)

Packaging tasks (`assemble`, `bundleRelease`, `installDebug`, …) depend on
`checkManagerConfig`, which fails early with setup instructions when config is
missing:

```sh
JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
ANDROID_HOME="$HOME/Library/Android/sdk" \
./gradlew assembleDebug
```

`minSdk` is 26 because `clerk-convex-kotlin` declares that minimum. `targetSdk`
is 36; `compileSdk` uses the `platforms;android-37.0` SDK package (API 37 ships
with a `.0` suffix in sdkmanager). Build-tools 36.0.0 is pinned.

`MANAGER_VERSION_NUMBER` sets `versionName` and `github.run_number` sets
`versionCode` in release builds; both default to `0.1.0` / `1` locally.

## Release assets

The `android` job in `.github/workflows/release.yml` runs the tests, then
`assembleDebug bundleRelease`, and packages:

- `Manager-Android-<tag>.apk` — debug-signed, installs from "Unknown sources".
- `Manager-Android-<tag>.aab` — unsigned app bundle for a store to sign.

`scripts/package-android-artifacts.sh` performs the packaging. Both assets are
public on `/download`, like the web and desktop builds.

## Runtime shape

`ManagerApplication` validates config, initializes `Clerk`, then constructs
`ManagerServices`. `createClerkConvexClient(deploymentUrl, context)` binds
Clerk session changes to `ConvexClientWithAuth`, so `authState` drives the UI:

- loading → progress indicator
- signed out → Clerk `AuthView`
- signed in → `TaskBoardScreen` with Clerk `UserButton` and explicit sign-out

`MainViewModel` maps that state to `SessionStatus` from `managerkit`, starts and
stops the board with the session, and clears board subscriptions when the
ViewModel is cleared. Deep links are forwarded to `Clerk.auth.handle(uri)` from
both `onCreate` and `onNewIntent`.

Board mutations are optimistic: checkbox and delete update the local list
immediately, call the explicit Convex setter/removal, and restore the original
item with an error message if the call fails. A retried tap therefore cannot
invert the backend value.

## Dependency notes

- `dev.convex:android-convexmobile:0.8.0@aar` is declared with
  `isTransitive = true`, as required by the published AAR.
- `kotlinx-serialization-json` provides the contextual number decoders.
- `com.clerk:clerk-convex-kotlin:0.16.0` compiles against
  `clerk-android-api:1.1.8`; `clerk-android-ui:1.5.0` brings `1.5.0`, and Gradle
  resolves the conflict to `1.5.0`. This compiles and packages cleanly.
- Compose UI lives in `managerkit` as a library with the Compose compiler
  plugin; the app supplies the `ComponentActivity` and Clerk prebuilt UI.
