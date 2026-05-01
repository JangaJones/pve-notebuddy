import { normalizeSvgPreferredMode, normalizeWeservDomain } from "../core/state.js";

export function createSettingsFeature({
  refs,
  getState,
  patchState,
  replaceState,
  prepareIcon,
  readTextFile,
  assertFileSizeWithinLimit,
  assertTextSizeWithinLimit,
  maxImportFileBytes,
  onAfterStateApplied,
  isDemoTemplatesVisible,
  onSetDemoTemplatesVisible,
}) {
  function getConfiguredWeservDomain() {
    return normalizeWeservDomain(getState().settings.weservDomain);
  }

  function getWeservBaseUrl() {
    return getConfiguredWeservDomain() || "https://wsrv.nl";
  }

  function getPreferredSvgMode() {
    return normalizeSvgPreferredMode(getState().settings.svgPreferredMode);
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
      replaceState(JSON.parse(text));
      onAfterStateApplied();
    } catch {
      // Ignore invalid import files.
    } finally {
      input.value = "";
    }
  }

  function resetAppStateToDefaults(defaultState) {
    replaceState(defaultState);
    onAfterStateApplied();
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
      refs.resetStorageBtnEl.addEventListener("click", () => resetAppStateToDefaults(defaultState));
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
    syncSettingsPaneFromState,
    initSettingsPane,
  };
}
