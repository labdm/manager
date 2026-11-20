#!/usr/bin/env bash
# Runs the standalone Gradle build under apps/android with a usable JDK and SDK.
# Android Studio ships its own JBR; macOS does not expose `java` on PATH by default.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"

if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
  for candidate in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "/Applications/Android Studio Preview.app/Contents/jbr/Contents/Home"
  do
    if [ -x "$candidate/bin/java" ]; then
      export JAVA_HOME="$candidate"
      break
    fi
  done
fi

if [ -z "${ANDROID_HOME:-}" ] || [ ! -d "$ANDROID_HOME" ]; then
  if [ -d "$HOME/Library/Android/sdk" ]; then
    export ANDROID_HOME="$HOME/Library/Android/sdk"
  fi
fi

if [ -z "${JAVA_HOME:-}" ] || [ ! -x "$JAVA_HOME/bin/java" ]; then
  echo "android-gradle: no JDK found. Install Android Studio or set JAVA_HOME." >&2
  exit 1
fi
if [ -z "${ANDROID_HOME:-}" ] || [ ! -d "$ANDROID_HOME" ]; then
  echo "android-gradle: no Android SDK found. Install Android Studio or set ANDROID_HOME." >&2
  exit 1
fi

exec "$root/apps/android/gradlew" -p "$root/apps/android" "$@"
