#!/usr/bin/env bash
# Vercel build: deploy Convex when CONVEX_DEPLOY_KEY is set, then build the SPA.
# `convex deploy --cmd` exports CONVEX_URL into the build. The Clerk issuer and
# MCP_ROLE_SECRET must already be set on that Convex deployment
# (`scripts/sync-convex-auth-env.sh` with a member login). A preview deploy key
# cannot set deployment env (Convex returns ServiceTokenNotAllowed).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

if [[ -n "${CONVEX_DEPLOY_KEY:-}" ]]; then
  pnpm --filter @manager/backend exec convex deploy --cmd "bash \"$ROOT/scripts/vite-build-with-env.sh\""
else
  bash "$ROOT/scripts/vite-build-with-env.sh"
fi
