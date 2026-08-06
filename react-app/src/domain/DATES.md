# Legacy date interpretation

ACC dates are calendar values in `YYYY-MM-DD` form, not instants in UTC. Domain functions parse
the year, month, and day explicitly and calculate differences with calendar-day ordinals. They do
not pass stored date strings through `Date.parse`, so a date cannot move backward or forward when
the device timezone changes.

Reference dates are explicit `Date` arguments. Their local year, month, and day select the
calendar date, matching the legacy UI's local-day behavior. Tests construct reference dates with
the numeric `new Date(year, monthIndex, day)` form and include daylight-saving boundaries.

The legacy implementation subtracted local-midnight `Date` objects, which could count a spring
DST day as 23 hours and floor it incorrectly. The extracted implementation preserves the intended
calendar-day salary rule while eliminating that environment-dependent shift, as required by the
Phase 3A date-safety constraint.
