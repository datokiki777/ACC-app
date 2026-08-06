# Legacy date interpretation

ACC dates are calendar values in `YYYY-MM-DD` form, not instants in UTC. Domain functions parse
the year, month, and day explicitly and construct local-midnight dates, matching the legacy
application. They do not pass stored date strings through `Date.parse`, so parsing itself cannot
move a date backward or forward.

Reference dates are explicit `Date` arguments. Their local year, month, and day select the
calendar date, matching the legacy UI's local-day behavior. Tests construct reference dates with
the numeric `new Date(year, monthIndex, day)` form and include daylight-saving boundaries.

The legacy implementation subtracts local-midnight `Date` objects and floors elapsed milliseconds
by 24 hours. In Europe/Berlin, crossing the spring DST transition therefore counts one fewer day
until enough elapsed hours accumulate; the autumn transition does not add a day because the result
is floored. Phase 3A.1 differential testing confirmed this observable behavior, so the initial
migration preserves it. Changing to timezone-independent calendar ordinals remains a possible
future bug fix, but requires explicit approval because it changes payroll boundary dates.
