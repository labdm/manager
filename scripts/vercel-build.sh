#!/usr/bin/env bash
# Vercel build: deploy Convex when a deploy key is present, then build the
# static SPA. Preview and production are selected by CONVEX_DEPLOY_KEY on
# the Vercel project. Do not put production deploy keys in the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -n "${CONVEX_DEPLOY_KEY:-}" ]]; then
  pnpm --filter @manager/backend exec convex deploy
fi

if [[ -z "${VITE_CONVEX_URL:-}" && -n "${CONVEX_URL:-}" ]]; then
  export VITE_CONVEX_URL="$CONVEX_URL"
fi
if [[ -z "${VITE_CLERK_PUBLISHABLE_KEY:-}" && -n "${CLERK_PUBLISHABLE_KEY:-}" ]]; then
  export VITE_CLERK_PUBLISHABLE_KEY="$CLERK_PUBLISHABLE_KEY"
fi

pnpm --filter @manager/web build
