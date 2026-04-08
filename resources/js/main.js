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

const {
  form,
  appVersion: APP_VERSION,
  presetBtnEls,
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
    localTemplateNameEl,
    saveLocalTemplateBtn,
    localTemplateListEl,
    importBtn,
    exportBtn,
    importFileEl,
  },
  sidebarRefs: {
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
  settingsRefs: {
    settingsWeservDomainEl,
    settingsSvgPreferredModeEl,
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
  previewRefs: {
    iconScaleEl,
    iconScaleValueEl,
    charCountEl,
    charWarningEl,
  },
  iconRefs: {
    iconModeRadios,
    iconUrlWrap,
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
  prepareIcon();
}

function buildNoteHtml() {
  return noteBuilderFeature ? noteBuilderFeature.buildNoteHtml() : "";
}

function renderOutput() {
  previewFeature?.renderOutput();
}

async function prepareIcon() {
  if (!appIconsFeature) {
    return;
  }
  await appIconsFeature.prepareIcon();
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
    },
    minDesktopViewportWidth: MIN_DESKTOP_VIEWPORT_WIDTH,
  });

  rowEditorFeature = createRowEditorFeature({
    form,
    getEl,
    refs: {
      iconUrlEl,
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
    closeTemplateSuggest: () => templateSearchFeature?.closeSuggest(),
    getState: getAppState,
    patchState: patchAppState,
  });

  appIconsFeature = createAppIconsFeature({
    refs: {
      iconStatusEl,
      iconUrlWrap,
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
    getIconResolvedSrc: () => runtime.iconResolvedSrc,
    getIconMode,
    getIconGalleryItems: () => (appIconsFeature?.getGalleryItems ? appIconsFeature.getGalleryItems() : []),
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
    isWsrvResizeEnabled,
    getIconColorVariant,
    getIconGalleryItems: () => (appIconsFeature?.getGalleryItems ? appIconsFeature.getGalleryItems() : []),
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
}

function initFeatureUi() {
  appShellFeature.initUnsupportedViewportGuard();
  rowEditorFeature.initDefaultRows();

  sidebarFeature.initSidebarPanels();
  sidebarFeature.initSidebarToggle();
  emojiFeature.initEmojiRail();
  settingsFeature.initSettingsPane(DEFAULT_APP_STATE);
  templateManagerFeature.initTemplateManager();
  templateSearchFeature.init();
  appShellFeature.initThemeToggle();
  appShellFeature.initSupportMenu();
  appShellFeature.initCopyButton();
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
  templateSettingsFeature.initPresetInteractions(presetBtnEls);
  appIconsFeature.initIconInteractions();
}

function applyInitialRuntime() {
  appShellFeature.setTheme("dark");
  appIconsFeature.updateIconControls();
  prepareIcon();
}

function loadInitialMetadata() {
  githubMetadataService.loadGithubStarCount();
  githubMetadataService.loadReleaseVersionStatus();
}

function bootstrap() {
  createFeatures();
  initFeatureUi();
  createMetadataServices();
  applyStateToRuntime();
  wireFeatureInteractions();
  applyInitialRuntime();
  loadInitialMetadata();
}

bootstrap();
