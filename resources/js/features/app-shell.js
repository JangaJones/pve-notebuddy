export function createAppShellFeature({
  refs,
  minDesktopViewportWidth,
}) {
  let activeTheme = "dark";

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
      refs.themeIconEl.textContent = activeTheme === "dark" ? "🌙" : "☀️";
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

  return {
    initUnsupportedViewportGuard,
    initSupportMenu,
    initThemeToggle,
    initCopyButton,
    setTheme,
    getTheme,
    closeSupportMenu,
    copyOutput,
  };
}
