export function createTemplateSearchFeature({
  refs,
  escapeHtml,
  fetchCatalog,
  onLoadTemplateFile,
}) {
  let publicTemplateCatalog = [];

  function closeSuggest() {
    if (!refs.templateSuggestEl) {
      return;
    }
    refs.templateSuggestEl.classList.add("hidden");
  }

  function setClearVisibility() {
    if (!refs.templateSearchInputEl || !refs.templateSearchClearEl) {
      return;
    }
    refs.templateSearchClearEl.disabled = !refs.templateSearchInputEl.value.trim();
  }

  function getRandomTemplates(maxItems = 10) {
    const pool = [...publicTemplateCatalog];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, maxItems);
  }

  function renderSuggest(items) {
    if (!refs.templateSuggestEl) {
      return;
    }
    if (items.length === 0) {
      refs.templateSuggestEl.innerHTML = '<div class="template-suggest-empty">No matching templates</div>';
      refs.templateSuggestEl.classList.remove("hidden");
      return;
    }

    refs.templateSuggestEl.innerHTML = items
      .slice(0, 10)
      .map((item) => {
        const tag = String(item.tag || "").trim();
        const tagHtml = tag ? `<span class="template-suggest-tag">${escapeHtml(tag)}</span>` : "";
        return `<button type="button" class="template-suggest-item" data-template-file="${escapeHtml(item.file)}" data-template-name="${escapeHtml(item.name)}"><span class="template-suggest-item-name">${escapeHtml(item.name)}</span>${tagHtml}</button>`;
      })
      .join("");
    refs.templateSuggestEl.classList.remove("hidden");
  }

  function updateSuggest(showRandomWhenEmpty = false) {
    if (!refs.templateSearchInputEl) {
      return;
    }
    const query = refs.templateSearchInputEl.value.trim().toLowerCase();
    setClearVisibility();
    if (!query) {
      if (showRandomWhenEmpty && publicTemplateCatalog.length > 0) {
        renderSuggest(getRandomTemplates(10));
      } else {
        closeSuggest();
      }
      return;
    }

    const matches = publicTemplateCatalog.filter((item) => {
      const name = item.name.toLowerCase();
      const file = item.file.toLowerCase();
      const tag = String(item.tag || "").toLowerCase();
      return name.includes(query) || file.includes(query) || tag.includes(query);
    });
    renderSuggest(matches);
  }

  function toPublicTemplatePath(file) {
    const clean = String(file || "")
      .replace(/^\.?\/*public\//i, "")
      .replace(/^\.?\/*templates\//i, "")
      .trim();
    if (!clean) {
      return "";
    }

    return `./templates/${clean.replace(/^\/+/, "")}`;
  }

  async function loadPublicTemplateFile(file) {
    const path = toPublicTemplatePath(file);
    if (!path) {
      return;
    }
    await onLoadTemplateFile(path);
  }

  async function loadCatalog() {
    publicTemplateCatalog = await fetchCatalog();
  }

  function init() {
    if (!refs.templateSearchInputEl || !refs.templateSuggestEl) {
      return;
    }

    loadCatalog().then(() => {
      if (document.activeElement === refs.templateSearchInputEl && !refs.templateSearchInputEl.value.trim()) {
        updateSuggest(true);
      }
    });
    setClearVisibility();

    refs.templateSearchInputEl.addEventListener("input", () => updateSuggest(true));
    refs.templateSearchInputEl.addEventListener("focus", () => updateSuggest(true));
    refs.templateSearchInputEl.addEventListener("keydown", async (event) => {
      if (event.key === "Escape") {
        closeSuggest();
        return;
      }
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      const first = refs.templateSuggestEl.querySelector(".template-suggest-item");
      if (!(first instanceof HTMLElement)) {
        return;
      }
      const file = first.getAttribute("data-template-file");
      if (!file) {
        return;
      }
      await loadPublicTemplateFile(file);
      closeSuggest();
    });

    refs.templateSuggestEl.addEventListener("click", async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const btn = target.closest(".template-suggest-item");
      if (!(btn instanceof HTMLElement)) {
        return;
      }
      const file = btn.getAttribute("data-template-file");
      const name = btn.getAttribute("data-template-name") || "";
      if (!file) {
        return;
      }
      refs.templateSearchInputEl.value = name;
      setClearVisibility();
      await loadPublicTemplateFile(file);
      closeSuggest();
    });

    if (refs.templateSearchClearEl) {
      refs.templateSearchClearEl.addEventListener("click", () => {
        refs.templateSearchInputEl.value = "";
        setClearVisibility();
        refs.templateSearchInputEl.focus();
        updateSuggest(true);
      });
    }

    document.addEventListener("click", (event) => {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (
        refs.templateSearchWrapEl &&
        refs.templateSuggestEl &&
        !refs.templateSuggestEl.contains(event.target) &&
        !refs.templateSearchWrapEl.contains(event.target)
      ) {
        closeSuggest();
      }
    });
  }

  return {
    init,
    closeSuggest,
  };
}
