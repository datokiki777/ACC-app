// ==================== 03-utils.js ====================
// Helper Functions, Finders, Currency Helpers, Gesture Helpers

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function todayStr() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDate(dateStr) {
  if (!dateStr) return "No date";
  const parts = dateStr.split("-");
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}.${parts[1]}.${parts[0]}`;
}

function currencyLabel(currency) {
  const c = currency || "EUR";
  if (c === "EUR") return "€";
  if (c === "USD") return "$";
  if (c === "GEL") return "₾";
  if (c === "CAD") return "C$";
  return "€";
}

function normalizeAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return 0;
  return Math.round(num);
}

function formatMoney(value, currency = "EUR") {
  const num = normalizeAmount(value);
  const sign = num > 0 ? "+" : "";
  return `${sign}${num}${currencyLabel(currency)}`;
}

function formatMoneyPlain(value, currency = "EUR") {
  const num = normalizeAmount(value);
  const sign = num < 0 ? "-" : "";
  return `${sign}${Math.abs(num)}${currencyLabel(currency)}`;
}

function parseLocalDate(dateStr) {
  if (!dateStr) return null;
  const parts = String(dateStr).split("-").map(Number);
  if (parts.length !== 3 || parts.some(n => !Number.isFinite(n))) return null;
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function daysInclusive(startDateStr, endDate = new Date()) {
  const start = parseLocalDate(startDateStr);
  if (!start) return 0;
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  const diff = Math.floor((end - start) / 86400000);
  return Math.max(0, diff + 1);
}

function daysSince(startDateStr, endDate = new Date()) {
  const start = parseLocalDate(startDateStr);
  if (!start) return 0;
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  return Math.max(0, Math.floor((end - start) / 86400000));
}

function addDays(dateStr, days) {
  const date = parseLocalDate(dateStr);
  if (!date) return "";
  date.setDate(date.getDate() + days);
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0")
  ].join("-");
}

function minDateString(firstDateStr, secondDate = new Date()) {
  const first = parseLocalDate(firstDateStr);
  if (!first) return secondDate;
  const second = new Date(secondDate.getFullYear(), secondDate.getMonth(), secondDate.getDate());
  return first < second ? first : second;
}

// Signed day count to a target date: positive = still ahead, 0 = today,
// negative = already past. Unlike daysSince, this is not clamped to zero,
// so it can flag an overdue pay date.
function daysUntil(dateStr, fromDate = new Date()) {
  const target = parseLocalDate(dateStr);
  if (!target) return 0;
  const from = new Date(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  return Math.floor((target - from) / 86400000);
}

// Below this many days to the next pay date, the forecast is flagged as
// "pay soon" (used for a gentle emphasis — no longer turns anything red;
// only a pay date that's actually passed does that, see SALARY_GRACE_DAYS).
const SALARY_PAY_SOON_DAYS = 3;

// After a pay date passes, wait this many extra days before flagging the
// amount as overdue (red). Missing a pay date by a single day is normal
// slack, not a real problem yet.
const SALARY_GRACE_DAYS = 1;

// Shifts a period's pay date forward relative to when the period's work
// ends, for salaries that aren't paid out immediately.
function computeSalaryPayDate(periodEndDateStr, payDelayMode) {
  if (payDelayMode === "2weeks") return addDays(periodEndDateStr, 14);
  if (payDelayMode === "4weeks") return addDays(periodEndDateStr, 28);
  if (payDelayMode === "firstOfMonth") {
    const d = parseLocalDate(periodEndDateStr);
    if (!d) return periodEndDateStr;
    const next = new Date(d.getFullYear(), d.getMonth() + 1, 1);
    return [
      next.getFullYear(),
      String(next.getMonth() + 1).padStart(2, "0"),
      "01"
    ].join("-");
  }
  return periodEndDateStr;
}

function balanceClass(value) {
  if (value > 0) return "green";
  if (value < 0) return "red";
  return "gray";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function highlightMatch(text, query) {
  const safeText = escapeHtml(text || "");
  const q = String(query || "").trim();
  if (!q) return safeText;
  const escapedQuery = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(`(${escapedQuery})`, "ig");
  return safeText.replace(re, '<mark class="search-mark">$1</mark>');
}

function entryEffect(type, amount) {
  const n = normalizeAmount(amount);
  if (type === "Gave") return n;
  if (type === "Received") return -n;
  return 0;
}

function typeLabelClass(type) {
  return type === "Gave" ? "green" : "red";
}

function isWorkMode() {
  return state.mode === "work";
}

function entryTypeVisual(type) {
  if (!isWorkMode()) return escapeHtml(type);
  return type === "Gave"
    ? '<span class="entry-type-money-icon money-green">€</span>'
    : '<span class="entry-type-money-icon money-red">€</span>';
}

function entryTypeToggleContent(type, active) {
  if (!isWorkMode()) {
    if (type === "Gave") {
      return `<span class="type-toggle-icon">↗</span><span>Gave</span>`;
    }
    return `<span class="type-toggle-icon">↘</span><span>Received</span>`;
  }
  if (type === "Gave") {
    return `<span class="type-toggle-money money-green ${active ? "active" : ""}">€</span>`;
  }
  return `<span class="type-toggle-money money-red ${active ? "active" : ""}">€</span>`;
}

// ---- Person / Entries (flat model — no stages) ----

function personCurrency(person) {
  return person?.currency || "EUR";
}

// One-time migration: old { person.stages: [{ currency, closed, entries }] }
// becomes { person.currency, person.entries: [...] } (all stage entries flattened
// and merged chronologically). Already-migrated people pass through unchanged.
function migratePersonToFlatEntries(person) {
  if (!person) return person;
  if (!Array.isArray(person.stages)) {
    return {
      ...person,
      currency: person.currency || "EUR",
      entries: Array.isArray(person.entries) ? person.entries : []
    };
  }
  const stages = person.stages;
  const openStage = stages.find(s => !s.closed);
  const currency = (openStage && openStage.currency) || (stages.length ? stages[stages.length - 1].currency : null) || "EUR";
  const entries = [];
  stages.forEach(stage => {
    (stage.entries || []).forEach(entry => entries.push({ ...entry }));
  });
  entries.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  const migrated = { ...person, currency, entries };
  delete migrated.stages;
  return migrated;
}

function isSalaryEntry(entry) {
  return entry?.category === "salary" || /^\[Salary\]/i.test(String(entry?.comment || ""));
}

function isGiftEntry(entry) {
  return entry?.category === "gift";
}

function personTotals(person) {
  let gave = 0, received = 0;
  (person.entries || []).forEach(entry => {
    const amount = normalizeAmount(entry.amount);
    if (entry.type === "Gave") gave += amount;
    if (entry.type === "Received") received += amount;
  });
  return { gave, received, balance: gave - received };
}

// Kept as `personOpenBalance` for call-site compatibility. In Work mode this
// only totals salary/gift categorized entries (matches prior stage behavior);
// in Personal mode it totals every entry.
function personOpenBalance(person) {
  const entries = person?.entries || [];
  if (isWorkMode()) {
    return entries.reduce((sum, entry) => {
      if (!isSalaryEntry(entry) && !isGiftEntry(entry)) return sum;
      return sum + entryEffect(entry.type, entry.amount);
    }, 0);
  }
  return entries.reduce((sum, entry) => sum + entryEffect(entry.type, entry.amount), 0);
}

function getPersonSalaryConfig(person) {
  const monthly = normalizeAmount(person?.salaryAmount || 0);
  const startDate = person?.salaryStartDate || "";
  const endDate = person?.salaryEndDate || "";
  const periodWeeks = Math.min(52, Math.max(1, Number(person?.salaryPayPeriodWeeks || person?.salaryPayDay || 1)));
  if (!monthly || !startDate) return null;
  return {
    monthly,
    startDate,
    endDate,
    periodWeeks,
    // When the pay period changes mid-stream, the new cadence counts forward
    // from the change date instead of retroactively rewriting history — see
    // accruedBaseline below, which banks what had already accrued under the
    // old schedule so it isn't lost in the switch.
    anchorDate: person?.salaryPeriodAnchorDate || startDate,
    accruedBaseline: normalizeAmount(person?.salaryAccruedBaseline || 0),
    currency: person?.salaryCurrency || personCurrency(person),
    payDelayMode: person?.salaryPayDelayMode || "none"
  };
}

function personSalaryPaid(person) {
  return (person?.entries || []).reduce((sum, entry) => {
    if (!isSalaryEntry(entry)) return sum;
    if (entry.type !== "Gave") return sum;
    return sum + normalizeAmount(entry.amount);
  }, 0);
}

function personGiftSummary(person) {
  const currency = person?.salaryCurrency || personCurrency(person);
  const totals = (person?.entries || []).reduce((sum, entry) => {
    if (!isGiftEntry(entry)) return sum;
    const amount = normalizeAmount(entry.amount);
    if (entry.type === "Gave") sum.gave += amount;
    if (entry.type === "Received") sum.received += amount;
    return sum;
  }, { gave: 0, received: 0 });
  return {
    gave: totals.gave,
    received: totals.received,
    total: totals.gave + totals.received,
    net: totals.gave - totals.received,
    currency
  };
}

function personSalarySummary(person, date = new Date()) {
  const config = getPersonSalaryConfig(person);
  if (!config) {
    return { enabled: false, accrued: 0, paid: 0, due: 0, upcoming: 0, currency: "EUR", days: 0, monthly: 0, periodWeeks: 1, periodAmount: 0, completedPeriods: 0, nextPayDate: "", daysUntilNextPay: null, paySoon: false, ended: false, endDate: "" };
  }
  const today = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const ended = !!config.endDate && parseLocalDate(config.endDate) <= today;
  const calculationDate = config.endDate ? minDateString(config.endDate, date) : date;
  const days = daysSince(config.anchorDate, calculationDate);
  const periodDays = config.periodWeeks * 7;
  const completedPeriods = Math.floor(days / periodDays);
  const periodAmount = normalizeAmount(config.monthly * (config.periodWeeks / 4));
  // `accrued` = fully completed periods only. This stays the "what's
  // definitively earned" figure used when banking a baseline on reset
  // (pay-period switch, unarchive) — unaffected by the current in-progress
  // period, so those resets keep landing on due=0 right afterward.
  const accrued = config.accruedBaseline + normalizeAmount(periodAmount * completedPeriods);
  const paid = personSalaryPaid(person);

  // How many period-targets count toward the total as of today: on the
  // exact pay-date day itself this must stay at the same count as the day
  // before (not bump up an extra period) — ceil() handles that boundary
  // correctly where floor()+1 would double-count it.
  const periodsTargeted = days <= 0 ? 1 : Math.ceil(days / periodDays);
  const boundariesReached = completedPeriods;

  const dueTarget = config.accruedBaseline + normalizeAmount(periodAmount * (ended ? boundariesReached : periodsTargeted));
  const remaining = Math.max(0, dueTarget - paid);
  const overdueTarget = config.accruedBaseline + normalizeAmount(periodAmount * boundariesReached);
  const overdueRemaining = Math.max(0, overdueTarget - paid);

  // The forecast pay date for the period currently in progress (used once
  // nothing is overdue, or as the "next" date once backlog is cleared).
  const nextPeriodEndDate = addDays(config.anchorDate, periodsTargeted * periodDays);
  const nextPayDateForecast = computeSalaryPayDate(nextPeriodEndDate, config.payDelayMode);

  // Only genuinely overdue (red) once we're more than the grace window past
  // the pay date of the *earliest* unpaid completed period — using the most
  // recently completed period instead would forget older backlog the
  // instant a new period boundary happens to land on today.
  const periodAmountSafe = periodAmount > 0 ? periodAmount : 1;
  const paidPeriodsCount = Math.floor(paid / periodAmountSafe);
  const earliestUnpaidIndex = Math.min(boundariesReached, paidPeriodsCount + 1);
  const earliestUnpaidPeriodEndDate = addDays(config.anchorDate, earliestUnpaidIndex * periodDays);
  const earliestUnpaidPayDate = computeSalaryPayDate(earliestUnpaidPeriodEndDate, config.payDelayMode);
  const isPastDue = boundariesReached > 0 && overdueRemaining > 0.0001 &&
    daysUntil(earliestUnpaidPayDate, date) < -SALARY_GRACE_DAYS;

  // Red "Overdue" — only the matured (pay-date-passed-plus-grace) portion
  // of the shortfall. Yellow "Upcoming" — whatever's left: the current
  // period's target before its own pay date arrives, or a forward forecast
  // once everything owed so far is covered. Both can be non-zero at once,
  // so overdue pay and the next forecasted pay always show side by side.
  const due = isPastDue ? Math.min(overdueRemaining, remaining) : 0;
  let upcoming = remaining - due;
  if (remaining <= 0 && !ended) upcoming = periodAmount;

  // While there's unpaid backlog that hasn't matured into "overdue" yet,
  // its pay date is the one to show as "next pay". Once it's flagged
  // overdue, the date to show shifts forward to the in-progress forecast.
  const nextPayDate = (overdueRemaining > 0.0001 && !isPastDue) ? earliestUnpaidPayDate : nextPayDateForecast;
  const daysUntilNextPay = ended ? null : daysUntil(nextPayDate, date);
  // Gentle "pay soon" emphasis only — no longer recolors anything red.
  const paySoon = !ended && due <= 0 && daysUntilNextPay !== null && daysUntilNextPay <= SALARY_PAY_SOON_DAYS;
  return {
    enabled: true,
    accrued,
    paid,
    due,
    upcoming,
    currency: config.currency,
    days,
    monthly: config.monthly,
    periodWeeks: config.periodWeeks,
    periodAmount,
    completedPeriods,
    nextPayDate,
    daysUntilNextPay,
    paySoon,
    startDate: config.startDate,
    ended,
    endDate: config.endDate,
    payDelayMode: config.payDelayMode
  };
}

function getOrderedCurrencyEntries(totalsMap) {
  const preferredOrder = ["GEL", "CAD", "USD", "EUR"];
  const entries = Object.entries(totalsMap || {});
  return entries.sort((a, b) => {
    const ai = preferredOrder.indexOf(a[0]);
    const bi = preferredOrder.indexOf(b[0]);
    const aRank = ai === -1 ? 999 : ai;
    const bRank = bi === -1 ? 999 : bi;
    if (aRank !== bRank) return aRank - bRank;
    return a[0].localeCompare(b[0]);
  });
}

function shouldIgnoreGestureTarget(target) {
  return !!target.closest("button, input, textarea, select, a, .swipe-delete-action");
}

function getNearestSwipeCard(target) {
  return target.closest(".swipe-card");
}

function personLastActivityTs(person) {
  const entries = person.entries || [];
  let latest = 0;
  entries.forEach(entry => {
    if (entry.date) {
      const ts = new Date(entry.date).getTime();
      if (!isNaN(ts) && ts > latest) latest = ts;
    }
  });
  if (!latest && person.createdAt) {
    const ts = new Date(person.createdAt).getTime();
    if (!isNaN(ts)) latest = ts;
  }
  return latest;
}

function getTopBalanceIds(people, limit = 3) {
  const ranked = people
    .map(p => ({ id: p.id, abs: Math.abs(personOpenBalance(p)) }))
    .filter(p => p.abs > 0.000001)
    .sort((a, b) => b.abs - a.abs)
    .slice(0, limit);
  // Only worth highlighting when there's a meaningful list to stand out from.
  if (people.length <= limit) return new Set();
  return new Set(ranked.map(p => p.id));
}

function tagColorRank(person) {
  const idx = TAG_COLOR_PALETTE.indexOf(person.tagColor || "");
  return idx === -1 ? TAG_COLOR_PALETTE.length : idx;
}

function getFilteredPeople() {
  const query = state.search.trim().toLowerCase();
  const isSearching = query.length > 0;
  const wantArchived = state.personFilter === "archived";
  return state.people
    .filter(person => isSearching || !!person.archived === wantArchived)
    .filter(person => (person.name || "").toLowerCase().includes(query))
    .sort((a, b) => {
      const colorDiff = tagColorRank(a) - tagColorRank(b);
      if (colorDiff !== 0) return colorDiff;
      return personLastActivityTs(b) - personLastActivityTs(a);
    });
}

// Finders (used across many modules)
function findPerson(personId) { return state.people.find(p => p.id === personId) || null; }
function findEntry(personId, entryId) { const p = findPerson(personId); return p ? (p.entries || []).find(e => e.id === entryId) || null : null; }
