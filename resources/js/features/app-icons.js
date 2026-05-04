import {
  assertFileSizeWithinLimit,
  assertTextSizeWithinLimit,
  encodeSvgDataUrl,
  escapeHtml,
  formatBytes,
  isAllowedIconImageUrl,
  isRasterUrl,
  isSvgUrl,
  readDataUrlFile,
  readTextFile,
} from "../core/utils.js";
import { fetchWithPrivacy } from "../services/http-cache.service.js";

function parsePositiveFloat(value) {
  const numeric = Number.parseFloat(String(value || "").replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) && numeric > 0 ? numeric : null;
}

function getSvgDimensions(svgEl) {
  const viewBox = svgEl.getAttribute("viewBox");
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map((item) => Number.parseFloat(item));
    if (parts.length === 4 && Number.isFinite(parts[2]) && Number.isFinite(parts[3]) && parts[2] > 0 && parts[3] > 0) {
      return { width: parts[2], height: parts[3] };
    }
  }

  const width = parsePositiveFloat(svgEl.getAttribute("width"));
  const height = parsePositiveFloat(svgEl.getAttribute("height"));
  if (width && height) {
    return { width, height };
  }

  return { width: 1, height: 1 };
}

function resizeSvg(svgText, targetWidth) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;

  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    throw new Error("Not a valid SVG.");
  }

  const { width, height } = getSvgDimensions(svg);
  const ratio = height / width;
  const normalizedWidth = Number.parseInt(String(targetWidth), 10) || 110;
  const normalizedHeight = Math.max(1, Math.round(normalizedWidth * ratio));

  svg.setAttribute("width", String(normalizedWidth));
  svg.setAttribute("height", String(normalizedHeight));

  return new XMLSerializer().serializeToString(doc);
}

function getMonoTargetColor(variant) {
  return variant === "light" ? "#ffffff" : "#000000";
}

function parseCssColorToRgb(value, svgColorCanvasCtx) {
  if (!svgColorCanvasCtx) {
    return null;
  }

  const input = String(value || "").trim();
  if (!input || input === "none" || /^url\(/i.test(input)) {
    return null;
  }

  const cssColorProbe = new Option().style;
  cssColorProbe.color = "";
  cssColorProbe.color = input;
  if (!cssColorProbe.color) {
    return null;
  }

  svgColorCanvasCtx.fillStyle = "#010203";
  svgColorCanvasCtx.fillStyle = cssColorProbe.color;
  const normalized = String(svgColorCanvasCtx.fillStyle || "").trim().toLowerCase();
  if (!normalized || normalized === "transparent" || normalized === "#010203") {
    return null;
  }

  if (normalized.startsWith("#")) {
    const hex = normalized.slice(1);
    if (hex.length === 3) {
      return {
        r: Number.parseInt(hex[0] + hex[0], 16),
        g: Number.parseInt(hex[1] + hex[1], 16),
        b: Number.parseInt(hex[2] + hex[2], 16),
      };
    }
    if (hex.length >= 6) {
      return {
        r: Number.parseInt(hex.slice(0, 2), 16),
        g: Number.parseInt(hex.slice(2, 4), 16),
        b: Number.parseInt(hex.slice(4, 6), 16),
      };
    }
    return null;
  }

  const rgbaMatch = normalized.match(/^rgba?\(\s*([0-9.]+)\s*,\s*([0-9.]+)\s*,\s*([0-9.]+)(?:\s*,\s*([0-9.]+))?\s*\)$/);
  if (!rgbaMatch) {
    return null;
  }

  if (rgbaMatch[4] && Number.parseFloat(rgbaMatch[4]) === 0) {
    return null;
  }

  return {
    r: Number.parseFloat(rgbaMatch[1]),
    g: Number.parseFloat(rgbaMatch[2]),
    b: Number.parseFloat(rgbaMatch[3]),
  };
}

function mapColorToMonochrome(value, variant, svgColorCanvasCtx) {
  const target = getMonoTargetColor(variant);
  const raw = String(value || "").trim();
  if (!raw) {
    return value;
  }

  if (raw === "none" || /^url\(/i.test(raw)) {
    return raw;
  }
  if (raw.toLowerCase() === "currentcolor") {
    return target;
  }

  const rgb = parseCssColorToRgb(raw, svgColorCanvasCtx);
  if (!rgb) {
    return value;
  }

  return target;
}

function rewriteStyleColors(styleValue, variant, svgColorCanvasCtx) {
  const colorProps = new Set(["fill", "stroke", "stop-color", "flood-color", "lighting-color", "color"]);
  return styleValue
    .split(";")
    .map((declaration) => {
      const idx = declaration.indexOf(":");
      if (idx < 0) {
        return declaration;
      }
      const prop = declaration.slice(0, idx).trim().toLowerCase();
      if (!colorProps.has(prop)) {
        return declaration;
      }
      const rawValue = declaration.slice(idx + 1).trim();
      return `${prop}:${mapColorToMonochrome(rawValue, variant, svgColorCanvasCtx)}`;
    })
    .join(";");
}

function hasStyleProp(styleValue, propName) {
  return styleValue
    .split(";")
    .some((declaration) => {
      const idx = declaration.indexOf(":");
      if (idx < 0) {
        return false;
      }
      return declaration.slice(0, idx).trim().toLowerCase() === propName;
    });
}

function parseOffset01(stopEl, fallback) {
  const raw = String(stopEl.getAttribute("offset") || "").trim();
  if (!raw) {
    return fallback;
  }
  if (raw.endsWith("%")) {
    const n = Number.parseFloat(raw.slice(0, -1));
    if (Number.isFinite(n)) {
      return Math.min(1, Math.max(0, n / 100));
    }
  }
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) {
    return fallback;
  }
  return Math.min(1, Math.max(0, n));
}

function getStopColorValue(stopEl) {
  const attr = stopEl.getAttribute("stop-color");
  if (attr) {
    return attr;
  }
  const style = stopEl.getAttribute("style");
  if (!style) {
    return "";
  }

  for (const declaration of style.split(";")) {
    const idx = declaration.indexOf(":");
    if (idx < 0) {
      continue;
    }
    const prop = declaration.slice(0, idx).trim().toLowerCase();
    if (prop === "stop-color") {
      return declaration.slice(idx + 1).trim();
    }
  }
  return "";
}

function setStopColorValue(stopEl, value) {
  stopEl.setAttribute("stop-color", value);
  const style = stopEl.getAttribute("style");
  if (!style) {
    return;
  }

  const next = style
    .split(";")
    .map((declaration) => {
      const idx = declaration.indexOf(":");
      if (idx < 0) {
        return declaration;
      }
      const prop = declaration.slice(0, idx).trim().toLowerCase();
      if (prop !== "stop-color") {
        return declaration;
      }
      return `stop-color:${value}`;
    })
    .join(";");
  stopEl.setAttribute("style", next);
}

function rewriteGradientStops(gradientEl, effectiveVariant, svgColorCanvasCtx) {
  const stops = Array.from(gradientEl.querySelectorAll("stop"));
  if (stops.length === 0) {
    return;
  }

  const measured = stops.map((stop, index) => {
    const fallbackOffset = stops.length > 1 ? index / (stops.length - 1) : 0;
    const offset = parseOffset01(stop, fallbackOffset);
    const color = parseCssColorToRgb(getStopColorValue(stop), svgColorCanvasCtx);
    const lum = color ? (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255 : null;
    return { stop, offset, lum };
  });

  const knownLums = measured.map((item) => item.lum).filter((lum) => lum !== null);
  const lumMin = knownLums.length > 0 ? Math.min(...knownLums) : 0;
  const lumMax = knownLums.length > 0 ? Math.max(...knownLums) : 1;
  const lumRange = lumMax - lumMin;

  for (const item of measured) {
    const normalized = item.lum === null || lumRange < 0.0001 ? item.offset : (item.lum - lumMin) / lumRange;
    const targetLum =
      effectiveVariant === "light"
        ? 0.72 + normalized * 0.24
        : 0.06 + normalized * 0.24;
    const g = Math.max(0, Math.min(255, Math.round(targetLum * 255)));
    setStopColorValue(item.stop, `rgb(${g}, ${g}, ${g})`);
  }
}

function transformSvgColors(svgText, variant, svgColorCanvasCtx) {
  if (variant === "original") {
    return svgText;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    throw new Error("Not a valid SVG.");
  }

  const gradients = doc.querySelectorAll("linearGradient, radialGradient");
  for (const gradient of gradients) {
    rewriteGradientStops(gradient, variant, svgColorCanvasCtx);
  }

  const colorAttrs = ["fill", "stroke", "flood-color", "lighting-color", "color"];
  const paintTags = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "text", "use"]);
  const target = getMonoTargetColor(variant);
  const all = doc.querySelectorAll("*");
  for (const el of all) {
    const tag = el.tagName.toLowerCase();
    if (tag === "lineargradient" || tag === "radialgradient" || tag === "stop") {
      continue;
    }

    for (const attr of colorAttrs) {
      const value = el.getAttribute(attr);
      if (!value) {
        continue;
      }
      el.setAttribute(attr, mapColorToMonochrome(value, variant, svgColorCanvasCtx));
    }

    const style = el.getAttribute("style");
    if (style) {
      el.setAttribute("style", rewriteStyleColors(style, variant, svgColorCanvasCtx));
    }

    if (!paintTags.has(tag)) {
      continue;
    }

    const fillAttr = (el.getAttribute("fill") || "").trim().toLowerCase();
    const strokeAttr = (el.getAttribute("stroke") || "").trim().toLowerCase();
    const styleNow = (el.getAttribute("style") || "").trim().toLowerCase();
    const hasFillStyle = styleNow ? hasStyleProp(styleNow, "fill") : false;
    const hasStrokeStyle = styleNow ? hasStyleProp(styleNow, "stroke") : false;

    const noExplicitFill = !fillAttr && !hasFillStyle;
    const noExplicitStroke = !strokeAttr && !hasStrokeStyle;
    if (noExplicitFill && noExplicitStroke) {
      el.setAttribute("fill", target);
    }
  }

  return new XMLSerializer().serializeToString(doc);
}

function isSelfhstCdnUrl(url) {
  return /^https:\/\/cdn\.jsdelivr\.net\/gh\/selfhst\/icons@main\//i.test(String(url || "").trim());
}

function parseSelfhstVariantUrls(inputUrl) {
  if (!isSelfhstCdnUrl(inputUrl)) {
    return null;
  }
  let parsed;
  try {
    parsed = new URL(String(inputUrl || "").trim());
  } catch {
    return null;
  }
  const slashIndex = parsed.pathname.lastIndexOf("/");
  if (slashIndex < 0) {
    return null;
  }
  const dir = parsed.pathname.slice(0, slashIndex + 1);
  const file = parsed.pathname.slice(slashIndex + 1);
  const match = file.match(/^(.*?)(?:-(light|dark))?(\.[^.\/]+)$/i);
  if (!match) {
    return null;
  }
  const baseName = match[1];
  const ext = match[3];
  const currentVariant = (match[2] || "orig").toLowerCase();
  const suffix = `${parsed.search}${parsed.hash}`;
  const make = (name) => `${parsed.origin}${dir}${name}${suffix}`;

  return {
    currentVariant,
    orig: make(`${baseName}${ext}`),
    light: make(`${baseName}-light${ext}`),
    dark: make(`${baseName}-dark${ext}`),
  };
}

function getSelfhstVariantUiMeta(key) {
  const normalized = String(key || "").toLowerCase();
  if (normalized === "light") {
    return { title: "Light variant", iconClass: "chip-icon-light-mode" };
  }
  if (normalized === "dark") {
    return { title: "Dark variant", iconClass: "chip-icon-dark-mode" };
  }
  return { title: "Original variant", iconClass: "chip-icon-dataset-linked" };
}

export function createAppIconsFeature({
  refs,
  getUploadSvgText,
  setUploadSvgText,
  getUploadImageDataUrl,
  setUploadImageDataUrl,
  getIconMode,
  isWsrvResizeEnabled,
  getIconColorVariant,
  getPreferredSvgMode,
  getConfiguredWeservDomain,
  getWeservBaseUrl,
  getIconResolvedSrc,
  setIconResolvedSrc,
  getRenderedOutputLength,
  maxFetchedSvgBytes,
  maxUploadSvgBytes,
  maxUploadRasterBytes,
  maxOutputLength,
  renderOutput,
}) {
  const MAX_GALLERY_ITEMS = 20;
  let prepareToken = 0;
  let selfhstVariantUiToken = 0;
  let selfhstVariantRefreshTimer = null;
  let galleryVariantUiToken = 0;
  let galleryVariantRefreshTimer = null;
  let iconInteractionsBound = false;
  let galleryDragRow = null;
  let galleryDragMoved = false;
  let previousIconMode = "";
  const externalModePreference = {
    resizeWithWsrv: Boolean(refs.iconResizeWsrvEl?.checked),
    embedSvg: Boolean(refs.iconEmbedSvgEl?.checked),
  };
  let oversizeEmbedLockedUrl = "";
  const externalSvgCache = new Map();
  const selfhstVariantExistsCache = new Map();
  const svgColorCanvasCtx = document.createElement("canvas").getContext("2d");

  function setIconStatus(text, isError = false) {
    if (!refs.iconStatusEl) {
      return;
    }
    refs.iconStatusEl.textContent = text;
    refs.iconStatusEl.classList.toggle("error", isError);
  }

  function normalizeGalleryDimension(value, fallback) {
    const numeric = Number.parseInt(String(value || ""), 10);
    if (!Number.isFinite(numeric)) {
      return fallback;
    }
    return Math.min(8, Math.max(1, numeric));
  }

  function normalizeGalleryItems(items) {
    if (!Array.isArray(items)) {
      return [];
    }
    const normalized = [];
    for (const item of items) {
      const value = String(item || "").trim();
      if (!value) {
        continue;
      }
      normalized.push(value);
      if (normalized.length >= MAX_GALLERY_ITEMS) {
        break;
      }
    }
    return normalized;
  }

  function createGalleryRow(initialValue = "", initialLinkUrl = "") {
    const row = document.createElement("div");
    row.className = "icon-gallery-row";

    const upBtn = document.createElement("button");
    upBtn.type = "button";
    upBtn.className = "icon-gallery-btn icon-gallery-up";
    upBtn.title = "Move up";
    upBtn.innerHTML = '<span class="move-icon move-icon-up" aria-hidden="true"></span><span class="sr-only">Move up</span>';

    const downBtn = document.createElement("button");
    downBtn.type = "button";
    downBtn.className = "icon-gallery-btn icon-gallery-down";
    downBtn.title = "Move down";
    downBtn.innerHTML = '<span class="move-icon move-icon-down" aria-hidden="true"></span><span class="sr-only">Move down</span>';

    const grabBtn = document.createElement("button");
    grabBtn.type = "button";
    grabBtn.className = "icon-gallery-btn icon-gallery-grab";
    grabBtn.title = "Drag handle";
    grabBtn.setAttribute("draggable", "true");
    grabBtn.innerHTML = '<span class="move-icon move-icon-drag" aria-hidden="true"></span><span class="sr-only">Drag handle</span>';

    const inputsWrap = document.createElement("div");
    inputsWrap.className = "icon-gallery-inputs";

    const input = document.createElement("input");
    input.type = "url";
    input.className = "icon-gallery-url";
    input.placeholder = "Image URL";
    input.value = String(initialValue || "").trim();

    const linkInput = document.createElement("input");
    linkInput.type = "url";
    linkInput.className = "icon-gallery-link-url";
    linkInput.placeholder = "Link URL";
    linkInput.value = String(initialLinkUrl || "").trim();

    const variants = document.createElement("span");
    variants.className = "icon-gallery-variants hidden";
    variants.setAttribute("aria-label", "selfh.st icon variants");

    const topRow = document.createElement("div");
    topRow.className = "icon-gallery-top";
    topRow.append(input, variants);
    inputsWrap.append(topRow, linkInput);

    const removeBtn = document.createElement("button");
    removeBtn.type = "button";
    removeBtn.className = "icon-gallery-btn icon-gallery-remove";
    removeBtn.title = "Delete icon";
    removeBtn.innerHTML = '<span class="action-icon action-icon-delete" aria-hidden="true"></span><span class="sr-only">Delete icon</span>';

    row.append(upBtn, downBtn, grabBtn, inputsWrap, removeBtn);
    return row;
  }

  function getGalleryRowsCollection() {
    if (!refs.iconGalleryListEl) {
      return [];
    }
    return Array.from(refs.iconGalleryListEl.querySelectorAll(".icon-gallery-row"));
  }

  function clearGalleryDragState() {
    if (galleryDragRow) {
      galleryDragRow.classList.remove("is-dragging");
    }
    galleryDragRow = null;
    galleryDragMoved = false;
  }

  function refreshGalleryButtons() {
    const rows = getGalleryRowsCollection();
    rows.forEach((row, index) => {
      const upBtn = row.querySelector(".icon-gallery-up");
      const downBtn = row.querySelector(".icon-gallery-down");
      const removeBtn = row.querySelector(".icon-gallery-remove");
      if (upBtn instanceof HTMLButtonElement) {
        upBtn.disabled = index === 0;
      }
      if (downBtn instanceof HTMLButtonElement) {
        downBtn.disabled = index === rows.length - 1;
      }
      if (removeBtn instanceof HTMLButtonElement) {
        removeBtn.disabled = rows.length <= 1;
      }
    });
    if (refs.addIconGalleryItemBtnEl instanceof HTMLButtonElement) {
      refs.addIconGalleryItemBtnEl.disabled = rows.length >= MAX_GALLERY_ITEMS;
    }
  }

  function getGalleryEntries() {
    const entries = [];
    for (const row of getGalleryRowsCollection()) {
      const input = row.querySelector(".icon-gallery-url");
      if (!(input instanceof HTMLInputElement)) {
        continue;
      }
      const url = input.value.trim();
      if (!url) {
        continue;
      }
      const linkInput = row.querySelector(".icon-gallery-link-url");
      const linkUrl = linkInput instanceof HTMLInputElement ? linkInput.value.trim() : "";
      entries.push({ url, linkUrl });
      if (entries.length >= MAX_GALLERY_ITEMS) {
        break;
      }
    }
    return entries;
  }

  function getGalleryItems() {
    return getGalleryEntries().map((entry) => entry.url);
  }

  function getGalleryLinkUrls() {
    return getGalleryEntries().map((entry) => entry.linkUrl);
  }

  function getSingleLinkUrl() {
    return refs.iconLinkUrlEl?.value?.trim() || "";
  }

  function setSingleLinkUrl(value) {
    if (refs.iconLinkUrlEl) {
      refs.iconLinkUrlEl.value = String(value || "").trim();
    }
  }

  function getGalleryFirstUrlInput() {
    if (!refs.iconGalleryListEl) {
      return null;
    }
    const firstRow = refs.iconGalleryListEl.querySelector(".icon-gallery-row");
    if (!(firstRow instanceof HTMLElement)) {
      return null;
    }
    const firstInput = firstRow.querySelector(".icon-gallery-url");
    return firstInput instanceof HTMLInputElement ? firstInput : null;
  }

  function getGalleryFirstLinkInput() {
    if (!refs.iconGalleryListEl) {
      return null;
    }
    const firstRow = refs.iconGalleryListEl.querySelector(".icon-gallery-row");
    if (!(firstRow instanceof HTMLElement)) {
      return null;
    }
    const firstInput = firstRow.querySelector(".icon-gallery-link-url");
    return firstInput instanceof HTMLInputElement ? firstInput : null;
  }

  function syncGalleryFirstFromSingleUrl() {
    const singleUrl = refs.iconUrlEl?.value?.trim() || "";
    const firstInput = getGalleryFirstUrlInput();
    if (firstInput) {
      firstInput.value = singleUrl;
      return;
    }
    if (refs.iconGalleryListEl) {
      refs.iconGalleryListEl.append(createGalleryRow(singleUrl, getSingleLinkUrl()));
      refreshGalleryButtons();
      scheduleGalleryVariantButtonsRefresh();
    }
  }

  function syncGalleryFirstFromSingleLinkUrl() {
    const singleLinkUrl = getSingleLinkUrl();
    const firstInput = getGalleryFirstLinkInput();
    if (firstInput) {
      firstInput.value = singleLinkUrl;
    }
  }

  function syncSingleUrlFromGalleryFirst() {
    const firstInput = getGalleryFirstUrlInput();
    if (refs.iconUrlEl && firstInput) {
      refs.iconUrlEl.value = firstInput.value.trim();
    }
  }

  function syncSingleLinkUrlFromGalleryFirst() {
    const firstInput = getGalleryFirstLinkInput();
    if (firstInput) {
      setSingleLinkUrl(firstInput.value.trim());
    }
  }

  function setGalleryEntries(items, linkUrls = []) {
    if (!refs.iconGalleryListEl) {
      return;
    }
    refs.iconGalleryListEl.innerHTML = "";
    const normalized = normalizeGalleryItems(items);
    const normalizedLinkUrls = Array.isArray(linkUrls) ? linkUrls.map((item) => String(item || "").trim()) : [];
    if (normalized.length === 0) {
      normalized.push(refs.iconUrlEl?.value?.trim() || "");
      normalizedLinkUrls.unshift(getSingleLinkUrl());
    }
    for (let index = 0; index < normalized.length; index += 1) {
      refs.iconGalleryListEl.append(createGalleryRow(normalized[index], normalizedLinkUrls[index] || ""));
    }
    refreshGalleryButtons();
    scheduleGalleryVariantButtonsRefresh();
  }

  function setGalleryItems(items) {
    setGalleryEntries(items, []);
  }

  function setGalleryLinkUrls(linkUrls) {
    const normalized = Array.isArray(linkUrls) ? linkUrls.map((item) => String(item || "").trim()) : [];
    let index = 0;
    for (const row of getGalleryRowsCollection()) {
      const urlInput = row.querySelector(".icon-gallery-url");
      const linkInput = row.querySelector(".icon-gallery-link-url");
      if (!(urlInput instanceof HTMLInputElement) || !(linkInput instanceof HTMLInputElement)) {
        continue;
      }
      if (!urlInput.value.trim()) {
        linkInput.value = "";
        continue;
      }
      linkInput.value = normalized[index] || "";
      index += 1;
    }
    syncSingleLinkUrlFromGalleryFirst();
  }

  function getGalleryColumns() {
    return normalizeGalleryDimension(refs.iconGalleryColumnsEl?.value, 4);
  }

  function setGalleryColumns(value) {
    if (!refs.iconGalleryColumnsEl) {
      return;
    }
    refs.iconGalleryColumnsEl.value = String(normalizeGalleryDimension(value, 4));
  }

  function normalizeGallerySpacing(value) {
    const raw = String(value || "").trim().toLowerCase();
    if (raw === "m" || raw === "l") {
      return raw;
    }
    return "s";
  }

  function getGallerySpacing() {
    const selected = Array.from(refs.iconGallerySpacingRadios || []).find((radio) => radio.checked);
    return normalizeGallerySpacing(selected ? selected.value : "s");
  }

  function setGallerySpacing(value) {
    const normalized = normalizeGallerySpacing(value);
    for (const radio of refs.iconGallerySpacingRadios || []) {
      radio.checked = radio.value === normalized;
    }
  }

  function buildWsrvUrl(url, width) {
    return `${getWeservBaseUrl()}/?url=${encodeURIComponent(String(url || "").trim())}&w=${encodeURIComponent(String(width || ""))}`;
  }

  function normalizePreferredMode(value) {
    return String(value || "").trim().toLowerCase() === "resize" ? "resize" : "embed";
  }

  function getEffectivePreferredMode() {
    return normalizePreferredMode(typeof getPreferredSvgMode === "function" ? getPreferredSvgMode() : "embed");
  }

  function syncExternalModePreferenceFromControls() {
    externalModePreference.resizeWithWsrv = Boolean(refs.iconResizeWsrvEl?.checked);
    externalModePreference.embedSvg = externalModePreference.resizeWithWsrv ? false : Boolean(refs.iconEmbedSvgEl?.checked);
  }

  function applyPreferredExternalMode() {
    const preferredMode = getEffectivePreferredMode();
    if (refs.iconResizeWsrvEl) {
      refs.iconResizeWsrvEl.checked = preferredMode === "resize";
    }
    if (refs.iconEmbedSvgEl) {
      refs.iconEmbedSvgEl.checked = preferredMode === "embed";
    }
    syncExternalModePreferenceFromControls();
  }

  function applyPreferredGalleryMode() {
    if (refs.iconResizeWsrvEl) {
      refs.iconResizeWsrvEl.checked = true;
    }
    if (refs.iconEmbedSvgEl) {
      refs.iconEmbedSvgEl.checked = false;
    }
    syncExternalModePreferenceFromControls();
  }

  function lockEmbedForOversize(url) {
    oversizeEmbedLockedUrl = String(url || "").trim();
    if (refs.iconResizeWsrvEl) {
      refs.iconResizeWsrvEl.checked = true;
    }
    if (refs.iconEmbedSvgEl) {
      refs.iconEmbedSvgEl.checked = false;
    }
    syncExternalModePreferenceFromControls();
  }

  function clearEmbedOversizeLockIfUrlChanged(url) {
    const normalizedUrl = String(url || "").trim();
    if (!oversizeEmbedLockedUrl) {
      return;
    }
    if (normalizedUrl !== oversizeEmbedLockedUrl) {
      oversizeEmbedLockedUrl = "";
    }
  }

  async function checkUrlExists(url) {
    if (selfhstVariantExistsCache.has(url)) {
      return selfhstVariantExistsCache.get(url);
    }
    try {
      const res = await fetchWithPrivacy(url, { method: "HEAD" });
      const ok = res.ok;
      selfhstVariantExistsCache.set(url, ok);
      return ok;
    } catch {
      selfhstVariantExistsCache.set(url, false);
      return false;
    }
  }

  async function refreshSelfhstVariantButtons() {
    if (!refs.iconCdnVariantsEl) {
      return;
    }
    const token = ++selfhstVariantUiToken;
    const url = refs.iconUrlEl.value.trim();
    const variants = parseSelfhstVariantUrls(url);
    if (!variants) {
      refs.iconCdnVariantsEl.innerHTML = "";
      refs.iconCdnVariantsEl.classList.add("hidden");
      refs.iconUrlRowEl?.classList.remove("has-variants");
      return;
    }

    const [hasOrig, hasLight, hasDark] = await Promise.all([
      checkUrlExists(variants.orig),
      checkUrlExists(variants.light),
      checkUrlExists(variants.dark),
    ]);
    if (token !== selfhstVariantUiToken) {
      return;
    }

    const available = [];
    if (hasOrig) available.push({ key: "orig", url: variants.orig, ...getSelfhstVariantUiMeta("orig") });
    if (hasLight) available.push({ key: "light", url: variants.light, ...getSelfhstVariantUiMeta("light") });
    if (hasDark) available.push({ key: "dark", url: variants.dark, ...getSelfhstVariantUiMeta("dark") });

    const hasAlternatives = available.length > 1 || (available.length === 1 && available[0].url !== url);
    if (!hasAlternatives) {
      refs.iconCdnVariantsEl.innerHTML = "";
      refs.iconCdnVariantsEl.classList.add("hidden");
      refs.iconUrlRowEl?.classList.remove("has-variants");
      return;
    }

    refs.iconCdnVariantsEl.innerHTML = available
      .map((item) => {
        const activeClass = item.key === variants.currentVariant ? " is-active" : "";
        return `<button type="button" class="tool-chip icon-cdn-variant-btn${activeClass}" data-variant-url="${escapeHtml(item.url)}" title="${item.title}" aria-label="${item.title}"><span class="chip-icon ${item.iconClass}" aria-hidden="true"></span><span class="sr-only">${item.title}</span></button>`;
      })
      .join("");
    refs.iconCdnVariantsEl.classList.remove("hidden");
    refs.iconUrlRowEl?.classList.add("has-variants");
  }

  async function refreshGalleryRowVariantButtons(row) {
    if (!(row instanceof HTMLElement)) {
      return;
    }
    const input = row.querySelector(".icon-gallery-url");
    const variantsEl = row.querySelector(".icon-gallery-variants");
    if (!(input instanceof HTMLInputElement) || !(variantsEl instanceof HTMLElement)) {
      return;
    }
    const token = String(++galleryVariantUiToken);
    row.dataset.galleryVariantToken = token;

    const url = input.value.trim();
    const variants = parseSelfhstVariantUrls(url);
    if (!variants) {
      variantsEl.innerHTML = "";
      variantsEl.classList.add("hidden");
      row.classList.remove("has-variants");
      return;
    }

    const [hasOrig, hasLight, hasDark] = await Promise.all([
      checkUrlExists(variants.orig),
      checkUrlExists(variants.light),
      checkUrlExists(variants.dark),
    ]);
    if (row.dataset.galleryVariantToken !== token) {
      return;
    }

    const available = [];
    if (hasOrig) available.push({ key: "orig", url: variants.orig, ...getSelfhstVariantUiMeta("orig") });
    if (hasLight) available.push({ key: "light", url: variants.light, ...getSelfhstVariantUiMeta("light") });
    if (hasDark) available.push({ key: "dark", url: variants.dark, ...getSelfhstVariantUiMeta("dark") });

    const hasAlternatives = available.length > 1 || (available.length === 1 && available[0].url !== url);
    if (!hasAlternatives) {
      variantsEl.innerHTML = "";
      variantsEl.classList.add("hidden");
      row.classList.remove("has-variants");
      return;
    }

    variantsEl.innerHTML = available
      .map((item) => {
        const activeClass = item.key === variants.currentVariant ? " is-active" : "";
        return `<button type="button" class="tool-chip icon-gallery-variant-btn${activeClass}" data-gallery-variant-url="${escapeHtml(item.url)}" title="${item.title}" aria-label="${item.title}"><span class="chip-icon ${item.iconClass}" aria-hidden="true"></span><span class="sr-only">${item.title}</span></button>`;
      })
      .join("");
    variantsEl.classList.remove("hidden");
    row.classList.add("has-variants");
  }

  function refreshAllGalleryVariantButtons() {
    for (const row of getGalleryRowsCollection()) {
      refreshGalleryRowVariantButtons(row);
    }
  }

  function scheduleGalleryVariantButtonsRefresh() {
    if (galleryVariantRefreshTimer) {
      window.clearTimeout(galleryVariantRefreshTimer);
    }
    galleryVariantRefreshTimer = window.setTimeout(() => {
      refreshAllGalleryVariantButtons();
    }, 180);
  }

  function scheduleSelfhstVariantButtonsRefresh() {
    if (selfhstVariantRefreshTimer) {
      window.clearTimeout(selfhstVariantRefreshTimer);
    }
    selfhstVariantRefreshTimer = window.setTimeout(() => {
      refreshSelfhstVariantButtons();
    }, 180);
  }

  async function getExternalSvgText(url) {
    if (externalSvgCache.has(url)) {
      return externalSvgCache.get(url);
    }

    const res = await fetchWithPrivacy(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const contentLength = Number.parseInt(res.headers.get("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > maxFetchedSvgBytes) {
      throw new Error(`External SVG exceeds the ${formatBytes(maxFetchedSvgBytes)} limit.`);
    }

    const text = await res.text();
    assertTextSizeWithinLimit(text, maxFetchedSvgBytes, "External SVG");
    externalSvgCache.set(url, text);
    return text;
  }

  function iconCanUseScale() {
    const mode = getIconMode();
    if (mode === "upload") {
      return Boolean(getUploadSvgText());
    }
    if (mode === "gallery") {
      return getGalleryItems().length > 0 && isWsrvResizeEnabled();
    }

    if (mode === "external") {
      const url = refs.iconUrlEl.value.trim();
      if (!url) {
        return false;
      }
      return isWsrvResizeEnabled() || (isSvgUrl(url) && refs.iconEmbedSvgEl.checked);
    }

    return false;
  }

  function iconCanTransformColors() {
    const mode = getIconMode();
    if (mode === "upload") {
      return Boolean(getUploadSvgText());
    }
    if (mode === "external") {
      const url = refs.iconUrlEl.value.trim();
      return isSvgUrl(url) && refs.iconEmbedSvgEl.checked && !isWsrvResizeEnabled();
    }
    if (mode === "gallery") {
      return false;
    }
    return false;
  }

  function updateIconControls() {
    const mode = getIconMode();
    refs.iconUrlWrap.classList.toggle("hidden", mode !== "external");
    refs.iconUploadWrap.classList.toggle("hidden", mode !== "upload");
    refs.iconLinkUrlWrap?.classList.toggle("hidden", mode === "gallery" || mode === "none");
    refs.iconGalleryWrap?.classList.toggle("hidden", mode !== "gallery");
    refs.iconSelfhstWrap.classList.toggle("hidden", !(mode === "external" || mode === "gallery"));
    refs.iconEmbedWrap.classList.toggle("hidden", mode !== "external" && mode !== "gallery");
    refs.iconEmbedSvgControlEl?.classList.toggle("hidden", mode === "gallery");
    if (isWsrvResizeEnabled()) {
      refs.iconEmbedSvgEl.checked = false;
    }

    const url = refs.iconUrlEl.value.trim();
    const embedLockedByOversize = mode === "external" && Boolean(oversizeEmbedLockedUrl) && url === oversizeEmbedLockedUrl;
    const rasterLink = mode === "external" && isRasterUrl(url);
    const externalSvg = mode === "external" && isSvgUrl(url);
    const showVariantControls =
      (mode === "upload" && Boolean(getUploadSvgText())) ||
      (externalSvg && refs.iconEmbedSvgEl.checked && !isWsrvResizeEnabled());
    if (refs.iconVariantWrapEl) {
      refs.iconVariantWrapEl.classList.toggle("hidden", !showVariantControls);
    }
    if (refs.iconScaleWrapEl) {
      refs.iconScaleWrapEl.classList.toggle("hidden", false);
    }
    if (mode === "gallery") {
      scheduleGalleryVariantButtonsRefresh();
    }

    if (rasterLink || embedLockedByOversize) {
      refs.iconEmbedSvgEl.checked = false;
      refs.iconEmbedSvgEl.disabled = true;
    } else {
      refs.iconEmbedSvgEl.disabled = false;
    }
    if (refs.iconResizeWsrvEl) {
      refs.iconResizeWsrvEl.disabled = mode !== "external" && mode !== "gallery";
    }

    refs.iconScaleEl.disabled = !iconCanUseScale();
    const disableColor = !iconCanTransformColors();
    for (const radio of refs.iconColorVariantEls) {
      radio.disabled = disableColor;
    }
  }

  async function prepareIcon(options = {}) {
    const token = ++prepareToken;
    const mode = getIconMode();
    if (mode === "gallery" && options && options.respectPreferredSvgMode === true) {
      applyPreferredGalleryMode();
    }
    if (mode === "external") {
      const currentUrl = refs.iconUrlEl.value.trim();
      const isLocked = Boolean(oversizeEmbedLockedUrl) && currentUrl === oversizeEmbedLockedUrl;
      if (!isLocked && options && options.respectPreferredSvgMode === true) {
        if (isSvgUrl(currentUrl)) {
          applyPreferredExternalMode();
        } else if (currentUrl) {
          // For non-SVG template icons, default to WSRV resize mode.
          if (refs.iconResizeWsrvEl) {
            refs.iconResizeWsrvEl.checked = true;
          }
          if (refs.iconEmbedSvgEl) {
            refs.iconEmbedSvgEl.checked = false;
          }
          syncExternalModePreferenceFromControls();
        }
      }
    }

    if (getIconMode() === "external") {
      scheduleSelfhstVariantButtonsRefresh();
    } else if (refs.iconCdnVariantsEl) {
      refs.iconCdnVariantsEl.innerHTML = "";
      refs.iconCdnVariantsEl.classList.add("hidden");
      refs.iconUrlRowEl?.classList.remove("has-variants");
    }
    updateIconControls();

    if (mode === "gallery") {
      const items = getGalleryItems().filter((value) => isAllowedIconImageUrl(value));
      if (items.length === 0) {
        setIconResolvedSrc("");
        setIconStatus("Add a collection of external images.");
        renderOutput();
        return;
      }
      const first = items[0];
      const resolved = isWsrvResizeEnabled() ? buildWsrvUrl(first, refs.iconScaleEl.value) : first;
      setIconResolvedSrc(resolved);
      setIconStatus(`Gallery mode active with ${items.length} icon${items.length === 1 ? "" : "s"}.`);
      renderOutput();
      return;
    }
    if (mode === "none") {
      setIconResolvedSrc("");
      setIconStatus("App-Icon disabled. Select a source to enable it again.");
      renderOutput();
      return;
    }

    if (mode === "upload") {
      const uploadImageDataUrl = getUploadImageDataUrl();
      const uploadSvgText = getUploadSvgText();

      if (uploadImageDataUrl) {
        setIconResolvedSrc(uploadImageDataUrl);
        setIconStatus("Uploaded raster image embedded. Scaling and color transform are only available for SVG.");
        updateIconControls();
        renderOutput();
        return;
      }

      if (!uploadSvgText) {
        setIconResolvedSrc("");
        setIconStatus("Upload an SVG or PNG/JPEG/GIF/WEBP to directly embed the icon. 6 KB file size limit for raster images.");
        renderOutput();
        return;
      }

      try {
        const resized = resizeSvg(uploadSvgText, refs.iconScaleEl.value);
        const colorized = transformSvgColors(resized, getIconColorVariant(), svgColorCanvasCtx);
        if (token !== prepareToken) {
          return;
        }
        setIconResolvedSrc(encodeSvgDataUrl(colorized));
        setIconStatus(`Uploaded SVG embedded at ${refs.iconScaleEl.value}px width.`);
        updateIconControls();
        renderOutput();
        return;
      } catch {
        setIconResolvedSrc("");
        setIconStatus("Could not process uploaded SVG.", true);
        renderOutput();
        return;
      }
    }

    const url = refs.iconUrlEl.value.trim();
    clearEmbedOversizeLockIfUrlChanged(url);
    if (!url) {
      setIconResolvedSrc("");
      setIconStatus("Add an external image.");
      renderOutput();
      return;
    }

    if (!isAllowedIconImageUrl(url)) {
      setIconResolvedSrc("");
      setIconStatus("Unsupported icon URL. Allowed image types: .svg .gif .jpeg .jpg .png .tif .webp", true);
      renderOutput();
      return;
    }

    if (isWsrvResizeEnabled()) {
      setIconResolvedSrc(buildWsrvUrl(url, refs.iconScaleEl.value));
      const serviceName = getConfiguredWeservDomain() ? "weserv/images" : "wsrv.nl";
      setIconStatus(`${serviceName} resize enabled at ${refs.iconScaleEl.value}px width.`);
      updateIconControls();
      renderOutput();
      return;
    }

    if (isRasterUrl(url)) {
      setIconResolvedSrc(url);
      setIconStatus("Raster image detected: link-only mode (no scaling). Use CDN-sized assets.");
      updateIconControls();
      renderOutput();
      return;
    }

    if (!refs.iconEmbedSvgEl.checked) {
      setIconResolvedSrc(url);
      setIconStatus("SVG link mode enabled. Scaling is disabled until embedding is enabled.");
      updateIconControls();
      renderOutput();
      return;
    }

    setIconStatus("Preparing embedded SVG...");
    try {
      const svgText = await getExternalSvgText(url);
      const resized = resizeSvg(svgText, refs.iconScaleEl.value);
      const colorized = transformSvgColors(resized, getIconColorVariant(), svgColorCanvasCtx);
      if (token !== prepareToken) {
        return;
      }
      const embeddedSvgDataUrl = encodeSvgDataUrl(colorized);
      setIconResolvedSrc(embeddedSvgDataUrl);
      renderOutput();
      const renderedLength = typeof getRenderedOutputLength === "function" ? getRenderedOutputLength() : 0;
      const exceedsLimit = embeddedSvgDataUrl.length > maxOutputLength || renderedLength > maxOutputLength;
      if (exceedsLimit && refs.iconResizeWsrvEl) {
        lockEmbedForOversize(url);
        setIconResolvedSrc(buildWsrvUrl(url, refs.iconScaleEl.value));
        const serviceName = getConfiguredWeservDomain() ? "weserv/images" : "wsrv.nl";
        setIconStatus(`Embedded SVG exceeded character limit. Switched to ${serviceName} resize automatically for this URL.`);
        updateIconControls();
        renderOutput();
        return;
      }

      setIconStatus(`External SVG embedded at ${refs.iconScaleEl.value}px width.`);
      updateIconControls();
      renderOutput();
    } catch (error) {
      if (token !== prepareToken) {
        return;
      }

      const message = error instanceof Error ? error.message : "Embedding failed. Falling back to direct SVG link.";
      if (error instanceof Error && /exceeds the .* limit/i.test(error.message)) {
        setIconResolvedSrc("");
        setIconStatus(error.message, true);
      } else {
        setIconResolvedSrc(url);
        setIconStatus(message, true);
      }
      updateIconControls();
      renderOutput();
    }
  }

  async function onIconUploadChange(event) {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }
    const [file] = input.files || [];
    if (!file) {
      setUploadSvgText("");
      setUploadImageDataUrl("");
      await prepareIcon();
      return;
    }

    const isSvg = file.type === "image/svg+xml" || /\.svg$/i.test(file.name);
    const isRaster = /^(image\/png|image\/jpe?g|image\/gif|image\/webp)$/i.test(file.type) || /\.(png|jpe?g|gif|webp)$/i.test(file.name);
    if (!isSvg && !isRaster) {
      refs.iconUploadEl.value = "";
      setUploadSvgText("");
      setUploadImageDataUrl("");
      setIconStatus("Only SVG/PNG/JPEG/GIF/WEBP upload is allowed.", true);
      updateIconControls();
      renderOutput();
      return;
    }

    try {
      if (isSvg) {
        assertFileSizeWithinLimit(file, maxUploadSvgBytes, "Uploaded SVG");
        const uploadSvgText = await readTextFile(file);
        assertTextSizeWithinLimit(uploadSvgText, maxUploadSvgBytes, "Uploaded SVG");
        setUploadSvgText(uploadSvgText);
        setUploadImageDataUrl("");
      } else {
        assertFileSizeWithinLimit(file, maxUploadRasterBytes, "Uploaded raster image");
        const uploadImageDataUrl = await readDataUrlFile(file);
        assertTextSizeWithinLimit(uploadImageDataUrl, maxOutputLength, "Embedded raster image");
        setUploadImageDataUrl(uploadImageDataUrl);
        setUploadSvgText("");
      }
      await prepareIcon();
    } catch (error) {
      setUploadSvgText("");
      setUploadImageDataUrl("");
      setIconStatus(error instanceof Error ? error.message : "Could not read uploaded icon file.", true);
      updateIconControls();
      renderOutput();
    }
  }

  function initIconInteractions() {
    if (iconInteractionsBound) {
      return;
    }
    iconInteractionsBound = true;

    if (refs.iconGalleryListEl && getGalleryRowsCollection().length === 0) {
      setGalleryItems([]);
    }

    if (refs.iconModeRadios) {
      previousIconMode = getIconMode();
      for (const radio of refs.iconModeRadios) {
        radio.addEventListener("change", () => {
          const nextMode = getIconMode();
          if (nextMode === "gallery") {
            const hadSingleResize = Boolean(refs.iconResizeWsrvEl?.checked) || Boolean(refs.iconEmbedSvgEl?.checked);
            if (refs.iconResizeWsrvEl) {
              refs.iconResizeWsrvEl.checked = hadSingleResize;
            }
            if (refs.iconEmbedSvgEl) {
              refs.iconEmbedSvgEl.checked = false;
            }
            syncExternalModePreferenceFromControls();
            if (getGalleryRowsCollection().length === 0) {
              setGalleryItems([]);
            }
            syncGalleryFirstFromSingleUrl();
            syncGalleryFirstFromSingleLinkUrl();
            scheduleGalleryVariantButtonsRefresh();
          } else if (nextMode === "external") {
            applyPreferredExternalMode();
            syncSingleUrlFromGalleryFirst();
            syncSingleLinkUrlFromGalleryFirst();
          } else if (previousIconMode === "external") {
            externalModePreference.resizeWithWsrv = Boolean(refs.iconResizeWsrvEl?.checked);
            externalModePreference.embedSvg = externalModePreference.resizeWithWsrv ? false : Boolean(refs.iconEmbedSvgEl?.checked);
          }
          previousIconMode = nextMode;
          prepareIcon();
        });
      }
    }

    refs.iconUrlEl?.addEventListener("input", () => {
      if (getIconMode() === "external") {
        clearEmbedOversizeLockIfUrlChanged(refs.iconUrlEl.value.trim());
      }
      syncGalleryFirstFromSingleUrl();
      scheduleGalleryVariantButtonsRefresh();
      prepareIcon({ respectPreferredSvgMode: true });
    });

    refs.iconLinkUrlEl?.addEventListener("input", () => {
      syncGalleryFirstFromSingleLinkUrl();
      prepareIcon();
    });

    refs.iconEmbedSvgEl?.addEventListener("change", () => {
      if (refs.iconEmbedSvgEl.checked && refs.iconResizeWsrvEl) {
        refs.iconResizeWsrvEl.checked = false;
      }
      if (getIconMode() === "external") {
        syncExternalModePreferenceFromControls();
      }
      prepareIcon();
    });

    refs.iconResizeWsrvEl?.addEventListener("change", () => {
      if (refs.iconResizeWsrvEl.checked && refs.iconEmbedSvgEl) {
        refs.iconEmbedSvgEl.checked = false;
      }
      if (getIconMode() === "external") {
        syncExternalModePreferenceFromControls();
      }
      prepareIcon();
    });

    refs.iconScaleEl?.addEventListener("input", prepareIcon);
    refs.iconUploadEl?.addEventListener("change", onIconUploadChange);
    refs.iconGalleryColumnsEl?.addEventListener("input", () => {
      setGalleryColumns(refs.iconGalleryColumnsEl.value);
      prepareIcon();
    });
    if (refs.iconGallerySpacingRadios) {
      for (const radio of refs.iconGallerySpacingRadios) {
        radio.addEventListener("change", prepareIcon);
      }
    }
    refs.addIconGalleryItemBtnEl?.addEventListener("click", () => {
      if (!refs.iconGalleryListEl || getGalleryRowsCollection().length >= MAX_GALLERY_ITEMS) {
        return;
      }
      refs.iconGalleryListEl.append(createGalleryRow("", ""));
      refreshGalleryButtons();
      prepareIcon();
    });

    refs.iconGalleryListEl?.addEventListener("input", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLInputElement)) {
        return;
      }
      if (target.classList.contains("icon-gallery-url")) {
        const row = target.closest(".icon-gallery-row");
        const firstRow = refs.iconGalleryListEl?.querySelector(".icon-gallery-row");
        if (row && firstRow && row === firstRow) {
          syncSingleUrlFromGalleryFirst();
        }
        prepareIcon();
        if (row instanceof HTMLElement) {
          refreshGalleryRowVariantButtons(row);
        }
        return;
      }
      if (target.classList.contains("icon-gallery-link-url")) {
        const row = target.closest(".icon-gallery-row");
        const firstRow = refs.iconGalleryListEl?.querySelector(".icon-gallery-row");
        if (row && firstRow && row === firstRow) {
          syncSingleLinkUrlFromGalleryFirst();
        }
        prepareIcon();
      }
    });
    refs.iconGalleryListEl?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !refs.iconGalleryListEl) {
        return;
      }
      const row = target.closest(".icon-gallery-row");
      if (!(row instanceof HTMLElement)) {
        return;
      }

      if (target.closest(".icon-gallery-up")) {
        const prev = row.previousElementSibling;
        if (prev) {
          refs.iconGalleryListEl.insertBefore(row, prev);
        }
        refreshGalleryButtons();
        syncSingleUrlFromGalleryFirst();
        syncSingleLinkUrlFromGalleryFirst();
        scheduleGalleryVariantButtonsRefresh();
        prepareIcon();
        return;
      }

      if (target.closest(".icon-gallery-down")) {
        const next = row.nextElementSibling;
        if (next) {
          refs.iconGalleryListEl.insertBefore(next, row);
        }
        refreshGalleryButtons();
        syncSingleUrlFromGalleryFirst();
        syncSingleLinkUrlFromGalleryFirst();
        scheduleGalleryVariantButtonsRefresh();
        prepareIcon();
        return;
      }

      if (target.closest(".icon-gallery-grab")) {
        return;
      }

      const galleryVariantBtn = target.closest(".icon-gallery-variant-btn");
      if (galleryVariantBtn instanceof HTMLButtonElement) {
        const nextUrl = galleryVariantBtn.getAttribute("data-gallery-variant-url");
        if (!nextUrl) {
          return;
        }
        const input = row.querySelector(".icon-gallery-url");
        if (input instanceof HTMLInputElement) {
          input.value = nextUrl;
          const firstRow = refs.iconGalleryListEl?.querySelector(".icon-gallery-row");
          if (firstRow && row === firstRow) {
            syncSingleUrlFromGalleryFirst();
          }
          refreshGalleryRowVariantButtons(row);
          prepareIcon();
        }
        return;
      }

      if (target.closest(".icon-gallery-remove")) {
        row.remove();
        if (getGalleryRowsCollection().length === 0) {
          refs.iconGalleryListEl.append(createGalleryRow("", ""));
        }
        refreshGalleryButtons();
        syncSingleUrlFromGalleryFirst();
        syncSingleLinkUrlFromGalleryFirst();
        scheduleGalleryVariantButtonsRefresh();
        prepareIcon();
      }
    });
    refs.iconGalleryListEl?.addEventListener("dragstart", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement) || !target.closest(".icon-gallery-grab")) {
        return;
      }
      const row = target.closest(".icon-gallery-row");
      if (!(row instanceof HTMLElement)) {
        return;
      }
      galleryDragRow = row;
      galleryDragMoved = false;
      row.classList.add("is-dragging");
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData("text/plain", "icon-gallery-row");
      }
    });
    refs.iconGalleryListEl?.addEventListener("dragover", (event) => {
      if (!refs.iconGalleryListEl || !galleryDragRow) {
        return;
      }
      event.preventDefault();
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const row = target.closest(".icon-gallery-row");
      if (!(row instanceof HTMLElement) || row === galleryDragRow) {
        return;
      }
      const bounds = row.getBoundingClientRect();
      const shouldInsertAfter = event.clientY > bounds.top + bounds.height / 2;
      if (shouldInsertAfter) {
        refs.iconGalleryListEl.insertBefore(galleryDragRow, row.nextElementSibling);
      } else {
        refs.iconGalleryListEl.insertBefore(galleryDragRow, row);
      }
      galleryDragMoved = true;
      refreshGalleryButtons();
    });
    refs.iconGalleryListEl?.addEventListener("drop", (event) => {
      if (!galleryDragRow) {
        return;
      }
      event.preventDefault();
    });
    refs.iconGalleryListEl?.addEventListener("dragend", () => {
      const moved = galleryDragMoved;
      clearGalleryDragState();
      refreshGalleryButtons();
      syncSingleUrlFromGalleryFirst();
      syncSingleLinkUrlFromGalleryFirst();
      scheduleGalleryVariantButtonsRefresh();
      if (moved) {
        prepareIcon();
      }
    });

    if (refs.iconColorVariantEls) {
      for (const radio of refs.iconColorVariantEls) {
        radio.addEventListener("change", prepareIcon);
      }
    }

    refs.iconCdnVariantsEl?.addEventListener("click", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const btn = target.closest(".icon-cdn-variant-btn");
      if (!(btn instanceof HTMLButtonElement)) {
        return;
      }
      const nextUrl = btn.getAttribute("data-variant-url");
      if (!nextUrl) {
        return;
      }
      refs.iconUrlEl.value = nextUrl;
      syncGalleryFirstFromSingleUrl();
      prepareIcon();
    });

    scheduleGalleryVariantButtonsRefresh();
    syncSingleUrlFromGalleryFirst();
    syncSingleLinkUrlFromGalleryFirst();
  }

  function clearIconEditor() {
    if (refs.iconUrlEl) {
      refs.iconUrlEl.value = "";
    }
    setSingleLinkUrl("");
    if (refs.iconUploadEl) {
      refs.iconUploadEl.value = "";
    }
    setUploadSvgText("");
    setUploadImageDataUrl("");
    setGalleryItems([]);
    setGalleryColumns(4);
    setGallerySpacing("s");
    oversizeEmbedLockedUrl = "";
    scheduleSelfhstVariantButtonsRefresh();
    scheduleGalleryVariantButtonsRefresh();
  }

  return {
    updateIconControls,
    prepareIcon,
    setIconStatus,
    initIconInteractions,
    clearIconEditor,
    getSingleLinkUrl,
    setSingleLinkUrl,
    getGalleryItems,
    getGalleryLinkUrls,
    setGalleryLinkUrls,
    setGalleryItems,
    getGalleryColumns,
    setGalleryColumns,
    getGallerySpacing,
    setGallerySpacing,
  };
}
