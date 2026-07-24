// ==================== 12-cloud-sync.js ====================
// Firebase Cloud Sync — Email/Password auth, per-user Firestore docs,
// merge-based sync reusing the existing backup-merge logic.

let cloudUser = null;
let cloudSyncStatus = "signed-out"; // signed-out | syncing | synced | error
let cloudUnsubscribers = [];
let cloudPushTimers = {};
const CLOUD_PUSH_DELAY = 4000;
const CLOUD_MODES = ["personal", "work"];

function cloudStorageKey(mode) {
  return mode === "work" ? WORK_STORAGE_KEY : PERSONAL_STORAGE_KEY;
}

function cloudDocRef(mode) {
  if (!cloudUser) return null;
  return firebase.firestore().collection("acc_users").doc(cloudUser.uid).collection("data").doc(mode);
}

function cloudDayKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function cloudHistoryDocRef(mode, dayKey) {
  if (!cloudUser) return null;
  return firebase.firestore().collection("acc_users").doc(cloudUser.uid).collection(`history_${mode}`).doc(dayKey);
}

// One entry per calendar day per mode, always overwritten with the latest
// push — so by the time the day ends, that day's history holds whatever the
// data looked like last, not just its first save of the day.
async function saveHistorySnapshot(mode, people) {
  const ref = cloudHistoryDocRef(mode, cloudDayKey());
  if (!ref) return;
  try {
    await ref.set({ people, savedAt: firebase.firestore.FieldValue.serverTimestamp() });
  } catch (err) {
    console.warn("Cloud history snapshot failed:", err);
  }
}

let cloudLastSyncedAt = null;

function setCloudStatus(status) {
  cloudSyncStatus = status;
  if (status === "synced") cloudLastSyncedAt = new Date();

  const labels = { "signed-out": "Not signed in", syncing: "Syncing…", synced: "Synced", error: "Sync error" };
  let text = labels[status] || status;
  if (status === "synced" && cloudLastSyncedAt) {
    text += ` - ${cloudLastSyncedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`;
  }

  document.querySelectorAll(".cloud-sync-status").forEach(el => {
    el.textContent = text;
    el.className = `cloud-sync-status cloud-sync-status-${status}`;
  });
}

// ---- Auth ----

async function cloudSignUp(email, password) {
  await firebase.auth().createUserWithEmailAndPassword(email.trim(), password);
}

async function cloudSignIn(email, password) {
  await firebase.auth().signInWithEmailAndPassword(email.trim(), password);
}

async function cloudSignOut() {
  stopCloudListeners();
  await firebase.auth().signOut();
}

async function cloudResetPassword(email) {
  await firebase.auth().sendPasswordResetEmail(email.trim());
}

// ---- Sync engine ----

async function pullMergeAndPush(mode) {
  const ref = cloudDocRef(mode);
  if (!ref) return;
  try {
    const snap = await ref.get();
    const remotePeople = snap.exists ? (snap.data().people || []) : [];
    const key = cloudStorageKey(mode);
    const localRaw = await dbGet(key).catch(() => null);
    const localPeople = localRaw ? JSON.parse(localRaw) : [];

    const merged = mergePeopleArrays(
      normalizeImportedPeopleArray(localPeople),
      normalizeImportedPeopleArray(remotePeople)
    );

    await dbSet(key, JSON.stringify(merged));

    if (state.mode === mode) {
      state.people = merged.map(p => ({ ...p, expanded: false }));
      render();
    }

    await ref.set({ people: merged, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    setCloudStatus("synced");
    saveHistorySnapshot(mode, merged);
  } catch (err) {
    console.warn("Cloud sync (pull+merge) failed:", err);
    setCloudStatus("error");
  }
}

function handleRemoteSnapshot(mode, snap) {
  if (!snap.exists) return;
  if (snap.metadata.hasPendingWrites) return; // our own write echoing back — ignore
  mergeRemoteIntoLocal(mode, snap.data().people || []);
}

async function mergeRemoteIntoLocal(mode, remotePeople) {
  try {
    const key = cloudStorageKey(mode);
    const localRaw = await dbGet(key).catch(() => null);
    const localPeople = localRaw ? JSON.parse(localRaw) : [];

    const merged = mergePeopleArrays(
      normalizeImportedPeopleArray(localPeople),
      normalizeImportedPeopleArray(remotePeople)
    );

    await dbSet(key, JSON.stringify(merged));

    if (state.mode === mode) {
      state.people = merged.map(p => ({ ...p, expanded: false }));
      render();
    }
    setCloudStatus("synced");
  } catch (err) {
    console.warn("Cloud sync (merge remote) failed:", err);
    setCloudStatus("error");
  }
}

function scheduleCloudPush(mode) {
  if (!cloudUser) return;
  setCloudStatus("syncing");
  clearTimeout(cloudPushTimers[mode]);
  cloudPushTimers[mode] = setTimeout(() => pushToCloud(mode), CLOUD_PUSH_DELAY);
}

async function pushToCloud(mode) {
  const ref = cloudDocRef(mode);
  if (!ref) return;
  try {
    const key = cloudStorageKey(mode);
    const raw = await dbGet(key).catch(() => null);
    const people = raw ? JSON.parse(raw) : [];
    await ref.set({ people, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    setCloudStatus("synced");
    saveHistorySnapshot(mode, people);
  } catch (err) {
    console.warn("Cloud push failed:", err);
    setCloudStatus("error");
  }
}

function startCloudListeners() {
  CLOUD_MODES.forEach(mode => {
    pullMergeAndPush(mode);
    const unsub = cloudDocRef(mode).onSnapshot(
      snap => handleRemoteSnapshot(mode, snap),
      err => console.warn("Cloud listener error:", err)
    );
    cloudUnsubscribers.push(unsub);
  });
}

function stopCloudListeners() {
  cloudUnsubscribers.forEach(unsub => { try { unsub(); } catch (e) {} });
  cloudUnsubscribers = [];
  Object.values(cloudPushTimers).forEach(clearTimeout);
  cloudPushTimers = {};
}

// Called from saveData() after every local write, if this file has loaded.
function notifyCloudOfLocalSave(mode) {
  if (!cloudUser) return;
  scheduleCloudPush(mode);
}

function initCloudSync() {
  if (!window.firebase || !firebase.auth) return;
  firebase.auth().onAuthStateChanged(user => {
    cloudUser = user;
    if (user) {
      setCloudStatus("syncing");
      startCloudListeners();
    } else {
      stopCloudListeners();
      setCloudStatus("signed-out");
    }
    refreshCloudSyncModalIfOpen();
  });
}

initCloudSync();

// ---- UI ----

function refreshCloudSyncModalIfOpen() {
  if (!document.getElementById("cloudSyncModalBody")) return;
  openCloudSyncModal();
}

function openCloudSyncModal() {
  openModal("☁️ Cloud Sync", `
    <div id="cloudSyncModalBody">
      <div class="inline-note" style="margin-bottom:14px;">
        Sign in to sync your Personal and Work data across devices.
      </div>
      <form class="form" id="cloudAuthForm">
        <div class="field">
          <label for="cloudEmail">Email</label>
          <input id="cloudEmail" type="email" autocomplete="email" required placeholder="you@example.com">
        </div>
        <div class="field">
          <label for="cloudPassword">Password</label>
          <input id="cloudPassword" type="password" autocomplete="current-password" required placeholder="At least 6 characters" minlength="6">
        </div>
        <div id="cloudAuthError" class="inline-note" style="display:none;color:#ff9a9a;margin-bottom:10px;"></div>
        <div class="quick-actions-row quick-actions-row-2" style="margin-bottom:10px;">
          <button type="button" class="secondary-btn" id="cloudSignUpBtn">Create Account</button>
          <button type="submit" class="primary-btn" id="cloudSignInBtn">Sign In</button>
        </div>
        <div class="quick-actions-row" style="display:grid;grid-template-columns:1fr;">
          <button type="button" class="secondary-btn" id="cloudForgotBtn" style="min-height:40px;font-size:13px;">Forgot password?</button>
        </div>
      </form>
    </div>
  `, () => {
    const form = document.getElementById("cloudAuthForm");
    const emailEl = document.getElementById("cloudEmail");
    const passEl = document.getElementById("cloudPassword");
    const errorEl = document.getElementById("cloudAuthError");
    const signUpBtn = document.getElementById("cloudSignUpBtn");
    const forgotBtn = document.getElementById("cloudForgotBtn");

    function showError(err) {
      errorEl.textContent = (err && err.message) ? err.message.replace(/^Firebase:\s*/, "") : "Something went wrong.";
      errorEl.style.display = "block";
    }

    form.onsubmit = async e => {
      e.preventDefault();
      errorEl.style.display = "none";
      try {
        await cloudSignIn(emailEl.value, passEl.value);
        closeModal();
      } catch (err) {
        showError(err);
      }
    };

    if (signUpBtn) signUpBtn.onclick = async () => {
      errorEl.style.display = "none";
      try {
        await cloudSignUp(emailEl.value, passEl.value);
        closeModal();
      } catch (err) {
        showError(err);
      }
    };

    if (forgotBtn) forgotBtn.onclick = async () => {
      errorEl.style.display = "none";
      if (!emailEl.value.trim()) { showError({ message: "Enter your email first." }); return; }
      try {
        await cloudResetPassword(emailEl.value);
        errorEl.style.color = "var(--muted)";
        errorEl.textContent = "Password reset email sent.";
        errorEl.style.display = "block";
      } catch (err) {
        showError(err);
      }
    };
  });
}

function cloudFormatDayKey(dayKey) {
  const [y, m, d] = String(dayKey || "").split("-");
  if (!y || !m || !d) return dayKey || "";
  return `${d}/${m}/${y}`;
}

async function openRestoreBackupModal() {
  const mode = state.mode;
  const modeLabel = mode === "work" ? "Work" : "Personal";

  openModal("🕐 Restore Backup", `<div class="empty-state mini-empty">Loading ${escapeHtml(modeLabel)} backups…</div>`, () => {});

  try {
    const [latestSnap, historySnap] = await Promise.all([
      cloudDocRef(mode).get(),
      firebase.firestore()
        .collection("acc_users").doc(cloudUser.uid)
        .collection(`history_${mode}`)
        .orderBy(firebase.firestore.FieldPath.documentId(), "desc")
        .limit(30)
        .get()
    ]);

    const sources = [];

    if (latestSnap.exists) {
      const data = latestSnap.data();
      const updatedAt = data.updatedAt && data.updatedAt.toDate ? data.updatedAt.toDate() : null;
      sources.push({
        type: "latest",
        label: `Latest Cloud - ${updatedAt ? cloudFormatDayKey(cloudDayKey(updatedAt)) : "—"}`,
        count: (data.people || []).length
      });
    }

    historySnap.docs.forEach(doc => {
      sources.push({
        type: "history",
        day: doc.id,
        label: `History - ${cloudFormatDayKey(doc.id)}`,
        count: (doc.data().people || []).length
      });
    });

    if (!sources.length) {
      openModal("🕐 Restore Backup", `<div class="empty-state mini-empty">No ${escapeHtml(modeLabel)} backups yet. One is saved automatically each day while you're signed in.</div>`, () => {});
      return;
    }

    openModal(`🕐 Restore ${modeLabel}`, `
      <div class="inline-note" style="margin-bottom:12px;">
        Pick a source to restore from. You'll choose Merge or Replace on the next step.
      </div>
      <div class="sheet-list" id="restoreSourceList">
        ${sources.map((s, idx) => `
          <div class="sheet-item choose-restore-source" data-index="${idx}">
            <span class="sheet-item-title">${idx + 1}. ${escapeHtml(s.label)}</span>
            <span class="sheet-item-sub">${s.count} ${s.count === 1 ? "person" : "people"}</span>
          </div>
        `).join("")}
      </div>
      <div class="quick-actions-row quick-actions-row-2" style="margin-top:14px;">
        <button type="button" class="secondary-btn" id="restoreCancelBtn">Cancel</button>
        <button type="button" class="primary-btn" id="restoreConfirmBtn" disabled style="opacity:0.5;">Restore</button>
      </div>
    `, () => {
      let selected = null;
      const items = document.querySelectorAll(".choose-restore-source");
      const confirmBtn = document.getElementById("restoreConfirmBtn");
      const cancelBtn = document.getElementById("restoreCancelBtn");

      items.forEach(item => {
        item.onclick = () => {
          items.forEach(i => i.classList.remove("choose-restore-selected"));
          item.classList.add("choose-restore-selected");
          selected = sources[Number(item.dataset.index)];
          confirmBtn.disabled = false;
          confirmBtn.style.opacity = "1";
        };
      });

      if (cancelBtn) cancelBtn.onclick = () => closeModal();

      if (confirmBtn) confirmBtn.onclick = () => {
        if (!selected) return;
        closeModal();
        openRestoreModeModal(mode, modeLabel, selected);
      };
    });
  } catch (err) {
    console.warn("Loading backups failed:", err);
    openModal("🕐 Restore Backup", `<div class="empty-state mini-empty">Couldn't load backups. Check your connection and try again.</div>`, () => {});
  }
}

async function openRestoreModeModal(mode, modeLabel, source) {
  let backupCount = source.count;
  let localCount = "?";
  try {
    const localRaw = await dbGet(cloudStorageKey(mode)).catch(() => null);
    const localPeople = localRaw ? JSON.parse(localRaw) : [];
    localCount = localPeople.length;
  } catch (e) {}

  openModal("Restore Mode", `
    <div class="inline-note" style="margin-bottom:12px;">
      Restoring <strong>${escapeHtml(modeLabel)}</strong> from "${escapeHtml(source.label)}" (${backupCount} ${backupCount === 1 ? "person" : "people"}).
      Currently on this device: ${localCount} ${localCount === 1 ? "person" : "people"}.
      <br><br>
      <strong>Merge</strong> adds the backup's data into what you have now — nothing is deleted.<br>
      <strong>Replace</strong> discards everything currently on this device and in the cloud for ${escapeHtml(modeLabel)}, using only the backup.
    </div>
    <div class="quick-actions-row quick-actions-row-2" style="margin-bottom:10px;">
      <button type="button" class="secondary-btn" id="restoreMergeBtn">Merge</button>
      <button type="button" class="danger-btn" id="restoreReplaceBtn">Replace</button>
    </div>
    <div class="quick-actions-row" style="display:grid;grid-template-columns:1fr;">
      <button type="button" class="primary-btn" id="restoreModeCancelBtn" style="min-height:48px;border-radius:14px;font-weight:800;font-size:15px;">Cancel</button>
    </div>
  `, () => {
    const mergeBtn = document.getElementById("restoreMergeBtn");
    const replaceBtn = document.getElementById("restoreReplaceBtn");
    const cancelBtn = document.getElementById("restoreModeCancelBtn");

    if (cancelBtn) cancelBtn.onclick = () => closeModal();

    if (mergeBtn) {
      mergeBtn.onclick = () => {
        closeModal();
        restoreFromSource(mode, source, "merge");
      };
    }

    if (replaceBtn) {
      replaceBtn.onclick = () => {
        confirmDelete(
          `Replace will erase everything currently in ${modeLabel} (${localCount} ${localCount === 1 ? "person" : "people"}) on this device and in the cloud, keeping only the ${backupCount} from "${source.label}". This can't be undone. Continue?`,
          () => {
            closeModal();
            restoreFromSource(mode, source, "replace");
          },
          false,
          "Replace"
        );
      };
    }
  });
}

async function restoreFromSource(mode, source, action = "merge") {
  try {
    let backupPeople = [];

    if (source.type === "latest") {
      const snap = await cloudDocRef(mode).get();
      if (!snap.exists) return;
      backupPeople = snap.data().people || [];
    } else {
      const ref = cloudHistoryDocRef(mode, source.day);
      const snap = await ref.get();
      if (!snap.exists) return;
      backupPeople = snap.data().people || [];
    }

    const normalizedBackup = normalizeImportedPeopleArray(backupPeople);
    const key = cloudStorageKey(mode);

    let finalPeople;
    if (action === "replace") {
      finalPeople = normalizedBackup;
    } else {
      const localRaw = await dbGet(key).catch(() => null);
      const localPeople = localRaw ? JSON.parse(localRaw) : [];
      finalPeople = mergePeopleArrays(normalizeImportedPeopleArray(localPeople), normalizedBackup);
    }

    await dbSet(key, JSON.stringify(finalPeople));

    if (state.mode === mode) {
      state.people = finalPeople.map(p => ({ ...p, expanded: false }));
      render();
    }

    if (cloudUser) {
      const docRef = cloudDocRef(mode);
      if (docRef) await docRef.set({ people: finalPeople, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
  } catch (err) {
    console.warn("Restore failed:", err);
    alert("Restore failed. Check your connection and try again.");
  }
}
