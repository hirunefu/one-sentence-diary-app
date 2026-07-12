#!/usr/bin/env bash
#
# Local Android E2E runner.
# Usage: ./scripts/e2e/run.sh [options] [flow-glob]
#
# Options:
#   --skip-build          Use the already-installed APK; do not rebuild.
#                         Ignored when --at-date is set (the date is inlined
#                         at build time so the APK must be regenerated).
#   --target ID           ADB device serial (default: first device returned by adb).
#   --at-date YYYY-MM-DD  Inline this date as today() for the E2E build.
#                         Forces a rebuild with EXPO_PUBLIC_E2E_TODAY set so
#                         streak / streak_break flows are deterministic
#                         regardless of the device's wall clock or root status.
#   --help                This message.
#
# Without arguments, runs every flow under .maestro/flows/.

set -euo pipefail

SKIP_BUILD=0
TARGET=""
AT_DATE=""
# FLOW starts empty; the option-parsing loop below captures any non-flag
# positional argument as the flow name. Initializing from $1 here would
# misinterpret a leading flag like --skip-build as the flow.
FLOW=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1; shift;;
    --target) TARGET="$2"; shift 2;;
    --at-date) AT_DATE="$2"; shift 2;;
    --help) sed -n '2,17p' "$0"; exit 0;;
    *) FLOW="$1"; shift;;
  esac
done

# --at-date inlines the override at build time, so --skip-build is incompatible.
# Prefer correctness over speed: rebuild and announce the override.
if [[ -n "$AT_DATE" && "$SKIP_BUILD" -eq 1 ]]; then
  echo "::warning::--skip-build is ignored when --at-date is set; rebuilding." >&2
  SKIP_BUILD=0
fi

# Verify Maestro version matches the pinned version (best-effort: a missing
# pin file warns but does not abort, so a fresh clone with Maestro installed
# can still run flows. Create .maestro/.maestro-version with the output of
# `maestro --version` to lock the version once everything works.)
PIN_FILE=.maestro/.maestro-version
INSTALLED=$(maestro --version 2>/dev/null | tr -d '[:space:]')
if [[ ! -f "$PIN_FILE" ]]; then
  echo "::warning::Missing $PIN_FILE — pin the version with: echo \"$INSTALLED\" > $PIN_FILE" >&2
else
  PINNED=$(cat "$PIN_FILE")
  if [[ "$PINNED" != "$INSTALLED" ]]; then
    echo "::warning::Maestro version mismatch — pinned $PINNED, installed $INSTALLED" >&2
  fi
fi

# Resolve target device.
if [[ -z "$TARGET" ]]; then
  TARGET=$(adb devices | awk 'NR>1 && $2=="device" {print $1; exit}')
fi
if [[ -z "$TARGET" ]]; then
  echo "::error::No connected ADB device found." >&2
  exit 1
fi
echo "Using device: $TARGET"

# Gboard's stylus onboarding sheet ("Try out your stylus") can pop over the
# first focused text input on stylus-capable emulators (e.g. Pixel 10 Pro),
# hiding the whole UI hierarchy from Maestro. Disable stylus handwriting so
# the sheet never appears. Best-effort: the key may not exist on older APIs.
adb -s "$TARGET" shell settings put secure stylus_handwriting_enabled 0 || true

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  if [[ -n "$AT_DATE" ]]; then
    echo "Building E2E APK (EXPO_PUBLIC_E2E=1, EXPO_PUBLIC_E2E_TODAY=$AT_DATE)…"
  else
    echo "Building E2E APK (EXPO_PUBLIC_E2E=1)…"
  fi
  # Gradle's createBundleReleaseJsAndAssets task does not track EXPO_PUBLIC_*
  # env vars as inputs, so with an unchanged source tree it goes UP-TO-DATE
  # and repackages the previous JS bundle — silently dropping the inlined
  # E2E date. Delete the generated bundle to force Metro to re-run.
  find android/app/build -name 'index.android.bundle' -delete 2>/dev/null || true
  # Expo's --device flag does not accept ADB serials directly; instead it
  # uses the first attached device when --device is omitted. Set
  # ANDROID_SERIAL so adb-level installs target $TARGET specifically when
  # multiple devices are attached.
  ANDROID_SERIAL="$TARGET" \
    EXPO_PUBLIC_E2E=1 \
    EXPO_PUBLIC_E2E_TODAY="$AT_DATE" \
    npx expo run:android --variant=release --no-bundler
else
  echo "Skipping build (--skip-build)."
fi

# Run flows. Default: every flow under .maestro/flows/.
if [[ -z "$FLOW" ]]; then
  TARGET_PATH=".maestro/flows"
else
  # Allow either a flow name (without extension) or a relative path.
  if [[ -f "$FLOW" ]]; then
    TARGET_PATH="$FLOW"
  else
    TARGET_PATH=".maestro/flows/${FLOW%.yaml}.yaml"
    [[ -f "$TARGET_PATH" ]] || { echo "::error::No such flow: $TARGET_PATH" >&2; exit 1; }
  fi
fi

MAESTRO_DEVICE="$TARGET" maestro test "$TARGET_PATH"
