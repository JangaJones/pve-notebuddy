import { sanitizeFqdnHref } from "../core/utils.js";

export function createRowEditorFeature({
  form,
  getEl,
  refs,
  renderOutput,
  prepareIcon,
  setUploadSvgText,
  setUploadImageDataUrl,
  onClearAll,
}) {
  const staticRowConfigs = [
    { prefix: "title", defaultAlign: "center", defaultTag: "h2", bold: false, italic: false, strong: false, code: false },
    { prefix: "fqdn", defaultAlign: "center", defaultTag: "h3", bold: false, italic: false, strong: false, code: false },
    { prefix: "network", defaultAlign: "center", defaultTag: "h3", bold: false, italic: false, strong: false, code: false },
    { prefix: "config", defaultAlign: "center", defaultTag: "none", bold: false, italic: true, strong: true, code: true },
  ];
  const customRowDefaults = { prefix: "custom", defaultAlign: "left", defaultTag: "none", bold: false, italic: false, strong: false, code: false };
  const STATIC_ROW_KEYS = ["icon", "title", "fqdn", "network", "config"];
  const CUSTOM_ROW_KEY_RE = /^custom[1-9][0-9]*$/;
  let rowInteractionsBound = false;
  let defaultRowsInitialized = false;
  let dragRowFieldset = null;
  let dragOverFieldset = null;
  let dragOverPosition = "";

  function normalizeCustomRowKey(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "custom") {
      return "custom1";
    }
    return CUSTOM_ROW_KEY_RE.test(raw) ? raw : "";
  }

  function isCustomRowKey(value) {
    return Boolean(normalizeCustomRowKey(value));
  }

  function isValidRowKey(value) {
    const raw = String(value || "").trim().toLowerCase();
    return STATIC_ROW_KEYS.includes(raw) || isCustomRowKey(raw);
  }

  function normalizeRowKey(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (STATIC_ROW_KEYS.includes(raw)) {
      return raw;
    }
    return normalizeCustomRowKey(raw);
  }

  function getSelectedRadioValue(name, fallback = "") {
    const checked = form.querySelector(`input[name="${name}"]:checked`);
    return checked ? checked.value : fallback;
  }

  function setSelectedRadioValue(name, value) {
    const radios = form.querySelectorAll(`input[name="${name}"]`);
    let didSet = false;
    for (const radio of radios) {
      const shouldCheck = radio.value === value;
      radio.checked = shouldCheck;
      if (shouldCheck) {
        didSet = true;
      }
    }
    if (!didSet && radios.length > 0) {
      radios[0].checked = true;
    }
  }

  function getCustomRowFieldsets() {
    return Array.from(form.querySelectorAll('fieldset[data-row-key]')).filter((fieldset) => isCustomRowKey(fieldset.getAttribute("data-row-key")));
  }

  function getFieldsetLegend(fieldset) {
    if (!(fieldset instanceof HTMLElement)) {
      return null;
    }
    const legend = fieldset.querySelector(":scope > legend");
    return legend instanceof HTMLLegendElement ? legend : null;
  }

  function ensureLegendDragHandles() {
    const fieldsets = Array.from(form.querySelectorAll("fieldset[data-row-key]"));
    for (const fieldset of fieldsets) {
      const legend = getFieldsetLegend(fieldset);
      if (!legend) {
        continue;
      }
      legend.classList.add("row-drag-handle");
      legend.setAttribute("title", "Drag to reorder row");
      let hotspot = legend.querySelector(".row-drag-hotspot");
      if (!(hotspot instanceof HTMLSpanElement)) {
        hotspot = document.createElement("span");
        hotspot.className = "row-drag-hotspot";
        hotspot.draggable = true;
        hotspot.setAttribute("aria-hidden", "true");
        hotspot.setAttribute("title", "Drag to reorder row");
        legend.append(hotspot);
      }
    }
  }

  function clearDragIndicators() {
    for (const fieldset of form.querySelectorAll("fieldset[data-row-key]")) {
      fieldset.classList.remove("row-drop-before", "row-drop-after");
    }
    dragOverFieldset = null;
    dragOverPosition = "";
  }

  function resolveDropTarget(clientY, preferredFieldset = null) {
    const fieldsets = Array.from(form.querySelectorAll("fieldset[data-row-key]")).filter(
      (fieldset) => fieldset instanceof HTMLFieldSetElement && fieldset !== dragRowFieldset
    );
    if (fieldsets.length === 0) {
      return { fieldset: null, position: "" };
    }

    const preferred =
      preferredFieldset instanceof HTMLFieldSetElement && preferredFieldset !== dragRowFieldset ? preferredFieldset : null;
    let target = preferred;
    if (!target) {
      let best = null;
      let bestDistance = Number.POSITIVE_INFINITY;
      for (const fieldset of fieldsets) {
        const rect = fieldset.getBoundingClientRect();
        const mid = rect.top + rect.height / 2;
        const distance = Math.abs(clientY - mid);
        if (distance < bestDistance) {
          bestDistance = distance;
          best = fieldset;
        }
      }
      target = best;
    }
    if (!(target instanceof HTMLFieldSetElement)) {
      return { fieldset: null, position: "" };
    }

    const rect = target.getBoundingClientRect();
    const position = clientY > rect.top + rect.height / 2 ? "after" : "before";
    return { fieldset: target, position };
  }

  function isNoopDropPosition(targetFieldset, position) {
    if (!(dragRowFieldset instanceof HTMLFieldSetElement) || !(targetFieldset instanceof HTMLFieldSetElement)) {
      return true;
    }
    return (
      (position === "before" && dragRowFieldset.nextElementSibling === targetFieldset) ||
      (position === "after" && dragRowFieldset.previousElementSibling === targetFieldset)
    );
  }

  function getNextCustomRowKey() {
    const maxExisting = getCustomRowFieldsets().reduce((max, fieldset) => {
      const key = normalizeCustomRowKey(fieldset.getAttribute("data-row-key"));
      const num = Number.parseInt(key.replace("custom", ""), 10);
      return Number.isFinite(num) ? Math.max(max, num) : max;
    }, 0);
    return `custom${maxExisting + 1}`;
  }

  function styleToolbarHtml(prefix, defaults) {
    const headingOptions = [
      { tag: "h1", iconClass: "chip-icon-h1" },
      { tag: "h2", iconClass: "chip-icon-h2" },
      { tag: "h3", iconClass: "chip-icon-h3" },
      { tag: "h4", iconClass: "chip-icon-h4" },
      { tag: "h5", iconClass: "chip-icon-h5" },
    ];
    const alignOptions = ["left", "center", "right"];

    const align = alignOptions
      .map((value) => {
        const title = value.toUpperCase();
        const checked = defaults.defaultAlign === value ? "checked" : "";
        return `<label class="tool-chip align-chip format-chip" title="${title} alignment"><input type="radio" name="${prefix}Align" value="${value}" ${checked} /><span class="align-glyph align-${value}" aria-hidden="true"><span></span><span></span><span></span></span><span class="sr-only">${title}</span></label>`;
      })
      .join("");

    const heading = headingOptions
      .map((item) => {
        const title = `${item.tag.toUpperCase()} heading`;
        const checked = defaults.defaultTag === item.tag ? "checked" : "";
        return `<label class="tool-chip format-chip" title="${title}"><input type="checkbox" name="${prefix}Heading" value="${item.tag}" ${checked} /><span class="chip-icon ${item.iconClass}" aria-hidden="true"></span><span class="sr-only">${title}</span></label>`;
      })
      .join("");

    const toggles = [
      { key: "Italic", title: "Italic", iconClass: "chip-icon-italic", checked: defaults.italic },
      { key: "Bold", title: "Bold", iconClass: "chip-icon-bold", checked: defaults.bold },
      { key: "Strong", title: "Strong", iconClass: "chip-icon-strong", checked: defaults.strong },
      { key: "Code", title: "Code", iconClass: "chip-icon-code", checked: defaults.code },
    ]
      .map((item) => {
        const checked = item.checked ? "checked" : "";
        return `<label class="tool-chip format-chip" title="${item.title}"><input id="${prefix}${item.key}" type="checkbox" ${checked} /><span class="chip-icon ${item.iconClass}" aria-hidden="true"></span><span class="sr-only">${item.title}</span></label>`;
      })
      .join("");

    return `
    <div class="tool-set">
      <div class="tool-group">${align}</div>
    </div>
    <div class="tool-set">
      <div class="tool-group">${heading}${toggles}</div>
    </div>
  `;
  }

  function mountStyleToolbars() {
    for (const config of staticRowConfigs) {
      const holder = document.querySelector(`.style-tools[data-prefix="${config.prefix}"]`);
      if (!holder) {
        continue;
      }
      holder.innerHTML = styleToolbarHtml(config.prefix, config);
    }
  }

  function bindStyleConflictsForPrefix(prefix) {
    const bold = getEl(`${prefix}Bold`);
    const strong = getEl(`${prefix}Strong`);
    const headingToggles = form.querySelectorAll(`input[name="${prefix}Heading"]`);
    if (!bold || !strong) {
      return;
    }
    if (bold.dataset.boundStyleConflicts === "1") {
      return;
    }
    bold.dataset.boundStyleConflicts = "1";
    strong.dataset.boundStyleConflicts = "1";

    for (const headingToggle of headingToggles) {
      headingToggle.addEventListener("change", () => {
        if (headingToggle.checked) {
          for (const other of headingToggles) {
            if (other !== headingToggle) {
              other.checked = false;
            }
          }
          bold.checked = false;
          strong.checked = false;
        }
        renderOutput();
      });
    }

    bold.addEventListener("change", () => {
      if (bold.checked && strong.checked) {
        strong.checked = false;
      }
      if (bold.checked) {
        for (const headingToggle of headingToggles) {
          headingToggle.checked = false;
        }
      }
      renderOutput();
    });

    strong.addEventListener("change", () => {
      if (strong.checked && bold.checked) {
        bold.checked = false;
      }
      if (strong.checked) {
        for (const headingToggle of headingToggles) {
          headingToggle.checked = false;
        }
      }
      renderOutput();
    });
  }

  function bindStyleConflicts() {
    for (const { prefix } of staticRowConfigs) {
      bindStyleConflictsForPrefix(prefix);
    }
  }

  function getOrderedRowKeys() {
    return Array.from(form.querySelectorAll("fieldset[data-row-key]"))
      .map((fieldset) => fieldset.getAttribute("data-row-key"))
      .filter(Boolean);
  }

  function reorderFieldsets(rowOrder) {
    const seen = new Set();
    const map = new Map(
      Array.from(form.querySelectorAll("fieldset[data-row-key]"))
        .map((fieldset) => [fieldset.getAttribute("data-row-key"), fieldset])
    );
    for (const key of rowOrder) {
      const fieldset = map.get(key);
      if (!fieldset) {
        continue;
      }
      seen.add(key);
      form.appendChild(fieldset);
    }
    for (const [key, fieldset] of map.entries()) {
      if (!seen.has(key)) {
        form.appendChild(fieldset);
      }
    }
  }

  function getRowFieldset(rowKey) {
    return form.querySelector(`fieldset[data-row-key="${rowKey}"]`);
  }

  function isRowVisible(rowKey) {
    const fieldset = getRowFieldset(rowKey);
    if (!fieldset) {
      return true;
    }
    return fieldset.getAttribute("data-row-visible") !== "0";
  }

  function updateRowVisibilityUi(rowKey) {
    const fieldset = getRowFieldset(rowKey);
    if (!fieldset) {
      return;
    }
    const visible = isRowVisible(rowKey);
    const toggleBtn = fieldset.querySelector(".row-visibility");
    if (toggleBtn instanceof HTMLButtonElement) {
      toggleBtn.title = visible ? "Hide row" : "Show row";
      toggleBtn.setAttribute("aria-label", visible ? "Hide row" : "Show row");
      toggleBtn.setAttribute("aria-pressed", visible ? "false" : "true");
      const iconEl = toggleBtn.querySelector(".action-icon");
      if (iconEl instanceof HTMLElement) {
        iconEl.classList.toggle("action-icon-visibility", visible);
        iconEl.classList.toggle("action-icon-visibility-off", !visible);
      }
      const srOnlyEl = toggleBtn.querySelector(".sr-only");
      if (srOnlyEl instanceof HTMLElement) {
        srOnlyEl.textContent = visible ? "Hide row" : "Show row";
      }
    }
    fieldset.classList.toggle("row-hidden", !visible);

    const controls = fieldset.querySelectorAll("input, select, textarea, button");
    for (const control of controls) {
      if (!(control instanceof HTMLInputElement || control instanceof HTMLSelectElement || control instanceof HTMLTextAreaElement || control instanceof HTMLButtonElement)) {
        continue;
      }
      if (control.classList.contains("row-move") || control.classList.contains("row-visibility") || control.classList.contains("row-remove")) {
        control.disabled = false;
        continue;
      }
      control.disabled = !visible;
    }
  }

  function setRowVisibility(rowKey, visible) {
    const fieldset = getRowFieldset(rowKey);
    if (!fieldset) {
      return;
    }
    fieldset.setAttribute("data-row-visible", visible ? "1" : "0");
    updateRowVisibilityUi(rowKey);
  }

  function toggleRowVisibility(rowKey) {
    setRowVisibility(rowKey, !isRowVisible(rowKey));
  }

  function initializeRowVisibility() {
    const keys = Array.from(form.querySelectorAll("fieldset[data-row-key]"))
      .map((fieldset) => fieldset.getAttribute("data-row-key"))
      .filter(Boolean);
    for (const key of keys) {
      const fieldset = getRowFieldset(key);
      if (!fieldset.hasAttribute("data-row-visible")) {
        fieldset.setAttribute("data-row-visible", "1");
      }
      updateRowVisibilityUi(key);
    }
  }

  function moveRow(rowKey, direction) {
    const fieldsets = Array.from(form.querySelectorAll("fieldset[data-row-key]"));
    const index = fieldsets.findIndex((fieldset) => fieldset.getAttribute("data-row-key") === rowKey);
    if (index < 0) {
      return;
    }

    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= fieldsets.length) {
      return;
    }

    const current = fieldsets[index];
    const target = fieldsets[targetIndex];
    if (direction === "up") {
      form.insertBefore(current, target);
    } else {
      form.insertBefore(target, current);
    }
  }

  function createStackRemoveButton(row) {
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "icon-delete";
    remove.title = "Delete entry";
    remove.innerHTML = '<span class="action-icon action-icon-delete" aria-hidden="true"></span><span class="sr-only">Delete entry</span>';
    remove.addEventListener("click", () => {
      row.remove();
      renderOutput();
    });
    return remove;
  }

  function createHostEntryInput(initialLabel = "", initialUrl = "", initialIcon = "🔗") {
    const row = document.createElement("div");
    row.className = "stack-row host-entry-row";

    const iconField = document.createElement("label");
    iconField.className = "icon-field";
    iconField.textContent = "";

    const iconWrap = document.createElement("span");
    iconWrap.className = "icon-input-wrap";

    const iconInput = document.createElement("input");
    iconInput.type = "text";
    iconInput.maxLength = 8;
    iconInput.value = initialIcon;
    iconInput.setAttribute("data-host-icon", "1");

    const iconClear = document.createElement("button");
    iconClear.type = "button";
    iconClear.className = "icon-clear";
    iconClear.innerHTML = '<span class="action-icon action-icon-close" aria-hidden="true"></span><span class="sr-only">Clear icon</span>';
    iconClear.title = "Clear icon";
    iconClear.addEventListener("click", () => {
      iconInput.value = "";
      renderOutput();
    });

    iconWrap.append(iconInput, iconClear);
    iconField.append(iconWrap);

    const fieldStack = document.createElement("div");
    fieldStack.className = "field-stack host-fields";

    const labelInput = document.createElement("input");
    labelInput.type = "text";
    labelInput.placeholder = "Text";
    labelInput.value = initialLabel;
    labelInput.setAttribute("data-host-label", "1");

    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.placeholder = "URL";
    urlInput.value = initialUrl;
    urlInput.setAttribute("data-host-url", "1");
    urlInput.addEventListener("blur", () => {
      const normalized = sanitizeFqdnHref(urlInput.value);
      if (normalized && normalized !== urlInput.value.trim()) {
        urlInput.value = normalized;
        renderOutput();
      }
    });

    fieldStack.append(labelInput, urlInput);

    const remove = createStackRemoveButton(row);

    row.append(iconField, fieldStack, remove);
    iconInput.addEventListener("input", renderOutput);
    labelInput.addEventListener("input", renderOutput);
    urlInput.addEventListener("input", renderOutput);
    return row;
  }

  function createNetworkEntryInput(initialValue = "", initialIcon = "🖥️") {
    const row = document.createElement("div");
    row.className = "stack-row network-entry-row";

    const iconField = document.createElement("label");
    iconField.className = "icon-field";
    iconField.textContent = "";

    const iconWrap = document.createElement("span");
    iconWrap.className = "icon-input-wrap";

    const iconInput = document.createElement("input");
    iconInput.type = "text";
    iconInput.maxLength = 8;
    iconInput.value = initialIcon;
    iconInput.setAttribute("data-network-icon", "1");

    const iconClear = document.createElement("button");
    iconClear.type = "button";
    iconClear.className = "icon-clear";
    iconClear.innerHTML = '<span class="action-icon action-icon-close" aria-hidden="true"></span><span class="sr-only">Clear icon</span>';
    iconClear.title = "Clear icon";
    iconClear.addEventListener("click", () => {
      iconInput.value = "";
      renderOutput();
    });

    iconWrap.append(iconInput, iconClear);
    iconField.append(iconWrap);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "IPs, Ports, etc.";
    input.value = initialValue;
    input.setAttribute("data-network-value", "1");

    const remove = createStackRemoveButton(row);

    row.append(iconField, input, remove);
    iconInput.addEventListener("input", renderOutput);
    input.addEventListener("input", renderOutput);
    return row;
  }

  function createConfigLocationInput(initialValue = "", initialIcon = "📁") {
    const row = document.createElement("div");
    row.className = "stack-row config-location-row";

    const iconField = document.createElement("label");
    iconField.className = "icon-field";
    iconField.textContent = "";

    const iconWrap = document.createElement("span");
    iconWrap.className = "icon-input-wrap";

    const iconInput = document.createElement("input");
    iconInput.type = "text";
    iconInput.maxLength = 8;
    iconInput.value = initialIcon;
    iconInput.setAttribute("data-config-icon", "1");

    const iconClear = document.createElement("button");
    iconClear.type = "button";
    iconClear.className = "icon-clear";
    iconClear.innerHTML = '<span class="action-icon action-icon-close" aria-hidden="true"></span><span class="sr-only">Clear icon</span>';
    iconClear.title = "Clear icon";
    iconClear.addEventListener("click", () => {
      iconInput.value = "";
      renderOutput();
    });

    iconWrap.append(iconInput, iconClear);
    iconField.append(iconWrap);

    const input = document.createElement("input");
    input.type = "text";
    input.placeholder = "/etc/app/config.yml";
    input.value = initialValue;
    input.setAttribute("data-config-location", "1");

    const remove = createStackRemoveButton(row);

    row.append(iconField, input, remove);
    iconInput.addEventListener("input", renderOutput);
    input.addEventListener("input", renderOutput);
    return row;
  }

  function getConfigLocationEntries() {
    return Array.from(refs.configLocationsEl.querySelectorAll(".config-location-row"))
      .map((row) => {
        const iconInput = row.querySelector('input[data-config-icon="1"]');
        const pathInput = row.querySelector('input[data-config-location="1"]');
        return {
          icon: iconInput ? iconInput.value : "",
          value: pathInput ? pathInput.value.trim() : "",
        };
      })
      .filter((entry) => entry.value);
  }

  function getHostEntries() {
    return Array.from(refs.hostEntriesEl.querySelectorAll(".host-entry-row"))
      .map((row) => {
        const iconInput = row.querySelector('input[data-host-icon="1"]');
        const labelInput = row.querySelector('input[data-host-label="1"]');
        const urlInput = row.querySelector('input[data-host-url="1"]');
        return {
          icon: iconInput ? iconInput.value : "",
          label: labelInput ? labelInput.value.trim() : "",
          url: urlInput ? urlInput.value.trim() : "",
        };
      })
      .filter((entry) => entry.label);
  }

  function getNetworkEntries() {
    return Array.from(refs.networkEntriesEl.querySelectorAll(".network-entry-row"))
      .map((row) => {
        const iconInput = row.querySelector('input[data-network-icon="1"]');
        const valueInput = row.querySelector('input[data-network-value="1"]');
        return {
          icon: iconInput ? iconInput.value : "",
          value: valueInput ? valueInput.value.trim() : "",
        };
      })
      .filter((entry) => entry.value);
  }

  function getCustomRowEntries() {
    return getCustomRowFieldsets()
      .map((fieldset) => {
        const key = normalizeCustomRowKey(fieldset.getAttribute("data-row-key"));
        const textarea = fieldset.querySelector('textarea[data-custom-text="1"]');
        return {
          id: key,
          text: textarea ? textarea.value : "",
        };
      })
      .filter((entry) => entry.id);
  }

  function clearTextFields() {
    refs.iconUrlEl.value = "";
    setUploadSvgText("");
    setUploadImageDataUrl("");
    if (refs.iconUploadEl) {
      refs.iconUploadEl.value = "";
    }
    getEl("titleText").value = "";

    refs.hostEntriesEl.innerHTML = "";
    refs.hostEntriesEl.append(createHostEntryInput("", "", "🔗"));
    refs.networkEntriesEl.innerHTML = "";
    refs.networkEntriesEl.append(createNetworkEntryInput("", "🖥️"));
    for (const fieldset of getCustomRowFieldsets()) {
      fieldset.remove();
    }
    addCustomRow();

    const configInputs = refs.configLocationsEl.querySelectorAll('input[data-config-location="1"]');
    for (const input of configInputs) {
      input.value = "";
    }

    onClearAll?.();
    prepareIcon();
  }

  function collectRowState(prefix) {
    const emojiEl = getEl(`${prefix}Emoji`);
    return {
      emoji: emojiEl ? emojiEl.value : "",
      align: getSelectedRadioValue(`${prefix}Align`, "center"),
      heading: getSelectedRadioValue(`${prefix}Heading`, ""),
      bold: Boolean(getEl(`${prefix}Bold`)?.checked),
      italic: Boolean(getEl(`${prefix}Italic`)?.checked),
      strong: Boolean(getEl(`${prefix}Strong`)?.checked),
      code: Boolean(getEl(`${prefix}Code`)?.checked),
    };
  }

  function createCustomRowFieldset(rowKey, initialText = "") {
    const key = normalizeCustomRowKey(rowKey);
    if (!key) {
      return null;
    }

    const fieldset = document.createElement("fieldset");
    fieldset.className = "group";
    fieldset.setAttribute("data-row-key", key);
    fieldset.setAttribute("data-row-visible", "1");

    const legend = document.createElement("legend");
    legend.textContent = "Custom Note";
    legend.className = "row-drag-handle";
    legend.setAttribute("title", "Drag to reorder row");

    const controls = document.createElement("div");
    controls.className = "row-grid row-controls no-icon";

    const tools = document.createElement("div");
    tools.className = "style-tools";
    tools.setAttribute("data-prefix", key);
    tools.innerHTML = styleToolbarHtml(key, customRowDefaults);

    const reorder = document.createElement("div");
    reorder.className = "row-reorder";
    reorder.innerHTML = `
    <button type="button" class="row-visibility" data-row-key="${key}" title="Hide row" aria-label="Hide row" aria-pressed="false"><span class="action-icon action-icon-visibility" aria-hidden="true"></span><span class="sr-only">Hide row</span></button>
    <button type="button" class="row-move" data-row-key="${key}" data-direction="up" title="Move up"><span class="move-icon move-icon-up" aria-hidden="true"></span><span class="sr-only">Move up</span></button>
    <button type="button" class="row-move" data-row-key="${key}" data-direction="down" title="Move down"><span class="move-icon move-icon-down" aria-hidden="true"></span><span class="sr-only">Move down</span></button>
  `;

    controls.append(tools, reorder);

    const fields = document.createElement("div");
    fields.className = "row-grid row-fields";

    const textarea = document.createElement("textarea");
    textarea.className = "span-2";
    textarea.rows = 4;
    textarea.placeholder = "Additional notes...";
    textarea.value = initialText;
    textarea.setAttribute("data-custom-text", "1");

    const editor = document.createElement("div");
    editor.className = "custom-note-editor span-2";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "row-remove icon-delete custom-note-delete";
    remove.setAttribute("data-row-key", key);
    remove.title = "Delete row";
    remove.innerHTML = '<span class="action-icon action-icon-delete" aria-hidden="true"></span><span class="sr-only">Delete row</span>';

    editor.append(textarea, remove);
    fields.append(editor);
    fieldset.append(legend, controls, fields);
    bindStyleConflictsForPrefix(key);
    return fieldset;
  }

  function addCustomRow(initialText = "", explicitKey = "") {
    const key = explicitKey ? normalizeCustomRowKey(explicitKey) : getNextCustomRowKey();
    if (!key || getRowFieldset(key)) {
      return null;
    }
    const fieldset = createCustomRowFieldset(key, initialText);
    if (!fieldset) {
      return null;
    }
    form.append(fieldset);
    updateRowVisibilityUi(key);
    return fieldset;
  }

  function syncCustomRows(customRows = []) {
    for (const fieldset of getCustomRowFieldsets()) {
      fieldset.remove();
    }
    const rows = customRows.length > 0 ? customRows : [{ id: "custom1", text: "" }];
    for (const row of rows) {
      addCustomRow(row.text || "", row.id || "");
    }
  }

  function initDefaultRows() {
    if (defaultRowsInitialized) {
      return;
    }
    defaultRowsInitialized = true;

    refs.hostEntriesEl.append(createHostEntryInput("www.proxmox.com", "https://www.proxmox.com/", "🔗"));
    refs.networkEntriesEl.append(createNetworkEntryInput("10.2.0.40:8443", "🖥️"));
    refs.configLocationsEl.append(createConfigLocationInput("/etc/app/config.yml"));
    addCustomRow();
    initializeRowVisibility();
    ensureLegendDragHandles();
  }

  function initRowEditorInteractions({ onCustomTextareaInput } = {}) {
    if (rowInteractionsBound) {
      return;
    }
    rowInteractionsBound = true;

    refs.addHostBtn?.addEventListener("click", () => {
      refs.hostEntriesEl.append(createHostEntryInput("", "", "🔗"));
      renderOutput();
    });

    refs.addNetworkBtn?.addEventListener("click", () => {
      refs.networkEntriesEl.append(createNetworkEntryInput("", "🖥️"));
      renderOutput();
    });

    refs.addConfigBtn?.addEventListener("click", () => {
      refs.configLocationsEl.append(createConfigLocationInput(""));
      renderOutput();
    });

    refs.addCustomRowBtn?.addEventListener("click", () => {
      addCustomRow();
      renderOutput();
    });

    form.addEventListener("input", (event) => {
      const target = event.target;
      if (target instanceof HTMLTextAreaElement && target.matches('textarea[data-custom-text="1"]')) {
        onCustomTextareaInput?.();
      }
      renderOutput();
    });

    form.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }

      const moveBtn = target.closest(".row-move");
      if (moveBtn instanceof HTMLElement) {
        const rowKey = moveBtn.getAttribute("data-row-key");
        const direction = moveBtn.getAttribute("data-direction");
        if (rowKey && (direction === "up" || direction === "down")) {
          moveRow(rowKey, direction);
          renderOutput();
        }
        return;
      }

      const visibilityBtn = target.closest(".row-visibility");
      if (visibilityBtn instanceof HTMLElement) {
        const rowKey = visibilityBtn.getAttribute("data-row-key");
        if (rowKey) {
          toggleRowVisibility(rowKey);
          renderOutput();
        }
        return;
      }

      const removeBtn = target.closest(".row-remove");
      if (removeBtn instanceof HTMLElement) {
        const rowKey = normalizeCustomRowKey(removeBtn.getAttribute("data-row-key"));
        if (rowKey) {
          const fieldset = getRowFieldset(rowKey);
          if (fieldset) {
            fieldset.remove();
            if (getCustomRowFieldsets().length === 0) {
              addCustomRow();
            }
            renderOutput();
          }
        }
        return;
      }

      const localClearBtn = target.closest(".icon-clear");
      if (!localClearBtn) {
        return;
      }

      const inputId = localClearBtn.getAttribute("data-target");
      const input = inputId ? getEl(inputId) : null;
      if (input) {
        input.value = "";
        renderOutput();
      }
    });

    form.addEventListener("dragstart", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const handle = target.closest(".row-drag-hotspot");
      if (!(handle instanceof HTMLSpanElement)) {
        return;
      }
      const fieldset = handle.closest("fieldset[data-row-key]");
      if (!(fieldset instanceof HTMLFieldSetElement)) {
        return;
      }
      dragRowFieldset = fieldset;
      fieldset.classList.add("row-dragging");
      clearDragIndicators();
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", fieldset.getAttribute("data-row-key") || "row");
      }
    });

    form.addEventListener("dragover", (event) => {
      if (!(dragRowFieldset instanceof HTMLFieldSetElement)) {
        return;
      }
      event.preventDefault();
      if (event.dataTransfer) {
        event.dataTransfer.dropEffect = "move";
      }

      const target = event.target;
      const preferredFieldset = target instanceof HTMLElement ? target.closest("fieldset[data-row-key]") : null;
      const { fieldset: nextFieldset, position: nextPosition } = resolveDropTarget(event.clientY, preferredFieldset);
      if (!(nextFieldset instanceof HTMLFieldSetElement) || !nextPosition || isNoopDropPosition(nextFieldset, nextPosition)) {
        clearDragIndicators();
        return;
      }
      if (dragOverFieldset !== nextFieldset || dragOverPosition !== nextPosition) {
        clearDragIndicators();
        dragOverFieldset = nextFieldset;
        dragOverPosition = nextPosition;
        nextFieldset.classList.add(nextPosition === "after" ? "row-drop-after" : "row-drop-before");
      }
    });

    form.addEventListener("drop", (event) => {
      if (!(dragRowFieldset instanceof HTMLFieldSetElement)) {
        return;
      }
      event.preventDefault();
      let targetFieldset = dragOverFieldset;
      let targetPosition = dragOverPosition;
      if (!(targetFieldset instanceof HTMLFieldSetElement) || !targetPosition) {
        const target = event.target;
        const preferredFieldset = target instanceof HTMLElement ? target.closest("fieldset[data-row-key]") : null;
        const resolved = resolveDropTarget(event.clientY, preferredFieldset);
        targetFieldset = resolved.fieldset;
        targetPosition = resolved.position;
      }
      if (
        targetFieldset instanceof HTMLFieldSetElement &&
        targetPosition &&
        !isNoopDropPosition(targetFieldset, targetPosition)
      ) {
        if (targetPosition === "after") {
          form.insertBefore(dragRowFieldset, targetFieldset.nextElementSibling);
        } else {
          form.insertBefore(dragRowFieldset, targetFieldset);
        }
      }
      clearDragIndicators();
      dragRowFieldset.classList.remove("row-dragging");
      dragRowFieldset = null;
      renderOutput();
    });

    form.addEventListener("dragend", () => {
      if (!(dragRowFieldset instanceof HTMLFieldSetElement)) {
        return;
      }
      clearDragIndicators();
      dragRowFieldset.classList.remove("row-dragging");
      dragRowFieldset = null;
      renderOutput();
    });

    refs.clearBtn?.addEventListener("click", () => {
      clearTextFields();
    });

    ensureLegendDragHandles();
  }

  return {
    normalizeCustomRowKey,
    isCustomRowKey,
    isValidRowKey,
    normalizeRowKey,
    getSelectedRadioValue,
    setSelectedRadioValue,
    mountStyleToolbars,
    bindStyleConflicts,
    getOrderedRowKeys,
    reorderFieldsets,
    isRowVisible,
    setRowVisibility,
    createHostEntryInput,
    createNetworkEntryInput,
    createConfigLocationInput,
    getConfigLocationEntries,
    getHostEntries,
    getNetworkEntries,
    getCustomRowEntries,
    collectRowState,
    syncCustomRows,
    initDefaultRows,
    initRowEditorInteractions,
  };
}
