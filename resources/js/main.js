import {
  createAppStateStore,
  normalizeLocalTemplateCatalog,
  normalizeSidebarPanel,
  normalizeSvgPreferredMode,
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
  PREVIEW_SIDEBAR_DEFAULT_WIDTH,
  PREVIEW_SIDEBAR_MAX_WIDTH,
  PREVIEW_SIDEBAR_MIN_WIDTH,
  PROXMOX_NOTE_EMOJI_GROUPS,
} from "./core/config.js";
import { getAppDomRefs, getEl } from "./core/dom.js";
import {
  assertFileSizeWithinLimit,
  assertTextSizeWithinLimit,
  escapeHtml,
  isAllowedIconImageUrl,
  isCrossOriginHttpUrl,
  readTextFile,
} from "./core/utils.js";
import { fetchJsonWithCache } from "./services/http-cache.service.js";
import { cacheGetItem, cacheRemoveItem, cacheSetItem } from "./services/browser-cache.service.js";
import { createGithubMetadataService } from "./services/github-metadata.js";
import { loadPublicTemplateCatalog as fetchPublicTemplateCatalog } from "./services/template-catalog.service.js";
import { createSidebarFeature } from "./features/sidebar.js";
import { createSettingsFeature } from "./features/settings.js";
import { createEmojiFeature } from "./features/emoji.js";
import { createTemplateManagerFeature } from "./features/template-manager.js";
import { createTemplateSettingsFeature } from "./features/template-settings.js";
import { createAppIconsFeature } from "./features/app-icons.js";
import { createNoteBuilderFeature } from "./features/note-builder.js";
import { createPreviewFeature } from "./features/preview.js";
import { createTemplateSearchFeature } from "./features/template-search.js";
import { createAppShellFeature } from "./features/app-shell.js";
import { createRowEditorFeature } from "./features/row-editor.js";
import { createIconSearchFeature } from "./features/icon-search.js";

const {
  form,
  appVersion: APP_VERSION,
  shellRefs: {
    outputEl,
    previewCard,
    copyBtn,
    previewShell,
    themeToggleBtn,
    themeIconEl,
    supportMenuBtn,
    supportMenuList,
    unsupportedViewportEl,
    previewResizeHandleEl,
    workspacePreviewSidebarEl,
  },
  githubRefs: {
    githubStarCountEl,
    appVersionValueEl,
    appVersionStatusEl,
  },
  templateSearchRefs: {
    templateSearchInputEl,
    templateSearchWrapEl,
    templateSearchClearEl,
    templateSuggestEl,
  },
  emojiRefs: {
    emojiRailEl,
    emojiRailToggleEl,
    emojiRailToggleCloseEl,
    emojiRailToggleOpenIconEl,
    emojiRailListEl,
  },
  templateManagerRefs: {
    designButtonGridEl,
    saveLocalTemplateBtn,
    importLocalTemplateBtn,
    importLocalTemplateFileEl,
    localTemplateSearchEl,
    localTemplateSearchClearEl,
    localTemplateListEl,
    templateNameModalEl,
    templateNameModalTitleEl,
    templateNameModalMessageEl,
    templateNameModalInputEl,
    templateNameModalCancelBtnEl,
    templateNameModalConfirmBtnEl,
    confirmModalEl,
    confirmModalTitleEl,
    confirmModalMessageEl,
    confirmModalCancelBtnEl,
    confirmModalExtraBtnEl,
    confirmModalConfirmBtnEl,
  },
  sidebarRefs: {
    sidebarTabTemplatesEl,
    sidebarTabEmojiEl,
    sidebarTabIconSearchEl,
    sidebarTabSettingsEl,
    sidebarToggleBtnEl,
    sidebarToggleIconCloseEl,
    sidebarToggleIconOpenEl,
    sidebarPanelTemplatesEl,
    sidebarPanelEmojiEl,
    sidebarPanelIconSearchEl,
    sidebarPanelSettingsEl,
  },
  settingsRefs: {
    settingsWeservDomainEl,
    settingsSvgPreferredModeEl,
    settingsIconSearchThumbnailsEl,
    saveWeservDomainBtnEl,
    deleteWeservDomainBtnEl,
    exportStorageBtnEl,
    importStorageBtnEl,
    importStorageFileEl,
    resetStorageBtnEl,
    settingsShowDemoTemplatesEl,
    iconResizeLabelPrefixEl,
    iconResizeServiceLinkEl,
    iconResizeServiceTooltipEl,
    confirmModalEl: settingsConfirmModalEl,
    confirmModalTitleEl: settingsConfirmModalTitleEl,
    confirmModalMessageEl: settingsConfirmModalMessageEl,
    confirmModalCancelBtnEl: settingsConfirmModalCancelBtnEl,
    confirmModalExtraBtnEl: settingsConfirmModalExtraBtnEl,
    confirmModalConfirmBtnEl: settingsConfirmModalConfirmBtnEl,
  },
  iconSearchRefs: {
    iconSearchInputEl,
    iconSearchClearEl,
    iconSearchGridEl,
  },
  previewRefs: {
    iconScaleEl,
    iconScaleValueEl,
    charCountEl,
    charWarningEl,
  },
  iconRefs: {
    iconModeRadios,
    iconUrlWrap,
    iconLinkUrlWrap,
    iconUploadWrap,
    iconGalleryWrap,
    iconGalleryListEl,
    addIconGalleryItemBtnEl,
    iconGalleryColumnsEl,
    iconGallerySpacingRadios,
    iconEmbedWrap,
    iconEmbedSvgControlEl,
    iconSelfhstWrap,
    iconUrlEl,
    iconLinkUrlEl,
    iconUrlRowEl,
    iconCdnVariantsEl,
    iconEmbedSvgEl,
    iconResizeWsrvEl,
    iconUploadEl,
    iconScaleEl: iconScaleInputEl,
    iconScaleWrapEl,
    iconStatusEl,
    iconColorVariantEls,
    iconVariantWrapEl,
  },
  rowEditorRefs: {
    configLocationsEl,
    addConfigBtn,
    hostEntriesEl,
    addHostBtn,
    networkEntriesEl,
    addNetworkBtn,
    addCustomRowBtn,
    initBtn,
    clearBtn,
  },
} = getAppDomRefs();

const runtime = {
  iconResolvedSrc: "",
  uploadSvgText: "",
  uploadImageDataUrl: "",
  blockImportedRemoteCustomImages: false,
};
let sidebarFeature = null;
let settingsFeature = null;
let emojiFeature = null;
let previewFeature = null;
let templateManagerFeature = null;
let templateSettingsFeature = null;
let appIconsFeature = null;
let noteBuilderFeature = null;
let templateSearchFeature = null;
let appShellFeature = null;
let githubMetadataService = null;
let rowEditorFeature = null;
let iconSearchFeature = null;
let draftPersistenceEnabled = false;
let draftPersistTimer = null;
let lastDraftSnapshotRaw = "";
const NOTE_DRAFT_CACHE_KEY = "pve-notebuddy:note-draft-v1";
const APP_STORAGE_PREFIX = "pve-notebuddy:";

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

function getPreferredSvgMode() {
  return settingsFeature?.getPreferredSvgMode
    ? settingsFeature.getPreferredSvgMode()
    : normalizeSvgPreferredMode(getAppState().settings.svgPreferredMode);
}

function applyStateToRuntime() {
  templateManagerFeature?.syncFromState();
  settingsFeature?.syncSettingsPaneFromState();
  sidebarFeature?.setSidebarPanel(normalizeSidebarPanel(getAppState().ui.activeSidebarPanel), { persist: false });
  sidebarFeature?.setSidebarCollapsed(Boolean(getAppState().ui.sidebarCollapsed));
  appShellFeature?.syncPreviewSidebarWidthFromState({ persist: false });
  prepareIcon();
}

function buildNoteHtml() {
  return noteBuilderFeature ? noteBuilderFeature.buildNoteHtml() : "";
}

function persistDraftSnapshotToCache() {
  if (!draftPersistenceEnabled || !templateSettingsFeature) {
    return;
  }
  try {
    const snapshot = templateSettingsFeature.collectSettings();
    const raw = JSON.stringify(snapshot);
    if (raw === lastDraftSnapshotRaw) {
      return;
    }
    cacheSetItem(NOTE_DRAFT_CACHE_KEY, raw);
    lastDraftSnapshotRaw = raw;
  } catch {
    // Keep live editing functional even if cache write fails.
  }
}

function queueDraftPersistence() {
  if (!draftPersistenceEnabled || !templateSettingsFeature) {
    return;
  }
  if (draftPersistTimer) {
    window.clearTimeout(draftPersistTimer);
  }
  draftPersistTimer = window.setTimeout(() => {
    draftPersistTimer = null;
    persistDraftSnapshotToCache();
  }, 140);
}

function clearAllAppStorage() {
  try {
    const keys = [];
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (typeof key === "string" && key.startsWith(APP_STORAGE_PREFIX)) {
        keys.push(key);
      }
    }
    for (const key of keys) {
      localStorage.removeItem(key);
    }
  } catch {
    // Keep reset flow functional if storage is unavailable.
  }
}

function readDraftSnapshotFromCache() {
  const raw = cacheGetItem(NOTE_DRAFT_CACHE_KEY);
  if (!raw) {
    lastDraftSnapshotRaw = "";
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      lastDraftSnapshotRaw = raw;
      return parsed;
    }
    lastDraftSnapshotRaw = "";
    return null;
  } catch {
    lastDraftSnapshotRaw = "";
    return null;
  }
}

function renderOutput() {
  previewFeature?.renderOutput();
  queueDraftPersistence();
}

async function prepareIcon(options = {}) {
  if (!appIconsFeature) {
    return;
  }
  await appIconsFeature.prepareIcon(options);
}

async function applyInitTemplateFromFile() {
  if (!templateSettingsFeature) {
    return false;
  }
  const didLoad = await templateSettingsFeature.fetchAndApplySettings(
    "./templates/app/init.json",
    "init",
    "Could not load init template."
  );
  if (didLoad) {
    queueDraftPersistence();
  }
  return didLoad;
}

async function applyCachedDraftOrInitTemplate() {
  const cachedDraft = readDraftSnapshotFromCache();
  if (cachedDraft) {
    try {
      templateSettingsFeature.validateSettingsSchema(cachedDraft, "cache draft");
      await templateSettingsFeature.applySettings(cachedDraft, { source: "cache" });
      return true;
    } catch {
      cacheRemoveItem(NOTE_DRAFT_CACHE_KEY);
      lastDraftSnapshotRaw = "";
    }
  }
  return applyInitTemplateFromFile();
}

function createFeatures() {
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
      previewResizeHandleEl,
      workspacePreviewSidebarEl,
    },
    minDesktopViewportWidth: MIN_DESKTOP_VIEWPORT_WIDTH,
    getState: getAppState,
    patchState: patchAppState,
    previewSidebarMinWidth: PREVIEW_SIDEBAR_MIN_WIDTH,
    previewSidebarDefaultWidth: PREVIEW_SIDEBAR_DEFAULT_WIDTH,
    previewSidebarMaxWidth: PREVIEW_SIDEBAR_MAX_WIDTH,
    workspaceMinWidth: 752,
  });

  rowEditorFeature = createRowEditorFeature({
    form,
    getEl,
    refs: {
      iconUrlEl,
      iconLinkUrlEl,
      iconUploadEl,
      configLocationsEl,
      hostEntriesEl,
      networkEntriesEl,
      addConfigBtn,
      addHostBtn,
      addNetworkBtn,
      addCustomRowBtn,
      clearBtn,
    },
    renderOutput,
    prepareIcon,
    setUploadSvgText: (value) => {
      runtime.uploadSvgText = String(value || "");
    },
    setUploadImageDataUrl: (value) => {
      runtime.uploadImageDataUrl = String(value || "");
    },
    onClearAll: () => {
      appIconsFeature?.clearIconEditor?.();
    },
  });
  rowEditorFeature.mountStyleToolbars();
  rowEditorFeature.bindStyleConflicts();

  templateSearchFeature = createTemplateSearchFeature({
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
      await templateSettingsFeature.fetchAndApplySettings(path, "template-search", "Could not load selected public template.");
    },
  });

  sidebarFeature = createSidebarFeature({
    refs: {
      sidebarTabTemplatesEl,
      sidebarTabEmojiEl,
      sidebarTabIconSearchEl,
      sidebarTabSettingsEl,
      sidebarToggleBtnEl,
      sidebarToggleIconCloseEl,
      sidebarToggleIconOpenEl,
      sidebarPanelTemplatesEl,
      sidebarPanelEmojiEl,
      sidebarPanelIconSearchEl,
      sidebarPanelSettingsEl,
    },
    closeTemplateSuggest: () => templateSearchFeature?.closeSuggest(),
    getState: getAppState,
    patchState: patchAppState,
  });

  appIconsFeature = createAppIconsFeature({
    refs: {
      iconStatusEl,
      iconUrlWrap,
      iconLinkUrlWrap,
      iconUploadWrap,
      iconGalleryWrap,
      iconGalleryListEl,
      addIconGalleryItemBtnEl,
      iconGalleryColumnsEl,
      iconGallerySpacingRadios,
      iconEmbedWrap,
      iconEmbedSvgControlEl,
      iconSelfhstWrap,
      iconVariantWrapEl,
      iconScaleWrapEl,
      iconUrlEl,
      iconLinkUrlEl,
      iconUrlRowEl,
      iconCdnVariantsEl,
      iconEmbedSvgEl,
      iconResizeWsrvEl,
      iconUploadEl,
      iconScaleEl: iconScaleInputEl,
      iconColorVariantEls,
      iconModeRadios,
    },
    getUploadSvgText: () => runtime.uploadSvgText,
    setUploadSvgText: (value) => {
      runtime.uploadSvgText = String(value || "");
    },
    getUploadImageDataUrl: () => runtime.uploadImageDataUrl,
    setUploadImageDataUrl: (value) => {
      runtime.uploadImageDataUrl = String(value || "");
    },
    getIconMode,
    isWsrvResizeEnabled,
    getIconColorVariant,
    getConfiguredWeservDomain,
    getWeservBaseUrl,
    getPreferredSvgMode,
    getIconResolvedSrc: () => runtime.iconResolvedSrc,
    setIconResolvedSrc: (value) => {
      runtime.iconResolvedSrc = String(value || "");
    },
    getRenderedOutputLength: () => String(outputEl?.value || "").length,
    maxFetchedSvgBytes: MAX_FETCHED_SVG_BYTES,
    maxUploadSvgBytes: MAX_UPLOAD_SVG_BYTES,
    maxUploadRasterBytes: MAX_UPLOAD_RASTER_BYTES,
    maxOutputLength: MAX_OUTPUT_LENGTH,
    renderOutput,
  });

  settingsFeature = createSettingsFeature({
    refs: {
      settingsWeservDomainEl,
      settingsSvgPreferredModeEl,
      settingsIconSearchThumbnailsEl,
      saveWeservDomainBtnEl,
      deleteWeservDomainBtnEl,
      exportStorageBtnEl,
      importStorageBtnEl,
      importStorageFileEl,
      resetStorageBtnEl,
      settingsShowDemoTemplatesEl,
      iconResizeLabelPrefixEl,
      iconResizeServiceLinkEl,
      iconResizeServiceTooltipEl,
      confirmModalEl: settingsConfirmModalEl,
      confirmModalTitleEl: settingsConfirmModalTitleEl,
      confirmModalMessageEl: settingsConfirmModalMessageEl,
      confirmModalCancelBtnEl: settingsConfirmModalCancelBtnEl,
      confirmModalExtraBtnEl: settingsConfirmModalExtraBtnEl,
      confirmModalConfirmBtnEl: settingsConfirmModalConfirmBtnEl,
    },
    getState: getAppState,
    patchState: patchAppState,
    replaceState: replaceAppState,
    clearAppStorage: clearAllAppStorage,
    prepareIcon,
    readTextFile,
    assertFileSizeWithinLimit,
    assertTextSizeWithinLimit,
    maxImportFileBytes: MAX_IMPORT_FILE_BYTES,
    onAfterStateApplied: applyStateToRuntime,
    isDemoTemplatesVisible: () => templateManagerFeature?.areDemoTemplatesVisible?.() ?? true,
    onSetDemoTemplatesVisible: (isVisible) => templateManagerFeature?.setDemoTemplatesVisible?.(isVisible),
  });

  iconSearchFeature = createIconSearchFeature({
    refs: {
      iconSearchInputEl,
      iconSearchClearEl,
      iconSearchGridEl,
    },
    getThumbnailSource: () => settingsFeature?.getIconSearchThumbnailSource?.() || "jsdelivr",
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
    getIconResolvedSrc: () => runtime.iconResolvedSrc,
    getIconMode,
    getIconLinkUrl: () => (appIconsFeature?.getSingleLinkUrl ? appIconsFeature.getSingleLinkUrl() : ""),
    getIconGalleryItems: () => (appIconsFeature?.getGalleryItems ? appIconsFeature.getGalleryItems() : []),
    getIconGalleryLinkUrls: () => (appIconsFeature?.getGalleryLinkUrls ? appIconsFeature.getGalleryLinkUrls() : []),
    getIconGalleryColumns: () => (appIconsFeature?.getGalleryColumns ? appIconsFeature.getGalleryColumns() : 4),
    getIconGallerySpacing: () => (appIconsFeature?.getGallerySpacing ? appIconsFeature.getGallerySpacing() : "s"),
    getWeservBaseUrl,
    isWsrvResizeEnabled,
    isAllowedIconImageUrl,
    getHostEntries: rowEditorFeature.getHostEntries,
    getNetworkEntries: rowEditorFeature.getNetworkEntries,
    getConfigLocationEntries: rowEditorFeature.getConfigLocationEntries,
    getCustomRowEntries: rowEditorFeature.getCustomRowEntries,
    getOrderedRowKeys: rowEditorFeature.getOrderedRowKeys,
    isRowVisible: rowEditorFeature.isRowVisible,
    getBlockImportedRemoteCustomImages: () => runtime.blockImportedRemoteCustomImages,
    isCrossOriginHttpUrl,
  });

  previewFeature = createPreviewFeature({
    refs: {
      iconScaleEl,
      iconScaleValueEl,
      outputEl,
      previewCard,
      charCountEl,
      charWarningEl,
      copyBtn,
    },
    buildNoteHtml,
    maxOutputLength: MAX_OUTPUT_LENGTH,
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
    getUploadSvgText: () => runtime.uploadSvgText,
    setUploadSvgText: (value) => {
      runtime.uploadSvgText = String(value || "");
    },
    getUploadImageDataUrl: () => runtime.uploadImageDataUrl,
    setUploadImageDataUrl: (value) => {
      runtime.uploadImageDataUrl = String(value || "");
    },
    setBlockImportedRemoteCustomImages: (value) => {
      runtime.blockImportedRemoteCustomImages = Boolean(value);
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
    getIconLinkUrl: () => (appIconsFeature?.getSingleLinkUrl ? appIconsFeature.getSingleLinkUrl() : ""),
    setIconLinkUrl: (value) => {
      appIconsFeature?.setSingleLinkUrl?.(value);
    },
    isWsrvResizeEnabled,
    getIconColorVariant,
    getIconGalleryItems: () => (appIconsFeature?.getGalleryItems ? appIconsFeature.getGalleryItems() : []),
    getIconGalleryLinkUrls: () => (appIconsFeature?.getGalleryLinkUrls ? appIconsFeature.getGalleryLinkUrls() : []),
    setIconGalleryLinkUrls: (items) => {
      appIconsFeature?.setGalleryLinkUrls?.(items);
    },
    setIconGalleryItems: (items) => {
      appIconsFeature?.setGalleryItems?.(items);
    },
    getIconGalleryColumns: () => (appIconsFeature?.getGalleryColumns ? appIconsFeature.getGalleryColumns() : 4),
    setIconGalleryColumns: (value) => {
      appIconsFeature?.setGalleryColumns?.(value);
    },
    getIconGallerySpacing: () => (appIconsFeature?.getGallerySpacing ? appIconsFeature.getGallerySpacing() : "s"),
    setIconGallerySpacing: (value) => {
      appIconsFeature?.setGallerySpacing?.(value);
    },
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
    setIconStatus: (...args) => appIconsFeature?.setIconStatus(...args),
    getEl,
  });

  templateManagerFeature = createTemplateManagerFeature({
    appVersion: APP_VERSION,
    refs: {
      designButtonGridEl,
      saveLocalTemplateBtn,
      importLocalTemplateBtn,
      importLocalTemplateFileEl,
      localTemplateSearchEl,
      localTemplateSearchClearEl,
      localTemplateListEl,
      templateNameModalEl,
      templateNameModalTitleEl,
      templateNameModalMessageEl,
      templateNameModalInputEl,
      templateNameModalCancelBtnEl,
      templateNameModalConfirmBtnEl,
      confirmModalEl,
      confirmModalTitleEl,
      confirmModalMessageEl,
      confirmModalCancelBtnEl,
      confirmModalExtraBtnEl,
      confirmModalConfirmBtnEl,
    },
    getState: getAppState,
    patchState: patchAppState,
    normalizeLocalTemplateCatalog,
    escapeHtml,
    collectSettings: templateSettingsFeature.collectSettings,
    collectDesignSettings: templateSettingsFeature.collectDesignSettings,
    applySettings: templateSettingsFeature.applySettings,
    applyDesignSettings: templateSettingsFeature.applyDesignSettings,
    fetchAndApplyDesign: templateSettingsFeature.fetchAndApplyDesign,
    validateSettingsSchema: templateSettingsFeature.validateSettingsSchema,
    assertFileSizeWithinLimit,
    assertTextSizeWithinLimit,
    maxImportFileBytes: MAX_IMPORT_FILE_BYTES,
  });
}

async function initFeatureUi() {
  appShellFeature.initUnsupportedViewportGuard();
  rowEditorFeature.initDefaultRows();

  sidebarFeature.initSidebarPanels();
  sidebarFeature.initSidebarToggle();
  emojiFeature.initEmojiRail();
  settingsFeature.initSettingsPane(DEFAULT_APP_STATE);
  await iconSearchFeature.init();
  await templateManagerFeature.initTemplateManager();
  templateSearchFeature.init();
  appShellFeature.initThemeToggle();
  appShellFeature.initSupportMenu();
  appShellFeature.initCopyButton();
  appShellFeature.initPreviewSidebarResize();
}

function createMetadataServices() {
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
}

function wireFeatureInteractions() {
  rowEditorFeature.initRowEditorInteractions({
    onCustomTextareaInput: () => {
      if (runtime.blockImportedRemoteCustomImages) {
        runtime.blockImportedRemoteCustomImages = false;
      }
    },
  });
  const initButtonEl = initBtn || document.getElementById("initBtn");
  initButtonEl?.addEventListener("click", async () => {
    await applyInitTemplateFromFile();
  });
  const browseSelfhstLinkEl = document.querySelector("#iconSelfhstWrap a");
  browseSelfhstLinkEl?.addEventListener("click", (event) => {
    event.preventDefault();
    sidebarFeature?.setSidebarCollapsed(false);
    sidebarFeature?.setSidebarPanel("icon-search");
  });
  window.addEventListener("beforeunload", persistDraftSnapshotToCache);
  appIconsFeature.initIconInteractions();
}

function applyInitialRuntime() {
  appIconsFeature.updateIconControls();
  iconSearchFeature?.refreshThumbnails?.();
  prepareIcon();
}

function loadInitialMetadata() {
  githubMetadataService.loadGithubStarCount();
  githubMetadataService.loadReleaseVersionStatus();
}

async function bootstrap() {
  createFeatures();
  await initFeatureUi();
  createMetadataServices();
  applyStateToRuntime();
  await applyCachedDraftOrInitTemplate();
  wireFeatureInteractions();
  draftPersistenceEnabled = true;
  queueDraftPersistence();
  applyInitialRuntime();
  loadInitialMetadata();
}

bootstrap();
