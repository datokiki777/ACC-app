// ==================== Card Actions, Swipe, Long Press, Delete ====================

function findPerson(personId) { return state.people.find(p => p.id === personId) || null; }
function findStage(personId, stageId) { const p = findPerson(personId); return p ? (p.stages || []).find(s => s.id === stageId) || null : null; }
function findEntry(personId, stageId, entryId) { const s = findStage(personId, stageId); return s ? (s.entries || []).find(e => e.id === entryId) || null : null; }
function findOpenStage(personId) { const p = findPerson(personId); return p ? (p.stages || []).find(s => !s.closed) || null : null; }

function closeAllSwipes(exceptCard = null) {
  document.querySelectorAll(".swipe-card").forEach(card => {
    if (exceptCard && card === exceptCard) return;
    const content = card.querySelector(".swipe-content");
    if (content) content.style.transform = "";
    card.classList.remove("swipe-open");
  });
}

function setupLongPress(element, callback) {
  let timer = null, startX = 0, startY = 0;
  const hostSwipe = element.closest(".swipe-card");
  const start = e => {
    if (shouldIgnoreGestureTarget(e.target)) return;
    const nearestSwipe = getNearestSwipeCard(e.target);
    if (hostSwipe && nearestSwipe && nearestSwipe !== hostSwipe) return;
    const point = e.touches ? e.touches[0] : e;
    startX = point.clientX; startY = point.clientY;
    timer = setTimeout(() => { state.longPressTriggered = true; callback(); }, 600);
    state.longPressTimer = timer;
  };
  const move = e => {
    if (!timer) return;
    const point = e.touches ? e.touches[0] : e;
    const dx = Math.abs(point.clientX - startX);
    const dy = Math.abs(point.clientY - startY);
    if (dx > 10 || dy > 10) { clearTimeout(timer); timer = null; }
  };
  const cancel = () => {
    if (timer) { clearTimeout(timer); timer = null; }
    setTimeout(() => { state.longPressTriggered = false; }, 60);
  };
  element.addEventListener("contextmenu", e => e.preventDefault());
  element.addEventListener("touchstart", start, { passive: true });
  element.addEventListener("touchmove", move, { passive: true });
  element.addEventListener("touchend", cancel);
  element.addEventListener("touchcancel", cancel);
  element.addEventListener("mousedown", start);
  element.addEventListener("mousemove", move);
  element.addEventListener("mouseup", cancel);
  element.addEventListener("mouseleave", cancel);
}

function setupSwipeDelete(card, onDelete) {
  const content = card.querySelector(".swipe-content");
  if (!content) return;
  let deleteAction = card.querySelector(".swipe-delete-action");
  if (!deleteAction) {
    deleteAction = document.createElement("button");
    deleteAction.type = "button";
    deleteAction.className = "swipe-delete-action";
    deleteAction.innerHTML = "<span>Delete</span>";
    card.appendChild(deleteAction);
  }
  const revealWidth = 96;
  let startX = 0, currentX = 0, dragging = false, startYSwipe = 0;
  const setTranslate = x => { const safeX = Math.max(-revealWidth, Math.min(0, x)); content.style.transform = `translateX(${safeX}px)`; };
  const openSwipe = () => { closeAllSwipes(card); card.classList.add("swipe-open"); content.style.transform = `translateX(-${revealWidth}px)`; };
  const closeSwipe = () => { card.classList.remove("swipe-open"); content.style.transform = ""; };
  deleteAction.onclick = e => { e.stopPropagation(); closeSwipe(); if (typeof onDelete === "function") onDelete(); };
  card.addEventListener("touchstart", e => {
    if (shouldIgnoreGestureTarget(e.target)) return;
    const nearestSwipe = getNearestSwipeCard(e.target);
    if (nearestSwipe && nearestSwipe !== card) return;
    closeAllSwipes(card);
    const point = e.touches[0];
    startX = point.clientX; currentX = startX; startYSwipe = point.clientY;
    dragging = true;
  }, { passive: true });
  card.addEventListener("touchmove", e => {
    if (!dragging) return;
    const nearestSwipe = getNearestSwipeCard(e.target);
    if (nearestSwipe && nearestSwipe !== card) return;
    const point = e.touches[0];
    currentX = point.clientX;
    const dx = currentX - startX;
    const dy = Math.abs(point.clientY - startYSwipe);
    if (dx < -8 && Math.abs(dx) > dy * 1.5) { e.preventDefault(); setTranslate(dx); }
  }, { passive: false });
  const endTouch = () => {
    if (!dragging) return;
    dragging = false;
    const dx = currentX - startX;
    if (dx < -48) openSwipe(); else closeSwipe();
  };
  card.addEventListener("touchend", endTouch);
  card.addEventListener("touchcancel", endTouch);
  card.addEventListener("click", e => { if (card.classList.contains("swipe-open") && !e.target.closest(".swipe-delete-action")) closeSwipe(); });
}

function getActionPayloadFromCard(card) {
  return { type: card.dataset.actionType || "", personId: card.dataset.personId || "", stageId: card.dataset.stageId || "", entryId: card.dataset.entryId || "", source: card.dataset.source || "main" };
}

function openEditByPayload(payload) {
  if (payload.type === "person") openPersonForm(payload.personId);
  else if (payload.type === "stage") openStageForm(payload.personId, payload.stageId, false, false, payload.source === "overview" ? payload.personId : null);
  else if (payload.type === "entry") openEntryForm(payload.personId, payload.stageId, payload.entryId, payload.source === "overview" ? payload.personId : null);
}

function deleteByPayload(payload) {
  if (payload.type === "person") {
    confirmDelete("Delete this person? All stages and entries will be deleted.", async () => {
      state.people = state.people.filter(p => p.id !== payload.personId);
      await saveData(); render();
    });
    return;
  }
  if (payload.type === "stage") {
    confirmDelete("Delete this stage?", async () => {
      const person = findPerson(payload.personId);
      if (!person) return;
      person.stages = (person.stages || []).filter(s => s.id !== payload.stageId);
      await saveData(); render();
      if (payload.source === "overview") openOverviewPersonDetail(payload.personId);
    });
    return;
  }
  if (payload.type === "entry") {
    confirmDelete("Delete this entry?", async () => {
      const stage = findStage(payload.personId, payload.stageId);
      if (!stage) return;
      stage.entries = (stage.entries || []).filter(e => e.id !== payload.entryId);
      await saveData(); render();
    });
  }
}

function setupActionCard(card) {
  if (card.dataset.actionsBound === "1") return;
  card.dataset.actionsBound = "1";
  const payload = getActionPayloadFromCard(card);
  if (!payload.type) return;
  const swipeArea = card.querySelector(".swipe-content") || card;
  setupLongPress(swipeArea, () => {
    let onToggleStage = null, onExportPerson = null;
    if (payload.type === "stage") {
      const stage = findStage(payload.personId, payload.stageId);
      if (stage) {
        const isClosed = !!stage.closed;
        const toggleFn = async () => {
          if (!isClosed) {
            confirmDelete("Close this stage? You can reopen it later.", async () => {
              stage.closed = true; await saveData(); render();
              if (payload.source === "overview") openOverviewPersonDetail(payload.personId);
            }, false, "Close");
          } else {
            const existingOpen = findOpenStage(payload.personId);
            if (existingOpen) {
              confirmDelete("This person already has an open stage. Close it first.", () => openOverviewPersonDetail(payload.personId), false, "OK");
              return;
            }
            stage.closed = false; await saveData(); render();
            if (payload.source === "overview") openOverviewPersonDetail(payload.personId);
          }
        };
        toggleFn._label = isClosed ? "🔓 Reopen Stage" : "🔒 Close Stage";
        onToggleStage = toggleFn;
      }
    }
    if (payload.type === "person") onExportPerson = () => exportPersonPdf(payload.personId);
    const allowEdit = !(payload.type === "stage" && payload.source === "overview");
    openQuickActions({
      title: payload.type === "person" ? "Person" : payload.type === "stage" ? "Stage" : "Entry",
      onEdit: allowEdit ? () => openEditByPayload(payload) : null,
      onToggleStage, onExportPerson,
      onCancel: () => { if (payload.source === "overview") openOverviewPersonDetail(payload.personId); }
    });
  });
  setupSwipeDelete(card, () => deleteByPayload(payload));
}

function openQuickActions({ title = "", onEdit, onToggleStage, onExportPerson, onCancel }) {
  const hasEdit = typeof onEdit === "function";
  const hasStageToggle = typeof onToggleStage === "function";
  const hasExport = typeof onExportPerson === "function";
  let actionsHtml = "";
  if (!hasEdit && hasStageToggle) {
    actionsHtml = `<div class="quick-actions-row quick-actions-row-2"><button type="button" class="secondary-btn" id="quickCancelBtn">Cancel</button><button type="button" class="primary-btn" id="quickToggleStageBtn"></button></div>`;
  } else {
    actionsHtml = `${hasStageToggle ? `<div style="margin-bottom:10px;"><button type="button" class="secondary-btn full-btn" id="quickToggleStageBtn" style="min-height:48px;border-radius:14px;font-weight:800;font-size:15px;"></button></div>` : ""}${hasExport ? `<div style="margin-bottom:10px;"><button type="button" class="secondary-btn full-btn" id="quickExportPersonBtn" style="min-height:48px;border-radius:14px;font-weight:800;font-size:15px;">📄 Export PDF</button></div>` : ""}<div class="quick-actions-row ${hasEdit ? "quick-actions-row-2" : ""}" style="${hasEdit ? "" : "display:grid;grid-template-columns:1fr;"}"><button type="button" class="secondary-btn ${hasEdit ? "" : "full-btn"}" id="quickCancelBtn">Cancel</button>${hasEdit ? `<button type="button" class="primary-btn" id="quickEditBtn">Edit</button>` : ""}</div>`;
  }
  openModal(title || "Actions", actionsHtml, () => {
    const cancelBtn = document.getElementById("quickCancelBtn");
    const editBtn = document.getElementById("quickEditBtn");
    const toggleBtn = document.getElementById("quickToggleStageBtn");
    const exportBtn = document.getElementById("quickExportPersonBtn");
    if (cancelBtn) cancelBtn.onclick = () => { closeModal(); if (typeof onCancel === "function") onCancel(); };
    if (editBtn && hasEdit) editBtn.onclick = () => { closeModal(); onEdit(); };
    if (toggleBtn && hasStageToggle) { toggleBtn.textContent = onToggleStage._label || "Toggle Stage"; toggleBtn.onclick = () => { closeModal(); onToggleStage(); }; }
    if (exportBtn && hasExport) exportBtn.onclick = () => { closeModal(); onExportPerson(); };
  });
}

async function closeActiveStage(personId, afterClose = null) {
  const openStage = findOpenStage(personId);
  if (!openStage) return;
  openStage.closed = true;
  await saveData();
  render();
  if (typeof afterClose === "function") afterClose(openStage);
}

function confirmCloseAndOpenNewStage(personId) {
  const openStage = findOpenStage(personId);
  if (!openStage) { openStageForm(personId); return; }
  confirmDelete("Active stage will be closed and a new stage will open. Continue?", () => {
    closeActiveStage(personId, () => openStageForm(personId));
  }, false, "Close & Open");
}

function confirmEditActiveStage(personId) {
  const openStage = findOpenStage(personId);
  if (!openStage) return;
  confirmDelete("Edit active stage?", () => openStageForm(personId, openStage.id), false, "Edit");
}