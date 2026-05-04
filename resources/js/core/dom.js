export function getEl(id) {
  return document.getElementById(id);
}

export function getAppDomRefs() {
  const form = document.getElementById("noteForm");
  const outputEl = document.getElementById("output");
  const previewCard = document.getElementById("previewCard");
  const copyBtn = document.getElementById("copyBtn");
  const initBtn = document.getElementById("initBtn");
  const clearBtn = document.getElementById("clearBtn");
  const emojiRailToggleEl = document.getElementById("emojiRailToggle");
  const iconUrlEl = document.getElementById("iconUrl");
  const iconLinkUrlEl = document.getElementById("iconLinkUrl");
  const iconUploadEl = document.getElementById("iconUpload");
  const iconScaleEl = document.getElementById("iconScale");
  const iconScaleValueEl = document.getElementById("iconScaleValue");

  return {
    form,
    appVersion: document.querySelector('meta[name="app-version"]')?.getAttribute("content")?.trim() || "dev",
    shellRefs: {
      outputEl,
      previewCard,
      copyBtn,
      previewShell: document.getElementById("previewShell"),
      themeToggleBtn: document.getElementById("themeToggleBtn"),
      themeIconEl: document.getElementById("themeIcon"),
      supportMenuBtn: document.getElementById("supportMenuBtn"),
      supportMenuList: document.getElementById("supportMenuList"),
      unsupportedViewportEl: document.getElementById("unsupportedViewport"),
      previewResizeHandleEl: document.getElementById("previewResizeHandle"),
      workspacePreviewSidebarEl: document.querySelector(".workspace-preview-sidebar"),
    },
    githubRefs: {
      githubStarCountEl: document.getElementById("githubStarCount"),
      appVersionValueEl: document.getElementById("appVersionValue"),
      appVersionStatusEl: document.getElementById("appVersionStatus"),
    },
    templateSearchRefs: {
      templateSearchInputEl: document.getElementById("templateSearch"),
      templateSearchWrapEl: document.getElementById("templateSearchWrap"),
      templateSearchClearEl: document.getElementById("templateSearchClear"),
      templateSuggestEl: document.getElementById("templateSuggest"),
    },
    emojiRefs: {
      emojiRailEl: document.getElementById("emojiRail"),
      emojiRailToggleEl,
      emojiRailToggleCloseEl: emojiRailToggleEl?.querySelector(".emoji-rail-toggle-close") || null,
      emojiRailToggleOpenIconEl: emojiRailToggleEl?.querySelector(".emoji-rail-toggle-open-icon") || null,
      emojiRailListEl: document.getElementById("emojiRailList"),
    },
    templateManagerRefs: {
      designButtonGridEl: document.getElementById("designButtonGrid"),
      saveLocalTemplateBtn: document.getElementById("saveLocalTemplateBtn"),
      importLocalTemplateBtn: document.getElementById("importLocalTemplateBtn"),
      importLocalTemplateFileEl: document.getElementById("importLocalTemplateFile"),
      localTemplateSearchEl: document.getElementById("localTemplateSearch"),
      localTemplateListEl: document.getElementById("localTemplateList"),
      templateNameModalEl: document.getElementById("templateNameModal"),
      templateNameModalTitleEl: document.getElementById("templateNameModalTitle"),
      templateNameModalMessageEl: document.getElementById("templateNameModalMessage"),
      templateNameModalInputEl: document.getElementById("templateNameModalInput"),
      templateNameModalCancelBtnEl: document.getElementById("templateNameModalCancelBtn"),
      templateNameModalConfirmBtnEl: document.getElementById("templateNameModalConfirmBtn"),
      confirmModalEl: document.getElementById("confirmModal"),
      confirmModalTitleEl: document.getElementById("confirmModalTitle"),
      confirmModalMessageEl: document.getElementById("confirmModalMessage"),
      confirmModalCancelBtnEl: document.getElementById("confirmModalCancelBtn"),
      confirmModalExtraBtnEl: document.getElementById("confirmModalExtraBtn"),
      confirmModalConfirmBtnEl: document.getElementById("confirmModalConfirmBtn"),
    },
    sidebarRefs: {
      sidebarTabTemplatesEl: document.getElementById("sidebarTabTemplates"),
      sidebarTabEmojiEl: document.getElementById("sidebarTabEmoji"),
      sidebarTabSettingsEl: document.getElementById("sidebarTabSettings"),
      sidebarToggleBtnEl: document.getElementById("sidebarToggleBtn"),
      sidebarToggleIconCloseEl: document.getElementById("sidebarToggleIconClose"),
      sidebarToggleIconOpenEl: document.getElementById("sidebarToggleIconOpen"),
      sidebarPanelTemplatesEl: document.getElementById("sidebarPanelTemplates"),
      sidebarPanelEmojiEl: document.getElementById("sidebarPanelEmoji"),
      sidebarPanelSettingsEl: document.getElementById("sidebarPanelSettings"),
    },
    settingsRefs: {
      settingsWeservDomainEl: document.getElementById("settingsWeservDomain"),
      settingsSvgPreferredModeEl: document.getElementById("settingsSvgPreferredMode"),
      saveWeservDomainBtnEl: document.getElementById("saveWeservDomainBtn"),
      deleteWeservDomainBtnEl: document.getElementById("deleteWeservDomainBtn"),
      exportStorageBtnEl: document.getElementById("exportStorageBtn"),
      importStorageBtnEl: document.getElementById("importStorageBtn"),
      importStorageFileEl: document.getElementById("importStorageFile"),
      resetStorageBtnEl: document.getElementById("resetStorageBtn"),
      settingsShowDemoTemplatesEl: document.getElementById("settingsShowDemoTemplates"),
      iconResizeLabelPrefixEl: document.getElementById("iconResizeLabelPrefix"),
      iconResizeServiceLinkEl: document.getElementById("iconResizeServiceLink"),
      iconResizeServiceTooltipEl: document.getElementById("iconResizeServiceTooltip"),
      confirmModalEl: document.getElementById("confirmModal"),
      confirmModalTitleEl: document.getElementById("confirmModalTitle"),
      confirmModalMessageEl: document.getElementById("confirmModalMessage"),
      confirmModalCancelBtnEl: document.getElementById("confirmModalCancelBtn"),
      confirmModalExtraBtnEl: document.getElementById("confirmModalExtraBtn"),
      confirmModalConfirmBtnEl: document.getElementById("confirmModalConfirmBtn"),
    },
    iconRefs: {
      iconModeRadios: form.querySelectorAll('input[name="iconMode"]'),
      iconUrlWrap: document.getElementById("iconUrlWrap"),
      iconLinkUrlWrap: document.getElementById("iconLinkUrlWrap"),
      iconUploadWrap: document.getElementById("iconUploadWrap"),
      iconGalleryWrap: document.getElementById("iconGalleryWrap"),
      iconGalleryListEl: document.getElementById("iconGalleryList"),
      addIconGalleryItemBtnEl: document.getElementById("addIconGalleryItemBtn"),
      iconGalleryColumnsEl: document.getElementById("iconGalleryColumns"),
      iconGallerySpacingRadios: form.querySelectorAll('input[name="iconGallerySpacing"]'),
      iconEmbedWrap: document.getElementById("iconEmbedWrap"),
      iconEmbedSvgControlEl: document.getElementById("iconEmbedSvgControl"),
      iconSelfhstWrap: document.getElementById("iconSelfhstWrap"),
      iconUrlEl,
      iconLinkUrlEl,
      iconUrlRowEl: iconUrlEl?.closest(".icon-url-row") || null,
      iconCdnVariantsEl: document.getElementById("iconCdnVariants"),
      iconEmbedSvgEl: document.getElementById("iconEmbedSvg"),
      iconResizeWsrvEl: document.getElementById("iconResizeWsrv"),
      iconUploadEl,
      iconScaleEl,
      iconScaleValueEl,
      iconScaleWrapEl: document.getElementById("iconScaleWrap"),
      iconStatusEl: document.getElementById("iconStatus"),
      iconColorVariantEls: form.querySelectorAll('input[name="iconColorVariant"]'),
      iconVariantWrapEl: document.querySelector(".svg-variant-wrap"),
    },
    rowEditorRefs: {
      iconUrlEl,
      iconLinkUrlEl,
      iconUploadEl,
      configLocationsEl: document.getElementById("configLocations"),
      addConfigBtn: document.getElementById("addConfigBtn"),
      hostEntriesEl: document.getElementById("hostEntries"),
      addHostBtn: document.getElementById("addHostBtn"),
      networkEntriesEl: document.getElementById("networkEntries"),
      addNetworkBtn: document.getElementById("addNetworkBtn"),
      addCustomRowBtn: document.getElementById("addCustomRowBtn"),
      initBtn,
      clearBtn,
    },
    previewRefs: {
      iconScaleEl,
      iconScaleValueEl,
      charCountEl: document.getElementById("charCount"),
      charWarningEl: document.getElementById("charWarning"),
    },
  };
}
