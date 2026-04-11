// ==================== PDF, JSON Export/Import, Menus ====================

function buildPdfHtml(people, title = "ACC Export") {
  const isLight = document.body.classList.contains("light-theme");
  const bg = isLight ? "#f4f7fb" : "#13294d";
  const card = isLight ? "#ffffff" : "#1b3158";
  const text = isLight ? "#1d2a3a" : "#eef4ff";
  const muted = isLight ? "#6e7c8f" : "#a7b6cf";
  const line = isLight ? "#e4eaf2" : "#466087";
  const green = isLight ? "#1f9d55" : "#35c26b";
  const red = isLight ? "#d64545" : "#ff6b6b";
  const gray = isLight ? "#7b8794" : "#9aaac4";
  const colorFor = val => Number(val) > 0 ? green : Number(val) < 0 ? red : gray;
  let html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><style>body{margin:0;padding:24px;background:${bg};color:${text};font-family:system-ui,-apple-system,sans-serif;font-size:14px;}h1{font-size:22px;font-weight:900;margin:0 0 6px;}.sub{color:${muted};font-size:13px;margin-bottom:24px;}.person{background:${card};border-radius:16px;border:1px solid ${line};padding:16px;margin-bottom:20px;page-break-inside:avoid;}.person-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;padding-bottom:10px;border-bottom:1px solid ${line};}.person-name{font-size:18px;font-weight:900;}.balance-pill{font-size:16px;font-weight:900;padding:6px 14px;border-radius:999px;background:rgba(0,0,0,0.06);}.section-title{font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:.04em;color:${muted};margin:14px 0 8px;}.stage{border:1px solid ${line};border-radius:12px;margin-bottom:10px;overflow:hidden;}.stage-head{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:rgba(0,0,0,0.03);}.stage-name{font-weight:800;font-size:15px;}.stage-tag{font-size:11px;font-weight:700;padding:3px 8px;border-radius:999px;background:rgba(0,0,0,0.08);color:${muted};margin-left:8px;}.entry{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;border-top:1px solid ${line};}.entry-type{font-weight:700;font-size:13px;}.entry-right{text-align:right;}.entry-amount{font-weight:900;font-size:14px;}.entry-meta{font-size:12px;color:${muted};margin-top:2px;}.no-entries{padding:10px 14px;font-size:13px;color:${muted};}.totals{display:flex;gap:16px;flex-wrap:wrap;padding:10px 14px;background:rgba(0,0,0,0.03);font-size:13px;color:${muted};border-top:1px solid ${line};}.totals span{font-weight:700;}.grand-total{display:flex;justify-content:space-between;padding:12px 14px;border-top:2px solid ${line};margin-top:4px;}.grand-label{font-weight:800;font-size:15px;}.grand-value{font-weight:900;font-size:16px;}@media print{body{background:#fff;}}</style></head><body><h1>${escapeHtml(title)}</h1><div class="sub">Generated ${new Date().toLocaleDateString("ka-GE")} • ${people.length} person(s)</div>`;
  people.forEach(person => {
    const openStages = (person.stages || []).filter(s => !s.closed);
    const closedStages = (person.stages || []).filter(s => s.closed);
    const openBal = personOpenBalance(person);
    html += `<div class="person"><div class="person-header"><div class="person-name">${escapeHtml(person.name)}</div><div class="balance-pill" style="color:${colorFor(openBal)}">${formatMoney(openBal)}</div></div>`;
    if (person.note) html += `<div style="color:${muted};font-size:13px;margin-bottom:10px;">${escapeHtml(person.note)}</div>`;
    const renderStageGroup = (stages, label) => {
      if (!stages.length) return "";
      let out = `<div class="section-title">${label}</div>`;
      stages.forEach(stage => {
        const bal = stageBalance(stage);
        const cur = stageCurrency(stage);
        const totals = stageTotals(stage);
        out += `<div class="stage"><div class="stage-head"><div><span class="stage-name">${escapeHtml(stage.name)}</span><span class="stage-tag">${stage.closed ? "Closed" : "Open"}</span></div><div style="font-weight:900;color:${colorFor(bal)}">${formatMoney(bal, cur)}</div></div>`;
        if ((stage.entries || []).length) {
          stage.entries.forEach(entry => {
            const ef = entry.type === "Gave" ? entry.amount : -entry.amount;
            out += `<div class="entry"><div><div class="entry-type" style="color:${entry.type === "Gave" ? green : red}">${entry.type}</div>${entry.comment ? `<div style="font-size:12px;color:${muted};margin-top:2px;">${escapeHtml(entry.comment)}</div>` : ""}</div><div class="entry-right"><div class="entry-amount" style="color:${colorFor(ef)}">${normalizeAmount(entry.amount)}${currencyLabel(cur)}</div>Out <span>${normalizeAmount(totals.gave)}${currencyLabel(cur)}</span> &nbsp; In <span>${normalizeAmount(totals.received)}${currencyLabel(cur)}</span> &nbsp;<div class="entry-meta">${formatDate(entry.date)}</div></div></div>`;
          });
          out += `<div class="totals">Out <span>${totals.gave.toFixed(2)}${currencyLabel(cur)}</span> &nbsp; In <span>${totals.received.toFixed(2)}${currencyLabel(cur)}</span> &nbsp; Net <span style="color:${colorFor(bal)}">${formatMoney(bal, cur)}</span></div>`;
        } else out += `<div class="no-entries">No entries</div>`;
        out += `</div>`;
      });
      return out;
    };
    html += renderStageGroup(openStages, "Open Stage");
    html += renderStageGroup(closedStages, "Closed Stages");
    html += `<div class="grand-total"><div class="grand-label">Total Balance</div><div class="grand-value" style="color:${colorFor(openBal)}">${formatMoney(openBal)}</div></div></div>`;
  });
  html += `</body></html>`;
  return html;
}

function triggerPdfPrint(html) {
  const win = window.open("", "_blank");
  if (!win) { confirmDelete("Pop-up blocked. Please allow pop-ups and try again.", () => {}, false, "OK"); return; }
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

async function exportAllPdf() {
  const allData = await getAllModeData();
  const personalPeople = allData.personal || [];
  const workPeople = allData.work || [];
  if (!personalPeople.length && !workPeople.length) { confirmDelete("No data to export.", () => {}, false, "OK"); return; }
  const combinedPeople = [
    ...personalPeople.map(p => ({ ...p, name: `[Personal] ${p.name || "Unnamed"}` })),
    ...workPeople.map(p => ({ ...p, name: `[Work] ${p.name || "Unnamed"}` }))
  ];
  triggerPdfPrint(buildPdfHtml(combinedPeople, "ACC Full Export"));
}

function exportPersonPdf(personId) {
  const person = findPerson(personId);
  if (!person) return;
  triggerPdfPrint(buildPdfHtml([person]));
}

async function exportJsonBackup() {
  const allData = await getAllModeData();
  const backup = { personal: allData.personal, work: allData.work, exportDate: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `acc-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// Menu functions that open modals
function openTransferActionsModal() {
  openModal("Data Transfer", `
    <div class="quick-actions-row quick-actions-row-2" style="margin-bottom:10px;">
      <button type="button" class="secondary-btn" id="transferImportBtn">⬇️ Import JSON</button>
      <button type="button" class="primary-btn" id="transferExportBtn">⬆️ Export JSON</button>
    </div>
    <div class="quick-actions-row quick-actions-row-2" style="margin-bottom:10px;">
      <button type="button" class="secondary-btn" id="transferExportAllPdfBtn" style="min-height:48px;border-radius:14px;font-weight:800;font-size:14px;">📄 Export All PDF</button>
      <button type="button" class="primary-btn" id="transferExportPersonPdfBtn" style="min-height:48px;border-radius:14px;font-weight:800;font-size:14px;">👤 Export Person PDF</button>
    </div>
    <div class="quick-actions-row" style="display:grid;grid-template-columns:1fr;">
      <button type="button" class="danger-btn" id="transferCancelBtn" style="min-height:48px;border-radius:14px;font-weight:800;font-size:15px;">Cancel</button>
    </div>`, () => {
    const importBtn = document.getElementById("transferImportBtn");
    const cancelBtn = document.getElementById("transferCancelBtn");
    const exportBtn = document.getElementById("transferExportBtn");
    const exportAllPdfBtn = document.getElementById("transferExportAllPdfBtn");
    const exportPersonPdfBtn = document.getElementById("transferExportPersonPdfBtn");
    if (cancelBtn) cancelBtn.onclick = closeModal;
    if (exportBtn) exportBtn.onclick = () => { exportJsonBackup(); closeModal(); };
    if (exportAllPdfBtn) exportAllPdfBtn.onclick = () => { closeModal(); exportAllPdf(); };
    if (exportPersonPdfBtn) exportPersonPdfBtn.onclick = () => { closeModal(); openChoosePersonForPdf(); };
    if (importBtn) importBtn.onclick = () => { closeModal(); confirmDelete("Importing a file will replace your current data. Continue?", () => importFile.click(), false, "Import"); };
  });
}

function openChoosePersonForPdf() {
  openModal("Choose a Person", state.people.map(person => `<div class="sheet-item choose-person-pdf" data-person-id="${person.id}"><span class="sheet-item-title">${escapeHtml(person.name)}</span><span class="sheet-item-sub">${formatMoney(personOpenBalance(person))}</span></div>`).join(""), () => {
    document.querySelectorAll(".choose-person-pdf").forEach(btn => { btn.onclick = () => { const personId = btn.dataset.personId; closeModal(); exportPersonPdf(personId); }; });
  });
}

function openMainAddMenu() {
  const isWork = state.mode === "work";
  openModal("Add New", `<div class="sheet-list"><div class="sheet-item" id="quickAddPerson"><span class="sheet-item-title">${isWork ? "Add Team" : "Add Person"}</span><span class="sheet-item-sub">${isWork ? "Create a new team" : "Create a new person"}</span></div><div class="sheet-item" id="quickAddEntry"><span class="sheet-item-title">Add Entry</span><span class="sheet-item-sub">${isWork ? "Choose a team" : "Choose a person"}</span></div></div>`, () => {
    const addPersonBtn = document.getElementById("quickAddPerson");
    const addEntryBtn = document.getElementById("quickAddEntry");
    if (addPersonBtn) addPersonBtn.onclick = () => openPersonForm();
    if (addEntryBtn) addEntryBtn.onclick = () => { if (!state.people.length) alert(isWork ? "Add a team first." : "Add a person first."); else openChoosePersonForEntry(); };
  });
}

function openEditStagesPanel() {
  openModal("Edit", `<div class="empty-state mini-empty">Long press any card to edit. Swipe left to delete.</div>`, () => {});
}

function personTotalBalanceByCurrency(person) {
  const totals = {};
  (person.stages || []).forEach(stage => { const currency = stageCurrency(stage); const balance = stageBalance(stage); totals[currency] = (totals[currency] || 0) + balance; });
  return totals;
}

function openOverviewPersonDetail(personId) {
  const person = findPerson(personId);
  if (!person) return;
  const openStage = findOpenStage(person.id);
  const closedStages = (person.stages || []).filter(stage => stage.closed);
  const closedSummary = closedStagesSummary(person);
  const openEntriesExpanded = !!state.overviewOpenExpanded[person.id];
  openModal(`${escapeHtml(person.name)} — Details`, `
    <div class="inline-note overview-summary-grid">
      <div class="overview-summary-row"><span class="overview-summary-label">Total Balance</span><span class="overview-summary-value">${(() => { const totals = personTotalBalanceByCurrency(person); const ordered = getOrderedCurrencyEntries(totals); if (!ordered.length) return `<span class="gray">${formatMoney(0, "EUR")}</span>`; if (ordered.length === 1) { const [currency, amount] = ordered[0]; return `<span class="${balanceClass(amount)}">${formatMoney(amount, currency)}</span>`; } return `<span class="overview-summary-value-stack">${ordered.map(([currency, amount]) => `<span class="${balanceClass(amount)}">${formatMoney(amount, currency)}</span>`).join("")}</span>`; })()}</span></div>
      <div class="overview-summary-row"><span class="overview-summary-label">Open Stage</span><span class="overview-summary-value">${openStage ? escapeHtml(openStage.name) : "None"}</span></div>
      <div class="overview-summary-row"><span class="overview-summary-label overview-summary-label-with-badge"><span>Closed Stages</span><span class="mini-count-badge">${closedSummary.count}</span></span><span class="overview-summary-value"><span class="${balanceClass(closedSummary.balance)}">${formatMoney(closedSummary.balance, closedSummary.currency)}</span></span></div>
    </div>
    ${openStage ? `<div class="open-stage-mini-card swipe-card" data-action-type="stage" data-person-id="${person.id}" data-stage-id="${openStage.id}" data-source="overview"><div class="swipe-content"><div class="open-stage-mini-inner" data-toggle-open-entries="${person.id}"><div class="open-stage-mini-left"><div class="stage-title-row"><span class="open-stage-mini-title">${escapeHtml(openStage.name)}</span></div></div><div class="open-stage-mini-right"><div class="open-stage-mini-balance ${balanceClass(stageBalance(openStage))}">${formatMoney(stageBalance(openStage), stageCurrency(openStage))}</div><span class="closed-stage-chev ${openEntriesExpanded ? "open" : ""}">›</span></div></div></div></div>${openEntriesExpanded ? `<div class="entry-list" style="margin-top:8px;">${(openStage.entries || []).length ? openStage.entries.map(entry => renderEntry(person.id, openStage.id, openStage, entry, "overview")).join("") : `<div class="empty-state mini-empty">No entries</div>`}</div>` : ""}` : ""}
    ${closedStages.length ? `<div class="section-label overview-closed-label">Closed Stages</div><div class="sheet-list">${closedStages.map(stage => { const isExpanded = !!state.overviewClosedExpanded[stage.id]; const entries = stage.entries || []; const dates = entries.map(e => e.date).filter(Boolean).slice().sort(); const fromDate = dates.length ? formatDate(dates[0]) : ""; const toDate = dates.length ? formatDate(dates[dates.length - 1]) : ""; const dateRange = fromDate && toDate ? `${fromDate} → ${toDate}` : ""; return `<div class="sheet-item closed-stage-item swipe-card" data-action-type="stage" data-person-id="${person.id}" data-stage-id="${stage.id}" data-source="overview"><div class="swipe-content"><div class="closed-stage-head" data-toggle-closed-stage="${stage.id}"><div class="closed-stage-col closed-stage-left"><div class="stage-title-row"><span class="sheet-item-title">${escapeHtml(stage.name)}</span></div></div><div class="closed-stage-col closed-stage-right"><span class="closed-stage-date-range">${escapeHtml(dateRange)}</span><span class="closed-stage-chev ${isExpanded ? "open" : ""}">›</span></div></div>${isExpanded ? `<div class="closed-stage-body"><div class="closed-stage-summary-card"><span class="closed-stage-summary-label">Entry ${entries.length}</span><span class="closed-stage-summary-total ${balanceClass(stageBalance(stage))}">${formatMoney(stageBalance(stage), stageCurrency(stage))}</span></div>${entries.length ? entries.map(entry => renderEntry(person.id, stage.id, stage, entry, "overview")).join("") : `<div class="empty-state mini-empty">No entries</div>`}</div>` : ""}</div></div>`; }).join("")}</div>` : ""}`, () => {
    document.querySelectorAll("[data-toggle-open-entries]").forEach(btn => { btn.onclick = e => { if (state.longPressTriggered || e.target.closest(".swipe-delete-action")) return; state.overviewOpenExpanded[person.id] = !state.overviewOpenExpanded[person.id]; openOverviewPersonDetail(personId); }; });
    document.querySelectorAll("[data-toggle-closed-stage]").forEach(btn => { btn.onclick = () => { if (state.longPressTriggered) return; const stageId = btn.dataset.toggleClosedStage; state.overviewClosedExpanded[stageId] = !state.overviewClosedExpanded[stageId]; openOverviewPersonDetail(personId); }; });
    document.querySelectorAll(".swipe-card").forEach(card => setupActionCard(card));
    closeAllSwipes();
  });
}

function openChoosePersonForEntry() {
  openModal("Choose a Person", state.people.map(person => `<div class="sheet-item choose-person-entry" data-person-id="${person.id}"><span class="sheet-item-title">${escapeHtml(person.name)}</span><span class="sheet-item-sub">Balance: ${formatMoney(personOpenBalance(person))}</span></div>`).join(""), () => {
    document.querySelectorAll(".choose-person-entry").forEach(btn => { btn.onclick = () => { const personId = btn.dataset.personId; const openStage = findOpenStage(personId); if (openStage) openEntryForm(personId, openStage.id); else openStageForm(personId, null, true); }; });
  });
}