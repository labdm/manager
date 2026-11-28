#!/usr/bin/env bash
# Convex's esbuild follows static imports and leaves createRequire() as a
# runtime require. That require failed the production push with
# "Cannot find module 'web-push'". Fail if the bundle still asks for it.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

dir="$(mktemp -d)"
out="$dir/pushNode.mjs"
trap 'rm -rf "$dir"' EXIT

pnpm exec -- esbuild packages/backend/convex/pushNode.ts \
  --bundle \
  --platform=node \
  --format=esm \
  --log-level=warning \
  --outfile="$out"

if [[ ! -s "$out" ]]; then
  echo "esbuild did not write a pushNode bundle"
  exit 1
fi

if grep -Eq "from [\"']web-push[\"']|require\\([\"']web-push[\"']\\)" "$out"; then
  echo "pushNode.ts left web-push unresolved. Import it statically so Convex bundles it."
  exit 1
fi

echo "pushNode bundle includes web-push"
