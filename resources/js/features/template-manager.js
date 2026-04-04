export function createTemplateManagerFeature({
  refs,
  getState,
  patchState,
  normalizeLocalTemplateCatalog,
  escapeHtml,
  collectSettings,
  applySettings,
  validateSettingsSchema,
  assertFileSizeWithinLimit,
  assertTextSizeWithinLimit,
  maxImportFileBytes,
}) {
  let localTemplateCatalog = [];
  let activeTemplateId = "";

  function loadLocalTemplateCatalog() {
    localTemplateCatalog = normalizeLocalTemplateCatalog(getState().templates.localCatalog);
    if (!localTemplateCatalog.some((entry) => entry.id === activeTemplateId)) {
      activeTemplateId = "";
    }
  }

  function persistLocalTemplateCatalog() {
    patchState((state) => {
      state.templates.localCatalog = normalizeLocalTemplateCatalog(localTemplateCatalog);
    });
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

  function renderLocalTemplateCatalog() {
    if (!refs.localTemplateListEl) {
      return;
    }
    if (localTemplateCatalog.length === 0) {
      refs.localTemplateListEl.innerHTML = '<div class="local-template-empty">No local templates yet.</div>';
      return;
    }

    const sorted = [...localTemplateCatalog].sort((a, b) => b.updatedAt - a.updatedAt || a.name.localeCompare(b.name));
    refs.localTemplateListEl.innerHTML = sorted
      .map((entry) => {
        const updated = formatLocalTemplateTime(entry.updatedAt);
        const isActive = entry.id === activeTemplateId;
        return `<div class="local-template-item" data-local-template-id="${escapeHtml(entry.id)}">
        <button type="button" class="local-template-load${isActive ? " active" : ""}" data-local-template-id="${escapeHtml(entry.id)}" title="Load local template">${escapeHtml(entry.name)}</button>
        <div class="local-template-meta">${escapeHtml(updated)}</div>
        <button type="button" class="local-template-delete" data-local-template-id="${escapeHtml(entry.id)}" aria-label="Delete ${escapeHtml(entry.name)}">✕</button>
      </div>`;
      })
      .join("");
  }

  function setTemplateNameInput(name) {
    if (refs.localTemplateNameEl) {
      refs.localTemplateNameEl.value = String(name || "");
    }
  }

  function findTemplateByName(name) {
    const normalized = String(name || "").trim().toLowerCase();
    if (!normalized) {
      return null;
    }
    return localTemplateCatalog.find((entry) => entry.name.toLowerCase() === normalized) || null;
  }

  function saveCurrentLocalTemplate() {
    if (!refs.localTemplateNameEl) {
      return;
    }
    const name = refs.localTemplateNameEl.value.trim();
    if (!name) {
      return;
    }

    const existing = findTemplateByName(name);
    const snapshot = collectSettings();
    const now = Date.now();
    if (existing) {
      existing.settings = snapshot;
      existing.updatedAt = now;
      existing.name = name;
      activeTemplateId = existing.id;
    } else {
      const id = `${now}-${Math.random().toString(16).slice(2, 8)}`;
      localTemplateCatalog.push({ id, name, settings: snapshot, updatedAt: now });
      activeTemplateId = id;
    }

    persistLocalTemplateCatalog();
    renderLocalTemplateCatalog();
  }

  async function loadLocalTemplateById(templateId) {
    const entry = localTemplateCatalog.find((item) => item.id === templateId);
    if (!entry || !entry.settings) {
      return;
    }
    activeTemplateId = entry.id;
    setTemplateNameInput(entry.name);
    renderLocalTemplateCatalog();
    await applySettings(entry.settings, { source: "template" });
  }

  function deleteLocalTemplateById(templateId) {
    const before = localTemplateCatalog.length;
    localTemplateCatalog = localTemplateCatalog.filter((entry) => entry.id !== templateId);
    if (localTemplateCatalog.length === before) {
      return;
    }
    if (activeTemplateId === templateId) {
      activeTemplateId = "";
    }
    persistLocalTemplateCatalog();
    renderLocalTemplateCatalog();
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

  function resolveExportTemplate() {
    const byActiveId = localTemplateCatalog.find((entry) => entry.id === activeTemplateId) || null;
    if (byActiveId) {
      return byActiveId;
    }

    const byInputName = findTemplateByName(refs.localTemplateNameEl?.value || "");
    if (byInputName) {
      return byInputName;
    }

    if (localTemplateCatalog.length === 1) {
      return localTemplateCatalog[0];
    }

    if (localTemplateCatalog.length > 1) {
      return [...localTemplateCatalog].sort((a, b) => b.updatedAt - a.updatedAt)[0];
    }

    return null;
  }

  function exportTemplateToFile() {
    const entry = resolveExportTemplate();
    if (!entry || !entry.settings) {
      return;
    }
    // Keep template export compatible with legacy single-template JSON files.
    const payload = JSON.stringify(entry.settings, null, 2);
    triggerJsonDownload(payload, toTemplateFileName(entry.name));
  }

  function getBaseNameFromFileName(fileName) {
    const trimmed = String(fileName || "").trim();
    if (!trimmed) {
      return "Imported Template";
    }
    const withoutExt = trimmed.replace(/\.[^.]+$/, "").trim();
    if (!withoutExt) {
      return "Imported Template";
    }
    return withoutExt;
  }

  function ensureUniqueImportedName(baseName) {
    const normalizedBase = String(baseName || "Imported Template").trim() || "Imported Template";
    const lower = normalizedBase.toLowerCase();
    if (!localTemplateCatalog.some((entry) => entry.name.toLowerCase() === lower)) {
      return normalizedBase;
    }
    let suffix = 2;
    while (localTemplateCatalog.some((entry) => entry.name.toLowerCase() === `${normalizedBase} (${suffix})`.toLowerCase())) {
      suffix += 1;
    }
    return `${normalizedBase} (${suffix})`;
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

      const uniqueName = ensureUniqueImportedName(imported.name);
      const now = Date.now();
      const id = `${now}-${Math.random().toString(16).slice(2, 8)}`;
      localTemplateCatalog.push({
        id,
        name: uniqueName,
        settings: imported.settings,
        updatedAt: now,
      });
      activeTemplateId = id;
      setTemplateNameInput(uniqueName);
      persistLocalTemplateCatalog();
      renderLocalTemplateCatalog();

      await applySettings(imported.settings, { source: "import" });
    } catch (error) {
      console.error(error instanceof Error ? `Template import failed: ${error.message}` : "Template import failed.");
    } finally {
      if (refs.importFileEl) {
        refs.importFileEl.value = "";
      }
    }
  }

  function syncFromState() {
    loadLocalTemplateCatalog();
    renderLocalTemplateCatalog();
  }

  function initTemplateManager() {
    if (refs.saveLocalTemplateBtn) {
      refs.saveLocalTemplateBtn.addEventListener("click", saveCurrentLocalTemplate);
    }
    if (refs.localTemplateNameEl) {
      refs.localTemplateNameEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        saveCurrentLocalTemplate();
      });
    }

    if (refs.localTemplateListEl) {
      refs.localTemplateListEl.addEventListener("click", async (event) => {
        const target = event.target;
        if (!(target instanceof HTMLElement)) {
          return;
        }
        const loadBtn = target.closest(".local-template-load");
        if (loadBtn instanceof HTMLElement) {
          const id = loadBtn.getAttribute("data-local-template-id") || "";
          if (id) {
            await loadLocalTemplateById(id);
          }
          return;
        }

        const deleteBtn = target.closest(".local-template-delete");
        if (deleteBtn instanceof HTMLElement) {
          const id = deleteBtn.getAttribute("data-local-template-id") || "";
          if (id) {
            deleteLocalTemplateById(id);
          }
        }
      });
    }

    if (refs.exportBtn) {
      refs.exportBtn.addEventListener("click", exportTemplateToFile);
    }
    if (refs.importBtn && refs.importFileEl) {
      refs.importBtn.addEventListener("click", () => refs.importFileEl.click());
    }
    if (refs.importFileEl) {
      refs.importFileEl.addEventListener("change", importTemplateFromFile);
    }
  }

  return {
    syncFromState,
    initTemplateManager,
    loadLocalTemplateById,
    saveCurrentLocalTemplate,
    deleteLocalTemplateById,
  };
}
