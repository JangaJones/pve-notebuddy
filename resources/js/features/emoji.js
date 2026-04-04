export function createEmojiFeature({
  refs,
  emojiGroups,
  escapeHtml,
}) {
  let emojiCopyToastTimer = null;

  function getEmojiCopyToastEl() {
    let toastEl = document.getElementById("emojiCopyToast");
    if (toastEl) {
      return toastEl;
    }
    toastEl = document.createElement("div");
    toastEl.id = "emojiCopyToast";
    toastEl.className = "emoji-copy-toast hidden";
    toastEl.setAttribute("aria-hidden", "true");
    document.body.append(toastEl);
    return toastEl;
  }

  function showEmojiCopyToast(text, clientX, clientY) {
    const toastEl = getEmojiCopyToastEl();
    toastEl.textContent = text;
    toastEl.classList.remove("hidden", "visible");

    const offset = 12;
    const viewportWidth = window.innerWidth || document.documentElement.clientWidth || 0;
    const viewportHeight = window.innerHeight || document.documentElement.clientHeight || 0;
    const padding = 8;

    const measuredWidth = toastEl.offsetWidth || 72;
    const measuredHeight = toastEl.offsetHeight || 24;
    const left = Math.min(
      Math.max(Math.round(clientX + offset), padding),
      Math.max(padding, viewportWidth - measuredWidth - padding)
    );
    const top = Math.min(
      Math.max(Math.round(clientY - measuredHeight - offset), padding),
      Math.max(padding, viewportHeight - measuredHeight - padding)
    );

    toastEl.style.left = `${left}px`;
    toastEl.style.top = `${top}px`;
    toastEl.classList.add("visible");

    if (emojiCopyToastTimer) {
      window.clearTimeout(emojiCopyToastTimer);
    }
    emojiCopyToastTimer = window.setTimeout(() => {
      toastEl.classList.remove("visible");
      toastEl.classList.add("hidden");
      emojiCopyToastTimer = null;
    }, 900);
  }

  function setEmojiRailCollapsed(collapsed) {
    if (!refs.emojiRailEl || !refs.emojiRailToggleEl) {
      return;
    }
    refs.emojiRailEl.classList.toggle("collapsed", collapsed);
    refs.emojiRailToggleEl.setAttribute("aria-expanded", collapsed ? "false" : "true");
    if (refs.emojiRailToggleCloseEl) {
      refs.emojiRailToggleCloseEl.classList.toggle("hidden", collapsed);
    }
    if (refs.emojiRailToggleOpenIconEl) {
      refs.emojiRailToggleOpenIconEl.classList.toggle("hidden", !collapsed);
    }
  }

  function initEmojiRail() {
    if (!refs.emojiRailEl || !refs.emojiRailToggleEl || !refs.emojiRailListEl) {
      return;
    }

    refs.emojiRailListEl.innerHTML = emojiGroups
      .map((group) => {
        const title = escapeHtml(group.title);
        const items = group.items
          .map(
            (emoji) =>
              `<button type="button" class="emoji-chip" data-emoji="${escapeHtml(emoji)}" title="Copy ${escapeHtml(emoji)}">${escapeHtml(emoji)}</button>`
          )
          .join("");
        return `<section class="emoji-section"><div class="emoji-section-title">${title}</div><div class="emoji-grid">${items}</div></section>`;
      })
      .join("");

    setEmojiRailCollapsed(false);

    if (!refs.emojiRailToggleEl.classList.contains("hidden")) {
      refs.emojiRailToggleEl.addEventListener("click", () => {
        const isCollapsed = refs.emojiRailEl.classList.contains("collapsed");
        setEmojiRailCollapsed(!isCollapsed);
      });
    }

    refs.emojiRailListEl.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const button = target.closest(".emoji-chip");
      if (!(button instanceof HTMLButtonElement)) {
        return;
      }
      const emoji = button.getAttribute("data-emoji") || button.textContent || "";
      if (!emoji) {
        return;
      }
      const rect = button.getBoundingClientRect();
      const fallbackX = Math.round(rect.left + rect.width / 2);
      const fallbackY = Math.round(rect.top + rect.height / 2);
      const clientX = typeof event.clientX === "number" && event.clientX > 0 ? event.clientX : fallbackX;
      const clientY = typeof event.clientY === "number" && event.clientY > 0 ? event.clientY : fallbackY;

      try {
        await navigator.clipboard.writeText(emoji);
        showEmojiCopyToast("Copied to clipboard!", clientX, clientY);
      } catch {
        showEmojiCopyToast("Clipboard blocked", clientX, clientY);
      }
    });
  }

  return {
    initEmojiRail,
  };
}
