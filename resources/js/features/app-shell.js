export function createAppShellFeature({
  refs,
  minDesktopViewportWidth,
  getState,
  patchState,
  previewSidebarMinWidth = 358,
  previewSidebarDefaultWidth = 468,
  previewSidebarMaxWidth = 600,
  workspaceMinWidth = 752,
}) {
  let activeTheme = "dark";
  let previewResizeBound = false;
  const previewWidthCssVar = "--preview-sidebar-width";

  function shouldShowUnsupportedViewport() {
    const width = window.innerWidth || document.documentElement.clientWidth || 0;
    const isPortrait = window.matchMedia("(orientation: portrait)").matches;
    const hasCoarsePointer = window.matchMedia("(pointer: coarse)").matches || navigator.maxTouchPoints > 0;

    if (width < minDesktopViewportWidth) {
      return true;
    }

    return hasCoarsePointer && isPortrait;
  }

  function updateUnsupportedViewportState() {
    if (!refs.unsupportedViewportEl) {
      return;
    }
    const show = shouldShowUnsupportedViewport();
    document.body.classList.toggle("unsupported-viewport-active", show);
    refs.unsupportedViewportEl.classList.toggle("hidden", !show);
  }

  function initUnsupportedViewportGuard() {
    updateUnsupportedViewportState();
    window.addEventListener("resize", updateUnsupportedViewportState);
    window.addEventListener("orientationchange", updateUnsupportedViewportState);
  }

  function setTheme(theme) {
    activeTheme = theme === "light" ? "light" : "dark";
    refs.previewShell.classList.toggle("dark", activeTheme === "dark");
    refs.previewShell.classList.toggle("light", activeTheme === "light");
    if (refs.themeToggleBtn) {
      refs.themeToggleBtn.setAttribute("aria-pressed", activeTheme === "light" ? "true" : "false");
      refs.themeToggleBtn.setAttribute("title", activeTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
    }
    if (refs.themeIconEl) {
      refs.themeIconEl.classList.toggle("theme-icon-dark", activeTheme === "dark");
      refs.themeIconEl.classList.toggle("theme-icon-light", activeTheme === "light");
    }
  }

  function getTheme() {
    return activeTheme;
  }

  function closeSupportMenu() {
    if (!refs.supportMenuBtn || !refs.supportMenuList) {
      return;
    }
    refs.supportMenuBtn.setAttribute("aria-expanded", "false");
    refs.supportMenuList.classList.add("hidden");
  }

  function toggleSupportMenu() {
    if (!refs.supportMenuBtn || !refs.supportMenuList) {
      return;
    }
    const nextExpanded = refs.supportMenuBtn.getAttribute("aria-expanded") !== "true";
    refs.supportMenuBtn.setAttribute("aria-expanded", nextExpanded ? "true" : "false");
    refs.supportMenuList.classList.toggle("hidden", !nextExpanded);
  }

  function initSupportMenu() {
    if (!refs.supportMenuBtn || !refs.supportMenuList) {
      return;
    }

    refs.supportMenuBtn.addEventListener("click", (event) => {
      event.stopPropagation();
      toggleSupportMenu();
    });

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (!refs.supportMenuList.contains(event.target) && !refs.supportMenuBtn.contains(event.target)) {
        closeSupportMenu();
      }
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") {
        closeSupportMenu();
      }
    });
  }

  async function copyOutput() {
    if (refs.copyBtn.disabled) {
      return;
    }

    try {
      await navigator.clipboard.writeText(refs.outputEl.value);
      refs.copyBtn.textContent = "Copied";
      setTimeout(() => {
        refs.copyBtn.textContent = "Copy HTML";
      }, 1200);
    } catch {
      refs.copyBtn.textContent = "Clipboard blocked";
      setTimeout(() => {
        refs.copyBtn.textContent = "Copy HTML";
      }, 1400);
    }
  }

  function initThemeToggle() {
    if (!refs.themeToggleBtn) {
      return;
    }
    refs.themeToggleBtn.addEventListener("click", () => {
      setTheme(activeTheme === "dark" ? "light" : "dark");
    });
  }

  function initCopyButton() {
    if (!refs.copyBtn) {
      return;
    }
    refs.copyBtn.addEventListener("click", copyOutput);
  }

  function getCssPxVar(name, fallback) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const numeric = Number.parseFloat(raw);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function getLeftSidebarWidthPx() {
    const collapsed = document.body.classList.contains("sidebar-collapsed");
    if (collapsed) {
      return getCssPxVar("--sidebar-rail-width", 52);
    }
    return getCssPxVar("--sidebar-width", 356);
  }

  function clampPreviewSidebarWidth(value) {
    const numeric = Number.parseInt(String(value || ""), 10);
    const requested = Number.isFinite(numeric) ? numeric : previewSidebarDefaultWidth;
    const viewport = window.innerWidth || document.documentElement.clientWidth || 0;
    const maxByViewport = Math.max(previewSidebarMinWidth, viewport - getLeftSidebarWidthPx() - workspaceMinWidth);
    const effectiveMax = Math.min(previewSidebarMaxWidth, maxByViewport);
    return Math.min(effectiveMax, Math.max(previewSidebarMinWidth, requested));
  }

  function setPreviewSidebarWidth(width, options = {}) {
    const persist = options.persist !== false;
    const clamped = clampPreviewSidebarWidth(width);
    document.documentElement.style.setProperty(previewWidthCssVar, `${clamped}px`);
    if (persist && getState().ui.previewSidebarWidth !== clamped) {
      patchState((state) => {
        state.ui.previewSidebarWidth = clamped;
      });
    }
    return clamped;
  }

  function syncPreviewSidebarWidthFromState(options = {}) {
    const persist = options.persist === true;
    const stateWidth = getState().ui.previewSidebarWidth;
    setPreviewSidebarWidth(stateWidth, { persist });
  }

  function resetPreviewSidebarWidth() {
    setPreviewSidebarWidth(previewSidebarDefaultWidth, { persist: true });
  }

  function initPreviewSidebarResize() {
    if (previewResizeBound) {
      return;
    }
    const handleEl = refs.previewResizeHandleEl;
    if (!(handleEl instanceof HTMLElement)) {
      return;
    }
    previewResizeBound = true;

    let dragging = false;
    let startX = 0;
    let startWidth = 0;
    let currentWidth = 0;

    const onPointerMove = (event) => {
      if (!dragging) {
        return;
      }
      const delta = startX - event.clientX;
      currentWidth = setPreviewSidebarWidth(startWidth + delta, { persist: false });
    };

    const endDrag = () => {
      if (!dragging) {
        return;
      }
      dragging = false;
      document.body.classList.remove("preview-resizing");
      handleEl.classList.remove("is-dragging");
      setPreviewSidebarWidth(currentWidth, { persist: true });
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", endDrag);
      window.removeEventListener("pointercancel", endDrag);
    };

    handleEl.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) {
        return;
      }
      event.preventDefault();
      dragging = true;
      startX = event.clientX;
      startWidth = refs.workspacePreviewSidebarEl
        ? refs.workspacePreviewSidebarEl.getBoundingClientRect().width
        : getCssPxVar(previewWidthCssVar, previewSidebarDefaultWidth);
      currentWidth = startWidth;
      document.body.classList.add("preview-resizing");
      handleEl.classList.add("is-dragging");
      window.addEventListener("pointermove", onPointerMove);
      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
    });

    handleEl.addEventListener("dblclick", (event) => {
      event.preventDefault();
      resetPreviewSidebarWidth();
    });

    window.addEventListener("resize", () => {
      syncPreviewSidebarWidthFromState({ persist: false });
    });

    const bodyClassObserver = new MutationObserver(() => {
      syncPreviewSidebarWidthFromState({ persist: false });
    });
    bodyClassObserver.observe(document.body, { attributes: true, attributeFilter: ["class"] });

    syncPreviewSidebarWidthFromState({ persist: false });
  }

  return {
    initUnsupportedViewportGuard,
    initSupportMenu,
    initThemeToggle,
    initCopyButton,
    initPreviewSidebarResize,
    syncPreviewSidebarWidthFromState,
    setTheme,
    getTheme,
  };
}
