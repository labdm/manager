# Manager desktop

Tauri v2 client for Windows and macOS. It bundles the Vite build of `packages/ui`
locally; it does not load the hosted web app. The desktop client hides the Downloads
link because release downloads belong on the website.

## Commands

From the repo root:

- `pnpm desktop:dev` — Vite dev server plus the Tauri window.
- `pnpm desktop:build` — build the bundled SPA and the native Tauri app.

From `apps/desktop`:

- `pnpm tauri build --bundles dmg,app` — local macOS app and DMG.
- `cargo check --manifest-path src-tauri/Cargo.toml` — Rust type check.

The Vite build needs `VITE_CONVEX_URL` and `VITE_CLERK_PUBLISHABLE_KEY` in
`apps/desktop/.env.local` (or as environment variables). The Rust side reads
`VITE_CLERK_PUBLISHABLE_KEY` at compile time, so export it before `tauri dev` or
`tauri build`:

```sh
set -a; . apps/web/.env.local; set +a
pnpm desktop:build
```

Then open `apps/desktop/src-tauri/target/release/bundle/macos/Manager.app`.
No Clerk secret key belongs in this app or the repo.

PR CI artifacts are built with public repository variables now; older CI builds
that used placeholder values will show a blank window.

`@tauri-apps/plugin-http` is pinned to 2.8.3 in both the pnpm workspace and the
Rust manifest. `tauri-plugin-clerk` 0.1.1 depends on plugin-http 2.8's IPC
payload; 2.9 moved that payload into a header and Clerk calls fail with an
`Origin`/`Authorization` conflict. `pnpm --dir apps/desktop test` guards the pin.

## Auth

The app uses `tauri-plugin-clerk` with Clerk's React SDK and the same Convex
`ConvexProviderWithClerk` as the web app. Supported methods match the web app's
Clerk instance: email address + password, email codes, and Google OAuth. Clerk's
pre-built sign-in UI is used; OAuth is handled by a custom transport because the
default Tauri webview cannot complete a same-document OAuth redirect.

One-time Clerk configuration for OAuth:

- Enable the Native API for the Clerk instance.
- Keep the JWT template named `convex`.
- Add `https://manager.labdm.dev/oauth-callback.html` as an allowed redirect URL.
  The page is served from `apps/web/public/oauth-callback.html` by the static web
  deployment.
- Keep `dev.labdm.manager://callback` allowed as well. The completion page uses
  that registered deep link to hand Clerk's parameters back to the app.
- Enable Google as a social connection.

The flow opens the provider in the system browser and returns to the hosted
completion page. That page renders "Signed in" instead of leaving the browser
hanging on a custom-scheme URL, forwards Clerk's parameters to the
`dev.labdm.manager` deep link, and the desktop window comes to the front. Tauri's
deep-link plugin delivers the callback to the running app; Clerk then reloads the
client and activates the session. The callback listener times out after three
minutes. On macOS, custom-scheme deep links only reach a packaged app installed
outside the build directory; test OAuth with a built app, not `pnpm desktop:dev`.

Magic links are not supported by the Tauri plugin and are not enabled on the
Manager Clerk instance. If magic links are enabled later, desktop needs a custom
flow before it can claim auth parity.

## Packaging and releases

`scripts/package-desktop-artifacts.sh` copies Tauri bundles into `artifacts/desktop`
as `Manager-Windows-<version>.exe|msi|zip|tar.gz` and
`Manager-macOS-Desktop-<version>.dmg|zip|tar.gz`. The native SwiftUI macOS app
uses `Manager-macOS-Native-<version>.zip|tar.gz`, so the two macOS builds do not
overwrite each other. The release workflow builds Windows on
`windows-latest` and macOS on `macos-latest`, then uploads those files to the
GitHub release. `/download` lists both platforms publicly.

The macOS app is ad-hoc signed and is not notarized. macOS Gatekeeper will show
a warning on first launch; open it from System Settings → Privacy & Security →
Open Anyway. The macOS archives include `INSTALL-macOS.txt`, which also explains
that Google sign-in needs the app installed in `/Applications` so macOS routes
`dev.labdm.manager://callback` links to it. Windows builds are unsigned, so SmartScreen may
show a warning for a newly downloaded installer.
