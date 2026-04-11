// ==================== Form Modals (Add/Edit Person, Stage, Entry) ====================

function openPersonForm(personId = null, reopenEditPanel = false) {
  const person = personId ? findPerson(personId) : null;
  openModal(
    person ? (state.mode === "work" ? "Edit Team" : "Edit Person") : (state.mode === "work" ? "Add Team" : "Add Person"),
    `<form class="form" id="personForm"><div class="field"><label for="personName">Name</label><input id="personName" name="name" type="text" maxlength="80" required placeholder="Example: John" value="${person ? escapeHtml(person.name) : ""}"></div><div class="form-actions"><button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button><button type="submit" class="primary-btn">Save</button></div></form>`,
    () => {
      const form = document.getElementById("personForm");
      const cancelBtn = document.getElementById("cancelModalBtn");
      cancelBtn.onclick = () => { if (reopenEditPanel) openEditStagesPanel(); else closeModal(); };
      form.onsubmit = async e => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = String(fd.get("name") || "").trim();
        if (!name) return;
        if (person) {
          person.name = name;
          await saveData();
          render();
          if (reopenEditPanel) openEditStagesPanel(); else closeModal();
        } else {
          const newId = uid();
          state.people.unshift({ id: newId, name, expanded: true, stages: [] });
          await saveData();
          closeModal();
          requestAnimationFrame(() => {
            render();
            requestAnimationFrame(() => {
              const card = document.querySelector(`[data-person-id="${newId}"]`);
              if (card) card.scrollIntoView({ behavior: "smooth", block: "start" });
              openStageForm(newId, null, true);
            });
          });
        }
      };
    }
  );
}

function openStageForm(personId, stageId = null, openEntryAfterSave = false, reopenEditPanel = false, reopenOverviewPersonId = null) {
  const person = findPerson(personId);
  const stage = stageId ? findStage(personId, stageId) : null;
  if (!person) return;
  if (!stage && findOpenStage(personId)) {
    alert("This person already has an open stage.");
    return;
  }
  openModal(
    stage ? "Edit Stage" : "Add Stage",
    `<form class="form" id="stageForm"><div class="field"><label for="stageName">Stage Name</label><input id="stageName" name="name" type="text" maxlength="100" required placeholder="Example: Main Job" value="${stage ? escapeHtml(stage.name) : ""}"></div><div class="field"><label for="stageCurrency">Currency</label><select id="stageCurrency" name="currency"><option value="EUR" ${(stage?.currency || "EUR") === "EUR" ? "selected" : ""}>€</option><option value="USD" ${(stage?.currency || "EUR") === "USD" ? "selected" : ""}>$</option><option value="GEL" ${(stage?.currency || "EUR") === "GEL" ? "selected" : ""}>₾</option><option value="CAD" ${(stage?.currency || "EUR") === "CAD" ? "selected" : ""}>CAD</option></select></div><div class="form-actions"><button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button><button type="submit" class="primary-btn">Save</button></div></form>`,
    () => {
      const form = document.getElementById("stageForm");
      const cancelBtn = document.getElementById("cancelModalBtn");
      cancelBtn.onclick = () => {
        if (reopenOverviewPersonId) openOverviewPersonDetail(reopenOverviewPersonId);
        else if (reopenEditPanel) openEditStagesPanel();
        else closeModal();
      };
      form.onsubmit = async e => {
        e.preventDefault();
        const fd = new FormData(form);
        const name = String(fd.get("name") || "").trim();
        const note = "";
        const currency = String(fd.get("currency") || "EUR");
        const oldCurrency = stage ? stageCurrency(stage) : "EUR";
        const hasEntries = !!(stage && (stage.entries || []).length);
        if (!name) return;
        let savedStageId = stageId;
        if (stage && hasEntries && currency !== oldCurrency) {
          confirmDelete("This stage already has entries. Do you really want to change the currency?", async () => {
            stage.name = name; stage.note = note; stage.currency = currency;
            await saveData(); render();
            if (openEntryAfterSave && savedStageId) openEntryForm(personId, savedStageId, null, reopenOverviewPersonId);
            else if (reopenOverviewPersonId) openOverviewPersonDetail(reopenOverviewPersonId);
            else if (reopenEditPanel) openEditStagesPanel();
            else closeModal();
          }, false, "Change");
          return;
        }
        if (stage) {
          stage.name = name; stage.note = note; stage.currency = currency;
        } else {
          person.expanded = true;
          const newStage = { id: uid(), name, note, currency, createdAt: todayStr(), closed: false, expanded: true, entries: [] };
          person.stages.unshift(newStage);
          savedStageId = newStage.id;
        }
        await saveData();
        if (openEntryAfterSave && savedStageId) openEntryForm(personId, savedStageId);
        else if (reopenEditPanel) openEditStagesPanel();
        else closeModal();
      };
    }
  );
}

function openEntryForm(personId, stageId, entryId = null, reopenOverviewPersonId = null) {
  const stage = findStage(personId, stageId);
  const entry = entryId ? findEntry(personId, stageId, entryId) : null;
  if (!stage) return;
  openModal(
    entry ? "Edit Entry" : "Add Entry",
    `<form class="form" id="entryForm"><div class="field"><label for="entryAmount">Amount</label><input id="entryAmount" name="amount" type="number" step="1" min="1" required placeholder="Example: 50" value="${entry ? escapeHtml(normalizeAmount(entry.amount)) : ""}"></div><div class="field"><label>Type</label><div class="type-toggle-row"><button type="button" class="type-toggle-btn ${(entry?.type || "Gave") === "Gave" ? "active gave" : ""}" data-entry-type="Gave">${entryTypeToggleContent("Gave", (entry?.type || "Gave") === "Gave")}</button><button type="button" class="type-toggle-btn ${(entry?.type || "Gave") === "Received" ? "active received" : ""}" data-entry-type="Received">${entryTypeToggleContent("Received", (entry?.type || "Gave") === "Received")}</button></div><input type="hidden" id="entryType" name="type" value="${entry?.type || "Gave"}"></div><div class="field"><label for="entryDate">Date</label><input id="entryDate" name="date" type="date" value="${entry ? escapeHtml(entry.date) : todayStr()}"></div><div class="field"><label for="entryComment">Comment</label><textarea id="entryComment" name="comment" placeholder="Optional">${entry ? escapeHtml(entry.comment || "") : ""}</textarea></div><div class="form-actions"><button type="button" class="secondary-btn" id="cancelModalBtn">Cancel</button><button type="submit" class="primary-btn">Save</button></div></form>`,
    () => {
      const form = document.getElementById("entryForm");
      const cancelBtn = document.getElementById("cancelModalBtn");
      const typeInput = document.getElementById("entryType");
      const typeButtons = document.querySelectorAll("[data-entry-type]");
      cancelBtn.onclick = () => { if (reopenOverviewPersonId) openOverviewPersonDetail(reopenOverviewPersonId); else closeModal(); };
      typeButtons.forEach(btn => {
        btn.onclick = () => {
          const nextType = btn.dataset.entryType || "Gave";
          typeInput.value = nextType;
          typeButtons.forEach(b => {
            const type = b.dataset.entryType || "Gave";
            const isActive = type === nextType;
            b.classList.remove("active", "gave", "received");
            if (isActive) { b.classList.add("active"); b.classList.add(type === "Gave" ? "gave" : "received"); }
            b.innerHTML = entryTypeToggleContent(type, isActive);
          });
        };
      });
      form.onsubmit = async e => {
        e.preventDefault();
        const fd = new FormData(form);
        const amount = normalizeAmount(fd.get("amount"));
        if (amount < 1) return;
        const type = String(fd.get("type") || "");
        const date = String(fd.get("date") || todayStr());
        const comment = String(fd.get("comment") || "").trim();
        if (!amount || amount <= 0 || !type) return;
        if (entry) {
          entry.amount = amount; entry.type = type; entry.date = date; entry.comment = comment;
        } else {
          stage.entries.unshift({ id: uid(), amount, type, date, comment });
        }
        await saveData();
        if (reopenOverviewPersonId) openOverviewPersonDetail(reopenOverviewPersonId);
        else closeModal();
      };
    }
  );
}