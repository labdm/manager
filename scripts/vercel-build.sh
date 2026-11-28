#!/usr/bin/env bash
# Vercel build: on production, deploy Convex when CONVEX_DEPLOY_KEY is set,
# then build the SPA. Preview builds only build the SPA.
# `convex deploy --cmd` exports CONVEX_URL into the build. The Clerk issuer and
# MCP_ROLE_SECRET must already be set on that Convex deployment
# (`scripts/sync-convex-auth-env.sh` with a member login). A preview deploy key
# cannot set deployment env (Convex returns ServiceTokenNotAllowed).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# Production (Vercel `main`) is the only environment that pushes Convex.
# Preview deploy keys cannot set deployment env, and a second push from a
# preview build would race the production deploy. Outside Vercel, a set key
# still deploys, which is the local `vercel build` path.
if [[ -n "${CONVEX_DEPLOY_KEY:-}" && ( -z "${VERCEL_ENV:-}" || "${VERCEL_ENV}" == "production" ) ]]; then
  echo "Deploy Convex (production)"
  pnpm --filter @manager/backend exec convex deploy --cmd "bash \"$ROOT/scripts/vite-build-with-env.sh\""
else
  if [[ -n "${VERCEL_ENV:-}" && "${VERCEL_ENV}" != "production" ]]; then
    echo "Skip Convex deploy on Vercel ${VERCEL_ENV}. Production (main) deploys Convex."
  fi
  bash "$ROOT/scripts/vite-build-with-env.sh"
fi
