// ==================== 12-cloud-sync.js ====================
// Firebase Cloud Sync — Email/Password auth, per-user Firestore docs,
// merge-based sync reusing the existing backup-merge logic.

let cloudUser = null;
let cloudSyncStatus = "signed-out"; // signed-out | syncing | synced | error
let cloudUnsubscribers = [];
let cloudPushTimers = {};
const CLOUD_PUSH_DELAY = 2500;
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

// One snapshot per calendar day per mode, so there's always something to
// roll back to if a bad sync/merge or accidental mass-delete happens.
async function saveHistorySnapshotIfNeeded(mode, people) {
  const ref = cloudHistoryDocRef(mode, cloudDayKey());
  if (!ref) return;
  const flagKey = `acc_cloud_history_saved_${mode}_${cloudDayKey()}`;
  try {
    if (await dbGet(flagKey).catch(() => null)) return; // already saved today
    await ref.set({ people, savedAt: firebase.firestore.FieldValue.serverTimestamp() });
    await dbSet(flagKey, "1");
  } catch (err) {
    console.warn("Cloud history snapshot failed:", err);
  }
}

function setCloudStatus(status) {
  cloudSyncStatus = status;
  const el = document.getElementById("cloudSyncStatusBadge");
  if (!el) return;
  const labels = { "signed-out": "Not signed in", syncing: "Syncing…", synced: "Synced", error: "Sync error" };
  el.textContent = labels[status] || status;
  el.className = `cloud-sync-status cloud-sync-status-${status}`;
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
    saveHistorySnapshotIfNeeded(mode, merged);
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
    saveHistorySnapshotIfNeeded(mode, people);
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
  if (cloudUser) {
    openModal("☁️ Cloud Sync", `
      <div id="cloudSyncModalBody">
        <div class="inline-note" style="margin-bottom:14px;">
          Signed in as <strong>${escapeHtml(cloudUser.email || "")}</strong>
        </div>
        <div class="backup-row" style="margin-bottom:16px;">
          <span class="backup-label">Status</span>
          <span class="backup-dots"></span>
          <span class="backup-value"><span id="cloudSyncStatusBadge" class="cloud-sync-status"></span></span>
        </div>
        <button type="button" class="secondary-btn full-btn" id="cloudRestoreBtn" style="min-height:48px;border-radius:14px;font-weight:800;margin-bottom:10px;">🕐 Restore from Backup</button>
        <button type="button" class="danger-btn full-btn" id="cloudSignOutBtn" style="min-height:48px;border-radius:14px;font-weight:800;">Sign Out</button>
      </div>
    `, () => {
      setCloudStatus(cloudSyncStatus);
      const signOutBtn = document.getElementById("cloudSignOutBtn");
      if (signOutBtn) signOutBtn.onclick = async () => {
        await cloudSignOut();
        closeModal();
      };
      const restoreBtn = document.getElementById("cloudRestoreBtn");
      if (restoreBtn) restoreBtn.onclick = () => openRestoreBackupModal();
    });
    return;
  }

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

async function openRestoreBackupModal() {
  const mode = state.mode;
  const modeLabel = mode === "work" ? "Work" : "Personal";

  openModal("🕐 Restore Backup", `<div class="empty-state mini-empty">Loading ${escapeHtml(modeLabel)} backups…</div>`, () => {});

  try {
    const snap = await firebase.firestore()
      .collection("acc_users").doc(cloudUser.uid)
      .collection(`history_${mode}`)
      .orderBy(firebase.firestore.FieldPath.documentId(), "desc")
      .limit(30)
      .get();

    if (snap.empty) {
      openModal("🕐 Restore Backup", `<div class="empty-state mini-empty">No ${escapeHtml(modeLabel)} backups yet. One is saved automatically once a day while you're signed in.</div>`, () => {});
      return;
    }

    const days = snap.docs.map(doc => ({ day: doc.id, count: (doc.data().people || []).length }));

    openModal(`🕐 Restore ${modeLabel}`, `
      <div class="inline-note" style="margin-bottom:12px;">
        Pick a day to restore from. This merges that day's data back in — nothing currently on your device is deleted.
      </div>
      <div class="sheet-list">
        ${days.map(d => `
          <div class="sheet-item choose-restore-day" data-day="${d.day}">
            <span class="sheet-item-title">${escapeHtml(d.day)}</span>
            <span class="sheet-item-sub">${d.count} ${d.count === 1 ? "person" : "people"}</span>
          </div>
        `).join("")}
      </div>
    `, () => {
      document.querySelectorAll(".choose-restore-day").forEach(btn => {
        btn.onclick = () => {
          const day = btn.dataset.day;
          closeModal();
          confirmDelete(
            `Restore ${modeLabel} data from ${day}? This merges that backup into your current data.`,
            () => restoreFromHistoryDay(mode, day),
            false,
            "Restore"
          );
        };
      });
    });
  } catch (err) {
    console.warn("Loading backups failed:", err);
    openModal("🕐 Restore Backup", `<div class="empty-state mini-empty">Couldn't load backups. Check your connection and try again.</div>`, () => {});
  }
}

async function restoreFromHistoryDay(mode, day) {
  try {
    const ref = cloudHistoryDocRef(mode, day);
    const snap = await ref.get();
    if (!snap.exists) return;
    const backupPeople = snap.data().people || [];

    const key = cloudStorageKey(mode);
    const localRaw = await dbGet(key).catch(() => null);
    const localPeople = localRaw ? JSON.parse(localRaw) : [];

    const merged = mergePeopleArrays(
      normalizeImportedPeopleArray(localPeople),
      normalizeImportedPeopleArray(backupPeople)
    );

    await dbSet(key, JSON.stringify(merged));

    if (state.mode === mode) {
      state.people = merged.map(p => ({ ...p, expanded: false }));
      render();
    }

    if (cloudUser) {
      const docRef = cloudDocRef(mode);
      if (docRef) await docRef.set({ people: merged, updatedAt: firebase.firestore.FieldValue.serverTimestamp() });
    }
  } catch (err) {
    console.warn("Restore failed:", err);
    alert("Restore failed. Check your connection and try again.");
  }
}
