#!/usr/bin/env bash
# Maps Convex and Clerk env into Vite's VITE_* names, then builds the SPA.
# `convex deploy --cmd` exports CONVEX_URL for this process.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# `convex deploy --cmd` sets CONVEX_URL for this deployment. Prefer it over a
# project-level VITE_CONVEX_URL so each preview build talks to its own deployment.
if [[ -n "${CONVEX_URL:-}" ]]; then
  export VITE_CONVEX_URL="$CONVEX_URL"
elif [[ -z "${VITE_CONVEX_URL:-}" && -n "${NEXT_PUBLIC_CONVEX_URL:-}" ]]; then
  export VITE_CONVEX_URL="$NEXT_PUBLIC_CONVEX_URL"
fi
if [[ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" && -n "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ]]; then
  export VITE_CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
fi
if [[ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" && -n "${CLERK_PUBLISHABLE_KEY:-}" ]]; then
  export VITE_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_KEY"
fi
# Vercel build metadata lets the SPA treat preview deployments differently
# without shipping secrets to the browser.
if [[ -z "${VITE_DEPLOY_ENV:-}" && -n "${VERCEL_ENV:-}" ]]; then
  export VITE_DEPLOY_ENV="$VERCEL_ENV"
fi

pnpm --filter @manager/web build
