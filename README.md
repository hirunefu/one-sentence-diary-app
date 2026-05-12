# 一口日記 (One-Sentence Diary)

A minimal, offline-first diary app for jotting down a single sentence (up to 140 characters) per day. Built with Expo / React Native and TypeScript.

All data is stored locally on the device via SQLite. No accounts, no servers, no cloud sync.

## Features

- **One entry per day** — text capped at 140 characters, single-line input
- **Streak tracking** — current and longest consecutive-day streaks
- **Two history views** — calendar (Japanese locale, weekend coloring) and timeline
- **Local reminders** — daily notification that fires only on days you haven't written yet
- **App lock** — optional biometric unlock (Face ID / Touch ID / fingerprint) via `expo-local-authentication`
- **Light / Dark / System** theme
- **JSON export / import** — full backup and restore with duplicate-resolution strategies (skip / overwrite / keep-newer)
- **100% local** — no analytics, no telemetry, no network calls

## Tech stack

- React Native 0.81 + React 19
- Expo SDK 54 (new architecture enabled)
- TypeScript 5.9
- `expo-sqlite` for persistence
- `expo-notifications`, `expo-local-authentication`, `expo-document-picker`, `expo-file-system`, `expo-sharing`
- `@react-navigation/*` v7
- `react-native-calendars`
- Jest + `@testing-library/react-native` for tests (`better-sqlite3` powers the SQLite layer under test)

## Project layout

```
src/
  components/      Reusable UI (EntryInput, StreakDisplay, ImportConflictModal, ...)
  contexts/        SettingsContext, EntriesContext, AuthLockContext
  db/              SQLite database + migrations
  navigation/      RootNavigator (stack + tabs)
  repositories/    entriesRepository, settingsRepository
  screens/         Home, History, Settings, EntryEditorModal, LockScreen
  services/        importService, exportService, notifications, localAuth
  theme/           colors / radius / spacing / typography
  types/           shared types (Entry, Settings, ...)
  utils/           date, streak, text helpers
docs/superpowers/  design specs and implementation plans
```

## Getting started

Requires Node.js 20+ and the Expo CLI.

```sh
npm install
npm start        # Expo dev server (Metro bundler)
npm test         # Jest test suite
```

## Build

### Local native build (development)

`expo run:*` runs `expo prebuild` to generate the gitignored `ios/` and `android/` projects, then compiles and installs the app on a connected simulator/emulator or device.

Prerequisites:
- iOS — macOS with Xcode 16+ and the iOS Simulator (or a registered physical device)
- Android — Android Studio with SDK Platform 35+ and an emulator or device with USB debugging enabled

```sh
npm run ios       # build & install on iOS simulator
npm run android   # build & install on Android emulator
```

### Cloud build with EAS

Distribution builds are produced via [Expo Application Services](https://docs.expo.dev/build/introduction/). Three profiles are defined in `eas.json`:

| Profile       | Output                  | Distribution        |
| ------------- | ----------------------- | ------------------- |
| `development` | Android APK + dev client | Internal            |
| `preview`     | Android APK             | Internal            |
| `production`  | Android App Bundle (AAB) | Play Store / Ad-hoc |

Install the CLI and authenticate once:

```sh
npm install -g eas-cli
eas login
```

Build:

```sh
eas build --profile development --platform android
eas build --profile preview     --platform android
eas build --profile production  --platform android
eas build --profile production  --platform ios       # uses EAS defaults
```

iOS-specific options aren't pinned in `eas.json`, so iOS builds fall back to EAS defaults; configure signing/credentials via `eas credentials` if needed. Bump `expo.version` in `app.json` before each production build.

## App icon

The app icon is regenerated from SVG via `@resvg/resvg-js`:

```sh
npm run icons
```

## Open-source license attribution

The app ships an in-app "Open-source licenses" screen (Settings → このアプリについて → オープンソースライセンス) listing every bundled package along with its license text. The data lives in `src/assets/licenses.json` and is regenerated from `node_modules` after dependency changes:

```sh
npm install         # ensure node_modules is up to date
npm run licenses    # writes src/assets/licenses.json
```

`src/assets/licenses.json` is committed so the asset is available at build time even on machines without `node_modules`.

## Install via Obtainium

[Obtainium](https://github.com/ImranR98/Obtainium) installs and tracks updates for Android apps directly from their source (GitHub Releases, F-Droid, etc.), bypassing the Play Store. Signed APKs are published to [GitHub Releases](https://github.com/hirunefu/one-sentence-diary-app/releases) by the [`Build & release Android APK`](.github/workflows/release-apk.yml) workflow whenever a `v*` tag is pushed.

### One-tap setup

Open this link on your Android device (Obtainium must be installed first):

```
obtainium://app/%7B%22id%22%3A%22com.hirunefu.onesentencediary%22%2C%22url%22%3A%22https%3A%2F%2Fgithub.com%2Fhirunefu%2Fone-sentence-diary-app%22%2C%22author%22%3A%22hirunefu%22%2C%22name%22%3A%22%E4%B8%80%E5%8F%A3%E6%97%A5%E8%A8%98%22%7D
```

### Manual setup

1. Install [Obtainium](https://github.com/ImranR98/Obtainium/releases) on your Android device.
2. Open Obtainium → tap **+** → paste:
   ```
   https://github.com/hirunefu/one-sentence-diary-app
   ```
3. Tap **Add**. Obtainium picks up the latest `one-sentence-diary-v*.apk` automatically.
4. Tap **Install**.

Subsequent releases (new tags pushed to this repo) appear in Obtainium's update list automatically.

### Verifying the signing certificate

Every release is signed with the same keystore. Pin or compare against the SHA-256 fingerprint to detect tampering:

| Field | Value |
| --- | --- |
| DN | `CN=one-sentence-diary, O=hirunefu, C=JP` |
| SHA-256 | `3E:D5:CC:6B:4E:3F:4A:E4:36:AC:F4:BF:E7:B4:45:AB:9C:BD:2A:B6:2E:DA:FE:F4:00:E8:2B:25:23:99:4C:41` |

Verify locally with:

```sh
$ANDROID_HOME/build-tools/<latest>/apksigner verify --print-certs one-sentence-diary-v*.apk
```

## License

MIT. See [LICENSE](./LICENSE).
