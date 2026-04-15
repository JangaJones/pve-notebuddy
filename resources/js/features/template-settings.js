import { createTemplateSettingsSchema } from "./template-settings-schema.js";

export function createTemplateSettingsFeature({
  appVersion,
  maxUploadSvgBytes,
  maxImportFileBytes,
  refs,
  form,
  getTheme,
  getUploadSvgText,
  setUploadSvgText,
  getUploadImageDataUrl,
  setUploadImageDataUrl,
  setBlockImportedRemoteCustomImages,
  assertTextSizeWithinLimit,
  isValidRowKey,
  isCustomRowKey,
  normalizeCustomRowKey,
  normalizeRowKey,
  getOrderedRowKeys,
  isRowVisible,
  collectRowState,
  getSelectedRadioValue,
  getIconMode,
  isWsrvResizeEnabled,
  getIconColorVariant,
  getIconGalleryItems,
  setIconGalleryItems,
  getIconGalleryColumns,
  setIconGalleryColumns,
  getIconGallerySpacing,
  setIconGallerySpacing,
  getHostEntries,
  getNetworkEntries,
  getConfigLocationEntries,
  getCustomRowEntries,
  setSelectedRadioValue,
  setTheme,
  setIconMode,
  isAllowedIconImageUrl,
  syncCustomRows,
  reorderFieldsets,
  setRowVisibility,
  createHostEntryInput,
  createNetworkEntryInput,
  createConfigLocationInput,
  prepareIcon,
  setIconStatus,
  getEl,
}) {
  const { validateSettingsSchema } = createTemplateSettingsSchema({
    assertTextSizeWithinLimit,
    maxUploadSvgBytes,
    maxImportFileBytes,
    isValidRowKey,
    isCustomRowKey,
    normalizeCustomRowKey,
  });

  function collectSettings() {
    const rows = {};
    for (const key of getOrderedRowKeys()) {
      if (key === "icon") {
        continue;
      }
      rows[key] = collectRowState(key);
    }

    const rowOrder = {};
    for (const key of getOrderedRowKeys()) {
      rowOrder[key] = isRowVisible(key) ? "1" : "0";
    }

    return {
      version: appVersion,
      rowOrder,
      theme: getTheme(),
      icon: {
        mode: getIconMode(),
        align: getSelectedRadioValue("iconAlign", "center"),
        url: refs.iconUrlEl.value,
        embedSvg: refs.iconEmbedSvgEl.checked,
        resizeWithWsrv: isWsrvResizeEnabled(),
        scale: refs.iconScaleEl.value,
        colorVariant: getIconColorVariant(),
        uploadSvgText: getUploadSvgText(),
        uploadImageDataUrl: getUploadImageDataUrl(),
        galleryItems: getIconMode() === "gallery" ? getIconGalleryItems() : [],
        galleryColumns: getIconGalleryColumns(),
        gallerySpacing: getIconGallerySpacing(),
      },
      fields: {
        titleText: getEl("titleText").value,
        hostEntries: getHostEntries(),
        networkEntries: getNetworkEntries(),
        configLocations: getConfigLocationEntries(),
        customRows: getCustomRowEntries(),
      },
      rows,
    };
  }

  function applyRowState(prefix, rowState = {}) {
    const emojiEl = getEl(`${prefix}Emoji`);
    if (emojiEl && typeof rowState.emoji === "string") {
      emojiEl.value = rowState.emoji;
    }

    if (typeof rowState.align === "string") {
      setSelectedRadioValue(`${prefix}Align`, rowState.align);
    }

    const headingValue = typeof rowState.heading === "string" ? rowState.heading : "";
    const headingToggles = form.querySelectorAll(`input[name="${prefix}Heading"]`);
    for (const toggle of headingToggles) {
      toggle.checked = headingValue ? toggle.value === headingValue : false;
    }

    const bold = getEl(`${prefix}Bold`);
    const italic = getEl(`${prefix}Italic`);
    const strong = getEl(`${prefix}Strong`);
    const code = getEl(`${prefix}Code`);

    if (bold) bold.checked = Boolean(rowState.bold);
    if (italic) italic.checked = Boolean(rowState.italic);
    if (strong) strong.checked = Boolean(rowState.strong);
    if (code) code.checked = Boolean(rowState.code);
  }

  // Non-destructive apply: omitted properties are intentionally left untouched.
  async function applySettings(settings, options = {}) {
    const source = options && typeof options === "object" ? options.source : "";
    validateSettingsSchema(settings, source || "settings");
    let blockedImportedInvalidIcon = false;

    const importedCustomRows = [];
    if (settings.fields && typeof settings.fields === "object") {
      if (Array.isArray(settings.fields.customRows)) {
        for (const row of settings.fields.customRows) {
          if (!row || typeof row !== "object") {
            continue;
          }
          const id = normalizeCustomRowKey(row.id || "");
          if (!id) {
            continue;
          }
          importedCustomRows.push({ id, text: String(row.text || "") });
        }
      } else if (typeof settings.fields.customText === "string") {
        importedCustomRows.push({ id: "custom1", text: settings.fields.customText });
      }
    }

    if (settings.rows && typeof settings.rows === "object") {
      for (const key of Object.keys(settings.rows)) {
        const normalized = normalizeCustomRowKey(key);
        if (normalized && !importedCustomRows.some((row) => row.id === normalized)) {
          importedCustomRows.push({ id: normalized, text: "" });
        }
      }
    }

    if (settings.rowOrder) {
      const keys = Array.isArray(settings.rowOrder) ? settings.rowOrder : Object.keys(settings.rowOrder);
      for (const key of keys) {
        const normalized = normalizeCustomRowKey(key);
        if (normalized && !importedCustomRows.some((row) => row.id === normalized)) {
          importedCustomRows.push({ id: normalized, text: "" });
        }
      }
    }
    setBlockImportedRemoteCustomImages(
      source === "import" && importedCustomRows.some((row) => /<img\b/i.test(String(row.text || "")))
    );
    syncCustomRows(importedCustomRows);

    if (Array.isArray(settings.rowOrder)) {
      const requestedOrder = settings.rowOrder.map((k) => normalizeRowKey(k)).filter(Boolean);
      if (requestedOrder.length > 0) {
        reorderFieldsets(requestedOrder);
      }
    } else if (settings.rowOrder && typeof settings.rowOrder === "object") {
      const entries = Object.entries(settings.rowOrder)
        .map(([key, value]) => [normalizeRowKey(key), value])
        .filter(([key]) => Boolean(key));
      if (entries.length > 0) {
        reorderFieldsets(entries.map(([key]) => key));
        for (const [key, rawVisible] of entries) {
          const visible = !(rawVisible === "0" || rawVisible === 0 || rawVisible === false);
          setRowVisibility(key, visible);
        }
      }
    }

    if (settings.theme === "light" || settings.theme === "dark") {
      setTheme(settings.theme);
    }

    if (settings.icon && typeof settings.icon === "object") {
      if (typeof settings.icon.align === "string") {
        setSelectedRadioValue("iconAlign", settings.icon.align);
      }
      if (typeof settings.icon.mode === "string") {
        if (settings.icon.mode === "none") {
          // Legacy compatibility: the NONE mode was removed from the UI.
          // Map it to hidden icon row while keeping the current mode radios valid.
          setIconMode("external");
          setRowVisibility("icon", false);
        } else {
          setIconMode(settings.icon.mode);
          if (settings.rowOrder === undefined) {
            setRowVisibility("icon", true);
          }
        }
      }
      if (typeof settings.icon.url === "string") {
        refs.iconUrlEl.value = settings.icon.url;
        if (source === "import" && settings.icon.url.trim() && !isAllowedIconImageUrl(settings.icon.url)) {
          setIconMode("external");
          setRowVisibility("icon", false);
          blockedImportedInvalidIcon = true;
        }
      }
      if (typeof settings.icon.embedSvg === "boolean") {
        refs.iconEmbedSvgEl.checked = settings.icon.embedSvg;
      }
      if (typeof settings.icon.resizeWithWsrv === "boolean" && refs.iconResizeWsrvEl) {
        refs.iconResizeWsrvEl.checked = settings.icon.resizeWithWsrv;
      }
      if (typeof settings.icon.scale === "string" || typeof settings.icon.scale === "number") {
        refs.iconScaleEl.value = String(settings.icon.scale);
      }
      if (typeof settings.icon.colorVariant === "string") {
        setSelectedRadioValue("iconColorVariant", settings.icon.colorVariant);
      }
      if (typeof settings.icon.uploadSvgText === "string") {
        setUploadSvgText(settings.icon.uploadSvgText);
      }
      if (typeof settings.icon.uploadImageDataUrl === "string") {
        setUploadImageDataUrl(settings.icon.uploadImageDataUrl);
      }
      if (Array.isArray(settings.icon.galleryItems)) {
        setIconGalleryItems(settings.icon.galleryItems.map((item) => String(item || "")));
      }
      if (settings.icon.galleryColumns !== undefined) {
        setIconGalleryColumns(settings.icon.galleryColumns);
      }
      if (settings.icon.gallerySpacing !== undefined) {
        setIconGallerySpacing(settings.icon.gallerySpacing);
      }
    }

    if (settings.fields && typeof settings.fields === "object") {
      if (typeof settings.fields.titleText === "string") getEl("titleText").value = settings.fields.titleText;

      if (Array.isArray(settings.fields.hostEntries)) {
        refs.hostEntriesEl.innerHTML = "";
        const values = settings.fields.hostEntries.length > 0 ? settings.fields.hostEntries : [{ icon: "🔗", label: "", url: "" }];
        for (const value of values) {
          if (value && typeof value === "object") {
            refs.hostEntriesEl.append(createHostEntryInput(String(value.label || ""), String(value.url || ""), String(value.icon || "🔗")));
          }
        }
      } else if (typeof settings.fields.fqdnLabel === "string" || typeof settings.fields.fqdnUrl === "string") {
        refs.hostEntriesEl.innerHTML = "";
        refs.hostEntriesEl.append(createHostEntryInput(String(settings.fields.fqdnLabel || ""), String(settings.fields.fqdnUrl || ""), "🔗"));
      }

      if (Array.isArray(settings.fields.networkEntries)) {
        refs.networkEntriesEl.innerHTML = "";
        const values = settings.fields.networkEntries.length > 0 ? settings.fields.networkEntries : [{ icon: "🖥️", value: "" }];
        for (const value of values) {
          if (value && typeof value === "object") {
            refs.networkEntriesEl.append(createNetworkEntryInput(String(value.value || ""), String(value.icon || "🖥️")));
          }
        }
      } else if (typeof settings.fields.networkText === "string") {
        refs.networkEntriesEl.innerHTML = "";
        refs.networkEntriesEl.append(createNetworkEntryInput(String(settings.fields.networkText || ""), "🖥️"));
      }

      if (Array.isArray(settings.fields.configLocations)) {
        refs.configLocationsEl.innerHTML = "";
        const values = settings.fields.configLocations.length > 0 ? settings.fields.configLocations : [{ icon: "📁", value: "" }];
        for (const value of values) {
          if (value && typeof value === "object") {
            refs.configLocationsEl.append(createConfigLocationInput(String(value.value || ""), String(value.icon || "📁")));
          } else {
            refs.configLocationsEl.append(createConfigLocationInput(String(value), "📁"));
          }
        }
      }
    }

    if (settings.rows && typeof settings.rows === "object") {
      for (const [key, rowState] of Object.entries(settings.rows)) {
        const normalized = normalizeRowKey(key);
        if (!normalized || normalized === "icon" || !rowState || typeof rowState !== "object") {
          continue;
        }
        applyRowState(normalized, rowState);
      }
    }

    await prepareIcon();
    if (blockedImportedInvalidIcon) {
      setIconStatus("Imported icon URL blocked. Allowed image types: .svg .gif .jpeg .jpg .png .tif .webp", true);
    }
  }

  async function fetchAndApplySettings(path, source, errorMessage) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const parsed = await res.json();
      await applySettings(parsed, { source });
      return true;
    } catch {
      console.error(errorMessage);
      return false;
    }
  }

  function toDesignRows(rows) {
    if (!rows || typeof rows !== "object") {
      return undefined;
    }
    const nextRows = {};
    for (const [rowKey, rowState] of Object.entries(rows)) {
      if (!rowState || typeof rowState !== "object") {
        continue;
      }
      const nextRow = {};
      if (typeof rowState.align === "string") nextRow.align = rowState.align;
      if (typeof rowState.heading === "string") nextRow.heading = rowState.heading;
      if (typeof rowState.bold === "boolean") nextRow.bold = rowState.bold;
      if (typeof rowState.italic === "boolean") nextRow.italic = rowState.italic;
      if (typeof rowState.strong === "boolean") nextRow.strong = rowState.strong;
      if (typeof rowState.code === "boolean") nextRow.code = rowState.code;
      if (Object.keys(nextRow).length > 0) {
        nextRows[rowKey] = nextRow;
      }
    }
    return Object.keys(nextRows).length > 0 ? nextRows : undefined;
  }

  function toDesignIcon(icon) {
    if (!icon || typeof icon !== "object") {
      return undefined;
    }
    const nextIcon = {};
    if (typeof icon.mode === "string") nextIcon.mode = icon.mode;
    if (typeof icon.align === "string") nextIcon.align = icon.align;
    if (typeof icon.embedSvg === "boolean") nextIcon.embedSvg = icon.embedSvg;
    if (typeof icon.resizeWithWsrv === "boolean") nextIcon.resizeWithWsrv = icon.resizeWithWsrv;
    if (typeof icon.scale === "string" || typeof icon.scale === "number") nextIcon.scale = icon.scale;
    if (typeof icon.colorVariant === "string") nextIcon.colorVariant = icon.colorVariant;
    if (icon.galleryColumns !== undefined) nextIcon.galleryColumns = icon.galleryColumns;
    if (icon.gallerySpacing !== undefined) nextIcon.gallerySpacing = icon.gallerySpacing;
    return Object.keys(nextIcon).length > 0 ? nextIcon : undefined;
  }

  function toDesignSettings(settings) {
    const source = settings && typeof settings === "object" ? settings : {};
    const next = {};
    if (source.version !== undefined) {
      next.version = source.version;
    }
    if (source.rowOrder !== undefined) {
      next.rowOrder = source.rowOrder;
    }
    if (source.theme !== undefined) {
      next.theme = source.theme;
    }
    const icon = toDesignIcon(source.icon);
    if (icon) {
      next.icon = icon;
    }
    const rows = toDesignRows(source.rows);
    if (rows) {
      next.rows = rows;
    }
    return next;
  }

  function collectDesignSettings() {
    return toDesignSettings(collectSettings());
  }

  async function applyDesignSettings(settings, options = {}) {
    const source = options && typeof options === "object" ? options.source : "design";
    const designSettings = toDesignSettings(settings);
    await applySettings(designSettings, { source });
  }

  async function fetchAndApplyDesign(path, source, errorMessage) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const parsed = await res.json();
      await applyDesignSettings(parsed, { source });
      return true;
    } catch {
      console.error(errorMessage);
      return false;
    }
  }

  return {
    validateSettingsSchema,
    collectSettings,
    collectDesignSettings,
    applySettings,
    applyDesignSettings,
    fetchAndApplySettings,
    fetchAndApplyDesign,
  };
}
