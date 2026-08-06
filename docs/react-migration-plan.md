# ACC React migration: Phase 1 audit and plan

This document records the behavior of the Vanilla JavaScript application before
the React implementation begins. The legacy app remains intact on this branch.

## Current feature inventory

### Application shell and navigation

- A mobile-first, single-page interface with no URL routing.
- Personal and Work modes, persisted independently and switched from the header.
- Active and Archived list scopes. Searching by name spans both scopes and shows
  an Archived chip when appropriate.
- People are sorted first by the fixed tag-color palette and then by most recent
  entry/creation activity. The three largest non-zero absolute balances are
  visually highlighted when more than three records are visible.
- Expandable person cards, animated balances, responsive bottom sheets, browser
  back-button modal/card closing, a floating add button, and startup splash.
- Touch interactions: swipe left to delete; swipe right to archive/unarchive;
  600 ms long press for edit/export/archive actions; delete confirmation and a
  five-second Undo toast.

### People and teams

- Add, edit, delete, archive, and unarchive a person. Work mode calls the same
  entity a Team in parts of the UI but stores the same shape.
- Required name (maximum 80 characters), optional tag label (maximum 20), and
  one of eight tag colors or no color.
- Currency is selected only at creation and is intentionally fixed afterward:
  EUR, USD, GEL, or CAD.
- Creating a person immediately opens the first-entry form.
- A duplicate name matching an archived record offers to unarchive it instead.
- Unarchiving a salaried Work record resets its payroll anchor to today and its
  accrued baseline to the amount already paid, excluding archived time from new
  salary debt.

### Entries, balances, and Work categories

- Add, edit, and delete entries with an integer amount of at least 1, date,
  optional comment, and direction `Gave` or `Received`.
- `Gave` contributes positively and `Received` negatively. Amount input and all
  calculations are rounded to whole units with `Math.round`.
- Personal open balance includes every entry.
- Work open balance includes only salary entries and `gift` entries. A salary
  entry is detected by `category === "salary"` or a legacy comment beginning
  `[Salary]`; `gift` requires `category === "gift"`.
- In Work mode, entry kind is Salary or Other (`gift`). Salary forces direction
  to `Gave`; Other permits both directions.
- Cards display total Gave, total Received, net, entry count, chronological
  entry details, and currency-specific balance. Note that these card totals use
  all entries, while Work open balance uses only salary/gift entries.

### Payroll and payment schedules

- Optional Work-only salary setup: monthly salary, start date, optional end
  date, pay period from 1 to 52 weeks, salary currency, and payment delay.
- Delay choices are none, 2 weeks after period end, 4 weeks after period end,
  or the first day of the next month.
- Period amount is `round(monthly * periodWeeks / 4)`. Completed periods are
  `floor(daysSince(anchor) / (periodWeeks * 7))`; `daysSince` excludes the start
  date and clamps negative dates to zero.
- Accrued salary counts completed periods plus `salaryAccruedBaseline`. Paid
  salary is the sum of salary-category/legacy `[Salary]` entries of type `Gave`.
- Current target count uses `days <= 0 ? 1 : ceil(days / periodDays)` so the
  exact period boundary does not double-count.
- Overdue is limited to matured completed-period shortfall and appears only
  after the earliest unpaid pay date is more than one day past. Upcoming is the
  remainder of the current target; when fully paid it forecasts one next period.
- “Due soon” is a gentle emphasis at three days or fewer until the next pay date.
- Salary end dates cap calculation at the end date and suppress future forecasts.
- Changing the pay-period length banks the old accrued amount and anchors the
  new cadence today; history is not retroactively recalculated.
- Sync Pay Date optionally adds a one-time salary payment, then sets the accrued
  baseline to all salary paid and starts a new cycle at the chosen anchor date.
- Work cards show Payroll (overdue/upcoming/paid/next pay) and net Other panels.

### Search, statistics, and summaries

- Live, case-insensitive name search with escaped match highlighting.
- Statistics scopes: Active, Archived, and All.
- Per-currency balance totals (kept separate, never converted), six-month Gave
  versus Received chart, entry count, rounded average entry, most active person,
  and top five absolute balances.
- Work statistics add payroll totals per currency, overdue people, and upcoming
  pay-date groups. Existing grouping totals use the first row's currency, a
  behavior that should be characterized before changing it.

### Import, export, and backup

- Full JSON backup contains `{ personal, work, exportDate }`; filename is
  `acc-backup-YYYY-MM-DD.json`. Both modes are always included.
- Restore validates that `personal` and `work` are arrays, then offers Merge or
  Replace. Replace overwrites both modes after flattening legacy stages.
- Merge matches records by stable ID. Only ID-less records fall back to person
  (`name|note`) or entry (`type|amount|date|comment`) fingerprints. Existing
  non-empty scalar values win; missing fields are filled; incoming objects are
  cloned; incoming `archived: true` wins; entries are merged independently.
- Backup metadata records last backup timestamp and count. The Data & Backup
  screen shows estimated storage, record/entry counts, last backup, backup count,
  and a Safe/Warning/Risk heuristic.
- Print-based PDF export supports one current-mode person or all Personal and
  Work records, with mode prefixes in the combined export.

### Theme and PWA behavior

- Theme cycles System -> Dark -> Light -> System and reacts to OS-theme changes
  while System is selected.
- Manifest name/short name is ACC, portrait standalone display, finance/business/
  productivity categories, dark theme colors, and the existing 167, 180, 192,
  512, maskable 192/512, and 1024 icons.
- Android install uses `beforeinstallprompt`; iOS receives Add to Home Screen
  instructions. Prompts appear after three seconds and are skipped in standalone.
- The service worker precaches the full shell and icons. Navigation and shell
  requests are network-first with offline cache fallback; runtime assets are
  stale-while-revalidate/cache fallback.
- A waiting worker displays an update sheet with Export, Cancel, and Update.
  Update sends `SKIP_WAITING`, waits for `controllerchange`, then reloads. The
  registration uses `updateViaCache: "none"` and explicitly checks for updates.

## Current persisted data model

The database is IndexedDB `acc-db`, schema version 1, with a keyless object store
named `kv`. Values are stored by explicit string key. Personal and Work arrays
are JSON-stringified; mode and theme are plain strings; backup metadata is also
JSON-stringified.

```ts
type AppMode = 'personal' | 'work';
type ThemeMode = 'system' | 'dark' | 'light';
type Currency = 'EUR' | 'USD' | 'GEL' | 'CAD';
type EntryType = 'Gave' | 'Received';
type EntryCategory = 'salary' | 'gift';
type SalaryPayDelayMode = 'none' | '2weeks' | '4weeks' | 'firstOfMonth';

interface LegacyEntry {
  id?: string;
  amount: number | string;
  type: EntryType;
  date: string; // YYYY-MM-DD
  comment?: string;
  category?: EntryCategory;
  [unknownLegacyField: string]: unknown;
}

interface LegacyStage {
  currency?: Currency;
  closed?: boolean;
  entries?: LegacyEntry[];
  [unknownLegacyField: string]: unknown;
}

interface LegacyPerson {
  id?: string;
  name?: string;
  note?: string;
  currency?: Currency;
  tagLabel?: string;
  tagColor?: string;
  archived?: boolean;
  expanded?: boolean; // persisted UI state, reset to false at load/import
  createdAt?: string;
  entries?: LegacyEntry[];
  stages?: LegacyStage[]; // older representation, flattened on load/import
  salaryAmount?: number | string;
  salaryStartDate?: string;
  salaryEndDate?: string;
  salaryPayPeriodWeeks?: number | string;
  salaryPayDay?: number | string; // older alias for period weeks
  salaryPayDelayMode?: SalaryPayDelayMode;
  salaryCurrency?: Currency;
  salaryPeriodAnchorDate?: string;
  salaryAccruedBaseline?: number | string;
  [unknownLegacyField: string]: unknown;
}

interface ExportedBackupData {
  personal: LegacyPerson[];
  work: LegacyPerson[];
  exportDate?: string;
}
```

| Key | Stored value |
| --- | --- |
| `accounts-personal-v1` | JSON string containing `LegacyPerson[]` |
| `accounts-work-v1` | JSON string containing `LegacyPerson[]` |
| `accounts-mode-v1` | `personal` or `work` |
| `accounts-theme` | `system`, `dark`, or `light` |
| `acc_backup_meta_v1` | JSON string `{ lastBackup: string, count: number }` |
| `acc_debug` | Optional string `"1"` |

The historical stages migration selects the open stage's currency, otherwise the
last stage's currency, otherwise EUR; copies all entries; sorts them descending
by date; writes flat `entries`; and removes `stages`. Unknown fields otherwise
survive object spreading and therefore must not be discarded by migration.

## Proposed React architecture

```text
src/
  app/              App shell, providers, startup and error boundaries
  components/       Shared buttons, sheets, prompts, form controls
  features/
    people/         Lists, cards, archive/search/tag workflows
    transactions/   Entry forms, lists, swipe/undo actions
    salary/         Payroll settings, panels, schedule sync
    statistics/     Scope summaries, charts, payroll overview
    import-export/  Backup schemas, merge/replace, PDF/print
    settings/       Mode, theme, install/update UI
  hooks/            Gestures, media/theme, PWA lifecycle hooks
  store/            Zustand UI/session stores and mode-scoped actions
  db/               Dexie schema, legacy reader, migrations, repositories
  services/         Backup download, print export, update coordinator
  types/            Explicit domain, persistence, backup, and stats types
  utils/            Dates, currency formatting, identifiers
  domain/           Pure balance, salary, overdue, merge, and stats functions
  styles/           Ported tokens and component styles preserving identity
```

Zustand should hold the active mode, loaded mode data, search/filter state, and
transient UI actions. Dexie repositories remain the persistence boundary. React
Hook Form plus Zod owns person, salary, entry, and import validation. Domain
functions accept data and an explicit reference date/mode, avoiding globals,
React, DOM access, and implicit clocks in tests. Routing is unnecessary for the
current single-screen app; modal/back-stack behavior can use history explicitly.

## IndexedDB preservation and migration strategy

1. Open the existing database with Dexie using the exact name `acc-db` and retain
   version 1's `kv` store. Do not delete, clear, or rename it.
2. In an initial compatibility release, read all legacy keys in place and decode
   JSON with a tolerant Zod `safeParse` pipeline. Invalid data must produce a
   recoverable error/export path, never silently overwrite with an empty array.
3. Snapshot the raw legacy values before transformation. Store migration metadata
   and a backup in additive keys/tables in a later Dexie version, in one transaction.
4. Normalize Personal and Work independently. Preserve unknown fields, IDs,
   currencies, entry direction/category, comments, dates, salary baselines, and
   anchors. Apply the stages flattening algorithm exactly once and support the
   `salaryPayDay` alias without mutating the original until verification succeeds.
5. Validate normalized results, compare person/entry counts and deterministic
   balance/payroll checksums per mode, then mark migration complete. Only after
   successful verification may the React app use normalized records.
6. Prefer a dual-read/compatible-write transition: keep the four legacy keys
   current for at least the parity phase, or write the normalized canonical shape
   back to those same keys atomically. This allows rollback to the Vanilla app.
7. Treat migration as idempotent and resumable. Reopening, refresh during upgrade,
   and partially populated databases must not duplicate people or entries.
8. Preserve `acc_backup_meta_v1`, active mode, and theme. Keep Personal and Work
   repository methods separate so actions cannot accidentally write the other key.
9. Reuse the existing import format initially. Add an optional `schemaVersion`
   only backward-compatibly; continue accepting unversioned backups.
10. Before any schema cleanup, offer/export a full legacy-compatible backup and
    verify migration tests in real browsers, including an installed upgrade.

## Highest-risk parity areas

- Salary date boundaries: local dates, DST, exact pay-date behavior, one-day grace,
  earliest unpaid-period selection, end-date capping, and delayed pay dates.
- Period changes, schedule sync, and salaried unarchive deliberately bank/reset
  different values; combining those flows would change debt.
- Work balances exclude uncategorized entries while legacy `[Salary]` comments are
  still salary. A stricter new schema could silently change totals.
- Legacy stages and permissive unknown fields require lossless, idempotent handling.
- Whole-unit rounding is a business rule despite the UI showing two decimals.
- Mixed currencies are separate totals; no conversion is performed.
- Merge semantics intentionally protect existing non-empty values and avoid
  fingerprint matching when stable IDs exist.
- IndexedDB upgrade transactions, JSON strings inside a KV store, failed parses,
  and browser storage eviction demand explicit rollback/error handling.
- Service-worker replacement can strand an installed PWA on old chunks if HTML,
  hashed assets, waiting-worker consent, and cache cleanup are not coordinated.
- iOS lacks the Android install event and has distinct storage/update behavior.
- Swipe/long-press/back-button/modals and accessibility focus restoration can
  regress during the DOM-to-React transition.
- Existing source text displays signs of encoding damage in some environments;
  migration must preserve stored user text byte-for-byte and source files as UTF-8.

## Phased implementation plan

1. **Phase 1 — analysis:** keep this audited inventory/data model, capture golden
   calculation fixtures and representative legacy backups, and make no runtime changes.
2. **Phase 2 — foundation:** scaffold strict React/TypeScript/Vite; ESLint,
   Prettier, Vitest, testing-library, and vite-plugin-pwa; copy icons unchanged;
   port the shell/theme tokens and establish build checks. Do not add routing
   unless a concrete workflow requires it.
3. **Phase 3 — domain and persistence:** define strict types and Zod schemas;
   extract pure balance/salary/date/merge functions; configure Dexie against
   `acc-db`; implement transactional, idempotent legacy migration and Zustand
   mode-scoped stores.
4. **Phase 4 — people parity:** Personal/Work switch, theme, active/archive/search,
   sorting/tags, person CRUD, duplicate archived handling, cards, gestures, and undo.
5. **Phase 5 — financial parity:** entry CRUD/categories, balances, payroll setup,
   delay schedules, overdue/upcoming logic, period-change banking, sync/unarchive
   resets, gifts, and all statistics scopes.
6. **Phase 6 — portability and PWA:** compatible merge/replace import, JSON backup,
   print/PDF flows, storage/backup metadata, install prompts, offline behavior,
   waiting-update notification, cache rollover, iOS and Android installed testing.
7. **Phase 7 — verification:** unit tests for balances, schedules, overdue edges,
   mode isolation, merge/replace, and migration; integration/e2e parity fixtures;
   accessibility/responsive checks; production build; migration/rollback runbook.

After each implementation phase: run formatting/lint/typecheck/tests/production
build, compare against golden fixtures and the legacy app, fix failures, commit a
small coherent change, and document completed work plus remaining parity gaps.

