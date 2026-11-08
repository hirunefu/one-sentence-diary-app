---
status: accepted
---

# Keep where a first-time user is in a device-local first-run state

There are no onboarding screens. Until the first Entry, Home explains itself in place (a line under the Streak's dots and one about where Entries are kept); the save that makes the first Entry says 「1日目。明日も書くと、つながります。」; and on that first day Home offers a Reminder once. None of this may reach someone who already uses the app, including after they delete every Entry, and the offer must never become a standing ask. The Entries alone cannot say that, so one versioned AsyncStorage key, `firstRun.state`, holds `new`, `started {day, offer: open | closed}` or `returning`, as app state rather than diary data (out of SQLite, the settings and the export JSON, like the celebration ledger in ADR 0001).

- Seeded when missing or unreadable: `returning` if there are Entries (an update, Q19), otherwise `new`. A missed offer is preferred to a false one.
- `new` → `started` at a first-time user's first save on Home that creates today's Entry on a day with no break before it (after a lapse the offer would read as a reproach). A Backfill or an import never starts it.
- The offer closes when answered (設定する closes it before Android's dialog, so an interrupted dialog never brings it back), when Reminders are already on, or when this app's permission request was refused for good. Unanswered, it stays for the rest of that day only. The confirmation that 設定する shows lasts for the day the answer came (an answer to Android's screen after midnight is confirmed on the new day), or less when Home is left.
- `started` → `returning` at the first launch or the midnight after that day; `new` → `returning` once an Entry was written on an earlier day (someone who writes only from History never starts a first day on Home, but already uses the app); any state → `returning` on an import that brings Entries.
- The explanatory lines follow the Entries (shown while there is none) for as long as the user is not `returning`; 「1日目」 shows while that day's Entry is the only one.

## Considered options

- **Derive everything from the Entries.** A returning user who deletes every Entry would be greeted as new, and an updater whose only Entry is today's would get 「1日目」 and the offer.
- **Keep the offer until it is answered.** Turns "once" into a question at the start of every visit, interrupting the task it is meant to support.
- **A flag in the settings.** The settings are the user's choices and are what the Settings screen shows; this is the app's own memory.

## Consequences

- First-run state is per device: clearing app data on a phone with Entries seeds `returning`; on an empty phone it is a first-time user again.
- On a small phone at a large font size, the lines give way to what the Entry field needs, by measured height (privacy line over the dot line, the offer over 「1日目」). A line that gave way stays away while the window, the lines that want to show and what the field needs stay the same, and is decided again when any of them changes.
- The rules are pinned by `src/contexts/EntriesContext.test.tsx`, `src/repositories/firstRunRepository.test.ts` and `src/screens/HomeScreen.firstRun.test.tsx`.
