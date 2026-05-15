#!/usr/bin/env bash
#
# Local Android E2E runner.
# Usage: ./scripts/e2e/run.sh [options] [flow-glob]
#
# Options:
#   --skip-build          Use the already-installed APK; do not rebuild.
#   --target ID           ADB device serial (default: first device returned by adb).
#   --at-date YYYY-MM-DD  Freeze device clock to this date (requires rooted emulator).
#   --help                This message.
#
# Without arguments, runs every flow under .maestro/flows/.

set -euo pipefail

SKIP_BUILD=0
TARGET=""
AT_DATE=""
FLOW="${1:-}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build) SKIP_BUILD=1; shift;;
    --target) TARGET="$2"; shift 2;;
    --at-date) AT_DATE="$2"; shift 2;;
    --help) sed -n '2,16p' "$0"; exit 0;;
    *) FLOW="$1"; shift;;
  esac
done

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

# Freeze device clock if requested. Works on rooted emulator images
# (most -api35 images allow `su 0 ...`); physical devices may refuse.
if [[ -n "$AT_DATE" ]]; then
  TS=$(date -j -f %Y-%m-%d "$AT_DATE" +%m%d0900%Y.%S 2>/dev/null \
      || date -d "$AT_DATE 09:00:00" +%m%d0900%Y.%S)
  adb -s "$TARGET" shell "su 0 settings put global auto_time 0" 2>/dev/null \
    || echo "::warning::Could not disable auto_time; clock fixation may not stick"
  adb -s "$TARGET" shell "su 0 date $TS" 2>/dev/null \
    || echo "::warning::Could not set device date; streak flows may be flaky"
fi
trap 'if [[ -n "$AT_DATE" ]]; then adb -s "$TARGET" shell "su 0 settings put global auto_time 1" 2>/dev/null || true; fi' EXIT

MAESTRO_DEVICE="$TARGET" maestro test "$TARGET_PATH"
