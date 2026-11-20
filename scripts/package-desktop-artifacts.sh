#!/usr/bin/env bash
set -euo pipefail

platform="${1:-}"
case "$platform" in
  windows|macos) ;;
  *)
    echo "Usage: $0 {windows|macos}" >&2
    exit 2
    ;;
esac

version="${MANAGER_VERSION:-v${MANAGER_VERSION_NUMBER:-0.1.0}}"
case "$platform" in
  windows) label="Windows" ;;
  macos) label="macOS" ;;
esac
root="$(cd "$(dirname "$0")/.." && pwd)"
profile="${TAURI_PROFILE:-release}"
bundle="$root/apps/desktop/src-tauri/target/$profile/bundle"
out="${MANAGER_DESKTOP_ARTIFACTS_DIR:-$root/artifacts/desktop}"
stage="$out/.stage-$platform"

mkdir -p "$out"
rm -rf "$stage"
mkdir -p "$stage"

first_file() {
  find "$1" -maxdepth 1 -type f -iname "$2" -print -quit 2>/dev/null || true
}

case "$platform" in
  windows)
    exe="$(first_file "$bundle/nsis" '*-setup.exe')"
    msi="$(first_file "$bundle/msi" '*.msi')"
    if [ -z "$exe" ] || [ -z "$msi" ]; then
      echo "::error::Windows NSIS and MSI bundles are both required" >&2
      exit 1
    fi
    cp "$exe" "$stage/Manager-Windows-$version.exe"
    cp "$msi" "$stage/Manager-Windows-$version.msi"
    cp "$stage/Manager-Windows-$version.exe" "$stage/Manager-Windows-$version.msi" "$out/"
    ;;
  macos)
    dmg="$(first_file "$bundle/dmg" '*.dmg')"
    app="$(find "$bundle/macos" -type d -name 'Manager.app' -print -quit 2>/dev/null || true)"
    if [ -z "$dmg" ] || [ -z "$app" ]; then
      echo "::error::macOS DMG and .app bundles are both required" >&2
      exit 1
    fi
    cp "$dmg" "$stage/Manager-macOS-$version.dmg"
    cp -R "$app" "$stage/Manager.app"
    cp "$root/apps/desktop/INSTALL-macOS.txt" "$stage/INSTALL-macOS.txt"
    cp "$stage/Manager-macOS-$version.dmg" "$out/"
    ;;
esac

tar -a -cf "$out/Manager-$label-$version.zip" -C "$stage" .
tar -czf "$out/Manager-$label-$version.tar.gz" -C "$stage" .
rm -rf "$stage"

echo "Packaged $platform desktop artifacts in $out"
ls -lh "$out"
