// ==================== 11-stats.js ====================
// Statistics Modal (Scope Switch, Overview, Monthly Chart, Insights, Top Balances)

function getPeopleForStatsScope(people, scope) {
  if (scope === "archived") return people.filter(p => p.archived);
  if (scope === "all") return people;
  return people.filter(p => !p.archived);
}

function getBalanceTotalsForScope(people) {
  const totals = {};
  people.forEach(person => {
    const currency = personCurrency(person);
    totals[currency] = (totals[currency] || 0) + personOpenBalance(person);
  });
  return totals;
}

function getMonthlyBreakdown(people, monthsBack = 6) {
  const now = new Date();
  const buckets = [];
  const bucketIndex = {};

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    bucketIndex[key] = buckets.length;
    buckets.push({ key, label: d.toLocaleDateString("en-US", { month: "short" }), gave: 0, received: 0 });
  }

  people.forEach(person => {
    (person.entries || []).forEach(entry => {
      if (!entry.date) return;
      const key = String(entry.date).slice(0, 7);
      const idx = bucketIndex[key];
      if (idx === undefined) return;
      const amount = normalizeAmount(entry.amount);
      if (entry.type === "Gave") buckets[idx].gave += amount;
      else if (entry.type === "Received") buckets[idx].received += amount;
    });
  });

  return buckets;
}

function getTopBalances(people, limit = 5) {
  return people
    .map(p => ({ id: p.id, name: p.name, balance: personOpenBalance(p), currency: personCurrency(p) }))
    .filter(p => Math.abs(p.balance) > 0.000001)
    .sort((a, b) => Math.abs(b.balance) - Math.abs(a.balance))
    .slice(0, limit);
}

function getEntryInsights(people) {
  let count = 0;
  let sum = 0;
  const perPersonCount = {};

  people.forEach(person => {
    (person.entries || []).forEach(entry => {
      count++;
      sum += normalizeAmount(entry.amount);
      perPersonCount[person.id] = (perPersonCount[person.id] || 0) + 1;
    });
  });

  let mostActive = null;
  let mostActiveCount = 0;
  people.forEach(person => {
    const c = perPersonCount[person.id] || 0;
    if (c > mostActiveCount) { mostActiveCount = c; mostActive = person; }
  });

  return {
    count,
    average: count ? Math.round(sum / count) : 0,
    mostActiveName: mostActive ? mostActive.name : null,
    mostActiveCount
  };
}

// Payroll overview: red = overdue (a pay date already passed, unpaid),
// yellow = upcoming (what's owed at the next pay date for each person).
function getPayrollOverview(people) {
  const rows = [];

  people.forEach(person => {
    const config = getPersonSalaryConfig(person);
    if (!config) return;
    const summary = personSalarySummary(person);
    rows.push({
      name: person.name,
      due: summary.due,
      upcoming: summary.upcoming,
      nextPayDate: summary.nextPayDate,
      daysUntilNextPay: summary.daysUntilNextPay,
      paySoon: summary.paySoon,
      ended: summary.ended,
      currency: summary.currency
    });
  });

  if (!rows.length) return null;

  const totalsByCurrency = {};
  rows.forEach(r => {
    if (!totalsByCurrency[r.currency]) totalsByCurrency[r.currency] = { due: 0, upcoming: 0 };
    totalsByCurrency[r.currency].due += r.due;
    totalsByCurrency[r.currency].upcoming += r.upcoming;
  });

  const dateGroups = {};
  rows.forEach(r => {
    if (r.ended || !r.nextPayDate || r.upcoming <= 0) return;
    if (!dateGroups[r.nextPayDate]) dateGroups[r.nextPayDate] = [];
    dateGroups[r.nextPayDate].push(r);
  });

  const payDates = Object.keys(dateGroups)
    .sort()
    .map(date => ({
      date,
      rows: dateGroups[date].sort((a, b) => b.upcoming - a.upcoming)
    }));

  const overdueRows = rows.filter(r => r.due > 0).sort((a, b) => b.due - a.due);

  return { totalsByCurrency, payDates, overdueRows };
}

function buildPayrollOverviewHtml(people) {
  const overview = getPayrollOverview(people);
  if (!overview) return "";

  const currencyEntries = getOrderedCurrencyEntries(overview.totalsByCurrency);
  const hasAny = currencyEntries.some(([, t]) => t.due > 0 || t.upcoming > 0);

  const totalsHtml = `
    <div class="stats-payroll-totals">
      ${hasAny ? currencyEntries.map(([currency, t]) => `
        ${t.due > 0 ? `
          <div class="salary-pill-item">
            <span class="salary-pill-label">Overdue</span>
            <div class="salary-due-pill due">${formatMoneyPlain(t.due, currency)}</div>
          </div>
        ` : ""}
        ${t.upcoming > 0 ? `
          <div class="salary-pill-item">
            <span class="salary-pill-label">Upcoming</span>
            <div class="salary-due-pill upcoming">${formatMoneyPlain(t.upcoming, currency)}</div>
          </div>
        ` : ""}
      `).join("") : `<div class="salary-due-pill clear">All Clear</div>`}
    </div>
  `;

  const overdueHtml = overview.overdueRows.length ? `
    <div class="stats-payroll-subtitle">Overdue</div>
    <div class="stats-payroll-list">
      ${overview.overdueRows.map(r => `
        <div class="stats-payroll-row">
          <span class="stats-payroll-name">${escapeHtml(r.name)}</span>
          <span class="stats-payroll-amount due">${formatMoneyPlain(r.due, r.currency)}</span>
        </div>
      `).join("")}
    </div>
  ` : "";

  const datesHtml = overview.payDates.length ? `
    <div class="stats-payroll-subtitle">Next Pay Dates</div>
    <div class="stats-payroll-list">
      ${overview.payDates.map(pd => {
        const daysUntilNextPay = pd.rows[0].daysUntilNextPay;
        const paySoon = pd.rows.some(r => r.paySoon);
        const groupTotal = pd.rows.reduce((sum, r) => sum + r.upcoming, 0);
        const names = pd.rows.map(r => escapeHtml(r.name)).join(", ");
        const daysLabel = daysUntilNextPay <= 0 ? "Due now" : `in ${daysUntilNextPay}d`;
        return `
          <div class="stats-payroll-row stats-payroll-date-row">
            <div class="stats-payroll-date-col">
              <span class="stats-payroll-date">${formatDate(pd.date)}</span>
              <span class="stats-payroll-names">${names}</span>
            </div>
            <div class="stats-payroll-date-side">
              <span class="stats-payroll-amount upcoming ${paySoon ? "pay-soon" : ""}">${formatMoneyPlain(groupTotal, pd.rows[0].currency)}</span>
              <span class="stats-payroll-days ${paySoon ? "pay-soon" : ""}">${daysLabel}</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  ` : "";

  return `
    <div class="stats-section-title">💼 Payroll</div>
    <div class="stats-payroll-card">
      ${totalsHtml}
      ${overdueHtml}
      ${datesHtml}
    </div>
  `;
}

function buildStatsBodyHtml(scope) {
  const allPeople = state.people || [];
  const people = getPeopleForStatsScope(allPeople, scope);
  const totals = getBalanceTotalsForScope(people);
  const totalsOrdered = getOrderedCurrencyEntries(totals);
  const monthly = getMonthlyBreakdown(people, 6);
  const maxMonthly = Math.max(1, ...monthly.map(m => Math.max(m.gave, m.received)));
  const topBalances = getTopBalances(people, 5);
  const insights = getEntryInsights(people);
  const primaryCurrency = totalsOrdered[0]?.[0] || "EUR";
  const payrollHtml = state.mode === "work" ? buildPayrollOverviewHtml(people) : "";

  const scopeLabel = scope === "archived" ? "Archived" : scope === "all" ? "All" : (state.mode === "work" ? "Team" : "People");

  const balanceValueHtml = totalsOrdered.length
    ? totalsOrdered.map(([cur, amt]) => `<span class="${balanceClass(amt)}">${formatMoney(amt, cur)}</span>`).join(" ")
    : `<span class="gray">${formatMoney(0, "EUR")}</span>`;

  const monthlyHtml = `
    <div class="stats-section-title">Last 6 Months</div>
    <div class="stats-month-chart">
      ${monthly.map(m => `
        <div class="stats-month-col">
          <div class="stats-month-bars">
            <div class="stats-bar-give" style="height:${Math.round((m.gave / maxMonthly) * 100)}%" title="Gave ${m.gave}"></div>
            <div class="stats-bar-receive" style="height:${Math.round((m.received / maxMonthly) * 100)}%" title="Received ${m.received}"></div>
          </div>
          <div class="stats-month-label">${m.label}</div>
        </div>
      `).join("")}
    </div>
    <div class="stats-legend">
      <span><span class="stats-legend-dot stats-legend-give"></span>Gave</span>
      <span><span class="stats-legend-dot stats-legend-receive"></span>Received</span>
    </div>
  `;

  const insightsHtml = insights.count ? `
    <div class="stats-section-title">Quick Insights</div>
    <div class="stats-insights-grid">
      <div class="stats-insight-card">
        <div class="stats-insight-value">${insights.count}</div>
        <div class="stats-insight-label">Entries</div>
      </div>
      <div class="stats-insight-card">
        <div class="stats-insight-value">${formatMoneyPlain(insights.average, primaryCurrency)}</div>
        <div class="stats-insight-label">Avg Entry</div>
      </div>
      <div class="stats-insight-card">
        <div class="stats-insight-value stats-insight-value-name">${insights.mostActiveName ? escapeHtml(insights.mostActiveName) : "—"}</div>
        <div class="stats-insight-label">Most Active</div>
      </div>
    </div>
  ` : "";

  const topBalancesHtml = topBalances.length ? `
    <div class="stats-section-title">Top Balances</div>
    <div class="stats-top-list">
      ${topBalances.map((m, idx) => `
        <div class="stats-top-item ${idx === 0 ? "stats-top-item-first" : ""}">
          <span class="stats-top-name">${escapeHtml(m.name)}</span>
          <span class="stats-top-balance ${balanceClass(m.balance)}">${formatMoney(m.balance, m.currency)}</span>
        </div>
      `).join("")}
    </div>
  ` : `<div class="stats-section-title">Top Balances</div><div class="empty-state mini-empty">No open balances</div>`;

  return `
    <div class="stats-scope-switch">
      <button type="button" class="stats-scope-btn ${scope === "active" ? "active" : ""}" data-stats-scope="active">Active</button>
      <button type="button" class="stats-scope-btn ${scope === "archived" ? "active" : ""}" data-stats-scope="archived">Archived</button>
      <button type="button" class="stats-scope-btn ${scope === "all" ? "active" : ""}" data-stats-scope="all">All</button>
    </div>
    <div class="stats-modal-body" id="statsModalBody">
      <div class="stats-overview-cards">
        <div class="stats-overview-card">
          <div class="stats-overview-label">${scopeLabel}</div>
          <div class="stats-overview-value">${people.length}</div>
        </div>
        <div class="stats-overview-card">
          <div class="stats-overview-label">Balance</div>
          <div class="stats-overview-value stats-overview-value-money">${balanceValueHtml}</div>
        </div>
      </div>
      ${payrollHtml}
      ${monthlyHtml}
      ${insightsHtml}
      ${topBalancesHtml}
    </div>
  `;
}

function bindStatsScopeButtons() {
  document.querySelectorAll("[data-stats-scope]").forEach(btn => {
    btn.onclick = () => renderStatsScope(btn.dataset.statsScope || "active");
  });
}

function renderStatsScope(scope) {
  modalContent.innerHTML = buildStatsBodyHtml(scope);
  bindStatsScopeButtons();
  const body = document.getElementById("statsModalBody");
  if (body) {
    body.style.opacity = "0";
    body.style.transform = "translateY(4px)";
    requestAnimationFrame(() => {
      body.style.transition = "opacity 0.2s ease, transform 0.2s ease";
      body.style.opacity = "1";
      body.style.transform = "translateY(0)";
    });
  }
}

function openStatsModal() {
  openModal("📊 Statistics", buildStatsBodyHtml("active"), () => {
    bindStatsScopeButtons();
  });
}
