---
status: accepted
---

# Remember what has been celebrated in a device-local ledger

A Milestone or a new Longest streak is told once per stretch (a maximal run of consecutive days that each have an Entry): again after a real break, but never again after an Entry is deleted and written back, a restart or a lock, an import, or the update that introduced celebrations. The Entries alone cannot express "already told" — a deletion leaves no trace, and the first launch after the update must be silent — so what has been told is kept in one versioned AsyncStorage key, `celebration.ledger`, as app state rather than diary data. It stays out of SQLite, the settings and the export JSON. A remembered stretch that loses days lives on in its oldest surviving part; a gap in the middle leaves the part after it as a new stretch. Whenever the ledger is missing or unreadable, and whenever an import brings back or extends the Streak, the current state is acknowledged instead of celebrated: a missed celebration is preferred to a repeated or false one. Seeding, and every import, also remembers each stretch already there (or brought by the import) as told, so a Backfill or a Streak repair that later joins one to the Streak tells nothing it had reached. "Told" means seen — the full-screen moment came to rest in the foreground or was closed, or, for a Longest streak on a day that is not a Milestone, its line was shown on Home in the foreground.

## Considered options

- **Derive everything from the Entries.** Tells a Milestone again after a delete and rewrite, and would celebrate every existing Streak on the update.
- **Identify a stretch by its exact start date, or by its newest part.** Deleting the first day or today's Entry would make an already told Milestone tellable again.
- **A table in SQLite.** Needs a schema migration and mixes app state into the diary data that is exported and imported.
- **Carry the ledger in the backup JSON.** Changes the published backup format, and older backups lack it, so imports would have to be acknowledged anyway.

## Consequences

- Celebration memory is per device: a Streak restored on a new phone counts as already told.
- Clearing app data, an unreadable ledger or a version bump re-seeds silently, so a celebration that was due but not yet seen can be missed.
- The ledger keeps at most 8 stretches, dropping those that carry nothing first; a Streak repair that rejoins a stretch dropped long ago could tell its Milestone again.
- The Entries (SQLite) and the ledger (AsyncStorage) are not written in one transaction; a failed ledger save is only logged.
- Changing the identity rule or the import rule means a new ADR that supersedes this one and a bump of the ledger version.

The rules are pinned by `src/services/celebration.test.ts` and `src/repositories/celebrationRepository.test.ts`.
