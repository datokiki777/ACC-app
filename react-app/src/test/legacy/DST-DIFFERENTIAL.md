# Europe/Berlin DST differential result

Phase 3A initially used timezone-independent calendar ordinals. Phase 3A.1 compared that version
with the actual legacy `daysSince` and `daysUntil` functions under `TZ=Europe/Berlin` and found the
following behavioral differences around the spring clock change:

| Fixed input                                               |                               Legacy output |                              Initial TypeScript output | Exact reason                                                                        |
| --------------------------------------------------------- | ------------------------------------------: | -----------------------------------------------------: | ----------------------------------------------------------------------------------- |
| `daysSince("2026-03-28", 2026-03-30)`                     |                                           1 |                                                      2 | The two local midnights are 47 hours apart; legacy floors `47 / 24`.                |
| `daysUntil("2026-04-04", 2026-03-28)`                     |                                           6 |                                                      7 | The local-midnight interval is 167 hours; legacy floors `167 / 24`.                 |
| Weekly salary starting `2026-03-28`, checked `2026-04-04` | `days=6`, `completedPeriods=0`, `accrued=0` | `days=7`, `completedPeriods=1`, `accrued=periodAmount` | The preceding 167-hour interval has not reached seven legacy elapsed 24-hour units. |

The autumn transition does not create a corresponding extra completed day because legacy uses
`Math.floor`: for example, `2026-10-24` through `2026-10-26` is 49 elapsed hours and still floors
to two days.

The current TypeScript domain implementation now preserves these legacy outputs. The full fixed
date matrix and 250 seeded schedules match. Switching to calendar ordinals is not part of the
initial migration and would require explicit product approval as a payroll behavior change.
