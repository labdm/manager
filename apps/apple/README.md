# Manager for Apple platforms

One SwiftUI app target for iPhone (including the foldable iPhone Duo), iPad and Mac. CarPlay, watchOS, tvOS and visionOS are out of scope: `ConvexMobile` only declares iOS and macOS platforms, and each of those would need a separate app or target.

The app talks to the same Convex deployment and Clerk account as the web app and the MCP bots. There is no separate backend for native clients.

## Layout

| Path | What | Depends on |
|---|---|---|
| `Packages/ManagerKit` | Domain models, board state machine, SwiftUI views, tests | Swift standard library + SwiftUI only |
| `Packages/ManagerData` | Convex client, Clerk token provider, wire decoding | ConvexMobile, ClerkKit, ClerkConvex |
| `Manager/` | App entry point, environment, auth gate, macOS settings | all of the above |
| `project.yml` | XcodeGen spec (the source of truth for `Manager.xcodeproj`) | — |
| `Config/Secrets.example.plist` | Template for generated local config | — |

`ManagerCore` and `ManagerUI` deliberately contain no Convex or Clerk imports, so `pnpm apple:test` works with only Command Line Tools. `ManagerData` owns the heavyweight dependencies; building it needs full Xcode because ClerkKit ships a compiled `.xcstrings` catalog.

## Setup

1. Install Xcode and XcodeGen (`brew install xcodegen`). An Apple Silicon Mac is required: the prebuilt Convex Rust library has arm64 slices only.
2. Put the Convex URL in `packages/backend/.env.local` (`CONVEX_URL`) and the Clerk publishable key in `apps/web/.env.local` (`VITE_CLERK_PUBLISHABLE_KEY`). These are the same values the web app uses. You can also pass `MANAGER_CONVEX_URL` / `MANAGER_CLERK_PUBLISHABLE_KEY` in the environment.
3. From the repo root, run `pnpm apple:project`. This writes `Config/Secrets.plist` and regenerates `Manager.xcodeproj`.
4. Open `apps/apple/Manager.xcodeproj` in Xcode, pick the `Manager` scheme and run on macOS or an iOS simulator. Set a development team in Signing & Capabilities if you want to run on a device.

The generated plist and Xcode project are gitignored. The app reads configuration in this order: process environment → `Secrets.plist` → Info.plist. If either value is missing, the app shows setup instructions instead of crashing; the build itself does not need real keys.

## Layout and navigation

- Compact width (folded Duo, iPhone): one `NavigationStack` with a segmented smart-list picker.
- Regular width (unfolded Duo, iPad, Mac): `NavigationSplitView` with a smart-list sidebar and the board as detail.
- The board is a single `List` with grouped sections, so swipe actions, keyboard navigation and VoiceOver behave natively on every destination. Completed tasks start folded.
- The palette and typography mirror `packages/ui/src/tasks.css`: warm paper, surface, ink and green accent, with real dark mode.
- Prominent actions use Liquid Glass (`.glassProminent` / `.glass`, via `ManagerGlass`) on iOS/macOS 26+ and the original button styles below that. Text-heavy rows, badges and checkboxes deliberately keep opaque paper surfaces: clear glass on every list row fuses into a washed-out layer that hides task titles. A `GlassEffectContainer` must never wrap `NavigationStack` / `NavigationSplitView` — it collapses the regular-width columns. Both rules are locked down by `ManagerUITests`.

## Data flow

`ClerkConvexAuthProvider` binds Clerk sessions to `ConvexClientWithAuth<String>`. `ConvexTaskBackend` subscribes to `tasks:list` and watches the websocket state; `TaskBoardModel` applies optimistic writes and rolls back on failure. `tasks:create`, `tasks:setDone` and `tasks:remove` live in `packages/backend/convex/tasks.ts` next to the web/MCP mutations.

Convex encodes JavaScript numbers as tagged objects, so `dueAt` is decoded with `@OptionalConvexFloat`. A plain `Double` compiles but fails at runtime. Outgoing dates are sent as local-midnight milliseconds, matching the web app.

## Commands

From the repo root:

```sh
pnpm apple:project      # generate Config/Secrets.plist + Manager.xcodeproj
pnpm apple:test         # 39 Swift tests: core logic, config, board and glass coverage
pnpm apple:build:mac
pnpm apple:build:ios
pnpm apple:install:ios  # install + launch on the booted simulator
pnpm apple:package      # zip both builds into artifacts/apple/
pnpm check:functions    # assert the Convex deployment has every function the app calls
```

The iOS simulator build is ad-hoc signed (`CODE_SIGN_IDENTITY=-`) on purpose.
Building with `CODE_SIGNING_ALLOWED=NO` leaves the bundle without a usable code
signature, and Clerk's keychain writes then fail with OSStatus `-34018` inside
the simulator. Ad-hoc signing needs no certificate or team and keeps the
keychain working.

`pnpm apple:build:*` writes to `apps/apple/.build/derivedData` by default. Set `MANAGER_DERIVED_DATA` to use another location and `MANAGER_CONFIGURATION=Release` for distribution builds. `pnpm apple:package` converts those builds into `Manager-macOS-<version>.zip` and `Manager-iOS-Simulator-<version>.zip`; the iOS archive is for the Simulator, not for sideloading onto a device.

`pnpm build` (the Vercel build) does not touch the Apple client. CI runs the Apple workflow separately on an arm64 macOS runner and uploads both zips. `.github/workflows/release.yml` uses the same packaging for tagged releases.

## Known rough edges

- The public `convex-swift` binary is built with a newer macOS min version than the app target, so macOS links emit `built for newer 'macOS' version (26.2)` warnings. The app builds and runs on macOS 14+.
- Sign in with Apple is present in the entitlements template but must be enabled on the App ID and in Clerk before use. Email-code sign-in works without it.
- Widgets, App Intents and Live Activities are future work; they need additional targets and are not part of this app yet.
