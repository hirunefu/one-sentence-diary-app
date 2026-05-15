# E2E test runner

Local-only Maestro suite. CI does not run these tests.

## One-time setup

1. Install Android Studio + an AVD: Pixel 7 / API 35 / cold-boot snapshot, 4 GB RAM.
2. Install Maestro CLI matching the version in `.maestro/.maestro-version`.
3. Start the emulator (or plug in a USB device with developer mode enabled).
4. From the repo root: `./scripts/e2e/run.sh`

## Day-to-day

```sh
# Full suite (rebuilds APK):
./scripts/e2e/run.sh

# Skip rebuild after non-app changes (~30 sec faster):
./scripts/e2e/run.sh --skip-build

# Single flow during debugging:
./scripts/e2e/run.sh write_today
./scripts/e2e/run.sh --skip-build write_today
```

## Why the build flag

`EXPO_PUBLIC_E2E=1` is injected at build time so the APK boots with biometric
auth, notifications, and the document picker stubbed out — these can't be
driven from Maestro. Production builds (no flag) are byte-identical to the
pre-E2E behavior.

## Editing flows

- Add testID attributes lazily as flows demand them — do not pre-emptively
  add them across the app.
- For UI chrome (buttons, tabs, settings rows), select by testID only.
- For diary content (user-entered text), text matching is acceptable.
- Use `clearState: true` (already in `.maestro/config.yaml`) for every flow.
