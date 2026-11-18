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

# Vercel does not hoist workspace deps for files in /api, and it does not run
# the TypeScript sources. Bundle each function into one ESM file, then drop
# the .ts entry so the deployed function is the bundle.
if [[ -n "${VERCEL:-}" ]]; then
  bundle_api() {
    local name="$1"
    pnpm exec esbuild "api/${name}.ts" \
      --bundle \
      --platform=node \
      --format=esm \
      --outfile="api/${name}.js"
    rm -f "api/${name}.ts"
  }
  bundle_api mcp
  bundle_api oauth-authorization-server
  bundle_api oauth-protected-resource
fi
