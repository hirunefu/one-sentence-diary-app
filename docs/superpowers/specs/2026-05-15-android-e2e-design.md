# Android E2E testing — design spec

Status: Draft (awaiting user review)
Date: 2026-05-15
Author: hirunefu (with Amadeus)

## Goal

Stand up an Android end-to-end test suite that is **stable** and runs as **fast as possible** on a local developer machine. The suite is a pre-push / pre-release smoke gate, not a per-commit CI gate. CI integration is explicitly out of scope.

### Success criteria

- 13 flow files cover the app's core features (write, edit, delete, history, theme, lock toggle, reminder toggle, import).
- Second-run wall time ≤ 3 minutes from `./scripts/e2e/run.sh` to "all passed".
- Zero false failures across 10 consecutive runs of the full suite once the app code is unchanged.
- Production build output is byte-identical to the pre-E2E build for the same git ref (no E2E code paths reachable in production).

## Non-goals

- CI execution. The release-apk workflow remains untouched.
- iOS coverage. The app currently ships Android-only.
- E2E coverage of true OS-dialog behavior (biometrics, system notifications, document picker). Those are validated by the existing unit tests; E2E only validates the surrounding app behavior with these calls stubbed.
- Performance benchmarking. Speed targets are wall-clock budgets, not regression guards.

## Tool choice: Maestro

Selected over Detox because:

1. **Lower setup cost on Expo / RN new architecture.** Maestro talks to the device through ADB and accessibility; no native client compiled into the app, no JS bridge synchronization. Detox needs a Detox-aware build and historically lags on new-architecture support.
2. **YAML flows are cheaper to maintain** than Detox's JS suites for a project this size (~13 flows).
3. **Selector model fits the codebase.** Existing components already use `testID` for streak dots, the entry input, and the remaining-count label.

Trade-off accepted: Detox's gray-box sync with the RN bridge yields slightly faster per-flow execution. For this suite's scale (~13 flows, ~2-min wall time), the difference is dwarfed by AVD cold-start.

## Architecture

```
one-sentence-diary-app/
├── .maestro/
│   ├── config.yaml                      shared appId + clearState
│   ├── flows/
│   │   ├── write_today.yaml
│   │   ├── write_max_length.yaml
│   │   ├── write_empty_blocked.yaml
│   │   ├── streak.yaml
│   │   ├── streak_break.yaml
│   │   ├── edit_past.yaml
│   │   ├── delete_entry.yaml
│   │   ├── history_calendar.yaml
│   │   ├── history_timeline.yaml
│   │   ├── theme_switch.yaml
│   │   ├── lock_toggle.yaml
│   │   ├── reminder_toggle.yaml
│   │   └── import_flow.yaml
│   ├── fixtures/
│   │   └── seed-7days.json
│   └── .maestro-version                 pins Maestro CLI version
├── src/
│   └── config/
│       └── e2eMode.ts                   single read-point for EXPO_PUBLIC_E2E
├── scripts/
│   └── e2e/
│       ├── run.sh
│       └── README.md
└── eas.json                             new `e2e` profile (env: EXPO_PUBLIC_E2E=1)
```

Nothing existing is modified except:

- `services/localAuth.ts` — gain a single early-return branch under `IS_E2E`
- `services/notifications.ts` — gain `IS_E2E` no-op branches
- `screens/SettingsScreen.tsx` — `pickImportSource` chooses between DocumentPicker and the bundled fixture based on `IS_E2E`
- Several components — add missing `testID` attributes where Maestro needs them (save button, settings rows, tab labels). These are inert in production.

## Test mode integration

### Flag plumbing

`src/config/e2eMode.ts`:

```ts
// EXPO_PUBLIC_E2E=1 in the build environment. The EXPO_PUBLIC_ prefix tells
// Expo's bundler to statically inline the value into the client JS at build
// time, so `IS_E2E` is a compile-time constant in production (undefined →
// false → branches DCE'd away).
export const IS_E2E = process.env.EXPO_PUBLIC_E2E === '1';
```

Read at the top of each service that needs to branch. No runtime config, no `Constants.expoConfig.extra`, no global flag overrides — keeping the single source of truth makes audits trivial.

### Service-level branching

| Module | Production behavior | `IS_E2E` behavior |
|---|---|---|
| `localAuth.authenticate()` | `LocalAuthentication.authenticateAsync()` | `Promise.resolve(true)` |
| `localAuth.isLocalAuthAvailable()` | hardware + enrolled checks | `Promise.resolve(true)` |
| `notifications.requestNotificationPermission()` | OS permission dialog | `Promise.resolve(true)` |
| `notifications.rescheduleReminders()` | actually schedule | no-op |
| `SettingsScreen.pickImportSource` | DocumentPicker + File read | static `require` of `.maestro/fixtures/seed-7days.json` |

The DocumentPicker mock uses Metro's static `require`, so the fixture is bundled into the E2E APK at build time. No `adb push` of fixtures needed.

### Build profile

`eas.json` gains:

```jsonc
{
  "build": {
    "e2e": {
      "extends": "preview",
      "env": { "EXPO_PUBLIC_E2E": "1" },
      "android": { "buildType": "apk" }
    }
  }
}
```

Local builds use:

```sh
EXPO_PUBLIC_E2E=1 npx expo run:android --variant=release
```

The EAS profile is added for parity but isn't required for local-only operation.

## Maestro flow design

### Shared header (`.maestro/config.yaml`)

```yaml
appId: com.hirunefu.onesentencediary
---
- launchApp:
    clearState: true
    stopApp: true
```

`clearState: true` runs `pm clear` before every flow, so SQLite, AsyncStorage, and notification state are wiped. This is the foundation of the stability strategy: every flow starts from byte-identical initial state.

### Flow inventory and time budget

| flow | invariant | budget |
|---|---|---|
| `write_today.yaml` | input → save → "✓ saved" → relaunch shows text | 8s |
| `write_max_length.yaml` | 140 chars shows "remaining 0"; the 141st keystroke is dropped | 6s |
| `write_empty_blocked.yaml` | save button is disabled on empty input | 4s |
| `streak.yaml` | 7 consecutive days produces "7 day streak" with all dots filled | 25s |
| `streak_break.yaml` | skipped day shortens the streak appropriately | 15s |
| `edit_past.yaml` | calendar → past day → edit modal → text updated after navigating back | 12s |
| `delete_entry.yaml` | delete confirmation → entry gone from history | 8s |
| `history_calendar.yaml` | month navigation; Sunday red, Saturday blue weekday coloring | 10s |
| `history_timeline.yaml` | tab switch shows same data in reverse-chronological list | 6s |
| `theme_switch.yaml` | system / light / dark switch updates background color | 8s |
| `lock_toggle.yaml` | lock ON → backgrounded → foregrounded → LockScreen → unlock | 10s |
| `reminder_toggle.yaml` | reminder ON exposes time picker; OFF hides it | 6s |
| `import_flow.yaml` | import → conflict modal → overwrite → result summary | 12s |

Total expected wall time: ~2 min sequential.

### Selector strategy

Maestro flows select **only by `testID`**. Text selectors are forbidden because:

1. The app is Japanese-only today but i18n is a foreseeable refactor.
2. Theme switches change rendered text color; some Maestro text matchers are sensitive to contrast (rare but observed).
3. Icon-button text is often absent — `testID` is the only sane handle.

Components currently expose `testID` for:

- `remaining-count`
- `entry-input`
- `streak-dot-${i}`

To be added during implementation (one-line each, no behavior change):

- save button (`save-button`)
- history tab labels (`history-tab-calendar`, `history-tab-timeline`)
- settings rows (`settings-row-lock`, `settings-row-reminder`, `settings-row-theme-${value}`)
- import/export buttons (`settings-export`, `settings-import`)
- import-conflict modal strategies (`import-strategy-${value}`)
- lock screen authenticate button (`lock-authenticate`)

### Time fixation

Streak flows pin the device clock via `setDate` so "today" doesn't drift across runs:

```yaml
- runFlow:
    when:
      platform: ANDROID
    file: _helpers/set_date.yaml
    env:
      DATE: "2026-05-15"
```

Implementation calls `adb shell date` and `adb shell settings put global auto_time 0` once at suite start. Restored automatically because `clearState` resets only app data, not device settings — the helper has an explicit teardown flow.

## Stability controls

| Risk | Mitigation |
|---|---|
| Test-to-test state leakage | `clearState: true` in every flow header |
| Text matcher fragility | testID-only selectors; CI lint to forbid text selectors (optional follow-up) |
| Animation timing | `waitForAnimationToEnd` after every navigation; explicit `assertVisible` before tap |
| Calendar's "today" drifting | `setDate` to a fixed value in streak flows |
| Maestro CLI drift | `.maestro/.maestro-version` pins the version; `scripts/e2e/run.sh` refuses to run a mismatched local install |
| AVD configuration drift | `scripts/e2e/README.md` documents the AVD profile (API 35, Pixel 7, 4 GB RAM, cold-boot snapshot) — committing an `.avd` archive is out of scope but considered for a later pass |

## Performance controls

| Optimization | Effect |
|---|---|
| Reuse the E2E APK across runs (`run.sh --skip-build`) | Skips Gradle assembly (~30s saved) |
| AVD cold-boot snapshot | First foreground after wipe: 5–8s instead of 30s |
| `clearState` (pm clear) instead of reinstall | ~200ms per flow vs ~5s for reinstall |
| Physical USB device support | `run.sh --target <device-id>` bypasses emulator entirely |
| Hermes (already RN default) | JS parse + startup time already minimal |

### `scripts/e2e/run.sh`

```text
Usage: ./scripts/e2e/run.sh [options] [flow-glob]

Options:
  --skip-build         Use the existing APK; assume it's E2E-flavored
  --target <id>        ADB device serial (default: first adb device)
  --no-clear           Skip `pm clear` between flows (debugging only)

Examples:
  ./scripts/e2e/run.sh                              # full suite
  ./scripts/e2e/run.sh write_today                  # one flow
  ./scripts/e2e/run.sh --skip-build streak          # fast iteration
```

The script's responsibilities:

1. Verify `EXPO_PUBLIC_E2E` is set if building.
2. Build a release APK if not `--skip-build`, install on the target device.
3. Run `maestro test` against the chosen flow glob.
4. Propagate the maestro exit code.

### Expected wall time

| Scenario | Time |
|---|---|
| Cold first run (full build + cold AVD) | 6–8 min |
| Warm full suite (`--skip-build`, snapshot AVD) | **2–3 min** |
| Single flow during debugging | 15–20s |

## Risks

- **Maestro CLI breaking changes.** Mitigated by pinning the version; revisit on major releases.
- **DocumentPicker mock divergence from production.** The `IS_E2E` branch bypasses real File I/O. The unit tests in `services/importService.test.ts` already validate the JSON parsing pipeline against the same fixture shape; E2E only validates the UI conflict-modal flow downstream.
- **`setDate` fights real device users.** Only the suite runner sets it; on a physical device, the helper restores `auto_time = 1` on teardown.
- **`testID` proliferation.** Mitigated by adding them lazily during E2E implementation, not pre-emptively across the codebase.

## Implementation order (for the future plan)

1. `e2eMode.ts` + service branches + missing `testID` attributes.
2. `.maestro/config.yaml` + first flow (`write_today.yaml`) — validate the loop end-to-end before scaling.
3. `scripts/e2e/run.sh` + README.
4. Remaining flows, easiest-first (write/edit/delete → history → settings → lock → import).
5. Fixed-time helper for streak flows.

This ordering means the suite is usable after step 2 and grows monotonically. Each step is independently committable.
