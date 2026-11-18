#!/usr/bin/env bash
# Vercel build: sync Convex auth env, deploy Convex when a deploy key is
# present, then build the static SPA. Preview and production are selected by
# CONVEX_DEPLOY_KEY on the Vercel project. Do not put deploy keys in the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -n "${CONVEX_DEPLOY_KEY:-}" ]]; then
  bash "$ROOT/scripts/sync-convex-auth-env.sh"
  pnpm --filter @manager/backend exec convex deploy --cmd "bash \"$ROOT/scripts/vite-build-with-env.sh\""
else
  bash "$ROOT/scripts/vite-build-with-env.sh"
fi
