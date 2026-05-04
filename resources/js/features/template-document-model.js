import { isPlainObject } from "../core/utils.js";
import {
  TEMPLATE_DOCUMENT_TYPES,
  assertTemplateDocument,
  createTemplateDocumentEnvelope,
} from "./template-document-schema.js";

const STATIC_ROW_KEYS = Object.freeze(["icon", "title", "fqdn", "network", "config"]);
const CUSTOM_ROW_KEY_RE = /^custom[1-9][0-9]*$/;
const DEFAULT_BLOCK_ORDER = Object.freeze(STATIC_ROW_KEYS.map((rowKey) => `row:${rowKey}`));
const ICON_MODE_VALUES = new Set(["external", "upload", "gallery", "none"]);

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeCustomRowKey(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "custom") {
    return "custom1";
  }
  return CUSTOM_ROW_KEY_RE.test(raw) ? raw : "";
}

function isStaticRowKey(value) {
  return STATIC_ROW_KEYS.includes(String(value || "").trim().toLowerCase());
}

function rowKeyToBlockId(rowKey) {
  const normalized = String(rowKey || "").trim().toLowerCase();
  if (isStaticRowKey(normalized)) {
    return `row:${normalized}`;
  }
  const custom = normalizeCustomRowKey(normalized);
  return custom ? `custom:${custom}` : "";
}

function blockIdToRowKey(blockId) {
  const raw = String(blockId || "").trim().toLowerCase();
  if (raw.startsWith("row:")) {
    const rowKey = raw.slice(4);
    return isStaticRowKey(rowKey) ? rowKey : "";
  }
  if (raw.startsWith("custom:")) {
    return normalizeCustomRowKey(raw.slice(7));
  }
  return "";
}

function pickRowStyle(value) {
  const row = isPlainObject(value) ? value : {};
  const next = {};
  if (typeof row.emoji === "string") next.emoji = row.emoji;
  if (typeof row.align === "string") next.align = row.align;
  if (typeof row.heading === "string") next.heading = row.heading;
  if (typeof row.bold === "boolean") next.bold = row.bold;
  if (typeof row.italic === "boolean") next.italic = row.italic;
  if (typeof row.strong === "boolean") next.strong = row.strong;
  if (typeof row.code === "boolean") next.code = row.code;
  return next;
}

function normalizeRowsObject(rows) {
  const source = isPlainObject(rows) ? rows : {};
  const out = {};
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const rowKey = blockIdToRowKey(rowKeyToBlockId(rawKey));
    if (!rowKey) {
      continue;
    }
    out[rowKey] = pickRowStyle(rawValue);
  }
  return out;
}

function normalizeCustomBlocks(customBlocks, fallbackRows = {}, fallbackFields = {}) {
  const out = [];
  const seen = new Set();
  const rows = normalizeRowsObject(fallbackRows);

  const fieldRows = Array.isArray(fallbackFields.customRows) ? fallbackFields.customRows : [];
  for (const entry of fieldRows) {
    if (!isPlainObject(entry)) {
      continue;
    }
    const id = normalizeCustomRowKey(entry.id);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push({
      id,
      kind: entry.kind === "design-note" ? "design-note" : "custom-note",
      text: typeof entry.text === "string" ? entry.text : "",
      style: pickRowStyle(rows[id]),
    });
  }

  if (Array.isArray(customBlocks)) {
    for (const entry of customBlocks) {
      if (!isPlainObject(entry)) {
        continue;
      }
      const id = normalizeCustomRowKey(entry.id);
      if (!id || seen.has(id)) {
        continue;
      }
      seen.add(id);
      out.push({
        id,
        kind: entry.kind === "design-note" ? "design-note" : "custom-note",
        text: typeof entry.text === "string" ? entry.text : "",
        style: pickRowStyle(entry.style),
      });
    }
  }

  for (const [rowKey, rowState] of Object.entries(rows)) {
    const id = normalizeCustomRowKey(rowKey);
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    out.push({
      id,
      kind: "custom-note",
      text: "",
      style: pickRowStyle(rowState),
    });
  }

  return out;
}

function normalizeBlockOrder(rawBlockOrder, rowOrder, customBlocks, options = {}) {
  const includeDefaults = options.includeDefaults !== false;
  const out = [];
  const seen = new Set();

  function push(blockId) {
    const normalized = String(blockId || "").trim().toLowerCase();
    if (!normalized || seen.has(normalized)) {
      return;
    }
    const rowKey = blockIdToRowKey(normalized);
    if (!rowKey) {
      return;
    }
    seen.add(normalized);
    out.push(normalized);
  }

  if (Array.isArray(rawBlockOrder)) {
    for (const item of rawBlockOrder) {
      push(item);
    }
  }

  if (Array.isArray(rowOrder)) {
    for (const rowKey of rowOrder) {
      push(rowKeyToBlockId(rowKey));
    }
  } else if (isPlainObject(rowOrder)) {
    for (const [rawRowKey, visible] of Object.entries(rowOrder)) {
      const isVisible = !(visible === "0" || visible === 0 || visible === false);
      if (!isVisible) {
        continue;
      }
      push(rowKeyToBlockId(rawRowKey));
    }
  }

  if (includeDefaults) {
    for (const blockId of DEFAULT_BLOCK_ORDER) {
      push(blockId);
    }
    for (const block of customBlocks) {
      push(`custom:${block.id}`);
    }
  }

  return out;
}

function normalizeRowOrderObject(rawRowOrder) {
  const out = {};
  if (Array.isArray(rawRowOrder)) {
    for (const rawKey of rawRowOrder) {
      const rowKey = blockIdToRowKey(rowKeyToBlockId(rawKey));
      if (!rowKey || rowKey in out) {
        continue;
      }
      out[rowKey] = "1";
    }
    return out;
  }
  if (isPlainObject(rawRowOrder)) {
    for (const [rawKey, rawVisible] of Object.entries(rawRowOrder)) {
      const rowKey = blockIdToRowKey(rowKeyToBlockId(rawKey));
      if (!rowKey || rowKey in out) {
        continue;
      }
      out[rowKey] = rawVisible === "0" || rawVisible === 0 || rawVisible === false ? "0" : "1";
    }
  }
  return out;
}

function filterLayoutRowsByCustomBlocks(rowOrder = {}, customBlocks = []) {
  const out = {};
  const customIds = new Set(
    Array.isArray(customBlocks)
      ? customBlocks.map((block) => normalizeCustomRowKey(block && block.id)).filter(Boolean)
      : []
  );
  for (const [rawRowKey, rawVisible] of Object.entries(rowOrder || {})) {
    const rowKey = blockIdToRowKey(rowKeyToBlockId(rawRowKey));
    if (!rowKey) {
      continue;
    }
    if (!isStaticRowKey(rowKey) && !customIds.has(rowKey)) {
      continue;
    }
    out[rowKey] = rawVisible === "0" || rawVisible === 0 || rawVisible === false ? "0" : "1";
  }
  return out;
}

function filterRowsByCustomBlocks(rows = {}, customBlocks = []) {
  const out = {};
  const customIds = new Set(
    Array.isArray(customBlocks)
      ? customBlocks.map((block) => normalizeCustomRowKey(block && block.id)).filter(Boolean)
      : []
  );
  for (const [rawRowKey, rawRowStyle] of Object.entries(rows || {})) {
    const rowKey = blockIdToRowKey(rowKeyToBlockId(rawRowKey));
    if (!rowKey) {
      continue;
    }
    if (!isStaticRowKey(rowKey) && !customIds.has(rowKey)) {
      continue;
    }
    out[rowKey] = pickRowStyle(rawRowStyle);
  }
  return out;
}

function orderCustomRowsByLayout(rowOrder = {}, customRows = []) {
  const indexById = new Map();
  let index = 0;
  for (const rowKey of Object.keys(rowOrder || {})) {
    const id = normalizeCustomRowKey(rowKey);
    if (!id || indexById.has(id)) {
      continue;
    }
    indexById.set(id, index);
    index += 1;
  }
  return [...customRows].sort((left, right) => {
    const leftIndex = indexById.has(left.id) ? indexById.get(left.id) : Number.POSITIVE_INFINITY;
    const rightIndex = indexById.has(right.id) ? indexById.get(right.id) : Number.POSITIVE_INFINITY;
    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }
    return String(left.id || "").localeCompare(String(right.id || ""));
  });
}

function normalizeContent(fields) {
  const source = isPlainObject(fields) ? fields : {};
  const content = {};
  if (typeof source.titleText === "string") content.titleText = source.titleText;
  if (typeof source.iconUrl === "string") content.iconUrl = source.iconUrl;
  if (Array.isArray(source.hostEntries)) content.hostEntries = cloneJson(source.hostEntries);
  if (Array.isArray(source.networkEntries)) content.networkEntries = cloneJson(source.networkEntries);
  if (Array.isArray(source.configLocations)) content.configLocations = cloneJson(source.configLocations);
  return content;
}

function normalizeIcon(icon) {
  return isPlainObject(icon) ? cloneJson(icon) : {};
}

function normalizeIconMode(value, fallback = "external") {
  const raw = String(value || "").trim().toLowerCase();
  return ICON_MODE_VALUES.has(raw) ? raw : fallback;
}

function mergeIconPresentationStyling(snapshotIcon = {}, designIcon = {}) {
  const base = isPlainObject(snapshotIcon) ? cloneJson(snapshotIcon) : {};
  if (!isPlainObject(designIcon)) {
    return base;
  }

  // Design documents control icon presentation only, not icon source mode/data.
  if (typeof designIcon.align === "string") {
    base.align = designIcon.align;
  }
  if (typeof designIcon.scale === "string" || typeof designIcon.scale === "number") {
    base.scale = designIcon.scale;
  }
  if (designIcon.galleryColumns !== undefined) {
    base.galleryColumns = designIcon.galleryColumns;
  }
  if (typeof designIcon.gallerySpacing === "string") {
    base.gallerySpacing = designIcon.gallerySpacing;
  }

  return base;
}

function readIndexedTextMap(source, keyPrefix, options = {}) {
  const preservePositions = options && options.preservePositions === true;
  if (!isPlainObject(source)) {
    return [];
  }
  const pairs = [];
  for (const [rawKey, rawValue] of Object.entries(source)) {
    const match = String(rawKey).match(new RegExp(`^${keyPrefix}(\\d+)$`, "i"));
    if (!match || typeof rawValue !== "string") {
      continue;
    }
    const index = Number.parseInt(match[1] || "0", 10);
    if (!Number.isFinite(index) || index < 1) {
      continue;
    }
    const value = rawValue.trim();
    if (!value) {
      continue;
    }
    pairs.push([index, value]);
  }
  pairs.sort((a, b) => a[0] - b[0]);
  if (preservePositions) {
    const maxIndex = pairs.reduce((max, [index]) => Math.max(max, index), 0);
    const out = Array.from({ length: maxIndex }, () => "");
    for (const [index, value] of pairs) {
      out[index - 1] = value;
    }
    return out;
  }
  return pairs.map((entry) => entry[1]);
}

function toIndexedTextMap(values, keyPrefix, options = {}) {
  const preservePositions = options && options.preservePositions === true;
  const out = {};
  if (preservePositions) {
    for (let index = 0; index < values.length; index += 1) {
      const text = String(values[index] || "").trim();
      if (!text) {
        continue;
      }
      out[`${keyPrefix}${index + 1}`] = text;
    }
    return out;
  }
  let index = 1;
  for (const value of values) {
    const text = String(value || "").trim();
    if (!text) {
      continue;
    }
    out[`${keyPrefix}${index}`] = text;
    index += 1;
  }
  return out;
}

function normalizeIconDataContent(contentSource = {}) {
  const content = isPlainObject(contentSource) ? contentSource : {};
  const icon = isPlainObject(content.icon) ? content.icon : {};
  const urls = readIndexedTextMap(icon.urls, "url", { preservePositions: true });
  if (urls.length === 0 && typeof content.iconUrl === "string" && content.iconUrl.trim()) {
    urls.push(content.iconUrl.trim());
  }
  const linkUrls = readIndexedTextMap(icon.linkUrls, "url", { preservePositions: true });
  const linkTexts = readIndexedTextMap(icon.linkTexts, "text", { preservePositions: true });
  return {
    urls,
    linkUrls,
    linkTexts,
    imageFileBase64: typeof icon.imageFileBase64 === "string" ? icon.imageFileBase64 : "",
    uploadSvgText: typeof icon.uploadSvgText === "string" ? icon.uploadSvgText : "",
    align:
      typeof icon.align === "string"
        ? icon.align
        : typeof content.iconAlign === "string"
          ? content.iconAlign
          : "",
  };
}

function normalizeIconDataFromLegacyIcon(iconSource = {}) {
  const icon = isPlainObject(iconSource) ? iconSource : {};
  const mode = normalizeIconMode(icon.mode, "external");
  const galleryItems = Array.isArray(icon.galleryItems) ? icon.galleryItems.map((item) => String(item || "").trim()).filter(Boolean) : [];
  const singleUrl = typeof icon.url === "string" ? icon.url.trim() : "";
  const urls = mode === "gallery" ? galleryItems : singleUrl ? [singleUrl] : [];
  return {
    mode,
    urls,
    linkUrls: Array.isArray(icon.linkUrls) ? icon.linkUrls.map((item) => String(item || "").trim()) : [],
    linkTexts: Array.isArray(icon.linkTexts) ? icon.linkTexts.map((item) => String(item || "").trim()) : [],
    imageFileBase64: typeof icon.uploadImageDataUrl === "string" ? icon.uploadImageDataUrl : "",
    uploadSvgText: typeof icon.uploadSvgText === "string" ? icon.uploadSvgText : "",
    align: typeof icon.align === "string" ? icon.align : "",
  };
}

function buildIconContent({ contentSource = {}, legacyIconSource = {}, type }) {
  const fromContent = normalizeIconDataContent(contentSource);
  const fromLegacy = normalizeIconDataFromLegacyIcon(legacyIconSource);
  const mode = fromLegacy.mode;
  const urlsRaw = fromContent.urls.length > 0 ? fromContent.urls : fromLegacy.urls;
  const linkUrlsRaw = fromContent.linkUrls.length > 0 ? fromContent.linkUrls : fromLegacy.linkUrls;
  const linkTextsRaw = fromContent.linkTexts.length > 0 ? fromContent.linkTexts : fromLegacy.linkTexts;
  const align = fromContent.align || fromLegacy.align;

  const modeForPersistence = type === TEMPLATE_DOCUMENT_TYPES.SNAPSHOT ? mode : "external";
  const urls =
    modeForPersistence === "upload" ? [] : modeForPersistence === "gallery" ? urlsRaw : urlsRaw.slice(0, 1);
  const linkUrls = modeForPersistence === "gallery" ? linkUrlsRaw : linkUrlsRaw.slice(0, 1);
  const linkTexts = modeForPersistence === "gallery" ? linkTextsRaw : linkTextsRaw.slice(0, 1);

  const iconOut = {};
  const urlMap = toIndexedTextMap(urls, "URL", { preservePositions: true });
  if (Object.keys(urlMap).length > 0) {
    iconOut.urls = urlMap;
  }
  const linkUrlMap = toIndexedTextMap(linkUrls, "URL", { preservePositions: true });
  if (Object.keys(linkUrlMap).length > 0) {
    iconOut.linkUrls = linkUrlMap;
  }
  const linkTextMap = toIndexedTextMap(linkTexts, "TEXT", { preservePositions: true });
  if (Object.keys(linkTextMap).length > 0) {
    iconOut.linkTexts = linkTextMap;
  }
  if (type === TEMPLATE_DOCUMENT_TYPES.SNAPSHOT && mode === "upload") {
    const imageFileBase64 = fromContent.imageFileBase64 || fromLegacy.imageFileBase64;
    const uploadSvgText = fromContent.uploadSvgText || fromLegacy.uploadSvgText;
    if (imageFileBase64) {
      iconOut.imageFileBase64 = imageFileBase64;
    }
    if (uploadSvgText) {
      iconOut.uploadSvgText = uploadSvgText;
    }
  }
  if (align) {
    iconOut.align = align;
  }
  return Object.keys(iconOut).length > 0 ? iconOut : undefined;
}

function buildIconStyling({ stylingSource = {}, legacyIconSource = {}, type }) {
  const source = isPlainObject(stylingSource.icon) ? stylingSource.icon : isPlainObject(legacyIconSource) ? legacyIconSource : {};
  const out = {};
  if (typeof source.align === "string") out.align = source.align;
  if (typeof source.scale === "string" || typeof source.scale === "number") out.scale = source.scale;
  if (source.galleryColumns !== undefined) out.galleryColumns = source.galleryColumns;
  if (source.gallerySpacing !== undefined) out.gallerySpacing = source.gallerySpacing;
  if (typeof source.colorVariant === "string") out.colorVariant = source.colorVariant;

  if (type === TEMPLATE_DOCUMENT_TYPES.SNAPSHOT) {
    out.mode = normalizeIconMode(source.mode, "external");
    if (typeof source.embedSvg === "boolean") out.embedSvg = source.embedSvg;
    if (typeof source.resizeWithWsrv === "boolean") out.resizeWithWsrv = source.resizeWithWsrv;
  }

  return out;
}

function normalizePayload(payload, type = TEMPLATE_DOCUMENT_TYPES.SNAPSHOT) {
  const source = isPlainObject(payload) ? payload : {};
  const hasDocumentShape =
    source.schema === "template-document-payload-v1" ||
    isPlainObject(source.layout) ||
    isPlainObject(source.styling) ||
    isPlainObject(source.content) ||
    Array.isArray(source.customBlocks);
  const fields = isPlainObject(source.fields) ? source.fields : {};
  const contentSource = isPlainObject(source.content) ? source.content : fields;
  const stylingSource = isPlainObject(source.styling) ? source.styling : {};
  const rows = isPlainObject(stylingSource.rows) ? stylingSource.rows : isPlainObject(source.rows) ? source.rows : {};
  const customBlocksAll = normalizeCustomBlocks(source.customBlocks, rows, fields);
  const customBlocks =
    type === TEMPLATE_DOCUMENT_TYPES.DESIGN
      ? customBlocksAll.filter((entry) => entry.kind === "design-note")
      : type === TEMPLATE_DOCUMENT_TYPES.CONTENT_TEMPLATE
        ? []
        : customBlocksAll;
  const rawLayoutOrder = isPlainObject(source.layout) && Array.isArray(source.layout.blockOrder) ? source.layout.blockOrder : [];
  const rawLayoutRowOrder = isPlainObject(source.layout) ? source.layout.rowOrder : undefined;
  const normalizedRowOrderRaw = normalizeRowOrderObject(rawLayoutRowOrder !== undefined ? rawLayoutRowOrder : source.rowOrder);
  const normalizedRowOrder = filterLayoutRowsByCustomBlocks(normalizedRowOrderRaw, customBlocks);
  const hasExplicitLegacyRowOrder =
    Object.keys(normalizedRowOrder).length > 0;
  const blockOrderRaw = normalizeBlockOrder(
    rawLayoutOrder,
    normalizedRowOrder,
    customBlocks,
    {
      includeDefaults:
        !hasDocumentShape &&
        type !== TEMPLATE_DOCUMENT_TYPES.CONTENT_TEMPLATE &&
        !hasExplicitLegacyRowOrder,
    }
  );
  const customBlockIds = new Set(customBlocks.map((block) => block.id));
  const blockOrder = blockOrderRaw.filter((blockId) => {
    const rowKey = blockIdToRowKey(blockId);
    if (!rowKey) {
      return false;
    }
    return isStaticRowKey(rowKey) || customBlockIds.has(rowKey);
  });

  const stylingRows = filterRowsByCustomBlocks(normalizeRowsObject(rows), customBlocks);
  for (const block of customBlocks) {
    if (!stylingRows[block.id]) {
      stylingRows[block.id] = pickRowStyle(block.style);
    }
  }

  const payloadOut = {
    schema: "template-document-payload-v1",
    layout: {
      blockOrder,
    },
    customBlocks,
  };

  if (type !== TEMPLATE_DOCUMENT_TYPES.CONTENT_TEMPLATE) {
    if (Object.keys(normalizedRowOrder).length > 0) {
      payloadOut.layout.rowOrder = normalizedRowOrder;
    }
    payloadOut.styling = {
      theme: (stylingSource.theme || source.theme) === "light" ? "light" : "dark",
      icon: buildIconStyling({ stylingSource, legacyIconSource: source.icon, type }),
      rows: stylingRows,
    };
  }

  if (type !== TEMPLATE_DOCUMENT_TYPES.DESIGN) {
    const content = normalizeContent(contentSource);
    const icon = buildIconContent({
      contentSource,
      // Prefer document styling.icon when present so snapshot mode ("gallery"/"upload")
      // is preserved during document normalization.
      legacyIconSource: isPlainObject(stylingSource.icon) ? stylingSource.icon : source.icon,
      type,
    });
    if (icon) {
      content.icon = icon;
    }
    payloadOut.content = content;
  }

  return payloadOut;
}

function getCustomBlockMap(payload) {
  const map = new Map();
  const blocks = Array.isArray(payload.customBlocks) ? payload.customBlocks : [];
  for (const block of blocks) {
    if (!isPlainObject(block)) {
      continue;
    }
    const id = normalizeCustomRowKey(block.id);
    if (!id || map.has(id)) {
      continue;
    }
    map.set(id, {
      id,
      kind: block.kind === "design-note" ? "design-note" : "custom-note",
      text: typeof block.text === "string" ? block.text : "",
      style: pickRowStyle(block.style),
    });
  }
  return map;
}

export function createTemplateDocumentFromSettings(settings, { appVersion, type, name } = {}) {
  const safeType = Object.values(TEMPLATE_DOCUMENT_TYPES).includes(type)
    ? type
    : TEMPLATE_DOCUMENT_TYPES.SNAPSHOT;
  const payload = normalizePayload(settings, safeType);
  return createTemplateDocumentEnvelope({
    appVersion,
    type: safeType,
    name,
    payload,
  });
}

// Transitional bridge: convert a TemplateDocument payload to current runtime settings shape.
// This is used internally while the UI runtime is still settings-based.
export function extractRuntimeSettingsFromTemplateDocument(document, options = {}) {
  assertTemplateDocument(document, "template document");
  const mode =
    options && typeof options === "object" && typeof options.mode === "string"
      ? options.mode
      : document.meta.type;
  const payload = normalizePayload(document.payload, document.meta.type);
  const rows = isPlainObject(payload.styling?.rows) ? cloneJson(payload.styling.rows) : {};
  const blockOrder = Array.isArray(payload.layout?.blockOrder) ? payload.layout.blockOrder : [];
  const visibleRowKeys = new Set();
  for (const blockId of blockOrder) {
    const rowKey = blockIdToRowKey(blockId);
    if (rowKey) {
      visibleRowKeys.add(rowKey);
    }
  }
  const allCustomRowsRaw = cloneJson(payload.customBlocks || []).map((block) => ({
    id: block.id,
    text: block.text || "",
    kind: block.kind === "design-note" ? "design-note" : "custom-note",
  }));
  const customRowIdSet = new Set(allCustomRowsRaw.map((row) => row.id));
  for (const rowKey of Object.keys(rows)) {
    const customId = normalizeCustomRowKey(rowKey);
    if (!customId) {
      continue;
    }
    if (!customRowIdSet.has(customId)) {
      delete rows[rowKey];
    }
  }
  const layoutRowOrder = filterLayoutRowsByCustomBlocks(normalizeRowOrderObject(payload.layout?.rowOrder), payload.customBlocks);
  const allCustomRows = orderCustomRowsByLayout(layoutRowOrder, allCustomRowsRaw);
  const rowOrder = {};
  const allKnownRowKeys = [...Object.keys(layoutRowOrder), ...STATIC_ROW_KEYS, ...allCustomRows.map((row) => row.id)];
  for (const rowKey of allKnownRowKeys) {
    if (rowKey in rowOrder) {
      continue;
    }
    if (visibleRowKeys.has(rowKey)) {
      rowOrder[rowKey] = "1";
    } else if (rowKey in layoutRowOrder) {
      rowOrder[rowKey] = layoutRowOrder[rowKey];
    } else {
      rowOrder[rowKey] = "0";
    }
  }

  if (mode === TEMPLATE_DOCUMENT_TYPES.CONTENT_TEMPLATE || mode === "content") {
    const contentIcon = normalizeIconDataContent(payload.content);
    const iconUrls = contentIcon.urls;
    const iconLinkUrls = contentIcon.linkUrls;
    const iconLinkTexts = contentIcon.linkTexts;
    return {
      version: document.meta.appVersion,
      icon: {
        mode: "external",
        url: iconUrls[0] || "",
        galleryItems: cloneJson(iconUrls),
        linkUrls: cloneJson(iconLinkUrls),
        linkTexts: cloneJson(iconLinkTexts),
        align: contentIcon.align || "center",
      },
      fields: {
        titleText: payload.content?.titleText || "",
        hostEntries: cloneJson(payload.content?.hostEntries || []),
        networkEntries: cloneJson(payload.content?.networkEntries || []),
        configLocations: cloneJson(payload.content?.configLocations || []),
        customRows: [],
      },
    };
  }

  if (mode === TEMPLATE_DOCUMENT_TYPES.DESIGN || mode === "design") {
    return {
      version: document.meta.appVersion,
      rowOrder,
      theme: payload.styling?.theme || "dark",
      icon: cloneJson(payload.styling?.icon || {}),
      rows,
      fields: {
        customRows: allCustomRows
          .filter((block) => block.kind === "design-note")
          .map((block) => ({ id: block.id, text: block.text, kind: block.kind })),
      },
    };
  }

  return {
    version: document.meta.appVersion,
    rowOrder,
    theme: payload.styling?.theme || "dark",
    icon: (() => {
      const stylingIcon = cloneJson(payload.styling?.icon || {});
      const contentIcon = normalizeIconDataContent(payload.content);
      const legacyStylingIcon = normalizeIconDataFromLegacyIcon(stylingIcon);
      const mode = normalizeIconMode(stylingIcon.mode, "external");
      const iconUrls = contentIcon.urls.length > 0 ? contentIcon.urls : legacyStylingIcon.urls;
      const iconLinkUrls = contentIcon.linkUrls.length > 0 ? contentIcon.linkUrls : legacyStylingIcon.linkUrls;
      const iconLinkTexts = contentIcon.linkTexts.length > 0 ? contentIcon.linkTexts : legacyStylingIcon.linkTexts;
      return {
        ...stylingIcon,
        mode,
        url: iconUrls[0] || "",
        galleryItems: cloneJson(iconUrls),
        linkUrls: cloneJson(iconLinkUrls),
        linkTexts: cloneJson(iconLinkTexts),
        uploadImageDataUrl: contentIcon.imageFileBase64 || legacyStylingIcon.imageFileBase64 || "",
        uploadSvgText: contentIcon.uploadSvgText || legacyStylingIcon.uploadSvgText || "",
        align: contentIcon.align || legacyStylingIcon.align || stylingIcon.align || "center",
      };
    })(),
    fields: {
      titleText: payload.content?.titleText || "",
      hostEntries: cloneJson(payload.content?.hostEntries || []),
      networkEntries: cloneJson(payload.content?.networkEntries || []),
      configLocations: cloneJson(payload.content?.configLocations || []),
      customRows: allCustomRows.map((block) => ({ id: block.id, text: block.text, kind: block.kind })),
    },
    rows,
  };
}

export function mergeDesignIntoSnapshotDocument(snapshotDocument, designDocument, options = {}) {
  assertTemplateDocument(snapshotDocument, "snapshot document");
  assertTemplateDocument(designDocument, "design document");

  const createMissingDesignNotes = options.createMissingDesignNotes !== false;

  const snapshotPayload = normalizePayload(snapshotDocument.payload, TEMPLATE_DOCUMENT_TYPES.SNAPSHOT);
  const designPayload = normalizePayload(designDocument.payload, TEMPLATE_DOCUMENT_TYPES.DESIGN);

  const snapshotCustom = getCustomBlockMap(snapshotPayload);
  const designCustom = getCustomBlockMap(designPayload);
  const snapshotOrder = Array.isArray(snapshotPayload.layout.blockOrder) ? snapshotPayload.layout.blockOrder : [];
  const designOrder = Array.isArray(designPayload.layout.blockOrder) ? designPayload.layout.blockOrder : [];
  const snapshotRowOrder = normalizeRowOrderObject(snapshotPayload.layout?.rowOrder);
  const designRowOrder = normalizeRowOrderObject(designPayload.layout?.rowOrder);

  // Preserve only non-design-note content rows from snapshot.
  // Design-notes are fully replaced by the loaded design.
  const mergedCustom = new Map();
  for (const [id, block] of snapshotCustom.entries()) {
    if (block.kind === "design-note") {
      continue;
    }
    mergedCustom.set(id, cloneJson(block));
  }

  const occupiedCustomIds = new Set(mergedCustom.keys());
  function getNextFreeCustomId() {
    let index = 1;
    while (occupiedCustomIds.has(`custom${index}`)) {
      index += 1;
    }
    return `custom${index}`;
  }

  // Map design-note IDs into the merged snapshot.
  // If a design-note ID collides with an existing custom-note, allocate a new ID
  // so custom-note content text is never overwritten.
  const designIdToMergedId = new Map();
  if (createMissingDesignNotes) {
    for (const [designId, designBlock] of designCustom.entries()) {
      if (designBlock.kind !== "design-note") {
        continue;
      }
      const targetId = occupiedCustomIds.has(designId) ? getNextFreeCustomId() : designId;
      occupiedCustomIds.add(targetId);
      designIdToMergedId.set(designId, targetId);
      mergedCustom.set(targetId, {
        ...cloneJson(designBlock),
        id: targetId,
      });
    }
  }

  function normalizeMergedCustomRowKey(rawRowKey, source = "snapshot") {
    const rowKey = blockIdToRowKey(rowKeyToBlockId(rawRowKey));
    if (!rowKey) {
      return "";
    }
    if (isStaticRowKey(rowKey)) {
      return rowKey;
    }
    const id = normalizeCustomRowKey(rowKey);
    if (!id) {
      return "";
    }
    if (source === "design") {
      if (designIdToMergedId.has(id)) {
        return designIdToMergedId.get(id);
      }
      return mergedCustom.has(id) ? id : "";
    }
    return mergedCustom.has(id) ? id : "";
  }

  const mergedRowOrder = {};
  function setMergedRowOrder(rawRowKey, rawVisible, source = "snapshot") {
    const rowKey = normalizeMergedCustomRowKey(rawRowKey, source);
    if (!rowKey || rowKey in mergedRowOrder) {
      return;
    }
    mergedRowOrder[rowKey] = rawVisible === "0" || rawVisible === 0 || rawVisible === false ? "0" : "1";
  }

  for (const [rowKey, visible] of Object.entries(designRowOrder)) {
    setMergedRowOrder(rowKey, visible, "design");
  }
  for (const [rowKey, visible] of Object.entries(snapshotRowOrder)) {
    setMergedRowOrder(rowKey, visible, "snapshot");
  }

  // Ensure static rows are always represented in rowOrder.
  for (const staticKey of STATIC_ROW_KEYS) {
    if (staticKey in mergedRowOrder) {
      continue;
    }
    if (staticKey in designRowOrder) {
      mergedRowOrder[staticKey] = designRowOrder[staticKey];
    } else if (staticKey in snapshotRowOrder) {
      mergedRowOrder[staticKey] = snapshotRowOrder[staticKey];
    } else {
      mergedRowOrder[staticKey] = "1";
    }
  }

  // Ensure all merged custom rows exist in rowOrder.
  const designVisibleIds = new Set(
    designOrder
      .map((blockId) => blockIdToRowKey(blockId))
      .map((rowKey) => normalizeCustomRowKey(rowKey))
      .filter(Boolean)
      .map((id) => designIdToMergedId.get(id) || id)
  );
  const snapshotVisibleIds = new Set(
    snapshotOrder
      .map((blockId) => blockIdToRowKey(blockId))
      .map((rowKey) => normalizeCustomRowKey(rowKey))
      .filter(Boolean)
  );
  for (const id of mergedCustom.keys()) {
    if (id in mergedRowOrder) {
      continue;
    }
    if (designVisibleIds.has(id)) {
      mergedRowOrder[id] = "1";
    } else if (id in snapshotRowOrder) {
      mergedRowOrder[id] = snapshotRowOrder[id];
    } else if (snapshotVisibleIds.has(id)) {
      mergedRowOrder[id] = "1";
    } else {
      mergedRowOrder[id] = "0";
    }
  }

  const mergedOrder = [];
  const used = new Set();
  function includeBlock(blockId) {
    const normalized = String(blockId || "").trim().toLowerCase();
    if (!normalized || used.has(normalized)) {
      return;
    }
    const rowKey = blockIdToRowKey(normalized);
    if (!rowKey) {
      return;
    }
    used.add(normalized);
    mergedOrder.push(normalized);
  }
  for (const [rowKey, visible] of Object.entries(mergedRowOrder)) {
    const isVisible = !(visible === "0" || visible === 0 || visible === false);
    if (!isVisible) {
      continue;
    }
    includeBlock(rowKeyToBlockId(rowKey));
  }
  for (const blockId of DEFAULT_BLOCK_ORDER) {
    if (!used.has(blockId) && mergedRowOrder[blockIdToRowKey(blockId)] !== "0") {
      includeBlock(blockId);
    }
  }

  const mergedRows = cloneJson(snapshotPayload.styling.rows || {});
  const designRows = isPlainObject(designPayload.styling?.rows) ? designPayload.styling.rows : {};
  for (const [rawRowKey, rawRowStyle] of Object.entries(designRows)) {
    const sourceRowKey = blockIdToRowKey(rowKeyToBlockId(rawRowKey));
    if (!sourceRowKey) {
      continue;
    }
    const customId = normalizeCustomRowKey(sourceRowKey);
    const rowKey = customId ? designIdToMergedId.get(customId) || sourceRowKey : sourceRowKey;
    if (!rowKey || !isPlainObject(rawRowStyle)) {
      continue;
    }
    mergedRows[rowKey] = pickRowStyle(rawRowStyle);
  }
  for (const block of mergedCustom.values()) {
    if (!isPlainObject(mergedRows[block.id])) {
      mergedRows[block.id] = pickRowStyle(block.style);
    }
  }
  for (const rowKey of Object.keys(mergedRows)) {
    const customId = normalizeCustomRowKey(rowKey);
    if (!customId) {
      continue;
    }
    if (!mergedCustom.has(customId)) {
      delete mergedRows[rowKey];
    }
  }

  const mergedPayload = {
    schema: "template-document-payload-v1",
    layout: { blockOrder: mergedOrder },
    content: cloneJson(snapshotPayload.content || {}),
    customBlocks: Array.from(mergedCustom.values()),
    styling: {
      theme: designPayload.styling?.theme || snapshotPayload.styling.theme || "dark",
      icon: mergeIconPresentationStyling(snapshotPayload.styling.icon || {}, designPayload.styling?.icon || {}),
      rows: mergedRows,
    },
  };
  if (Object.keys(mergedRowOrder).length > 0) {
    mergedPayload.layout.rowOrder = mergedRowOrder;
  }

  return createTemplateDocumentEnvelope({
    appVersion: snapshotDocument.meta.appVersion,
    type: TEMPLATE_DOCUMENT_TYPES.SNAPSHOT,
    name: snapshotDocument.meta.name,
    payload: mergedPayload,
  });
}
