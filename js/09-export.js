// ==================== 09-export.js ====================
// PDF, JSON Export/Import, Transfer Menu

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