#!/usr/bin/env bash
#
# Local Android E2E runner.
# Usage: ./scripts/e2e/run.sh [options] [flow-glob]
#
# Options:
#   --skip-build    Use the already-installed APK; do not rebuild.
#   --target ID     ADB device serial (default: first device returned by adb).
#   --help          This message.
#
# Without arguments, runs every flow under .maestro/flows/.

set -euo pipefail

SKIP_BUILD=0
TARGET=""
FLOW="${1:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1; shift;;
    --target) TARGET="$2"; shift 2;;
    --help) sed -n '2,15p' "$0"; exit 0;;
    *) FLOW="$1"; shift;;
  esac
done

# Verify Maestro version matches the pinned version.
PIN_FILE=.maestro/.maestro-version
if [[ ! -f "$PIN_FILE" ]]; then
  echo "::error::Missing $PIN_FILE" >&2
  exit 1
fi
PINNED=$(cat "$PIN_FILE")
INSTALLED=$(maestro --version 2>/dev/null | tr -d '[:space:]')
if [[ "$PINNED" != "$INSTALLED" ]]; then
  echo "::warning::Maestro version mismatch — pinned $PINNED, installed $INSTALLED" >&2
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

if [[ "$SKIP_BUILD" -eq 0 ]]; then
  echo "Building E2E APK (EXPO_PUBLIC_E2E=1)…"
  EXPO_PUBLIC_E2E=1 npx expo run:android --variant=release --device "$TARGET" --no-bundler
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
