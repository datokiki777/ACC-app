# Database boundary

Phase 2 intentionally contains no IndexedDB or Dexie code. The existing `acc-db`
database is not opened, upgraded, cleared, or written by this application shell.
The compatibility layer described in the migration plan begins only after Phase 3 approval.
