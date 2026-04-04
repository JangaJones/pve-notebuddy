import { normalizeSidebarPanel } from "../core/state.js";

export function createSidebarFeature({
  refs,
  closeTemplateSuggest,
  getState,
  patchState,
}) {
  function setSidebarPanel(panel, options = {}) {
    const {
      sidebarTabTemplatesEl,
      sidebarTabEmojiEl,
      sidebarTabSettingsEl,
      sidebarPanelTemplatesEl,
      sidebarPanelEmojiEl,
      sidebarPanelSettingsEl,
    } = refs;

    if (
      !sidebarTabTemplatesEl ||
      !sidebarTabEmojiEl ||
      !sidebarTabSettingsEl ||
      !sidebarPanelTemplatesEl ||
      !sidebarPanelEmojiEl ||
      !sidebarPanelSettingsEl
    ) {
      return;
    }
    const persist = options.persist !== false;
    const normalizedPanel = normalizeSidebarPanel(panel);
    const showEmoji = normalizedPanel === "emoji";
    const showSettings = normalizedPanel === "settings";
    const showTemplates = !showEmoji && !showSettings;

    sidebarTabTemplatesEl.classList.toggle("active", showTemplates);
    sidebarTabTemplatesEl.setAttribute("aria-selected", showTemplates ? "true" : "false");
    sidebarTabEmojiEl.classList.toggle("active", showEmoji);
    sidebarTabEmojiEl.setAttribute("aria-selected", showEmoji ? "true" : "false");
    sidebarTabSettingsEl.classList.toggle("active", showSettings);
    sidebarTabSettingsEl.setAttribute("aria-selected", showSettings ? "true" : "false");

    sidebarPanelTemplatesEl.classList.toggle("active", showTemplates);
    sidebarPanelTemplatesEl.toggleAttribute("hidden", !showTemplates);
    sidebarPanelEmojiEl.classList.toggle("active", showEmoji);
    sidebarPanelEmojiEl.toggleAttribute("hidden", !showEmoji);
    sidebarPanelSettingsEl.classList.toggle("active", showSettings);
    sidebarPanelSettingsEl.toggleAttribute("hidden", !showSettings);

    if (!showTemplates) {
      closeTemplateSuggest();
    }

    if (persist && getState().ui.activeSidebarPanel !== normalizedPanel) {
      patchState((state) => {
        state.ui.activeSidebarPanel = normalizedPanel;
      });
    }
  }

  function setSidebarCollapsed(collapsed) {
    const { sidebarToggleBtnEl, sidebarToggleIconCloseEl, sidebarToggleIconOpenEl } = refs;
    document.body.classList.toggle("sidebar-collapsed", collapsed);
    if (sidebarToggleBtnEl) {
      sidebarToggleBtnEl.setAttribute("aria-expanded", collapsed ? "false" : "true");
      sidebarToggleBtnEl.setAttribute("aria-label", collapsed ? "Expand sidebar" : "Collapse sidebar");
      sidebarToggleBtnEl.setAttribute("title", collapsed ? "Expand sidebar" : "Collapse sidebar");
    }
    if (sidebarToggleIconCloseEl) {
      sidebarToggleIconCloseEl.classList.toggle("hidden", collapsed);
    }
    if (sidebarToggleIconOpenEl) {
      sidebarToggleIconOpenEl.classList.toggle("hidden", !collapsed);
    }
    if (getState().ui.sidebarCollapsed !== Boolean(collapsed)) {
      patchState((state) => {
        state.ui.sidebarCollapsed = Boolean(collapsed);
      });
    }
  }

  function loadSidebarCollapsed() {
    return Boolean(getState().ui.sidebarCollapsed);
  }

  function initSidebarPanels() {
    const {
      sidebarTabTemplatesEl,
      sidebarTabEmojiEl,
      sidebarTabSettingsEl,
      sidebarPanelTemplatesEl,
      sidebarPanelEmojiEl,
      sidebarPanelSettingsEl,
    } = refs;
    if (
      !sidebarTabTemplatesEl ||
      !sidebarTabEmojiEl ||
      !sidebarTabSettingsEl ||
      !sidebarPanelTemplatesEl ||
      !sidebarPanelEmojiEl ||
      !sidebarPanelSettingsEl
    ) {
      return;
    }

    const openSidebarPanel = (panel) => {
      if (document.body.classList.contains("sidebar-collapsed")) {
        setSidebarCollapsed(false);
      }
      setSidebarPanel(panel);
    };

    sidebarTabTemplatesEl.addEventListener("click", () => openSidebarPanel("templates"));
    sidebarTabEmojiEl.addEventListener("click", () => openSidebarPanel("emoji"));
    sidebarTabSettingsEl.addEventListener("click", () => openSidebarPanel("settings"));
    setSidebarPanel(normalizeSidebarPanel(getState().ui.activeSidebarPanel), { persist: false });
  }

  function initSidebarToggle() {
    const { sidebarToggleBtnEl } = refs;
    if (!sidebarToggleBtnEl) {
      return;
    }
    setSidebarCollapsed(loadSidebarCollapsed());
    sidebarToggleBtnEl.addEventListener("click", () => {
      const collapsed = document.body.classList.contains("sidebar-collapsed");
      setSidebarCollapsed(!collapsed);
    });
  }

  return {
    initSidebarPanels,
    initSidebarToggle,
    setSidebarPanel,
    setSidebarCollapsed,
    loadSidebarCollapsed,
  };
}
