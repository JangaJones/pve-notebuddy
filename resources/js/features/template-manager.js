export function createTemplateManagerFeature({
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
  const DEMO_TEMPLATE_SOURCES = [
    { id: "demo-template-1", name: "Demo Template 1", file: "./templates/app/demo-template-1.json" },
    { id: "demo-template-2", name: "Demo Template 2", file: "./templates/app/demo-template-2.json" },
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
        slotBtn.textContent = hasDesign ? slotKey : "+";
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
    const normalizedBase = String(baseName || "Local Template").trim() || "Local Template";
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
      return "Imported Template";
    }
    const withoutExt = trimmed.replace(/\.[^.]+$/, "").trim();
    return withoutExt || "Imported Template";
  }

  function parseImportedTemplatePayload(parsed, fallbackName) {
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
      refs.localTemplateListEl.innerHTML = '<div class="local-template-empty">No matching local templates.</div>';
      return;
    }

    refs.localTemplateListEl.innerHTML = entries
      .map((entry) => {
        if (entry.kind === "demo") {
          return `<div class="local-template-item" data-template-kind="demo" data-template-id="${escapeHtml(entry.id)}">
        <div class="local-template-main">
          <button type="button" class="local-template-load demo${getEntryActiveClass(entry)}" data-demo-template-load="${escapeHtml(entry.id)}" title="Load demo template">${escapeHtml(entry.name)}</button>
          <div class="local-template-actions">
            <span class="local-template-tag">DEMO</span>
          </div>
        </div>
        <div class="local-template-meta">${escapeHtml(entry.metaText)}</div>
      </div>`;
        }

        return `<div class="local-template-item" data-template-kind="local" data-template-id="${escapeHtml(entry.id)}">
        <div class="local-template-main">
          <button type="button" class="local-template-load${getEntryActiveClass(entry)}" data-local-template-load="${escapeHtml(entry.id)}" title="Load local template">${escapeHtml(entry.name)}</button>
          <div class="local-template-actions">
            <button type="button" class="local-template-action" data-local-template-rename="${escapeHtml(entry.id)}" title="Rename">✏️</button>
            <button type="button" class="local-template-action" data-local-template-export="${escapeHtml(entry.id)}" title="Export">📤</button>
            <button type="button" class="local-template-action" data-local-template-overwrite="${escapeHtml(entry.id)}" title="Overwrite">♻️</button>
            <button type="button" class="local-template-action" data-local-template-delete="${escapeHtml(entry.id)}" title="Delete"><span class="action-icon action-icon-delete" aria-hidden="true"></span><span class="sr-only">Delete template</span></button>
          </div>
        </div>
        <div class="local-template-meta">${escapeHtml(entry.metaText)}</div>
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
      await applySettings(entry.settings, { source: "template" });
      return;
    }

    const entry = findLocalTemplateById(templateId);
    if (!entry || !entry.settings) {
      return;
    }
    activeTemplateKey = `local:${entry.id}`;
    renderLocalTemplateCatalog();
    await applySettings(entry.settings, { source: "template" });
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

  async function saveCurrentLocalTemplate() {
    const baseName = `Local Template ${localTemplateCatalog.length + 1}`;
    const suggestedName = ensureUniqueLocalTemplateName(baseName);
    const inputName = await promptTemplateName({
      title: "Save Current Template",
      message: "Enter a name for the new template",
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
    const payload = JSON.stringify(entry.settings, null, 2);
    triggerJsonDownload(payload, toTemplateFileName(entry.name));
  }

  function overwriteLocalTemplateById(templateId) {
    const entry = findLocalTemplateById(templateId);
    if (!entry) {
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

  function deleteLocalTemplateById(templateId) {
    const existing = findLocalTemplateById(templateId);
    if (!existing) {
      return;
    }

    const shouldDelete = window.confirm(`Delete local template \"${existing.name}\"?`);
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
      validateSettingsSchema(imported.settings, "template import");

      const suggested = ensureUniqueLocalTemplateName(imported.name);
      const inputName = window.prompt("Imported template name:", suggested);
      if (inputName === null) {
        return;
      }
      const finalName = ensureUniqueLocalTemplateName(inputName.trim() || suggested);

      const entry = toLocalTemplateRecord(finalName, imported.settings);
      localTemplateCatalog.push(entry);
      activeTemplateKey = `local:${entry.id}`;
      persistTemplateState();
      renderLocalTemplateCatalog();

      await applySettings(imported.settings, { source: "import" });
    } catch (error) {
      console.error(error instanceof Error ? `Template import failed: ${error.message}` : "Template import failed.");
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
        validateSettingsSchema(parsed, `demo template ${source.id}`);
        loaded.push({
          id: source.id,
          name: source.name,
          settings: parsed,
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
    });

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
          overwriteLocalTemplateById(id);
        }
        return;
      }

      const deleteBtn = target.closest("button[data-local-template-delete]");
      if (deleteBtn instanceof HTMLButtonElement) {
        const id = deleteBtn.getAttribute("data-local-template-delete") || "";
        if (id) {
          deleteLocalTemplateById(id);
        }
        return;
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
