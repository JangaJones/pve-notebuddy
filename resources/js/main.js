import {
  createAppStateStore,
  normalizeLocalTemplateCatalog,
  normalizeSidebarPanel,
  normalizeWeservDomain,
} from "./core/state.js";
import {
  APP_STATE_STORAGE_KEY,
  DEFAULT_APP_STATE,
  GITHUB_RELEASE_CACHE_TTL_MS,
  GITHUB_STARS_CACHE_TTL_MS,
  LEGACY_EMOJI_RAIL_STORAGE_KEY,
  LEGACY_LOCAL_TEMPLATES_STORAGE_KEY,
  LEGACY_SIDEBAR_COLLAPSED_STORAGE_KEY,
  MAX_FETCHED_SVG_BYTES,
  MAX_IMPORT_FILE_BYTES,
  MAX_OUTPUT_LENGTH,
  MAX_UPLOAD_RASTER_BYTES,
  MAX_UPLOAD_SVG_BYTES,
  MIN_DESKTOP_VIEWPORT_WIDTH,
  PROXMOX_NOTE_EMOJI_GROUPS,
} from "./core/config.js";
import { getEl } from "./core/dom.js";
import {
  assertFileSizeWithinLimit,
  assertTextSizeWithinLimit,
  escapeHtml,
  isAllowedIconImageUrl,
  isCrossOriginHttpUrl,
  readTextFile,
} from "./core/utils.js";
import { fetchJsonWithCache } from "./services/http-cache.service.js";
import { createGithubMetadataService } from "./services/github-metadata.js";
import { createSidebarFeature } from "./features/sidebar.js";
import { createSettingsFeature } from "./features/settings.js";
import { createEmojiFeature } from "./features/emoji.js";
import { loadPublicTemplateCatalog as fetchPublicTemplateCatalog } from "./features/template-search.js";
import { createTemplateManagerFeature } from "./features/template-manager.js";
import { createTemplateSettingsFeature } from "./features/template-settings.js";
import { createIconFeature } from "./features/icon.js";
import { createNoteBuilderFeature } from "./features/note-builder.js";
import { createPreviewFeature } from "./features/preview.js";
import { createTemplateSearchUiFeature } from "./features/template-search-ui.js";
import { createAppShellFeature } from "./features/app-shell.js";
import { createRowEditorFeature } from "./features/row-editor.js";

const form = document.getElementById("noteForm");
const outputEl = document.getElementById("output");
const previewCard = document.getElementById("previewCard");
const copyBtn = document.getElementById("copyBtn");
const charCountEl = document.getElementById("charCount");
const charWarningEl = document.getElementById("charWarning");
const previewShell = document.getElementById("previewShell");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeIconEl = document.getElementById("themeIcon");
const githubStarCountEl = document.getElementById("githubStarCount");
const appVersionValueEl = document.getElementById("appVersionValue");
const appVersionStatusEl = document.getElementById("appVersionStatus");
const clearBtn = document.getElementById("clearBtn");
const importBtn = document.getElementById("importBtn");
const exportBtn = document.getElementById("exportBtn");
const importFileEl = document.getElementById("importFile");
const presetBtnEls = document.querySelectorAll("button[data-preset]");
const templateSearchInputEl = document.getElementById("templateSearch");
const templateSearchWrapEl = document.getElementById("templateSearchWrap");
const templateSearchClearEl = document.getElementById("templateSearchClear");
const templateSuggestEl = document.getElementById("templateSuggest");
const emojiRailEl = document.getElementById("emojiRail");
const emojiRailToggleEl = document.getElementById("emojiRailToggle");
const emojiRailToggleCloseEl = emojiRailToggleEl?.querySelector(".emoji-rail-toggle-close") || null;
const emojiRailToggleOpenIconEl = emojiRailToggleEl?.querySelector(".emoji-rail-toggle-open-icon") || null;
const emojiRailListEl = document.getElementById("emojiRailList");
const supportMenuBtn = document.getElementById("supportMenuBtn");
const supportMenuList = document.getElementById("supportMenuList");
const localTemplateNameEl = document.getElementById("localTemplateName");
const saveLocalTemplateBtn = document.getElementById("saveLocalTemplateBtn");
const localTemplateListEl = document.getElementById("localTemplateList");
const sidebarTabTemplatesEl = document.getElementById("sidebarTabTemplates");
const sidebarTabEmojiEl = document.getElementById("sidebarTabEmoji");
const sidebarTabSettingsEl = document.getElementById("sidebarTabSettings");
const sidebarToggleBtnEl = document.getElementById("sidebarToggleBtn");
const sidebarToggleIconCloseEl = document.getElementById("sidebarToggleIconClose");
const sidebarToggleIconOpenEl = document.getElementById("sidebarToggleIconOpen");
const sidebarPanelTemplatesEl = document.getElementById("sidebarPanelTemplates");
const sidebarPanelEmojiEl = document.getElementById("sidebarPanelEmoji");
const sidebarPanelSettingsEl = document.getElementById("sidebarPanelSettings");
const unsupportedViewportEl = document.getElementById("unsupportedViewport");
const settingsWeservDomainEl = document.getElementById("settingsWeservDomain");
const saveWeservDomainBtnEl = document.getElementById("saveWeservDomainBtn");
const deleteWeservDomainBtnEl = document.getElementById("deleteWeservDomainBtn");
const exportStorageBtnEl = document.getElementById("exportStorageBtn");
const importStorageBtnEl = document.getElementById("importStorageBtn");
const importStorageFileEl = document.getElementById("importStorageFile");
const resetStorageBtnEl = document.getElementById("resetStorageBtn");
const iconModeRadios = form.querySelectorAll('input[name="iconMode"]');
const iconUrlWrap = document.getElementById("iconUrlWrap");
const iconUploadWrap = document.getElementById("iconUploadWrap");
const iconEmbedWrap = document.getElementById("iconEmbedWrap");
const iconSelfhstWrap = document.getElementById("iconSelfhstWrap");
const iconUrlEl = document.getElementById("iconUrl");
const iconUrlRowEl = iconUrlEl?.closest(".icon-url-row") || null;
const iconCdnVariantsEl = document.getElementById("iconCdnVariants");
const iconEmbedSvgEl = document.getElementById("iconEmbedSvg");
const iconResizeWsrvEl = document.getElementById("iconResizeWsrv");
const iconResizeLabelPrefixEl = document.getElementById("iconResizeLabelPrefix");
const iconResizeServiceLinkEl = document.getElementById("iconResizeServiceLink");
const iconResizeServiceTooltipEl = document.getElementById("iconResizeServiceTooltip");
const iconUploadEl = document.getElementById("iconUpload");
const iconScaleEl = document.getElementById("iconScale");
const iconScaleValueEl = document.getElementById("iconScaleValue");
const iconScaleWrapEl = document.getElementById("iconScaleWrap");
const iconStatusEl = document.getElementById("iconStatus");
const iconColorVariantEls = form.querySelectorAll('input[name="iconColorVariant"]');
const iconVariantWrapEl = document.querySelector(".svg-variant-wrap");
const configLocationsEl = document.getElementById("configLocations");
const addConfigBtn = document.getElementById("addConfigBtn");
const hostEntriesEl = document.getElementById("hostEntries");
const addHostBtn = document.getElementById("addHostBtn");
const networkEntriesEl = document.getElementById("networkEntries");
const addNetworkBtn = document.getElementById("addNetworkBtn");
const addCustomRowBtn = document.getElementById("addCustomRowBtn");
const APP_VERSION = document.querySelector('meta[name="app-version"]')?.getAttribute("content")?.trim() || "dev";

let iconResolvedSrc = "";
let uploadSvgText = "";
let uploadImageDataUrl = "";
let blockImportedRemoteCustomImages = false;
let sidebarFeature = null;
let settingsFeature = null;
let emojiFeature = null;
let previewFeature = null;
let templateManagerFeature = null;
let templateSettingsFeature = null;
let iconFeature = null;
let noteBuilderFeature = null;
let templateSearchUiFeature = null;
let appShellFeature = null;
let githubMetadataService = null;
let rowEditorFeature = null;

const appStateStore = createAppStateStore({
  storageKey: APP_STATE_STORAGE_KEY,
  legacyKeys: {
    emojiRail: LEGACY_EMOJI_RAIL_STORAGE_KEY,
    localTemplates: LEGACY_LOCAL_TEMPLATES_STORAGE_KEY,
    sidebarCollapsed: LEGACY_SIDEBAR_COLLAPSED_STORAGE_KEY,
  },
  defaultState: DEFAULT_APP_STATE,
});

function getAppState() {
  return appStateStore.getState();
}

function patchAppState(patchFn) {
  appStateStore.patch(patchFn);
}

function replaceAppState(nextState) {
  appStateStore.replace(nextState);
}

function getSelectedRadioValue(name, fallback = "") {
  return rowEditorFeature?.getSelectedRadioValue(name, fallback) || fallback;
}

function setSelectedRadioValue(name, value) {
  rowEditorFeature?.setSelectedRadioValue(name, value);
}

function getIconAlign() {
  return getSelectedRadioValue("iconAlign", "center");
}

function getIconMode() {
  return getSelectedRadioValue("iconMode", "external");
}

function setIconMode(value) {
  setSelectedRadioValue("iconMode", value);
}

function getIconColorVariant() {
  return getSelectedRadioValue("iconColorVariant", "original");
}

function isWsrvResizeEnabled() {
  return Boolean(iconResizeWsrvEl?.checked);
}

function getConfiguredWeservDomain() {
  return settingsFeature?.getConfiguredWeservDomain
    ? settingsFeature.getConfiguredWeservDomain()
    : normalizeWeservDomain(getAppState().settings.weservDomain);
}

function getWeservBaseUrl() {
  return settingsFeature?.getWeservBaseUrl
    ? settingsFeature.getWeservBaseUrl()
    : (getConfiguredWeservDomain() || "https://wsrv.nl");
}

function applyStateToRuntime() {
  templateManagerFeature?.syncFromState();
  settingsFeature?.syncSettingsPaneFromState();
  sidebarFeature?.setSidebarPanel(normalizeSidebarPanel(getAppState().ui.activeSidebarPanel), { persist: false });
  sidebarFeature?.setSidebarCollapsed(Boolean(getAppState().ui.sidebarCollapsed));
  prepareIcon();
}

function updateLengthState(noteHtml) {
  const len = noteHtml.length;
  charCountEl.textContent = `${len} / ${MAX_OUTPUT_LENGTH}`;

  if (len > MAX_OUTPUT_LENGTH) {
    charWarningEl.textContent = `Too long by ${len - MAX_OUTPUT_LENGTH} characters.`;
    copyBtn.disabled = true;
  } else {
    charWarningEl.textContent = "";
    copyBtn.disabled = len === 0;
  }
}

function buildNoteHtml() {
  return noteBuilderFeature ? noteBuilderFeature.buildNoteHtml() : "";
}

function renderOutput() {
  if (previewFeature) {
    previewFeature.renderOutput();
    return;
  }
  iconScaleValueEl.textContent = `${iconScaleEl.value} px`;
  const noteHtml = buildNoteHtml();
  outputEl.value = noteHtml;
  previewCard.innerHTML = noteHtml;
  updateLengthState(noteHtml);
}

function updateIconControls() {
  iconFeature?.updateIconControls();
}

async function prepareIcon() {
  if (!iconFeature) {
    return;
  }
  await iconFeature.prepareIcon();
}

async function onIconUploadChange(event) {
  if (!iconFeature) {
    return;
  }
  await iconFeature.onIconUploadChange(event);
}

function bootstrap() {
  appShellFeature = createAppShellFeature({
    refs: {
      previewShell,
      themeToggleBtn,
      themeIconEl,
      unsupportedViewportEl,
      supportMenuBtn,
      supportMenuList,
      copyBtn,
      outputEl,
    },
    minDesktopViewportWidth: MIN_DESKTOP_VIEWPORT_WIDTH,
  });
  appShellFeature.initUnsupportedViewportGuard();

  rowEditorFeature = createRowEditorFeature({
    form,
    getEl,
    refs: {
      iconUrlEl,
      iconUploadEl,
      configLocationsEl,
      hostEntriesEl,
      networkEntriesEl,
    },
    renderOutput,
    prepareIcon,
    setUploadSvgText: (value) => {
      uploadSvgText = String(value || "");
    },
    setUploadImageDataUrl: (value) => {
      uploadImageDataUrl = String(value || "");
    },
  });
  rowEditorFeature.mountStyleToolbars();
  rowEditorFeature.bindStyleConflicts();

  templateSearchUiFeature = createTemplateSearchUiFeature({
    refs: {
      templateSearchInputEl,
      templateSearchWrapEl,
      templateSearchClearEl,
      templateSuggestEl,
    },
    escapeHtml,
    fetchCatalog: async () => fetchPublicTemplateCatalog(fetch),
    onLoadTemplateFile: async (path) => {
      if (!templateSettingsFeature) {
        return;
      }
      await templateSettingsFeature.fetchAndApplySettings(path, "template", "Could not load selected public template.");
    },
  });

  sidebarFeature = createSidebarFeature({
    refs: {
      sidebarTabTemplatesEl,
      sidebarTabEmojiEl,
      sidebarTabSettingsEl,
      sidebarToggleBtnEl,
      sidebarToggleIconCloseEl,
      sidebarToggleIconOpenEl,
      sidebarPanelTemplatesEl,
      sidebarPanelEmojiEl,
      sidebarPanelSettingsEl,
    },
    closeTemplateSuggest: () => templateSearchUiFeature?.closeSuggest(),
    getState: getAppState,
    patchState: patchAppState,
  });

  iconFeature = createIconFeature({
    refs: {
      iconStatusEl,
      iconUrlWrap,
      iconUploadWrap,
      iconEmbedWrap,
      iconSelfhstWrap,
      iconVariantWrapEl,
      iconScaleWrapEl,
      iconUrlEl,
      iconUrlRowEl,
      iconCdnVariantsEl,
      iconEmbedSvgEl,
      iconResizeWsrvEl,
      iconUploadEl,
      iconScaleEl,
      iconColorVariantEls,
    },
    getUploadSvgText: () => uploadSvgText,
    setUploadSvgText: (value) => {
      uploadSvgText = String(value || "");
    },
    getUploadImageDataUrl: () => uploadImageDataUrl,
    setUploadImageDataUrl: (value) => {
      uploadImageDataUrl = String(value || "");
    },
    getIconMode,
    isWsrvResizeEnabled,
    getIconColorVariant,
    getConfiguredWeservDomain,
    getWeservBaseUrl,
    getIconResolvedSrc: () => iconResolvedSrc,
    setIconResolvedSrc: (value) => {
      iconResolvedSrc = String(value || "");
    },
    maxFetchedSvgBytes: MAX_FETCHED_SVG_BYTES,
    maxUploadSvgBytes: MAX_UPLOAD_SVG_BYTES,
    maxUploadRasterBytes: MAX_UPLOAD_RASTER_BYTES,
    maxOutputLength: MAX_OUTPUT_LENGTH,
    renderOutput,
  });

  settingsFeature = createSettingsFeature({
    refs: {
      settingsWeservDomainEl,
      saveWeservDomainBtnEl,
      deleteWeservDomainBtnEl,
      exportStorageBtnEl,
      importStorageBtnEl,
      importStorageFileEl,
      resetStorageBtnEl,
      iconResizeLabelPrefixEl,
      iconResizeServiceLinkEl,
      iconResizeServiceTooltipEl,
    },
    getState: getAppState,
    patchState: patchAppState,
    replaceState: replaceAppState,
    prepareIcon,
    readTextFile,
    assertFileSizeWithinLimit,
    assertTextSizeWithinLimit,
    maxImportFileBytes: MAX_IMPORT_FILE_BYTES,
    onAfterStateApplied: applyStateToRuntime,
  });

  emojiFeature = createEmojiFeature({
    refs: {
      emojiRailEl,
      emojiRailToggleEl,
      emojiRailToggleCloseEl,
      emojiRailToggleOpenIconEl,
      emojiRailListEl,
    },
    emojiGroups: PROXMOX_NOTE_EMOJI_GROUPS,
    escapeHtml,
  });

  noteBuilderFeature = createNoteBuilderFeature({
    form,
    getEl,
    escapeHtml,
    getIconAlign,
    getIconResolvedSrc: () => iconResolvedSrc,
    getHostEntries: rowEditorFeature.getHostEntries,
    getNetworkEntries: rowEditorFeature.getNetworkEntries,
    getConfigLocationEntries: rowEditorFeature.getConfigLocationEntries,
    getCustomRowEntries: rowEditorFeature.getCustomRowEntries,
    getOrderedRowKeys: rowEditorFeature.getOrderedRowKeys,
    isRowVisible: rowEditorFeature.isRowVisible,
    getBlockImportedRemoteCustomImages: () => blockImportedRemoteCustomImages,
    isCrossOriginHttpUrl,
  });

  previewFeature = createPreviewFeature({
    refs: {
      iconScaleEl,
      iconScaleValueEl,
      outputEl,
      previewCard,
    },
    buildNoteHtml,
    updateLengthState,
  });

  templateSettingsFeature = createTemplateSettingsFeature({
    appVersion: APP_VERSION,
    maxUploadSvgBytes: MAX_UPLOAD_SVG_BYTES,
    maxImportFileBytes: MAX_IMPORT_FILE_BYTES,
    refs: {
      iconUrlEl,
      iconEmbedSvgEl,
      iconResizeWsrvEl,
      iconScaleEl,
      hostEntriesEl,
      networkEntriesEl,
      configLocationsEl,
    },
    form,
    getTheme: () => appShellFeature?.getTheme() || "dark",
    getUploadSvgText: () => uploadSvgText,
    setUploadSvgText: (value) => {
      uploadSvgText = String(value || "");
    },
    getUploadImageDataUrl: () => uploadImageDataUrl,
    setUploadImageDataUrl: (value) => {
      uploadImageDataUrl = String(value || "");
    },
    setBlockImportedRemoteCustomImages: (value) => {
      blockImportedRemoteCustomImages = Boolean(value);
    },
    assertTextSizeWithinLimit,
    isValidRowKey: rowEditorFeature.isValidRowKey,
    isCustomRowKey: rowEditorFeature.isCustomRowKey,
    normalizeCustomRowKey: rowEditorFeature.normalizeCustomRowKey,
    normalizeRowKey: rowEditorFeature.normalizeRowKey,
    getOrderedRowKeys: rowEditorFeature.getOrderedRowKeys,
    isRowVisible: rowEditorFeature.isRowVisible,
    collectRowState: rowEditorFeature.collectRowState,
    getSelectedRadioValue: rowEditorFeature.getSelectedRadioValue,
    getIconMode,
    isWsrvResizeEnabled,
    getIconColorVariant,
    getHostEntries: rowEditorFeature.getHostEntries,
    getNetworkEntries: rowEditorFeature.getNetworkEntries,
    getConfigLocationEntries: rowEditorFeature.getConfigLocationEntries,
    getCustomRowEntries: rowEditorFeature.getCustomRowEntries,
    setSelectedRadioValue: rowEditorFeature.setSelectedRadioValue,
    setTheme: (theme) => appShellFeature?.setTheme(theme),
    setIconMode,
    isAllowedIconImageUrl,
    syncCustomRows: rowEditorFeature.syncCustomRows,
    reorderFieldsets: rowEditorFeature.reorderFieldsets,
    setRowVisibility: rowEditorFeature.setRowVisibility,
    createHostEntryInput: rowEditorFeature.createHostEntryInput,
    createNetworkEntryInput: rowEditorFeature.createNetworkEntryInput,
    createConfigLocationInput: rowEditorFeature.createConfigLocationInput,
    prepareIcon,
    setIconStatus: (...args) => iconFeature?.setIconStatus(...args),
    getEl,
  });

  templateManagerFeature = createTemplateManagerFeature({
    refs: {
      localTemplateNameEl,
      saveLocalTemplateBtn,
      localTemplateListEl,
      importBtn,
      exportBtn,
      importFileEl,
    },
    getState: getAppState,
    patchState: patchAppState,
    normalizeLocalTemplateCatalog,
    escapeHtml,
    collectSettings: templateSettingsFeature.collectSettings,
    applySettings: templateSettingsFeature.applySettings,
    validateSettingsSchema: templateSettingsFeature.validateSettingsSchema,
    assertFileSizeWithinLimit,
    assertTextSizeWithinLimit,
    maxImportFileBytes: MAX_IMPORT_FILE_BYTES,
  });

  hostEntriesEl.append(rowEditorFeature.createHostEntryInput("www.proxmox.com", "https://www.proxmox.com/", "🔗"));
  networkEntriesEl.append(rowEditorFeature.createNetworkEntryInput("10.2.0.40:8443", "🖥️"));
  configLocationsEl.append(rowEditorFeature.createConfigLocationInput("/etc/app/config.yml"));
  rowEditorFeature.addCustomRow();
  rowEditorFeature.initializeRowVisibility();

  sidebarFeature.initSidebarPanels();
  sidebarFeature.initSidebarToggle();
  emojiFeature.initEmojiRail();
  settingsFeature.initSettingsPane(DEFAULT_APP_STATE);
  templateManagerFeature.initTemplateManager();
  templateSearchUiFeature.init();
  appShellFeature.initThemeToggle();
  appShellFeature.initSupportMenu();
  appShellFeature.initCopyButton();

  githubMetadataService = createGithubMetadataService({
    refs: {
      githubStarCountEl,
      appVersionValueEl,
      appVersionStatusEl,
    },
    appVersion: APP_VERSION,
    githubStarsCacheTtlMs: GITHUB_STARS_CACHE_TTL_MS,
    githubReleaseCacheTtlMs: GITHUB_RELEASE_CACHE_TTL_MS,
    fetchJsonWithCache,
  });

  applyStateToRuntime();

  addHostBtn.addEventListener("click", () => {
    hostEntriesEl.append(rowEditorFeature.createHostEntryInput("", "", "🔗"));
    renderOutput();
  });
  addNetworkBtn.addEventListener("click", () => {
    networkEntriesEl.append(rowEditorFeature.createNetworkEntryInput("", "🖥️"));
    renderOutput();
  });
  addConfigBtn.addEventListener("click", () => {
    configLocationsEl.append(rowEditorFeature.createConfigLocationInput(""));
    renderOutput();
  });
  addCustomRowBtn.addEventListener("click", () => {
    rowEditorFeature.addCustomRow();
    renderOutput();
  });

  form.addEventListener("input", (event) => {
    const target = event.target;
    if (target instanceof HTMLTextAreaElement && target.matches('textarea[data-custom-text="1"]') && blockImportedRemoteCustomImages) {
      blockImportedRemoteCustomImages = false;
    }
    renderOutput();
  });

  form.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const moveBtn = target.closest(".row-move");
    if (moveBtn instanceof HTMLElement) {
      const rowKey = moveBtn.getAttribute("data-row-key");
      const direction = moveBtn.getAttribute("data-direction");
      if (rowKey && (direction === "up" || direction === "down")) {
        rowEditorFeature.moveRow(rowKey, direction);
        renderOutput();
      }
      return;
    }

    const visibilityBtn = target.closest(".row-visibility");
    if (visibilityBtn instanceof HTMLElement) {
      const rowKey = visibilityBtn.getAttribute("data-row-key");
      if (rowKey) {
        rowEditorFeature.toggleRowVisibility(rowKey);
        renderOutput();
      }
      return;
    }

    const removeBtn = target.closest(".row-remove");
    if (removeBtn instanceof HTMLElement) {
      const rowKey = rowEditorFeature.normalizeCustomRowKey(removeBtn.getAttribute("data-row-key"));
      if (rowKey) {
        const fieldset = rowEditorFeature.getRowFieldset(rowKey);
        if (fieldset) {
          fieldset.remove();
          if (rowEditorFeature.getCustomRowFieldsets().length === 0) {
            rowEditorFeature.addCustomRow();
          }
          renderOutput();
        }
      }
      return;
    }

    const localClearBtn = target.closest(".icon-clear");
    if (!localClearBtn) {
      return;
    }

    const inputId = localClearBtn.getAttribute("data-target");
    const input = inputId ? getEl(inputId) : null;
    if (input) {
      input.value = "";
      renderOutput();
    }
  });

  clearBtn.addEventListener("click", () => {
    rowEditorFeature.clearTextFields();
  });

  for (const presetBtn of presetBtnEls) {
    presetBtn.addEventListener("click", async () => {
      const didLoad = await templateSettingsFeature.loadPresetByNumber(presetBtn.getAttribute("data-preset"));
      if (didLoad) {
        templateSettingsFeature.flashLoadedPresetButton(presetBtn);
      }
    });
  }

  for (const radio of iconModeRadios) {
    radio.addEventListener("change", prepareIcon);
  }
  iconUrlEl.addEventListener("input", prepareIcon);
  iconEmbedSvgEl.addEventListener("change", () => {
    if (iconEmbedSvgEl.checked && iconResizeWsrvEl) {
      iconResizeWsrvEl.checked = false;
    }
    prepareIcon();
  });
  if (iconResizeWsrvEl) {
    iconResizeWsrvEl.addEventListener("change", () => {
      if (iconResizeWsrvEl.checked) {
        iconEmbedSvgEl.checked = false;
      }
      prepareIcon();
    });
  }
  iconScaleEl.addEventListener("input", prepareIcon);
  iconUploadEl.addEventListener("change", onIconUploadChange);
  for (const radio of iconColorVariantEls) {
    radio.addEventListener("change", prepareIcon);
  }
  if (iconCdnVariantsEl) {
    iconCdnVariantsEl.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const btn = target.closest(".icon-cdn-variant-btn");
      if (!(btn instanceof HTMLButtonElement)) {
        return;
      }
      const nextUrl = btn.getAttribute("data-variant-url");
      if (!nextUrl) {
        return;
      }
      iconUrlEl.value = nextUrl;
      prepareIcon();
    });
  }

  appShellFeature.setTheme("dark");
  updateIconControls();
  prepareIcon();
  githubMetadataService.loadGithubStarCount();
  githubMetadataService.loadReleaseVersionStatus();
}

bootstrap();
