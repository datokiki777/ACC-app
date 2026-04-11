// ==================== Modal and Confirm Dialogs ====================

let _suppressPopstate = false;

function openModal(title, html, afterOpen) {
  modalTitle.textContent = title;
  modalContent.innerHTML = html;
  modalOverlay.classList.add("show");
  fab.classList.remove("fab-hidden");
  fab.classList.add("fab-back");
  fab.style.pointerEvents = "";
  fab.style.opacity = "";
  fab.textContent = "←";
  fab.onclick = closeModal;
  history.pushState({ modal: true }, "");
  if (typeof afterOpen === "function") afterOpen();
}

function closeModal() {
  modalOverlay.classList.remove("show");
  modalContent.innerHTML = "";
  fab.classList.remove("fab-back");
  fab.style.pointerEvents = "";
  fab.style.opacity = "";
  fab.textContent = "+";
  fab.onclick = openMainAddMenu;
  const anyExpanded = state.people.some(p => p.expanded);
  if (anyExpanded) fab.classList.add("fab-hidden");
  else fab.classList.remove("fab-hidden");
  requestAnimationFrame(() => render());
}

window.addEventListener("popstate", async () => {
  if (_suppressPopstate) { _suppressPopstate = false; return; }
  if (modalOverlay.classList.contains("show")) {
    modalOverlay.classList.remove("show");
    modalContent.innerHTML = "";
    fab.classList.remove("fab-back");
    fab.style.pointerEvents = "";
    fab.style.opacity = "";
    fab.textContent = "+";
    fab.onclick = openMainAddMenu;
    const anyExpanded = state.people.some(p => p.expanded);
    if (anyExpanded) fab.classList.add("fab-hidden");
    else fab.classList.remove("fab-hidden");
    requestAnimationFrame(() => render());
    return;
  }
  if (confirmOverlay.classList.contains("show")) { closeConfirm(); return; }
  if (state.statsExpanded) { state.statsExpanded = false; render(); return; }
  const anyExpanded = state.people.some(p => p.expanded);
  if (anyExpanded) {
    state.people.forEach(p => { p.expanded = false; });
    await saveData();
    render();
  }
});

function confirmDelete(text, onOk, reopenEdit = false, okLabel = "Delete") {
  state.confirmAction = onOk;
  state.reopenEditAfterConfirm = reopenEdit;
  confirmText.textContent = text;
  confirmOk.textContent = okLabel;
  confirmOverlay.classList.add("show");
  fab.classList.add("fab-hidden");
}

function closeConfirm() {
  state.confirmAction = null;
  confirmOverlay.classList.remove("show");
  fab.classList.remove("fab-hidden");
}