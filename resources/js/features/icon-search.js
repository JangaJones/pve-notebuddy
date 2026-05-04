export function createIconSearchFeature({
  refs,
  getThumbnailSource,
}) {
  let allIcons = [];

  function fuzzyMatch(query, text) {
    const q = String(query || "").trim().toLowerCase();
    const t = String(text || "").trim().toLowerCase();
    if (!q) {
      return true;
    }
    let qi = 0;
    for (let i = 0; i < t.length && qi < q.length; i += 1) {
      if (t[i] === q[qi]) {
        qi += 1;
      }
    }
    return qi === q.length;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function getThumbUrl(item) {
    const mode = String(getThumbnailSource?.() || "jsdelivr").toLowerCase();
    if (mode === "local") {
      return item.referenceLocal || item.referenceJsdelivr || "";
    }
    return item.referenceJsdelivr || item.referenceLocal || "";
  }

  function normalizeIconEntry(row) {
    if (!row || typeof row !== "object") {
      return null;
    }

    const name = String(row.Name || "").trim();
    const svgNormal = String(row?.SVG?.normal || "").trim();
    const webpNormal = String(row?.WebP?.normal || "").trim();
    const referenceLocal = String(row["reference-local"] || "").trim();
    const referenceJsdelivr = String(row["reference-jsdelivr"] || "").trim();

    if (!name || (!svgNormal && !webpNormal)) {
      return null;
    }

    return {
      name,
      svgNormal,
      webpNormal,
      referenceLocal,
      referenceJsdelivr,
      searchBlob: `${name} ${String(row.Reference || "")}`.toLowerCase(),
    };
  }

  async function loadIndex() {
    const res = await fetch("./templates/icon-sidepanel-index.json", { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Icon index request failed with ${res.status}`);
    }
    const payload = await res.json();
    const rows = Array.isArray(payload?.icons) ? payload.icons : [];
    allIcons = rows.map(normalizeIconEntry).filter(Boolean);
    allIcons.sort((a, b) => a.name.localeCompare(b.name));
  }

  async function copyToClipboard(text) {
    const value = String(text || "").trim();
    if (!value) {
      return false;
    }

    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      try {
        const el = document.createElement("textarea");
        el.value = value;
        el.setAttribute("readonly", "");
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        const ok = document.execCommand("copy");
        el.remove();
        return Boolean(ok);
      } catch {
        return false;
      }
    }
  }

  function buildCard(item) {
    const thumb = getThumbUrl(item);
    const svgDisabled = !item.svgNormal;
    const webpDisabled = !item.webpNormal;
    return `
      <article class="icon-search-card" data-icon-name="${escapeHtml(item.name)}">
        <h4 class="icon-search-card-name">${escapeHtml(item.name)}</h4>
        <div class="icon-search-thumb-wrap">
          ${
  thumb
    ? `<img class="icon-search-thumb" src="${escapeHtml(thumb)}" alt="${escapeHtml(item.name)} logo" loading="lazy" />`
    : '<div class="icon-search-thumb-placeholder">No Preview</div>'
}
        </div>
        <div class="icon-search-actions">
          <button type="button" class="panel-action icon-search-copy-btn" data-copy-url="${escapeHtml(item.svgNormal)}" ${svgDisabled ? "disabled" : ""}>SVG</button>
          <button type="button" class="panel-action icon-search-copy-btn" data-copy-url="${escapeHtml(item.webpNormal)}" ${webpDisabled ? "disabled" : ""}>WEBP</button>
        </div>
      </article>
    `;
  }

  function render(items) {
    if (!refs.iconSearchGridEl) {
      return;
    }
    if (!items.length) {
      refs.iconSearchGridEl.innerHTML = '<div class="icon-search-empty">No matching icons.</div>';
      return;
    }
    refs.iconSearchGridEl.innerHTML = items.map((item) => buildCard(item)).join("");
  }

  function syncClearButton() {
    if (!refs.iconSearchClearEl || !refs.iconSearchInputEl) {
      return;
    }
    refs.iconSearchClearEl.disabled = !refs.iconSearchInputEl.value.trim();
  }

  function applyFilter() {
    if (!refs.iconSearchInputEl) {
      render(allIcons);
      return;
    }
    const query = refs.iconSearchInputEl.value || "";
    if (!query.trim()) {
      render(allIcons);
      syncClearButton();
      return;
    }

    const lower = query.trim().toLowerCase();
    const filtered = allIcons.filter((item) => item.searchBlob.includes(lower) || fuzzyMatch(lower, item.name));
    render(filtered);
    syncClearButton();
  }

  function bindInteractions() {
    refs.iconSearchInputEl?.addEventListener("input", applyFilter);
    refs.iconSearchClearEl?.addEventListener("click", () => {
      if (!refs.iconSearchInputEl) {
        return;
      }
      refs.iconSearchInputEl.value = "";
      applyFilter();
      refs.iconSearchInputEl.focus();
    });
    refs.iconSearchGridEl?.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const btn = target.closest(".icon-search-copy-btn");
      if (!(btn instanceof HTMLButtonElement) || btn.disabled) {
        return;
      }
      const url = btn.getAttribute("data-copy-url") || "";
      const copied = await copyToClipboard(url);
      const prev = btn.textContent || "";
      btn.textContent = copied ? "COPIED" : "FAILED";
      window.setTimeout(() => {
        btn.textContent = prev;
      }, 900);
    });
  }

  function refreshThumbnails() {
    applyFilter();
  }

  async function init() {
    if (!refs.iconSearchGridEl) {
      return;
    }
    try {
      await loadIndex();
      render(allIcons);
    } catch {
      refs.iconSearchGridEl.innerHTML = '<div class="icon-search-empty">Could not load icon index.</div>';
    }
    syncClearButton();
    bindInteractions();
  }

  return {
    init,
    refreshThumbnails,
  };
}
