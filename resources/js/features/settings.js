import { normalizeIconSearchThumbnailSource, normalizeSvgPreferredMode, normalizeWeservDomain } from "../core/state.js";

export function createSettingsFeature({
  refs,
  getState,
  patchState,
  replaceState,
  clearAppStorage,
  prepareIcon,
  readTextFile,
  assertFileSizeWithinLimit,
  assertTextSizeWithinLimit,
  maxImportFileBytes,
  onAfterStateApplied,
  isDemoTemplatesVisible,
  onSetDemoTemplatesVisible,
}) {
  function validateImportedSettingsSchema(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Unsupported settings schema. Expected a JSON object.");
    }
    const hasKnownTopLevelSection = ["ui", "settings", "templates"].some((key) => key in value);
    if (!hasKnownTopLevelSection) {
      throw new Error("Unsupported settings schema. Expected ui/settings/templates sections.");
    }
    if (value.ui !== undefined && (typeof value.ui !== "object" || value.ui === null || Array.isArray(value.ui))) {
      throw new Error("Unsupported settings schema. The 'ui' section must be an object.");
    }
    if (
      value.settings !== undefined &&
      (typeof value.settings !== "object" || value.settings === null || Array.isArray(value.settings))
    ) {
      throw new Error("Unsupported settings schema. The 'settings' section must be an object.");
    }
    if (
      value.templates !== undefined &&
      (typeof value.templates !== "object" || value.templates === null || Array.isArray(value.templates))
    ) {
      throw new Error("Unsupported settings schema. The 'templates' section must be an object.");
    }
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

  function getConfiguredWeservDomain() {
    return normalizeWeservDomain(getState().settings.weservDomain);
  }

  function getWeservBaseUrl() {
    return getConfiguredWeservDomain() || "https://wsrv.nl";
  }

  function getPreferredSvgMode() {
    return normalizeSvgPreferredMode(getState().settings.svgPreferredMode);
  }

  function getIconSearchThumbnailSource() {
    return normalizeIconSearchThumbnailSource(getState().settings.iconSearchThumbnails);
  }

  function updateWeservResizeUi() {
    const customDomain = getConfiguredWeservDomain();
    const hasCustomDomain = Boolean(customDomain);
    const serviceName = hasCustomDomain ? "weserv/images" : "wsrv.nl";
    const serviceHref = hasCustomDomain ? customDomain : "https://wsrv.nl/";
    const tooltipText = hasCustomDomain
      ? "Uses weserv/images custom domain to resize the linked image."
      : "Uses wsrv.nl (Open Source + worldwide CDN via Cloudflare) to resize & cache the linked image through their service.";

    if (refs.iconResizeLabelPrefixEl) {
      refs.iconResizeLabelPrefixEl.textContent = "Resize with";
    }
    if (refs.iconResizeServiceLinkEl) {
      refs.iconResizeServiceLinkEl.textContent = serviceName;
      refs.iconResizeServiceLinkEl.href = serviceHref;
    }
    if (refs.iconResizeServiceTooltipEl) {
      refs.iconResizeServiceTooltipEl.textContent = tooltipText;
    }
    if (refs.settingsSvgPreferredModeEl) {
      const resizeLabel = hasCustomDomain ? "Resize with weserv/images" : "Resize with wsrv.nl";
      const resizeOption = refs.settingsSvgPreferredModeEl.querySelector('option[value="resize"]');
      if (resizeOption) {
        resizeOption.textContent = resizeLabel;
      }
    }
  }

  function syncSettingsPaneFromState() {
    if (refs.settingsWeservDomainEl) {
      refs.settingsWeservDomainEl.value = getConfiguredWeservDomain();
    }
    if (refs.settingsSvgPreferredModeEl) {
      refs.settingsSvgPreferredModeEl.value = getPreferredSvgMode();
    }
    if (refs.settingsIconSearchThumbnailsEl) {
      refs.settingsIconSearchThumbnailsEl.value = getIconSearchThumbnailSource();
    }
    if (refs.settingsShowDemoTemplatesEl) {
      refs.settingsShowDemoTemplatesEl.checked = isDemoTemplatesVisible ? Boolean(isDemoTemplatesVisible()) : true;
    }
    updateWeservResizeUi();
  }

  function saveSvgPreferredModeSetting() {
    if (!refs.settingsSvgPreferredModeEl) {
      return;
    }
    const next = normalizeSvgPreferredMode(refs.settingsSvgPreferredModeEl.value);
    patchState((state) => {
      state.settings.svgPreferredMode = next;
    });
    syncSettingsPaneFromState();
    prepareIcon({ respectPreferredSvgMode: true });
  }

  function saveWeservDomainSetting() {
    if (!refs.settingsWeservDomainEl) {
      return;
    }
    const normalized = normalizeWeservDomain(refs.settingsWeservDomainEl.value);
    patchState((state) => {
      state.settings.weservDomain = normalized;
    });
    syncSettingsPaneFromState();
    prepareIcon();
  }

  function saveIconSearchThumbnailSetting() {
    if (!refs.settingsIconSearchThumbnailsEl) {
      return;
    }
    const next = normalizeIconSearchThumbnailSource(refs.settingsIconSearchThumbnailsEl.value);
    const current = getIconSearchThumbnailSource();
    if (next === current) {
      syncSettingsPaneFromState();
      return;
    }
    patchState((state) => {
      state.settings.iconSearchThumbnails = next;
    });
    syncSettingsPaneFromState();
    window.location.reload();
  }

  function deleteWeservDomainSetting() {
    patchState((state) => {
      state.settings.weservDomain = "";
    });
    syncSettingsPaneFromState();
    prepareIcon();
  }

  function exportAppStateToFile() {
    const payload = JSON.stringify(getState(), null, 2);
    const blob = new Blob([payload], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "pve-notebuddy-local-storage.json";
    document.body.append(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function importAppStateFromFile(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const file = input.files?.[0];
    if (!file) {
      return;
    }
    try {
      assertFileSizeWithinLimit(file, maxImportFileBytes, "Storage import file");
      const text = await readTextFile(file);
      assertTextSizeWithinLimit(text, maxImportFileBytes, "Storage import file");
      const parsed = JSON.parse(text);
      validateImportedSettingsSchema(parsed);
      replaceState(parsed);
      onAfterStateApplied();
    } catch (error) {
      const reason = getImportErrorReason(error);
      console.error(error instanceof Error ? `Settings import failed: ${error.message}` : "Settings import failed.");
      await showImportAlert({
        title: "Error while importing settings file",
        message: reason,
      });
    } finally {
      input.value = "";
    }
  }

  function resetAppStateToDefaults(defaultState) {
    clearAppStorage?.();
    replaceState(defaultState);
    onAfterStateApplied();
  }

  function promptConfirm({
    title = "Confirm",
    message,
    confirmLabel = "YES",
    cancelLabel = "NO",
    extraLabel = "",
  }) {
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
      if (extraLabel) {
        return Promise.resolve(window.confirm(`${message}\n\nSelect OK to export and reset, Cancel to abort.`) ? "extra" : "cancel");
      }
      return Promise.resolve(window.confirm(message) ? "confirm" : "cancel");
    }

    titleEl.textContent = title;
    messageEl.textContent = message;
    cancelBtnEl.textContent = cancelLabel;
    extraBtnEl.textContent = extraLabel;
    confirmBtnEl.textContent = confirmLabel;
    extraBtnEl.classList.toggle("hidden", !extraLabel);
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
        extraBtnEl.removeEventListener("click", onExtra);
        confirmBtnEl.removeEventListener("click", onConfirm);
        modalEl.removeEventListener("click", onBackdropClick);
        window.removeEventListener("keydown", onWindowKeydown);
      }
      function onCancel() {
        cleanup();
        resolve("cancel");
      }
      function onExtra() {
        cleanup();
        resolve("extra");
      }
      function onConfirm() {
        cleanup();
        resolve("confirm");
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
      extraBtnEl.addEventListener("click", onExtra);
      confirmBtnEl.addEventListener("click", onConfirm);
      modalEl.addEventListener("click", onBackdropClick);
      window.addEventListener("keydown", onWindowKeydown);
      window.setTimeout(() => {
        confirmBtnEl.focus();
      }, 0);
    });
  }

  function initSettingsPane(defaultState) {
    syncSettingsPaneFromState();

    if (refs.saveWeservDomainBtnEl) {
      refs.saveWeservDomainBtnEl.addEventListener("click", saveWeservDomainSetting);
    }
    if (refs.deleteWeservDomainBtnEl) {
      refs.deleteWeservDomainBtnEl.addEventListener("click", deleteWeservDomainSetting);
    }
    if (refs.settingsWeservDomainEl) {
      refs.settingsWeservDomainEl.addEventListener("keydown", (event) => {
        if (event.key !== "Enter") {
          return;
        }
        event.preventDefault();
        saveWeservDomainSetting();
      });
    }
    if (refs.settingsSvgPreferredModeEl) {
      refs.settingsSvgPreferredModeEl.addEventListener("change", saveSvgPreferredModeSetting);
    }
    if (refs.settingsIconSearchThumbnailsEl) {
      refs.settingsIconSearchThumbnailsEl.addEventListener("change", saveIconSearchThumbnailSetting);
    }
    if (refs.exportStorageBtnEl) {
      refs.exportStorageBtnEl.addEventListener("click", exportAppStateToFile);
    }
    if (refs.importStorageBtnEl && refs.importStorageFileEl) {
      refs.importStorageBtnEl.addEventListener("click", () => refs.importStorageFileEl.click());
    }
    if (refs.importStorageFileEl) {
      refs.importStorageFileEl.addEventListener("change", importAppStateFromFile);
    }
    if (refs.resetStorageBtnEl) {
      refs.resetStorageBtnEl.addEventListener("click", async () => {
        const action = await promptConfirm({
          title: "Reset Settings",
          message: "This will wipe all NoteBuddy settings and local NoteBuddy data.",
          confirmLabel: "YES",
          cancelLabel: "NO",
          extraLabel: "EXPORT AND RESET",
        });
        if (action === "cancel") {
          return;
        }
        if (action === "extra") {
          exportAppStateToFile();
        }
        resetAppStateToDefaults(defaultState);
      });
    }
    if (refs.settingsShowDemoTemplatesEl) {
      refs.settingsShowDemoTemplatesEl.addEventListener("change", () => {
        onSetDemoTemplatesVisible?.(Boolean(refs.settingsShowDemoTemplatesEl.checked));
      });
    }
  }

  return {
    getConfiguredWeservDomain,
    getWeservBaseUrl,
    getPreferredSvgMode,
    getIconSearchThumbnailSource,
    syncSettingsPaneFromState,
    initSettingsPane,
  };
}
