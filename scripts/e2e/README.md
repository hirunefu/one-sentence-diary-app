# E2E test runner

Local-only Maestro suite. CI does not run these tests.

## One-time setup

1. Install Android Studio + an AVD: Pixel 7 / API 35 / cold-boot snapshot, 4 GB RAM.
2. Install **JDK 17** (e.g. `brew install openjdk@17`). Expo 54 + RN 0.81's
   Android Gradle Plugin does not support JDK 18+ yet; with newer Java on
   `PATH` you'll see `Error resolving plugin [id: 'com.facebook.react.settings']`
   followed by the Java version. Set `JAVA_HOME` and prepend its `bin/`
   to `PATH` before invoking the runner.
3. Install Maestro CLI matching the version in `.maestro/.maestro-version`.
4. Start the emulator (or plug in a USB device with developer mode enabled).
5. From the repo root: `./scripts/e2e/run.sh`

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

## Streak flow time fixation

The `streak` and `streak_break` flows assume the device clock is at
2026-05-15. Use `--at-date` to freeze it:

```sh
./scripts/e2e/run.sh --at-date 2026-05-15 streak
```

Requires a rooted Android emulator image. The default Pixel 7 / API 35
**Google Play** image refuses `adb root` / `su 0`; the runner prints a
warning and continues, but the system clock stays at the real "today"
and the streak count won't match the flow's expectations. Use one of:

- A non-Google-Play (AOSP) Pixel 7 / API 35 system image, which allows
  `adb root` and can have its date set by the script.
- An emulator launched with `-writable-system` after `adb root` succeeds.

If neither is available, run the streak / streak_break flows by hand on
a date when "today minus 6 days" was a contiguous block in your real DB,
or exclude them from your default run:

```sh
./scripts/e2e/run.sh --skip-build write_today edit_past delete_entry \
  history_calendar history_timeline theme_switch reminder_toggle \
  lock_toggle import_flow write_empty_blocked write_max_length
```

(`run.sh` accepts only one positional flow today; for multiple-flow runs
of this form, invoke `maestro test` against an explicit file list.)
