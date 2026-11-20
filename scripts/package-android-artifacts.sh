#!/usr/bin/env bash
# Packages the Android client produced by `./gradlew assembleDebug bundleRelease`.
#
# The APK is debug-signed so it installs directly from "Unknown sources"; the
# AAB is unsigned and ready for a store to sign. Both are public release assets.
set -euo pipefail

version="${MANAGER_VERSION:-v${MANAGER_VERSION_NUMBER:-0.1.0}}"
root="$(cd "$(dirname "$0")/.." && pwd)"
out="${MANAGER_ANDROID_ARTIFACTS_DIR:-$root/artifacts/android}"
build="$root/apps/android/app/build/outputs"
apk="$build/apk/debug/app-debug.apk"
aab="$build/bundle/release/app-release.aab"

if [ ! -f "$apk" ]; then
  echo "package-android-artifacts: missing $apk" >&2
  exit 1
fi
if [ ! -f "$aab" ]; then
  echo "package-android-artifacts: missing $aab" >&2
  exit 1
fi

mkdir -p "$out"
cp "$apk" "$out/Manager-Android-$version.apk"
cp "$aab" "$out/Manager-Android-$version.aab"
ls -lh "$out"
