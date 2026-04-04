export function getEl(id) {
  return document.getElementById(id);
}

export function getAppDomRefs() {
  const form = document.getElementById("noteForm");
  const outputEl = document.getElementById("output");
  const previewCard = document.getElementById("previewCard");
  const copyBtn = document.getElementById("copyBtn");
  const clearBtn = document.getElementById("clearBtn");
  const emojiRailToggleEl = document.getElementById("emojiRailToggle");
  const iconUrlEl = document.getElementById("iconUrl");
  const iconUploadEl = document.getElementById("iconUpload");
  const iconScaleEl = document.getElementById("iconScale");
  const iconScaleValueEl = document.getElementById("iconScaleValue");

  return {
    form,
    appVersion: document.querySelector('meta[name="app-version"]')?.getAttribute("content")?.trim() || "dev",
    presetBtnEls: document.querySelectorAll("button[data-preset]"),
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
      localTemplateNameEl: document.getElementById("localTemplateName"),
      saveLocalTemplateBtn: document.getElementById("saveLocalTemplateBtn"),
      localTemplateListEl: document.getElementById("localTemplateList"),
      importBtn: document.getElementById("importBtn"),
      exportBtn: document.getElementById("exportBtn"),
      importFileEl: document.getElementById("importFile"),
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
      saveWeservDomainBtnEl: document.getElementById("saveWeservDomainBtn"),
      deleteWeservDomainBtnEl: document.getElementById("deleteWeservDomainBtn"),
      exportStorageBtnEl: document.getElementById("exportStorageBtn"),
      importStorageBtnEl: document.getElementById("importStorageBtn"),
      importStorageFileEl: document.getElementById("importStorageFile"),
      resetStorageBtnEl: document.getElementById("resetStorageBtn"),
      iconResizeLabelPrefixEl: document.getElementById("iconResizeLabelPrefix"),
      iconResizeServiceLinkEl: document.getElementById("iconResizeServiceLink"),
      iconResizeServiceTooltipEl: document.getElementById("iconResizeServiceTooltip"),
    },
    iconRefs: {
      iconModeRadios: form.querySelectorAll('input[name="iconMode"]'),
      iconUrlWrap: document.getElementById("iconUrlWrap"),
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
      iconUploadEl,
      configLocationsEl: document.getElementById("configLocations"),
      addConfigBtn: document.getElementById("addConfigBtn"),
      hostEntriesEl: document.getElementById("hostEntries"),
      addHostBtn: document.getElementById("addHostBtn"),
      networkEntriesEl: document.getElementById("networkEntries"),
      addNetworkBtn: document.getElementById("addNetworkBtn"),
      addCustomRowBtn: document.getElementById("addCustomRowBtn"),
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
