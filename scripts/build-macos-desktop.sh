#!/usr/bin/env bash
# macOS DMG creation uses hdiutil and occasionally fails on GitHub runners with
# "Resource busy". Retry only that known-flaky failure; real build errors fail
# immediately.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$root"

attempts="${MACOS_BUILD_ATTEMPTS:-3}"
log="$(mktemp)"
trap 'rm -f "$log"' EXIT

for attempt in $(seq 1 "$attempts"); do
  echo "::group::Build macOS desktop app (attempt $attempt/$attempts)"
  set +e
  pnpm --dir apps/desktop tauri build --bundles dmg,app 2>&1 | tee "$log"
  status=${PIPESTATUS[0]}
  set -e
  echo "::endgroup::"

  if [ "$status" -eq 0 ]; then
    exit 0
  fi

  if [ "$attempt" -eq "$attempts" ] || ! grep -q 'Resource busy' "$log"; then
    exit "$status"
  fi

  echo "hdiutil reported Resource busy; cleaning up and retrying in $((attempt * 10))s..."
  find apps/desktop/src-tauri/target/release/bundle/dmg -maxdepth 1 \
    -type f -name 'rw.*.dmg' -print -delete 2>/dev/null || true
  sleep $((attempt * 10))
done
