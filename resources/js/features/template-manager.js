import { routeLegacyTemplateImport } from "./legacy-import.js";
import {
  toTemplateDocumentFromSettings,
  toRuntimeSettingsFromTemplateDocument,
} from "./template-document-adapter.js";
import { TEMPLATE_DOCUMENT_TYPES, isTemplateDocument } from "./template-document-schema.js";

export function createTemplateManagerFeature({
  appVersion,
  refs,
  getState,
  patchState,
  normalizeLocalTemplateCatalog,
  escapeHtml,
  collectSettings,
  collectDesignSettings,
  applySettings,
  applyDesignSettings,
  fetchAndApplyDesign,
  validateSettingsSchema,
  assertFileSizeWithinLimit,
  assertTextSizeWithinLimit,
  maxImportFileBytes,
}) {
  const DESIGN_SLOTS = [6, 7, 8, 9, 10];
  const DESIGN_SLOT_ADD_ICON_PATH = "./resources/icons/add_24dp_E3E3E3_FILL0_wght400_GRAD0_opsz24.svg";
  const DEMO_TEMPLATE_SOURCES = [
    { id: "snapshot-demo1", name: "Snapshot Demo 1", file: "./templates/app/snapshot-demo1.json" },
    { id: "snapshot-demo2", name: "Snapshot Demo 2", file: "./templates/app/snapshot-demo2.json" },
  ];

  const designLoadFlashTimers = new WeakMap();
  let interactionsBound = false;
  let userDesignSlots = {};
  let localTemplateCatalog = [];
  let demoTemplates = [];
  let hiddenDemoTemplateIds = [];
  let activeTemplateKey = "";
  let localTemplateSearchQuery = "";

  function normalizeUserDesignSlots(value) {
    if (!value || typeof value !== "object") {
      return {};
    }
    const next = {};
    for (const slot of DESIGN_SLOTS) {
      const key = String(slot);
      if (value[key] && typeof value[key] === "object") {
        next[key] = value[key];
      }
    }
    return next;
  }

  function normalizeHiddenDemoTemplateIds(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    const allowed = new Set(DEMO_TEMPLATE_SOURCES.map((item) => item.id));
    const seen = new Set();
    const out = [];
    for (const item of value) {
      const id = String(item || "");
      if (!allowed.has(id) || seen.has(id)) {
        continue;
      }
      seen.add(id);
      out.push(id);
    }
    return out;
  }

  function allDemoTemplateIds() {
    return DEMO_TEMPLATE_SOURCES.map((item) => item.id);
  }

  function canonicalizeDemoTemplateVisibility() {
    const allIds = allDemoTemplateIds();
    if (allIds.length === 0) {
      hiddenDemoTemplateIds = [];
      return;
    }
    if (hiddenDemoTemplateIds.length === allIds.length) {
      hiddenDemoTemplateIds = [...allIds];
      return;
    }
    hiddenDemoTemplateIds = [];
  }

  function persistTemplateState() {
    patchState((state) => {
      state.templates.localCatalog = normalizeLocalTemplateCatalog(localTemplateCatalog);
      state.templates.userDesignSlots = normalizeUserDesignSlots(userDesignSlots);
      state.templates.hiddenDemoTemplateIds = normalizeHiddenDemoTemplateIds(hiddenDemoTemplateIds);
    });
  }

  function loadFromState() {
    const state = getState();
    localTemplateCatalog = normalizeLocalTemplateCatalog(state.templates.localCatalog);
    userDesignSlots = normalizeUserDesignSlots(state.templates.userDesignSlots);
    hiddenDemoTemplateIds = normalizeHiddenDemoTemplateIds(state.templates.hiddenDemoTemplateIds);
    canonicalizeDemoTemplateVisibility();
  }

  function flashLoadedDesignButton(buttonEl) {
    if (!(buttonEl instanceof HTMLButtonElement)) {
      return;
    }

    const existing = designLoadFlashTimers.get(buttonEl);
    if (existing) {
      window.clearTimeout(existing);
    }

    buttonEl.classList.remove("template-loaded");
    window.requestAnimationFrame(() => {
      buttonEl.classList.add("template-loaded");
      const timer = window.setTimeout(() => {
        buttonEl.classList.remove("template-loaded");
        designLoadFlashTimers.delete(buttonEl);
      }, 900);
      designLoadFlashTimers.set(buttonEl, timer);
    });
  }

  function renderDesignSlots() {
    for (const slot of DESIGN_SLOTS) {
      const slotKey = String(slot);
      const hasDesign = Boolean(userDesignSlots[slotKey]);
      const wrapEl = refs.designButtonGridEl?.querySelector(`[data-design-slot-wrap="${slotKey}"]`);
      const slotBtn = refs.designButtonGridEl?.querySelector(`button[data-design-slot="${slotKey}"]`);
      const deleteBtn = refs.designButtonGridEl?.querySelector(`button[data-design-slot-delete="${slotKey}"]`);
      if (wrapEl instanceof HTMLElement) {
        wrapEl.setAttribute("data-has-design", hasDesign ? "1" : "0");
      }
      if (slotBtn instanceof HTMLButtonElement) {
        if (hasDesign) {
          slotBtn.textContent = slotKey;
        } else {
          slotBtn.innerHTML = `<img class="design-slot-add-icon" src="${DESIGN_SLOT_ADD_ICON_PATH}" alt="" aria-hidden="true" />`;
        }
        slotBtn.setAttribute(
          "aria-label",
          hasDesign ? `Load user design ${slotKey}` : `Save current design to slot ${slotKey}`
        );
      }
      if (deleteBtn instanceof HTMLButtonElement) {
        deleteBtn.disabled = !hasDesign;
        deleteBtn.setAttribute(
          "aria-label",
          hasDesign ? `Clear design ${slotKey}` : `Clear design ${slotKey} (disabled)`
        );
      }
    }
  }

  async function loadDefaultDesign(designNumber) {
    const design = Number.parseInt(String(designNumber), 10);
    if (!Number.isFinite(design) || design < 1 || design > 5) {
      return false;
    }
    return fetchAndApplyDesign(
      `./templates/app/design-default-${design}.json`,
      "design",
      `Could not load default design ${design}.`
    );
  }

  function saveCurrentDesignToSlot(slot) {
    const slotKey = String(slot);
    if (!DESIGN_SLOTS.includes(Number.parseInt(slotKey, 10))) {
      return false;
    }
    userDesignSlots[slotKey] = collectDesignSettings();
    persistTemplateState();
    renderDesignSlots();
    return true;
  }

  async function loadUserDesignSlot(slot) {
    const slotKey = String(slot);
    const settings = userDesignSlots[slotKey];
    if (!settings || typeof settings !== "object") {
      return false;
    }
    await applyDesignSettings(settings, { source: "design" });
    return true;
  }

  function deleteUserDesignSlot(slot) {
    const slotKey = String(slot);
    if (!userDesignSlots[slotKey]) {
      return false;
    }
    delete userDesignSlots[slotKey];
    persistTemplateState();
    renderDesignSlots();
    return true;
  }

  function formatLocalTemplateTime(timestamp) {
    if (!Number.isFinite(timestamp) || timestamp <= 0) {
      return "";
    }
    try {
      return new Date(timestamp).toLocaleString();
    } catch {
      return "";
    }
  }

  function findLocalTemplateById(templateId) {
    return localTemplateCatalog.find((entry) => entry.id === templateId) || null;
  }

  function findLocalTemplateByName(name) {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return localTemplateCatalog.find((entry) => entry.name.toLowerCase() === normalized) || null;
  }

  function ensureUniqueLocalTemplateName(baseName, excludeId = "") {
    const normalizedBase = String(baseName || "Snapshot").trim() || "Snapshot";
    const occupied = new Set(
      localTemplateCatalog
        .filter((entry) => entry.id !== excludeId)
        .map((entry) => entry.name.toLowerCase())
    );

    if (!occupied.has(normalizedBase.toLowerCase())) {
      return normalizedBase;
    }

    let suffix = 2;
    while (occupied.has(`${normalizedBase} (${suffix})`.toLowerCase())) {
      suffix += 1;
    }
    return `${normalizedBase} (${suffix})`;
  }

  function toTemplateFileName(name) {
    const base = String(name || "template")
      .trim()
      .replace(/[^a-z0-9-_ ]/gi, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-+|-+$/g, "")
      .toLowerCase();
    return `${base || "template"}.json`;
  }

  function triggerJsonDownload(payload, fileName) {
    const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toLocalTemplateRecord(name, settings, now = Date.now()) {
    return {
      id: `${now}-${Math.random().toString(16).slice(2, 8)}`,
      name,
      settings,
      updatedAt: now,
    };
  }

  function getBaseNameFromFileName(fileName) {
    const trimmed = String(fileName || "").trim();
    if (!trimmed) {
      return "Imported Snapshot";
    }
    const withoutExt = trimmed.replace(/\.[^.]+$/, "").trim();
    return withoutExt || "Imported Snapshot";
  }

  function parseImportedTemplatePayload(parsed, fallbackName) {
    if (isTemplateDocument(parsed)) {
      if (parsed.meta.type !== TEMPLATE_DOCUMENT_TYPES.SNAPSHOT) {
        throw new Error(`Unsupported template document type "${parsed.meta.type}" for snapshot import.`);
      }
      return {
        name: typeof parsed.meta.name === "string" && parsed.meta.name.trim() ? parsed.meta.name.trim() : fallbackName,
        settings: toRuntimeSettingsFromTemplateDocument(parsed),
      };
    }
    if (parsed && typeof parsed === "object" && parsed.settings && typeof parsed.settings === "object") {
      return {
        name: typeof parsed.name === "string" && parsed.name.trim() ? parsed.name.trim() : fallbackName,
        settings: parsed.settings,
      };
    }
    return {
      name: fallbackName,
      settings: parsed,
    };
  }

  function getFilteredTemplateEntries() {
    const normalizedQuery = localTemplateSearchQuery.trim().toLowerCase();

    const demoVisible = hiddenDemoTemplateIds.length !== allDemoTemplateIds().length;
    const visibleDemoTemplates = demoTemplates
      .filter(() => demoVisible)
      .map((entry) => ({
        kind: "demo",
        id: entry.id,
        name: entry.name,
        settings: entry.settings,
        updatedAt: 0,
        metaText: "Read-only demo template",
      }));

    const localEntries = [...localTemplateCatalog]
      .sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name))
      .map((entry) => ({
        kind: "local",
        id: entry.id,
        name: entry.name,
        settings: entry.settings,
        updatedAt: entry.updatedAt,
        metaText: formatLocalTemplateTime(entry.updatedAt),
      }));

    const allEntries = [...visibleDemoTemplates, ...localEntries];
    if (!normalizedQuery) {
      return allEntries;
    }
    return allEntries.filter((entry) => entry.name.toLowerCase().includes(normalizedQuery));
  }

  function getEntryActiveClass(entry) {
    const key = `${entry.kind}:${entry.id}`;
    return key === activeTemplateKey ? " active" : "";
  }

  function renderLocalTemplateCatalog() {
    if (!refs.localTemplateListEl) {
      return;
    }

    const entries = getFilteredTemplateEntries();
    if (entries.length === 0) {
      refs.localTemplateListEl.innerHTML = '<div class="local-template-empty">No matching snapshots.</div>';
      return;
    }

    refs.localTemplateListEl.innerHTML = entries
      .map((entry) => {
        if (entry.kind === "demo") {
          return `<div class="local-template-item${getEntryActiveClass(entry)}" data-template-kind="demo" data-template-id="${escapeHtml(entry.id)}">
        <div class="local-template-main local-template-main-top">
          <button type="button" class="local-template-load demo" data-demo-template-load="${escapeHtml(entry.id)}" title="Load demo template">${escapeHtml(entry.name)}</button>
          <div class="local-template-tags">
            <span class="local-template-tag">DEMO</span>
          </div>
        </div>
        <div class="local-template-main local-template-main-bottom">
          <div class="local-template-meta">${escapeHtml(entry.metaText)}</div>
        </div>
      </div>`;
        }

        return `<div class="local-template-item${getEntryActiveClass(entry)}" data-template-kind="local" data-template-id="${escapeHtml(entry.id)}">
        <div class="local-template-main local-template-main-top">
          <button type="button" class="local-template-load" data-local-template-load="${escapeHtml(entry.id)}" title="Load snapshot">${escapeHtml(entry.name)}</button>
        </div>
        <div class="local-template-main local-template-main-bottom">
          <div class="local-template-meta">${escapeHtml(entry.metaText)}</div>
          <div class="local-template-actions">
            <button type="button" class="local-template-action" data-local-template-rename="${escapeHtml(entry.id)}" title="Edit name"><span class="action-icon action-icon-edit" aria-hidden="true"></span><span class="sr-only">Edit name</span></button>
            <button type="button" class="local-template-action" data-local-template-export="${escapeHtml(entry.id)}" title="Export snapshot"><span class="action-icon action-icon-ios-share" aria-hidden="true"></span><span class="sr-only">Export snapshot</span></button>
            <button type="button" class="local-template-action" data-local-template-overwrite="${escapeHtml(entry.id)}" title="Overwrite snapshot"><span class="action-icon action-icon-save-as" aria-hidden="true"></span><span class="sr-only">Overwrite snapshot</span></button>
            <button type="button" class="local-template-action" data-local-template-delete="${escapeHtml(entry.id)}" title="Delete"><span class="action-icon action-icon-delete" aria-hidden="true"></span><span class="sr-only">Delete template</span></button>
          </div>
        </div>
      </div>`;
      })
      .join("");
  }

  async function loadTemplateEntry(kind, templateId) {
    if (kind === "demo") {
      const entry = demoTemplates.find((item) => item.id === templateId);
      if (!entry) {
        return;
      }
      activeTemplateKey = `demo:${entry.id}`;
      renderLocalTemplateCatalog();
      await applySettings(entry.settings, { source: "template-manager" });
      return;
    }

    const entry = findLocalTemplateById(templateId);
    if (!entry || !entry.settings) {
      return;
    }
    activeTemplateKey = `local:${entry.id}`;
    renderLocalTemplateCatalog();
    await applySettings(entry.settings, { source: "template-manager" });
  }

  function promptTemplateName({ title, message, defaultValue = "", confirmLabel = "SAVE" }) {
    const modalEl = refs.templateNameModalEl;
    const titleEl = refs.templateNameModalTitleEl;
    const messageEl = refs.templateNameModalMessageEl;
    const inputEl = refs.templateNameModalInputEl;
    const cancelBtnEl = refs.templateNameModalCancelBtnEl;
    const confirmBtnEl = refs.templateNameModalConfirmBtnEl;

    if (
      !(modalEl instanceof HTMLElement) ||
      !(titleEl instanceof HTMLElement) ||
      !(messageEl instanceof HTMLElement) ||
      !(inputEl instanceof HTMLInputElement) ||
      !(cancelBtnEl instanceof HTMLButtonElement) ||
      !(confirmBtnEl instanceof HTMLButtonElement)
    ) {
      return Promise.resolve(window.prompt(message, defaultValue));
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    inputEl.value = String(defaultValue || "");
    confirmBtnEl.textContent = confirmLabel;
    modalEl.classList.remove("hidden");

    return new Promise((resolve) => {
      let settled = false;
      function cleanup() {
        if (settled) {
          return;
        }
        settled = true;
        modalEl.classList.add("hidden");
        cancelBtnEl.removeEventListener("click", onCancel);
        confirmBtnEl.removeEventListener("click", onConfirm);
        modalEl.removeEventListener("click", onBackdropClick);
        inputEl.removeEventListener("keydown", onInputKeydown);
      }
      function onCancel() {
        cleanup();
        resolve(null);
      }
      function onConfirm() {
        const value = inputEl.value;
        cleanup();
        resolve(value);
      }
      function onBackdropClick(event) {
        if (event.target === modalEl) {
          onCancel();
        }
      }
      function onInputKeydown(event) {
        if (event.key === "Enter") {
          event.preventDefault();
          onConfirm();
          return;
        }
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }

      cancelBtnEl.addEventListener("click", onCancel);
      confirmBtnEl.addEventListener("click", onConfirm);
      modalEl.addEventListener("click", onBackdropClick);
      inputEl.addEventListener("keydown", onInputKeydown);
      window.setTimeout(() => {
        inputEl.focus();
        inputEl.select();
      }, 0);
    });
  }

  function promptConfirm({ title = "Confirm", message, confirmLabel = "YES", cancelLabel = "NO" }) {
    const modalEl = refs.confirmModalEl;
    const titleEl = refs.confirmModalTitleEl;
    const messageEl = refs.confirmModalMessageEl;
    const cancelBtnEl = refs.confirmModalCancelBtnEl;
    const extraBtnEl = refs.confirmModalExtraBtnEl;
    const confirmBtnEl = refs.confirmModalConfirmBtnEl;

    if (
      !(modalEl instanceof HTMLElement) ||
      !(titleEl instanceof HTMLElement) ||
      !(messageEl instanceof HTMLElement) ||
      !(cancelBtnEl instanceof HTMLButtonElement) ||
      !(extraBtnEl instanceof HTMLButtonElement) ||
      !(confirmBtnEl instanceof HTMLButtonElement)
    ) {
      return Promise.resolve(window.confirm(message));
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    cancelBtnEl.textContent = cancelLabel;
    confirmBtnEl.textContent = confirmLabel;
    extraBtnEl.classList.add("hidden");
    modalEl.classList.remove("hidden");

    return new Promise((resolve) => {
      let settled = false;
      function cleanup() {
        if (settled) {
          return;
        }
        settled = true;
        modalEl.classList.add("hidden");
        cancelBtnEl.removeEventListener("click", onCancel);
        confirmBtnEl.removeEventListener("click", onConfirm);
        modalEl.removeEventListener("click", onBackdropClick);
        window.removeEventListener("keydown", onWindowKeydown);
      }
      function onCancel() {
        cleanup();
        resolve(false);
      }
      function onConfirm() {
        cleanup();
        resolve(true);
      }
      function onBackdropClick(event) {
        if (event.target === modalEl) {
          onCancel();
        }
      }
      function onWindowKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          onCancel();
        }
      }

      cancelBtnEl.addEventListener("click", onCancel);
      confirmBtnEl.addEventListener("click", onConfirm);
      modalEl.addEventListener("click", onBackdropClick);
      window.addEventListener("keydown", onWindowKeydown);
      window.setTimeout(() => {
        confirmBtnEl.focus();
      }, 0);
    });
  }

  function getImportErrorReason(error) {
    if (!error) {
      return "Unknown import error.";
    }
    if (error instanceof SyntaxError) {
      return "Invalid JSON format.";
    }
    const message = error instanceof Error ? String(error.message || "").trim() : "";
    if (!message) {
      return "Unknown import error.";
    }
    if (/exceeds the .* limit/i.test(message)) {
      return message;
    }
    if (/must be/i.test(message) || /unsupported/i.test(message) || /schema/i.test(message)) {
      return message;
    }
    return message;
  }

  function showImportAlert({ title, message }) {
    const modalEl = refs.importAlertModalEl;
    const titleEl = refs.importAlertModalTitleEl;
    const messageEl = refs.importAlertModalMessageEl;
    const closeBtnEl = refs.importAlertModalCloseBtnEl;

    if (
      !(modalEl instanceof HTMLElement) ||
      !(titleEl instanceof HTMLElement) ||
      !(messageEl instanceof HTMLElement) ||
      !(closeBtnEl instanceof HTMLButtonElement)
    ) {
      window.alert(`${title}\n\n${message}`);
      return Promise.resolve();
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    modalEl.classList.remove("hidden");

    return new Promise((resolve) => {
      let settled = false;
      function cleanup() {
        if (settled) {
          return;
        }
        settled = true;
        modalEl.classList.add("hidden");
        closeBtnEl.removeEventListener("click", onClose);
        modalEl.removeEventListener("click", onBackdropClick);
        window.removeEventListener("keydown", onWindowKeydown);
      }
      function onClose() {
        cleanup();
        resolve();
      }
      function onBackdropClick(event) {
        if (event.target === modalEl) {
          onClose();
        }
      }
      function onWindowKeydown(event) {
        if (event.key === "Escape") {
          event.preventDefault();
          onClose();
        }
      }
      closeBtnEl.addEventListener("click", onClose);
      modalEl.addEventListener("click", onBackdropClick);
      window.addEventListener("keydown", onWindowKeydown);
      window.setTimeout(() => closeBtnEl.focus(), 0);
    });
  }

  async function saveCurrentLocalTemplate() {
    const baseName = `Snapshot ${localTemplateCatalog.length + 1}`;
    const suggestedName = ensureUniqueLocalTemplateName(baseName);
    const inputName = await promptTemplateName({
      title: "Save Current Snapshot",
      message: "Enter a name for the new snapshot",
      defaultValue: suggestedName,
      confirmLabel: "SAVE",
    });
    if (inputName === null) {
      return;
    }

    const finalName = ensureUniqueLocalTemplateName(inputName.trim() || suggestedName);
    const snapshot = collectSettings();
    const entry = toLocalTemplateRecord(finalName, snapshot);

    localTemplateCatalog.push(entry);
    activeTemplateKey = `local:${entry.id}`;
    persistTemplateState();
    renderLocalTemplateCatalog();
  }

  function exportLocalTemplateById(templateId) {
    const entry = findLocalTemplateById(templateId);
    if (!entry || !entry.settings) {
      return;
    }
    const snapshotDocument = toTemplateDocumentFromSettings(entry.settings, {
      appVersion,
      type: TEMPLATE_DOCUMENT_TYPES.SNAPSHOT,
      name: entry.name,
    });
    const payload = JSON.stringify(snapshotDocument, null, 2);
    triggerJsonDownload(payload, toTemplateFileName(entry.name));
  }

  async function overwriteLocalTemplateById(templateId) {
    const entry = findLocalTemplateById(templateId);
    if (!entry) {
      return;
    }
    const shouldOverwrite = await promptConfirm({
      title: "Overwrite Snapshot",
      message: `Overwrite snapshot "${entry.name}"?`,
      confirmLabel: "YES",
      cancelLabel: "NO",
    });
    if (!shouldOverwrite) {
      return;
    }
    entry.settings = collectSettings();
    entry.updatedAt = Date.now();
    activeTemplateKey = `local:${entry.id}`;
    persistTemplateState();
    renderLocalTemplateCatalog();
  }

  async function renameLocalTemplateById(templateId) {
    const entry = findLocalTemplateById(templateId);
    if (!entry) {
      return;
    }

    const inputName = await promptTemplateName({
      title: "Rename Template",
      message: `Edit the name of the existing template "${entry.name}"`,
      defaultValue: entry.name,
      confirmLabel: "RENAME",
    });
    if (inputName === null) {
      return;
    }

    const candidate = inputName.trim() || entry.name;
    entry.name = ensureUniqueLocalTemplateName(candidate, entry.id);
    entry.updatedAt = Date.now();
    persistTemplateState();
    renderLocalTemplateCatalog();
  }

  async function deleteLocalTemplateById(templateId) {
    const existing = findLocalTemplateById(templateId);
    if (!existing) {
      return;
    }

    const shouldDelete = await promptConfirm({
      title: "Delete Snapshot",
      message: `Delete snapshot "${existing.name}"?`,
      confirmLabel: "YES",
      cancelLabel: "NO",
    });
    if (!shouldDelete) {
      return;
    }

    localTemplateCatalog = localTemplateCatalog.filter((entry) => entry.id !== templateId);
    if (activeTemplateKey === `local:${templateId}`) {
      activeTemplateKey = "";
    }
    persistTemplateState();
    renderLocalTemplateCatalog();
  }

  async function importTemplateFromFile(event) {
    const [file] = event.target.files || [];
    if (!file) {
      return;
    }

    try {
      assertFileSizeWithinLimit(file, maxImportFileBytes, "Template file");
      const text = await file.text();
      assertTextSizeWithinLimit(text, maxImportFileBytes, "Template file");
      const parsed = JSON.parse(text);
      const fallbackName = getBaseNameFromFileName(file.name);
      const imported = parseImportedTemplatePayload(parsed, fallbackName);
      const legacyRouted = routeLegacyTemplateImport(imported.settings, { source: "template import" });
      validateSettingsSchema(legacyRouted.settings, "template import");
      const hasPotentialRemoteCustomImages = Array.isArray(legacyRouted.settings?.fields?.customRows)
        && legacyRouted.settings.fields.customRows.some((row) =>
          /<img\b[^>]*\bsrc\s*=\s*["']?\s*https?:\/\//i.test(String(row?.text || ""))
        );

      const suggested = ensureUniqueLocalTemplateName(imported.name);
      const inputName = await promptTemplateName({
        title: "Import Snapshot",
        message: "Enter a name for the imported snapshot",
        defaultValue: suggested,
        confirmLabel: "IMPORT",
      });
      if (inputName === null) {
        return;
      }
      const finalName = ensureUniqueLocalTemplateName(inputName.trim() || suggested);

      const entry = toLocalTemplateRecord(finalName, legacyRouted.settings);
      localTemplateCatalog.push(entry);
      activeTemplateKey = `local:${entry.id}`;
      persistTemplateState();
      renderLocalTemplateCatalog();

      await applySettings(legacyRouted.settings, { source: "import" });
      if (hasPotentialRemoteCustomImages) {
        await showImportAlert({
          title: "Snapshot import safety notice",
          message: "Remote custom-note images were detected. For safety, imported remote custom images are blocked until you edit those custom rows.",
        });
      }
    } catch (error) {
      const reason = getImportErrorReason(error);
      console.error(error instanceof Error ? `Template import failed: ${error.message}` : "Template import failed.");
      await showImportAlert({
        title: "Error while importing snapshot file",
        message: reason,
      });
    } finally {
      if (refs.importLocalTemplateFileEl) {
        refs.importLocalTemplateFileEl.value = "";
      }
    }
  }

  function areDemoTemplatesVisible() {
    return hiddenDemoTemplateIds.length !== allDemoTemplateIds().length;
  }

  function setDemoTemplatesVisible(isVisible) {
    hiddenDemoTemplateIds = isVisible ? [] : allDemoTemplateIds();
    hiddenDemoTemplateIds = normalizeHiddenDemoTemplateIds(hiddenDemoTemplateIds);
    if (!isVisible && activeTemplateKey.startsWith("demo:")) {
      activeTemplateKey = "";
    }
    persistTemplateState();
    renderLocalTemplateCatalog();
  }

  async function loadDemoTemplates() {
    const loaded = [];
    for (const source of DEMO_TEMPLATE_SOURCES) {
      try {
        const res = await fetch(source.file, { cache: "no-store" });
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const parsed = await res.json();
        let settingsForDemo = null;
        if (isTemplateDocument(parsed)) {
          if (parsed.meta.type === TEMPLATE_DOCUMENT_TYPES.SNAPSHOT) {
            settingsForDemo = toRuntimeSettingsFromTemplateDocument(parsed, { mode: "snapshot" });
          } else if (parsed.meta.type === TEMPLATE_DOCUMENT_TYPES.CONTENT_TEMPLATE) {
            settingsForDemo = toRuntimeSettingsFromTemplateDocument(parsed, { mode: "content" });
          } else if (parsed.meta.type === TEMPLATE_DOCUMENT_TYPES.DESIGN) {
            settingsForDemo = toRuntimeSettingsFromTemplateDocument(parsed, { mode: "design" });
          } else {
            throw new Error(`Unsupported template document type "${parsed.meta.type}" in demo template.`);
          }
        } else {
          const legacyRouted = routeLegacyTemplateImport(parsed, { source: `demo template ${source.id}` });
          settingsForDemo = legacyRouted.settings;
        }
        validateSettingsSchema(settingsForDemo, `demo template ${source.id}`);
        loaded.push({
          id: source.id,
          name: source.name,
          settings: settingsForDemo,
        });
      } catch {
        // Keep app functional even if one demo template is missing.
      }
    }
    demoTemplates = loaded;
  }

  function bindDesignInteractions() {
    if (!refs.designButtonGridEl) {
      return;
    }

    refs.designButtonGridEl.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const defaultBtn = target.closest("button[data-design-default]");
      if (defaultBtn instanceof HTMLButtonElement) {
        const didLoad = await loadDefaultDesign(defaultBtn.getAttribute("data-design-default"));
        if (didLoad) {
          flashLoadedDesignButton(defaultBtn);
        }
        return;
      }

      const deleteBtn = target.closest("button[data-design-slot-delete]");
      if (deleteBtn instanceof HTMLButtonElement) {
        if (deleteBtn.disabled) {
          return;
        }
        const slot = deleteBtn.getAttribute("data-design-slot-delete") || "";
        const shouldDelete = await promptConfirm({
          title: "Delete Design",
          message: "Delete this saved design?",
          confirmLabel: "YES",
          cancelLabel: "NO",
        });
        if (!shouldDelete) {
          return;
        }
        deleteUserDesignSlot(slot);
        return;
      }

      const slotBtn = target.closest("button[data-design-slot]");
      if (slotBtn instanceof HTMLButtonElement) {
        const slot = slotBtn.getAttribute("data-design-slot") || "";
        const hasDesign = Boolean(userDesignSlots[slot]);
        if (hasDesign) {
          const didLoad = await loadUserDesignSlot(slot);
          if (didLoad) {
            flashLoadedDesignButton(slotBtn);
          }
        } else if (saveCurrentDesignToSlot(slot)) {
          flashLoadedDesignButton(slotBtn);
        }
      }
    });
  }

  function bindLocalTemplateInteractions() {
    const syncSearchClearButton = () => {
      if (!refs.localTemplateSearchEl || !refs.localTemplateSearchClearEl) {
        return;
      }
      refs.localTemplateSearchClearEl.disabled = !refs.localTemplateSearchEl.value.trim();
    };

    refs.saveLocalTemplateBtn?.addEventListener("click", async () => {
      await saveCurrentLocalTemplate();
    });

    refs.importLocalTemplateBtn?.addEventListener("click", () => {
      refs.importLocalTemplateFileEl?.click();
    });

    refs.importLocalTemplateFileEl?.addEventListener("change", importTemplateFromFile);

    refs.localTemplateSearchEl?.addEventListener("input", () => {
      localTemplateSearchQuery = refs.localTemplateSearchEl?.value || "";
      renderLocalTemplateCatalog();
      syncSearchClearButton();
    });

    refs.localTemplateSearchClearEl?.addEventListener("click", () => {
      if (!refs.localTemplateSearchEl) {
        return;
      }
      refs.localTemplateSearchEl.value = "";
      localTemplateSearchQuery = "";
      renderLocalTemplateCatalog();
      syncSearchClearButton();
      refs.localTemplateSearchEl.focus();
    });

    syncSearchClearButton();

    refs.localTemplateListEl?.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const loadLocalBtn = target.closest("button[data-local-template-load]");
      if (loadLocalBtn instanceof HTMLButtonElement) {
        const id = loadLocalBtn.getAttribute("data-local-template-load") || "";
        if (id) {
          await loadTemplateEntry("local", id);
        }
        return;
      }

      const loadDemoBtn = target.closest("button[data-demo-template-load]");
      if (loadDemoBtn instanceof HTMLButtonElement) {
        const id = loadDemoBtn.getAttribute("data-demo-template-load") || "";
        if (id) {
          await loadTemplateEntry("demo", id);
        }
        return;
      }

      const renameBtn = target.closest("button[data-local-template-rename]");
      if (renameBtn instanceof HTMLButtonElement) {
        const id = renameBtn.getAttribute("data-local-template-rename") || "";
        if (id) {
          await renameLocalTemplateById(id);
        }
        return;
      }

      const exportBtn = target.closest("button[data-local-template-export]");
      if (exportBtn instanceof HTMLButtonElement) {
        const id = exportBtn.getAttribute("data-local-template-export") || "";
        if (id) {
          exportLocalTemplateById(id);
        }
        return;
      }

      const overwriteBtn = target.closest("button[data-local-template-overwrite]");
      if (overwriteBtn instanceof HTMLButtonElement) {
        const id = overwriteBtn.getAttribute("data-local-template-overwrite") || "";
        if (id) {
          await overwriteLocalTemplateById(id);
        }
        return;
      }

      const deleteBtn = target.closest("button[data-local-template-delete]");
      if (deleteBtn instanceof HTMLButtonElement) {
        const id = deleteBtn.getAttribute("data-local-template-delete") || "";
        if (id) {
          await deleteLocalTemplateById(id);
        }
        return;
      }

      const item = target.closest(".local-template-item");
      if (item instanceof HTMLElement) {
        const id = item.getAttribute("data-template-id") || "";
        const kind = item.getAttribute("data-template-kind") || "";
        if (id && (kind === "local" || kind === "demo")) {
          await loadTemplateEntry(kind, id);
        }
      }

    });
  }

  function syncFromState() {
    loadFromState();
    renderDesignSlots();
    renderLocalTemplateCatalog();
  }

  async function initTemplateManager() {
    if (interactionsBound) {
      return;
    }
    interactionsBound = true;

    bindDesignInteractions();
    bindLocalTemplateInteractions();
    await loadDemoTemplates();
    syncFromState();
  }

  return {
    syncFromState,
    initTemplateManager,
    areDemoTemplatesVisible,
    setDemoTemplatesVisible,
  };
}
