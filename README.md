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
npm start        # Expo dev server
npm run ios      # build & run on iOS simulator
npm run android  # build & run on Android emulator
npm test         # Jest test suite
```

## App icon

The app icon is regenerated from SVG via `@resvg/resvg-js`:

```sh
npm run icons
```

## License

MIT. See [LICENSE](./LICENSE).
