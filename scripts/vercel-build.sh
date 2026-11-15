#!/usr/bin/env bash
# Vercel build: deploy Convex, then build the Next.js app in apps/web.
#
# Preview and production are selected by the Convex deploy key on the
# Vercel project (not created in this repo). There is no migration runner
# and no preview seed yet, so both environments use the same command.
# Do not put production deploy keys in the repo.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT/apps/web"
pnpm exec convex deploy --cmd 'pnpm run build'
