#!/usr/bin/env bash
# Packages the macOS and iOS Simulator builds produced by pnpm apple:build:*.
#
# Both builds are unsigned/ad-hoc-signed for download; the iOS archive is a
# simulator app, not an App Store or TestFlight build. The filenames carry the
# platform so the Convex downloads action can classify release assets.
set -euo pipefail

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
derived="${MANAGER_DERIVED_DATA:-$root/apps/apple/.build/derivedData}"
configuration="${MANAGER_CONFIGURATION:-Debug}"
version="${MANAGER_VERSION:-local}"
out="${MANAGER_ARTIFACTS_DIR:-$root/artifacts/apple}"

mac_app="$derived/Build/Products/$configuration/Manager.app"
ios_app="$derived/Build/Products/${configuration}-iphonesimulator/Manager.app"

if [ ! -d "$mac_app" ]; then
  echo "package-apple-artifacts: missing $mac_app" >&2
  exit 1
fi
if [ ! -d "$ios_app" ]; then
  echo "package-apple-artifacts: missing $ios_app" >&2
  exit 1
fi

mkdir -p "$out"

# Xcode's unsigned macOS build is linker-signed ad hoc without a resource seal,
# which macOS reports as "app is damaged". Re-sign the bundle so Info.plist and
# resources are sealed, then fail packaging if the signature is still invalid.
xattr -cr "$mac_app" 2>/dev/null || true
codesign --force --deep --sign - "$mac_app"
codesign --verify --deep --strict "$mac_app"

ditto -c -k --sequesterRsrc --keepParent "$mac_app" "$out/Manager-macOS-$version.zip"
tar -czf "$out/Manager-macOS-$version.tar.gz" -C "$(dirname "$mac_app")" "$(basename "$mac_app")"
ditto -c -k --sequesterRsrc --keepParent "$ios_app" "$out/Manager-iOS-Simulator-$version.zip"
tar -czf "$out/Manager-iOS-Simulator-$version.tar.gz" -C "$(dirname "$ios_app")" "$(basename "$ios_app")"
echo "Packaged Apple artifacts in $out"
