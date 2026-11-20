#!/usr/bin/env bash
# Packages the macOS and/or iOS Simulator builds produced by pnpm apple:build:*.
#
# Each target can be packaged on its own so release CI builds them in parallel.
# Both builds are unsigned/ad-hoc-signed for download; the iOS archive is a
# simulator app, not an App Store or TestFlight build. The filenames carry the
# platform so the Convex downloads action can classify release assets.
set -euo pipefail

target="${1:-all}"
case "$target" in
  all|macos|ios) ;;
  *)
    echo "Usage: $0 {all|macos|ios}" >&2
    exit 2
    ;;
esac

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
derived="${MANAGER_DERIVED_DATA:-$root/apps/apple/.build/derivedData}"
configuration="${MANAGER_CONFIGURATION:-Debug}"
version="${MANAGER_VERSION:-local}"
out="${MANAGER_ARTIFACTS_DIR:-$root/artifacts/apple}"

mac_app="$derived/Build/Products/$configuration/Manager.app"
ios_app="$derived/Build/Products/${configuration}-iphonesimulator/Manager.app"

if [ "$target" = "all" ] || [ "$target" = "macos" ]; then
  if [ ! -d "$mac_app" ]; then
    echo "package-apple-artifacts: missing $mac_app" >&2
    exit 1
  fi
fi
if [ "$target" = "all" ] || [ "$target" = "ios" ]; then
  if [ ! -d "$ios_app" ]; then
    echo "package-apple-artifacts: missing $ios_app" >&2
    exit 1
  fi
fi

mkdir -p "$out"
out="$(cd "$out" && pwd)"

if [ "$target" = "all" ] || [ "$target" = "macos" ]; then
  # Xcode's unsigned macOS build is linker-signed ad hoc without a resource seal,
  # which macOS reports as "app is damaged". Re-sign the bundle so Info.plist and
  # resources are sealed, then fail packaging if the signature is still invalid.
  xattr -cr "$mac_app" 2>/dev/null || true
  codesign --force --deep --sign - "$mac_app"
  codesign --verify --deep --strict "$mac_app"

  stage="$out/.macos-stage"
  rm -rf "$stage"
  mkdir -p "$stage"
  cp -R "$mac_app" "$stage/"
  cp "$root/apps/apple/INSTALL-macOS.txt" "$stage/INSTALL-macOS.txt"

  # zip cannot hold the install guide when ditto archives only one source, so the
  # macOS zip is built from a staged directory that contains both files. "Native"
  # keeps these apart from the Tauri desktop macOS archives.
  (cd "$stage" && zip -qry "$out/Manager-macOS-Native-$version.zip" Manager.app INSTALL-macOS.txt)
  tar -czf "$out/Manager-macOS-Native-$version.tar.gz" -C "$stage" Manager.app INSTALL-macOS.txt
  rm -rf "$stage"
fi

if [ "$target" = "all" ] || [ "$target" = "ios" ]; then
  ditto -c -k --sequesterRsrc --keepParent "$ios_app" "$out/Manager-iOS-Simulator-$version.zip"
  tar -czf "$out/Manager-iOS-Simulator-$version.tar.gz" -C "$(dirname "$ios_app")" "$(basename "$ios_app")"
fi

echo "Packaged $target Apple artifacts in $out"
