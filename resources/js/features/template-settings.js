import { createTemplateSettingsSchema } from "./template-settings-schema.js";
import { routeLegacyTemplateImport } from "./legacy-import.js";
import {
  fromTemplateDocument,
  mergeDesignDocumentIntoSnapshot,
  toRuntimeSettingsFromTemplateDocument,
  toTemplateDocumentFromSettings,
} from "./template-document-adapter.js";
import { isTemplateDocument, TEMPLATE_DOCUMENT_TYPES } from "./template-document-schema.js";

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
  getIconLinkUrl,
  setIconLinkUrl,
  isWsrvResizeEnabled,
  getIconColorVariant,
  getIconGalleryItems,
  getIconGalleryLinkUrls,
  setIconGalleryLinkUrls,
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
    const iconMode = getIconMode();
    const singleIconLinkUrl = typeof getIconLinkUrl === "function" ? String(getIconLinkUrl() || "").trim() : "";
    const galleryIconLinkUrls =
      iconMode === "gallery" && typeof getIconGalleryLinkUrls === "function"
        ? getIconGalleryLinkUrls().map((item) => String(item || "").trim())
        : [];

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
        mode: iconMode,
        align: getSelectedRadioValue("iconAlign", "center"),
        url: refs.iconUrlEl.value,
        embedSvg: refs.iconEmbedSvgEl.checked,
        resizeWithWsrv: isWsrvResizeEnabled(),
        scale: refs.iconScaleEl.value,
        colorVariant: getIconColorVariant(),
        uploadSvgText: getUploadSvgText(),
        uploadImageDataUrl: getUploadImageDataUrl(),
        galleryItems: iconMode === "gallery" ? getIconGalleryItems() : [],
        galleryColumns: getIconGalleryColumns(),
        gallerySpacing: getIconGallerySpacing(),
        linkUrls: iconMode === "gallery" ? galleryIconLinkUrls : singleIconLinkUrl ? [singleIconLinkUrl] : [],
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

  function shouldRespectPreferredSvgModeForSource(source) {
    const normalized = String(source || "").trim().toLowerCase();
    return normalized === "template-search" || normalized === "init" || normalized === "design";
  }

  // Non-destructive apply: omitted properties are intentionally left untouched.
  async function applySettings(settings, options = {}) {
    const source = options && typeof options === "object" ? options.source : "";
    const preserveDesignNotes =
      options && typeof options === "object" ? options.preserveDesignNotes === true : false;
    const preserveVisibilityOnIconModeChange =
      options && typeof options === "object" ? options.preserveVisibilityOnIconModeChange === true : false;
    const preserveDesignRowPresentation = preserveDesignNotes && settings && settings.rowOrder === undefined;
    const legacyRouted = routeLegacyTemplateImport(settings, { source: source || "settings" });
    settings = legacyRouted.settings;
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
          importedCustomRows.push({
            id,
            text: String(row.text || ""),
            kind: String(row.kind || "").trim().toLowerCase() === "design-note" ? "design-note" : "custom-note",
          });
        }
      } else if (typeof settings.fields.customText === "string") {
        importedCustomRows.push({ id: "custom1", text: settings.fields.customText, kind: "custom-note" });
      }
    }

    if (settings.rows && typeof settings.rows === "object") {
      for (const key of Object.keys(settings.rows)) {
        const normalized = normalizeCustomRowKey(key);
        if (normalized && !importedCustomRows.some((row) => row.id === normalized)) {
          importedCustomRows.push({ id: normalized, text: "", kind: "custom-note" });
        }
      }
    }

    if (settings.rowOrder) {
      const keys = Array.isArray(settings.rowOrder) ? settings.rowOrder : Object.keys(settings.rowOrder);
      for (const key of keys) {
        const normalized = normalizeCustomRowKey(key);
        if (normalized && !importedCustomRows.some((row) => row.id === normalized)) {
          importedCustomRows.push({ id: normalized, text: "", kind: "custom-note" });
        }
      }
    }

    const preservedDesignRowStateById = new Map();
    const preservedRowOrder = preserveDesignRowPresentation ? getOrderedRowKeys().slice() : [];
    if (preserveDesignRowPresentation) {
      const currentCustomRows = getCustomRowEntries();
      const designNoteIds = new Set(
        currentCustomRows
          .filter((row) => String(row.kind || "").trim().toLowerCase() === "design-note")
          .map((row) => row.id)
      );
      for (const rowId of designNoteIds) {
        preservedDesignRowStateById.set(rowId, {
          style: collectRowState(rowId),
          visible: isRowVisible(rowId),
        });
      }
    }

    if (preserveDesignNotes) {
      const existingRows = getCustomRowEntries();
      const importedById = new Map(importedCustomRows.map((row) => [row.id, row]));
      const mergedRows = [];
      const mergedIds = new Set();
      const usedImportedIds = new Set();

      for (const row of existingRows) {
        const kind = String(row.kind || "").trim().toLowerCase() === "design-note" ? "design-note" : "custom-note";
        if (kind === "design-note") {
          if (!mergedIds.has(row.id)) {
            mergedRows.push({
              id: row.id,
              text: String(row.text || ""),
              kind: "design-note",
            });
            mergedIds.add(row.id);
          }
          continue;
        }

        if (importedById.has(row.id) && !mergedIds.has(row.id)) {
          mergedRows.push(importedById.get(row.id));
          mergedIds.add(row.id);
          usedImportedIds.add(row.id);
        }
      }

      for (const row of importedCustomRows) {
        if (usedImportedIds.has(row.id) || mergedIds.has(row.id)) {
          continue;
        }
        mergedRows.push(row);
        mergedIds.add(row.id);
      }

      importedCustomRows.length = 0;
      importedCustomRows.push(...mergedRows);
    }

    setBlockImportedRemoteCustomImages(
      source === "import" && importedCustomRows.some((row) => /<img\b/i.test(String(row.text || "")))
    );
    syncCustomRows(importedCustomRows);

    if (preserveDesignRowPresentation) {
      const activeKeys = new Set(getOrderedRowKeys());
      const reorderKeys = preservedRowOrder.filter((key) => activeKeys.has(key));
      if (reorderKeys.length > 0) {
        reorderFieldsets(reorderKeys);
      }
      for (const [rowId, preserved] of preservedDesignRowStateById.entries()) {
        if (!activeKeys.has(rowId)) {
          continue;
        }
        applyRowState(rowId, preserved.style);
        setRowVisibility(rowId, preserved.visible);
      }
    }

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
      const importedIconLinkUrls = Array.isArray(settings.icon.linkUrls)
        ? settings.icon.linkUrls.map((item) => String(item || "").trim())
        : [];
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
          if (settings.rowOrder === undefined && !preserveVisibilityOnIconModeChange) {
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
      if (typeof setIconGalleryLinkUrls === "function") {
        setIconGalleryLinkUrls(importedIconLinkUrls);
      }
      if (settings.icon.galleryColumns !== undefined) {
        setIconGalleryColumns(settings.icon.galleryColumns);
      }
      if (settings.icon.gallerySpacing !== undefined) {
        setIconGallerySpacing(settings.icon.gallerySpacing);
      }
      if (typeof setIconLinkUrl === "function") {
        setIconLinkUrl(importedIconLinkUrls[0] || "");
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

    await prepareIcon({
      respectPreferredSvgMode: shouldRespectPreferredSvgModeForSource(source),
    });
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
      if (isTemplateDocument(parsed)) {
        const { meta } = fromTemplateDocument(parsed, { source: source || "template document" });
        if (meta.type === TEMPLATE_DOCUMENT_TYPES.SNAPSHOT) {
          const runtimeSettings = toRuntimeSettingsFromTemplateDocument(parsed, { mode: "snapshot" });
          await applySettings(runtimeSettings, { source });
        } else if (meta.type === TEMPLATE_DOCUMENT_TYPES.CONTENT_TEMPLATE) {
          const runtimeSettings = toRuntimeSettingsFromTemplateDocument(parsed, { mode: "content" });
          await applySettings(runtimeSettings, {
            source,
            preserveDesignNotes: true,
            preserveVisibilityOnIconModeChange: true,
          });
        } else if (meta.type === TEMPLATE_DOCUMENT_TYPES.DESIGN) {
          const currentSnapshotDocument = toTemplateDocumentFromSettings(collectSettings(), {
            appVersion,
            type: TEMPLATE_DOCUMENT_TYPES.SNAPSHOT,
            name: "Current Snapshot",
          });
          const mergedDocument = mergeDesignDocumentIntoSnapshot(currentSnapshotDocument, parsed, {
            createMissingDesignNotes: true,
            createMissingCustomNotes: false,
          });
          const runtimeSettings = toRuntimeSettingsFromTemplateDocument(mergedDocument, { mode: "snapshot" });
          await applySettings(runtimeSettings, { source });
        } else {
          throw new Error(`Unsupported template document type "${meta.type}".`);
        }
      } else {
        await applySettings(parsed, { source });
      }
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
    if (typeof icon.align === "string") nextIcon.align = icon.align;
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
    if (source.fields && typeof source.fields === "object" && Array.isArray(source.fields.customRows)) {
      const designRows = [];
      for (const row of source.fields.customRows) {
        if (!row || typeof row !== "object") {
          continue;
        }
        const id = normalizeCustomRowKey(row.id || "");
        if (!id) {
          continue;
        }
        const kind = String(row.kind || "").trim().toLowerCase() === "design-note" ? "design-note" : "custom-note";
        if (kind !== "design-note") {
          continue;
        }
        designRows.push({
          id,
          text: typeof row.text === "string" ? row.text : "",
          kind: "design-note",
        });
      }
      if (designRows.length > 0) {
        next.fields = {
          customRows: designRows,
        };
      }
    }
    return next;
  }

  function collectDesignSettings() {
    return toDesignSettings(collectSettings());
  }

  async function applyDesignSettings(settings, options = {}) {
    const source = options && typeof options === "object" ? options.source : "design";
    const designSettings = toDesignSettings(settings);
    const currentSnapshotDocument = toTemplateDocumentFromSettings(collectSettings(), {
      appVersion,
      type: TEMPLATE_DOCUMENT_TYPES.SNAPSHOT,
      name: "Current Snapshot",
    });
    const designDocument = toTemplateDocumentFromSettings(designSettings, {
      appVersion,
      type: TEMPLATE_DOCUMENT_TYPES.DESIGN,
      name: "Current Design",
    });
    const mergedDocument = mergeDesignDocumentIntoSnapshot(currentSnapshotDocument, designDocument, {
      createMissingDesignNotes: true,
      createMissingCustomNotes: false,
    });
    const runtimeSettings = toRuntimeSettingsFromTemplateDocument(mergedDocument, { mode: "snapshot" });
    await applySettings(runtimeSettings, { source });
  }

  async function fetchAndApplyDesign(path, source, errorMessage) {
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const parsed = await res.json();
      if (isTemplateDocument(parsed)) {
        const { meta } = fromTemplateDocument(parsed, { source: source || "design document" });
        if (meta.type !== TEMPLATE_DOCUMENT_TYPES.DESIGN) {
          throw new Error(`Unsupported design document type "${meta.type}".`);
        }
        const runtimeDesignSettings = toRuntimeSettingsFromTemplateDocument(parsed, { mode: "design" });
        await applyDesignSettings(runtimeDesignSettings, { source });
      } else {
        await applyDesignSettings(parsed, { source });
      }
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
