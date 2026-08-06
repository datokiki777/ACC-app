# Phase 3A legacy parity notes

The source of truth for this extraction is the Vanilla implementation in `js/03-utils.js`,
`js/05-forms.js`, `js/06-actions.js`, `js/09-export.js`, and `js/11-stats.js`.

## Reproduced rules

- Every amount passes through `Number` and `Math.round`; non-finite values become zero.
- `Gave` is positive and `Received` is negative. Person totals sum both independently.
- Personal open balance includes all entries. Work open balance includes only salary and gift
  entries. Salary means `category === "salary"` or a comment beginning exactly at character zero
  with `[Salary]`, case-insensitively. Gift means only `category === "gift"`.
- Salary period weeks are clamped to 1–52. Period amount is
  `round(monthly * periodWeeks / 4)`. Accrual counts completed periods plus the banked baseline.
- Paid salary includes only `Gave` salary entries. The exact boundary uses `ceil` for current
  targets and `floor` for completed periods. Overdue requires the earliest unpaid pay date to be
  more than one day past. Upcoming retains the remaining current/forecast target.
- Pay delays are none, 14 days, 28 days, or the first day of the following month. End dates cap
  accrual and suppress the future-pay countdown.
- Period changes bank old accrued salary and anchor the new cadence to the explicit reference
  date. Sync optionally adds a salary payment, then sets baseline to total salary paid and changes
  the anchor. Salaried unarchive sets baseline to paid salary and anchors today.
- Statistics keep currencies separate, include all entries in monthly/average activity metrics,
  and use mode-specific open balances for balance totals and rankings.
- Backup merge prefers stable IDs. Fingerprints apply only to ID-less records. Existing non-empty
  scalar values win; missing values are filled; incoming objects/arrays are cloned; incoming
  `archived: true` wins; distinct stable IDs never collapse.
- Stage migration chooses the open-stage currency, otherwise the last-stage currency, otherwise
  EUR; copies entries; sorts newest first; and removes `stages`. Unknown person/entry fields are
  retained. Unknown stage fields are retained additively as `legacyStageFields` so validation does
  not destroy unrecognized legacy content.

## Ambiguities retained or isolated

- The Work card's displayed Gave/Received totals include all entries even though its open balance
  filters to salary/gift. The extracted functions keep these as separate operations.
- Statistics monthly totals and average entry include uncategorized Work entries, matching legacy
  behavior even though Work balance excludes them.
- Pay-date groups can contain multiple currencies; the legacy renderer labels a group total with
  the first row's currency. No conversion or cross-currency aggregation has been introduced.
- Legacy import fingerprints depend on `note`, although the current person form does not expose a
  note field. The field remains supported for older backups.
- Legacy local-midnight subtraction is DST-sensitive. Differential tests confirmed the spring
  transition can delay a completed-period boundary by one elapsed day. `DATES.md` documents why
  the initial migration retains this behavior pending explicit approval for a future correction.
