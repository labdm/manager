#!/usr/bin/env bash
# Fails when the Convex deployment the app points at is missing a function the
# Apple client calls. Source-only typechecks cannot catch an unpushed function.
set -euo pipefail

ROOT=$(cd "$(dirname "$0")/.." && pwd)
BACKEND="$ROOT/packages/backend"
cd "$BACKEND"

# `convex function-spec --file` writes function_spec_<timestamp>.json here.
BEFORE=$(mktemp)
ls function_spec_*.json 2>/dev/null >"$BEFORE" || true

pnpm exec convex function-spec --file >/dev/null

SPEC=""
for file in function_spec_*.json; do
  [ -e "$file" ] || continue
  grep -Fqx "$file" "$BEFORE" && continue
  SPEC="$file"
done
rm -f "$BEFORE"

if [ -z "$SPEC" ]; then
  echo "check-convex-functions: no function spec was generated" >&2
  exit 1
fi

trap 'rm -f "$SPEC"' EXIT

python3 - "$SPEC" <<'PY'
import json
import sys

spec = json.load(open(sys.argv[1]))
identifiers = {entry["identifier"] for entry in spec["functions"]}
required = [
    "tasks.js:list",
    "tasks.js:create",
    "tasks.js:setDone",
    "tasks.js:remove",
    "users.js:ensure",
]
missing = [name for name in required if name not in identifiers]
if missing:
    print(
        "check-convex-functions: missing from "
        f"{spec['url']}: {', '.join(missing)}. "
        "Run `pnpm dev:backend` (or `convex dev --once`) and retry.",
        file=sys.stderr,
    )
    raise SystemExit(1)
print(f"check-convex-functions: {len(required)} required functions present on {spec['url']}")
PY
