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

export function createIconFeature({
  refs,
  getUploadSvgText,
  setUploadSvgText,
  getUploadImageDataUrl,
  setUploadImageDataUrl,
  getIconMode,
  isWsrvResizeEnabled,
  getIconColorVariant,
  getConfiguredWeservDomain,
  getWeservBaseUrl,
  getIconResolvedSrc,
  setIconResolvedSrc,
  maxFetchedSvgBytes,
  maxUploadSvgBytes,
  maxUploadRasterBytes,
  maxOutputLength,
  renderOutput,
}) {
  let prepareToken = 0;
  let selfhstVariantUiToken = 0;
  let selfhstVariantRefreshTimer = null;
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

  function buildWsrvUrl(url, width) {
    return `${getWeservBaseUrl()}/?url=${encodeURIComponent(String(url || "").trim())}&w=${encodeURIComponent(String(width || ""))}`;
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
    if (hasOrig) available.push({ key: "orig", label: "ORIG", url: variants.orig });
    if (hasLight) available.push({ key: "light", label: "LIGHT", url: variants.light });
    if (hasDark) available.push({ key: "dark", label: "DARK", url: variants.dark });

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
        return `<button type="button" class="tool-chip icon-cdn-variant-btn${activeClass}" data-variant-url="${escapeHtml(item.url)}">${item.label}</button>`;
      })
      .join("");
    refs.iconCdnVariantsEl.classList.remove("hidden");
    refs.iconUrlRowEl?.classList.add("has-variants");
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
    return false;
  }

  function updateIconControls() {
    const mode = getIconMode();
    refs.iconUrlWrap.classList.toggle("hidden", mode !== "external");
    refs.iconSelfhstWrap.classList.toggle("hidden", mode !== "external");
    refs.iconEmbedWrap.classList.toggle("hidden", mode !== "external");
    refs.iconUploadWrap.classList.toggle("hidden", mode !== "upload");
    if (isWsrvResizeEnabled()) {
      refs.iconEmbedSvgEl.checked = false;
    }

    const url = refs.iconUrlEl.value.trim();
    const rasterLink = mode === "external" && isRasterUrl(url);
    const externalSvg = mode === "external" && isSvgUrl(url);
    const showVariantControls =
      (mode === "upload" && Boolean(getUploadSvgText())) ||
      (externalSvg && refs.iconEmbedSvgEl.checked && !isWsrvResizeEnabled());
    if (refs.iconVariantWrapEl) {
      refs.iconVariantWrapEl.classList.toggle("hidden", !showVariantControls);
    }
    if (refs.iconScaleWrapEl) {
      refs.iconScaleWrapEl.classList.toggle("hidden", mode === "none");
    }

    if (rasterLink) {
      refs.iconEmbedSvgEl.checked = false;
      refs.iconEmbedSvgEl.disabled = true;
    } else {
      refs.iconEmbedSvgEl.disabled = false;
    }
    if (refs.iconResizeWsrvEl) {
      refs.iconResizeWsrvEl.disabled = mode !== "external";
    }

    refs.iconScaleEl.disabled = !iconCanUseScale();
    const disableColor = !iconCanTransformColors();
    for (const radio of refs.iconColorVariantEls) {
      radio.disabled = disableColor;
    }
  }

  async function prepareIcon() {
    const token = ++prepareToken;
    scheduleSelfhstVariantButtonsRefresh();
    updateIconControls();

    const mode = getIconMode();
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
    if (!url) {
      setIconResolvedSrc("");
      setIconStatus("Add an external image URL.");
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

      setIconResolvedSrc(encodeSvgDataUrl(colorized));
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

  return {
    updateIconControls,
    prepareIcon,
    onIconUploadChange,
    getIconResolvedSrc,
    setIconStatus,
  };
}
