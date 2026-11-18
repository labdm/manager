#!/usr/bin/env bash
# Maps Convex and Clerk env into Vite's VITE_* names, then builds the SPA.
# `convex deploy --cmd` exports CONVEX_URL for this process.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -z "${VITE_CONVEX_URL:-}" && -n "${CONVEX_URL:-}" ]]; then
  export VITE_CONVEX_URL="$CONVEX_URL"
fi
if [[ -z "${VITE_CONVEX_URL:-}" && -n "${NEXT_PUBLIC_CONVEX_URL:-}" ]]; then
  export VITE_CONVEX_URL="$NEXT_PUBLIC_CONVEX_URL"
fi
if [[ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" && -n "${NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY:-}" ]]; then
  export VITE_CLERK_PUBLISHABLE_KEY="$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY"
fi
if [[ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" && -n "${CLERK_PUBLISHABLE_KEY:-}" ]]; then
  export VITE_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_KEY"
fi

pnpm --filter @manager/web build
