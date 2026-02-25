const MAX_OUTPUT_LENGTH = 8192;

const form = document.getElementById("noteForm");
const outputEl = document.getElementById("output");
const previewCard = document.getElementById("previewCard");
const copyBtn = document.getElementById("copyBtn");
const charCountEl = document.getElementById("charCount");
const charWarningEl = document.getElementById("charWarning");

const previewShell = document.getElementById("previewShell");
const themeToggleBtn = document.getElementById("themeToggleBtn");
const themeIconEl = document.getElementById("themeIcon");
const githubStarCountEl = document.getElementById("githubStarCount");
const clearBtn = document.getElementById("clearBtn");
const importBtn = document.getElementById("importBtn");
const exportBtn = document.getElementById("exportBtn");
const importFileEl = document.getElementById("importFile");
const presetBtnEls = document.querySelectorAll("button[data-preset]");

const iconModeRadios = form.querySelectorAll('input[name="iconMode"]');
const iconUrlWrap = document.getElementById("iconUrlWrap");
const iconUploadWrap = document.getElementById("iconUploadWrap");
const iconEmbedWrap = document.getElementById("iconEmbedWrap");
const iconSelfhstWrap = document.getElementById("iconSelfhstWrap");
const iconUrlEl = document.getElementById("iconUrl");
const iconEmbedSvgEl = document.getElementById("iconEmbedSvg");
const iconUploadEl = document.getElementById("iconUpload");
const iconScaleEl = document.getElementById("iconScale");
const iconScaleValueEl = document.getElementById("iconScaleValue");
const iconScaleWrapEl = document.getElementById("iconScaleWrap");
const iconStatusEl = document.getElementById("iconStatus");
const iconColorVariantEls = form.querySelectorAll('input[name="iconColorVariant"]');
const iconVariantWrapEl = document.querySelector(".svg-variant-wrap");

const configLocationsEl = document.getElementById("configLocations");
const addConfigBtn = document.getElementById("addConfigBtn");

let activeTheme = "dark";
let iconResolvedSrc = "";
let uploadSvgText = "";
const externalSvgCache = new Map();
let prepareToken = 0;
const svgColorCanvasCtx = document.createElement("canvas").getContext("2d");

const rowConfigs = [
  { prefix: "title", defaultAlign: "center", defaultTag: "h2", bold: false, italic: false, strong: false, code: false },
  { prefix: "fqdn", defaultAlign: "center", defaultTag: "h3", bold: false, italic: false, strong: false, code: false },
  { prefix: "network", defaultAlign: "center", defaultTag: "h3", bold: false, italic: false, strong: false, code: false },
  { prefix: "config", defaultAlign: "center", defaultTag: "none", bold: false, italic: true, strong: true, code: true },
  { prefix: "custom", defaultAlign: "left", defaultTag: "none", bold: false, italic: false, strong: false, code: false },
];
const ROW_KEYS = ["icon", "title", "fqdn", "network", "config", "custom"];

function getEl(id) {
  return document.getElementById(id);
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function isSvgUrl(url) {
  return /\.svg($|[?#])/i.test(url);
}

function isRasterUrl(url) {
  return /\.(png|jpe?g|webp)($|[?#])/i.test(url);
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}

function encodeSvgDataUrl(svgText) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

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

function parseCssColorToRgb(value) {
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

function getMonoTargetColor(variant) {
  return variant === "light" ? "#ffffff" : "#000000";
}

function mapColorToMonochrome(value, variant) {
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

  const rgb = parseCssColorToRgb(raw);
  if (!rgb) {
    return value;
  }

  return target;
}

function rewriteStyleColors(styleValue, variant) {
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
      return `${prop}:${mapColorToMonochrome(rawValue, variant)}`;
    })
    .join(";");
}

function getIconColorVariant() {
  return getSelectedRadioValue("iconColorVariant", "original");
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

function rewriteGradientStops(gradientEl, effectiveVariant) {
  const stops = Array.from(gradientEl.querySelectorAll("stop"));
  if (stops.length === 0) {
    return;
  }

  const measured = stops.map((stop, index) => {
    const fallbackOffset = stops.length > 1 ? index / (stops.length - 1) : 0;
    const offset = parseOffset01(stop, fallbackOffset);
    const color = parseCssColorToRgb(getStopColorValue(stop));
    const lum = color ? (0.2126 * color.r + 0.7152 * color.g + 0.0722 * color.b) / 255 : null;
    return { stop, offset, lum };
  });

  const knownLums = measured.map((item) => item.lum).filter((lum) => lum !== null);
  const lumMin = knownLums.length > 0 ? Math.min(...knownLums) : 0;
  const lumMax = knownLums.length > 0 ? Math.max(...knownLums) : 1;
  const lumRange = lumMax - lumMin;

  for (const item of measured) {
    const normalized = item.lum === null || lumRange < 0.0001 ? item.offset : (item.lum - lumMin) / lumRange;
    // Keep gradients flatter while preserving subtle depth.
    const targetLum =
      effectiveVariant === "light"
        ? 0.72 + normalized * 0.24
        : 0.06 + normalized * 0.24;
    const g = Math.max(0, Math.min(255, Math.round(targetLum * 255)));
    setStopColorValue(item.stop, `rgb(${g}, ${g}, ${g})`);
  }
}

function transformSvgColors(svgText, variant) {
  if (variant === "original") {
    return svgText;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg") {
    throw new Error("Not a valid SVG.");
  }

  const effectiveVariant = variant;

  const gradients = doc.querySelectorAll("linearGradient, radialGradient");
  for (const gradient of gradients) {
    rewriteGradientStops(gradient, effectiveVariant);
  }

  const colorAttrs = ["fill", "stroke", "flood-color", "lighting-color", "color"];
  const paintTags = new Set(["path", "rect", "circle", "ellipse", "polygon", "polyline", "text", "use"]);
  const target = getMonoTargetColor(effectiveVariant);
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
      el.setAttribute(attr, mapColorToMonochrome(value, effectiveVariant));
    }

    const style = el.getAttribute("style");
    if (style) {
      el.setAttribute("style", rewriteStyleColors(style, effectiveVariant));
    }

    // If no explicit paint is defined, SVG defaults fill to black.
    // Enforce monochrome target so "Light" also affects implicit black fills.
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

async function getExternalSvgText(url) {
  if (externalSvgCache.has(url)) {
    return externalSvgCache.get(url);
  }

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const text = await res.text();
  externalSvgCache.set(url, text);
  return text;
}

function setIconStatus(text, isError = false) {
  iconStatusEl.textContent = text;
  iconStatusEl.classList.toggle("error", isError);
}

function getIconAlign() {
  return getSelectedRadioValue("iconAlign", "center");
}

function getIconMode() {
  return getSelectedRadioValue("iconMode", "external");
}

function setIconMode(value) {
  setSelectedRadioValue("iconMode", value);
}

function styleToolbarHtml(prefix, defaults) {
  const headingOptions = ["h1", "h2", "h3", "h4", "h5"];
  const alignOptions = ["left", "center", "right"];

  const align = alignOptions
    .map((value) => {
      const title = value.toUpperCase();
      const checked = defaults.defaultAlign === value ? "checked" : "";
      return `<label class="tool-chip align-chip" title="${title} alignment"><input type="radio" name="${prefix}Align" value="${value}" ${checked} /><span class="align-glyph align-${value}" aria-hidden="true"><span></span><span></span><span></span></span><span class="sr-only">${title}</span></label>`;
    })
    .join("");

  const heading = headingOptions
    .map((tag) => {
      const label = tag.toUpperCase();
      const title = `${tag.toUpperCase()} heading`;
      const checked = defaults.defaultTag === tag ? "checked" : "";
      return `<label class="tool-chip" title="${title}"><input type="checkbox" name="${prefix}Heading" value="${tag}" ${checked} /><span>${label}</span></label>`;
    })
    .join("");

  const toggles = [
    { key: "Italic", label: "I", title: "Italic", checked: defaults.italic },
    { key: "Bold", label: "B", title: "Bold", checked: defaults.bold },
    { key: "Strong", label: "S", title: "Strong", checked: defaults.strong },
    { key: "Code", label: "C", title: "Code", checked: defaults.code },
  ]
    .map((item) => {
      const checked = item.checked ? "checked" : "";
      return `<label class="tool-chip" title="${item.title}"><input id="${prefix}${item.key}" type="checkbox" ${checked} /><span>${item.label}</span></label>`;
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
  for (const config of rowConfigs) {
    const holder = document.querySelector(`.style-tools[data-prefix="${config.prefix}"]`);
    if (!holder) {
      continue;
    }
    holder.innerHTML = styleToolbarHtml(config.prefix, config);
  }
}

function bindStyleConflicts() {
  for (const { prefix } of rowConfigs) {
    const bold = getEl(`${prefix}Bold`);
    const strong = getEl(`${prefix}Strong`);
    const headingToggles = form.querySelectorAll(`input[name="${prefix}Heading"]`);
    if (!bold || !strong) {
      continue;
    }

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
}

function getFormat(prefix) {
  const checkedAlign = form.querySelector(`input[name="${prefix}Align"]:checked`);
  const checkedHeading = form.querySelector(`input[name="${prefix}Heading"]:checked`);
  return {
    align: checkedAlign ? checkedAlign.value : "center",
    tag: checkedHeading ? checkedHeading.value : "none",
    bold: getEl(`${prefix}Bold`).checked,
    italic: getEl(`${prefix}Italic`).checked,
    strong: getEl(`${prefix}Strong`).checked,
    code: getEl(`${prefix}Code`).checked,
  };
}

function textToHtml(value, keepLineBreaks = false) {
  const escaped = escapeHtml(value);
  if (!keepLineBreaks) {
    return escaped;
  }
  return escaped.replaceAll("\n", "<br />");
}

function rawTextToHtml(value, keepLineBreaks = false) {
  const raw = String(value);
  if (!keepLineBreaks) {
    return raw;
  }
  return raw.replaceAll("\n", "<br />");
}

function wrapTextForHeading(textHtml, format) {
  let value = textHtml;
  if (format.code) {
    value = `<code>${value}</code>`;
  }
  if (format.italic) {
    value = `<i>${value}</i>`;
  }
  if (format.strong) {
    value = `<strong>${value}</strong>`;
  } else if (format.bold) {
    value = `<b>${value}</b>`;
  }
  return value;
}

function wrapTextForPlain(textHtml, format) {
  let value = textHtml;
  if (format.strong) {
    value = `<strong>${value}</strong>`;
  } else if (format.bold) {
    value = `<b>${value}</b>`;
  }
  if (format.italic) {
    value = `<i>${value}</i>`;
  }
  if (format.code) {
    value = `<code>${value}</code>`;
  }
  return value;
}

function buildRowDiv({ align, contentHtml }) {
  const safeAlign = ["left", "center", "right"].includes(align) ? align : "center";
  return `<div align="${safeAlign}">${contentHtml}</div>`;
}

function buildTextRow({ align, icon, textHtml, format }) {
  const iconHtml = icon ? `${escapeHtml(icon)} ` : "";
  if (format.tag !== "none") {
    const textOnly = wrapTextForHeading(textHtml, format);
    return buildRowDiv({ align, contentHtml: `<${format.tag}>${iconHtml}${textOnly}</${format.tag}>` });
  }

  const textOnly = wrapTextForPlain(textHtml, format);
  return buildRowDiv({ align, contentHtml: `${iconHtml}${textOnly}` });
}

function getOrderedRowKeys() {
  return Array.from(form.querySelectorAll("fieldset[data-row-key]"))
    .map((fieldset) => fieldset.getAttribute("data-row-key"))
    .filter(Boolean);
}

function reorderFieldsets(rowOrder) {
  const map = new Map(
    Array.from(form.querySelectorAll("fieldset[data-row-key]")).map((fieldset) => [fieldset.getAttribute("data-row-key"), fieldset])
  );
  for (const key of rowOrder) {
    const fieldset = map.get(key);
    if (!fieldset) {
      continue;
    }
    form.appendChild(fieldset);
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

function getConfigLocationEntries() {
  return Array.from(configLocationsEl.querySelectorAll(".config-location-row"))
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

function buildNoteHtml() {
  const byKey = {};
  const lines = [];

  if (iconResolvedSrc) {
    byKey.icon = [buildRowDiv({ align: getIconAlign(), contentHtml: `<img src="${escapeHtml(iconResolvedSrc)}" alt="App icon" />` })];
  }

  const titleText = getEl("titleText").value.trim();
  if (titleText) {
    const format = getFormat("title");
    byKey.title = [buildTextRow({ align: format.align, icon: getEl("titleEmoji").value, textHtml: textToHtml(titleText), format })];
  }

  const fqdnLabel = getEl("fqdnLabel").value.trim();
  if (fqdnLabel) {
    const format = getFormat("fqdn");
    const fqdnUrl = getEl("fqdnUrl").value.trim();
    const label = textToHtml(fqdnLabel);
    const linked = fqdnUrl
      ? `<a href="${escapeHtml(fqdnUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`
      : label;
    byKey.fqdn = [buildTextRow({ align: format.align, icon: getEl("fqdnEmoji").value, textHtml: linked, format })];
  }

  const networkText = getEl("networkText").value.trim();
  if (networkText) {
    const format = getFormat("network");
    byKey.network = [buildTextRow({ align: format.align, icon: getEl("networkEmoji").value, textHtml: textToHtml(networkText), format })];
  }

  const configLocations = getConfigLocationEntries();
  if (configLocations.length > 0) {
    const format = getFormat("config");
    byKey.config = configLocations.map((location) =>
      buildTextRow({ align: format.align, icon: location.icon, textHtml: textToHtml(location.value), format })
    );
  }

  const customText = getEl("customText").value.trim();
  if (customText) {
    const format = getFormat("custom");
    byKey.custom = [buildTextRow({ align: format.align, icon: "", textHtml: rawTextToHtml(customText, true), format })];
  }

  for (const key of getOrderedRowKeys()) {
    const section = byKey[key];
    if (!section) {
      continue;
    }
    lines.push(...section);
  }

  return lines.join("\n");
}

function updateLengthState(noteHtml) {
  const len = noteHtml.length;
  charCountEl.textContent = `${len} / ${MAX_OUTPUT_LENGTH}`;

  if (len > MAX_OUTPUT_LENGTH) {
    charWarningEl.textContent = `Too long by ${len - MAX_OUTPUT_LENGTH} characters.`;
    copyBtn.disabled = true;
  } else {
    charWarningEl.textContent = "";
    copyBtn.disabled = len === 0;
  }
}

function clearTextFields() {
  iconUrlEl.value = "";
  getEl("titleText").value = "";
  getEl("fqdnLabel").value = "";
  getEl("fqdnUrl").value = "";
  getEl("networkText").value = "";
  getEl("customText").value = "";

  const configInputs = configLocationsEl.querySelectorAll('input[data-config-location="1"]');
  for (const input of configInputs) {
    input.value = "";
  }

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

function collectSettings() {
  const rows = {};
  for (const { prefix } of rowConfigs) {
    rows[prefix] = collectRowState(prefix);
  }

  return {
    version: 1,
    rowOrder: getOrderedRowKeys(),
    theme: activeTheme,
    icon: {
      align: getSelectedRadioValue("iconAlign", "center"),
      mode: getIconMode(),
      url: iconUrlEl.value,
      embedSvg: iconEmbedSvgEl.checked,
      scale: iconScaleEl.value,
      colorVariant: getIconColorVariant(),
      uploadSvgText,
    },
    fields: {
      titleText: getEl("titleText").value,
      fqdnLabel: getEl("fqdnLabel").value,
      fqdnUrl: getEl("fqdnUrl").value,
      networkText: getEl("networkText").value,
      configLocations: getConfigLocationEntries(),
      customText: getEl("customText").value,
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

async function applySettings(settings) {
  if (!settings || typeof settings !== "object") {
    throw new Error("Invalid settings format.");
  }

  const requestedOrder = Array.isArray(settings.rowOrder) ? settings.rowOrder.filter((k) => ROW_KEYS.includes(k)) : [];
  const ordered = requestedOrder.length > 0 ? requestedOrder : ROW_KEYS;
  reorderFieldsets(ordered);

  if (settings.theme === "light" || settings.theme === "dark") {
    setTheme(settings.theme);
  }

  if (settings.icon && typeof settings.icon === "object") {
    if (typeof settings.icon.align === "string") {
      setSelectedRadioValue("iconAlign", settings.icon.align);
    }
    if (typeof settings.icon.mode === "string") {
      setIconMode(settings.icon.mode);
    }
    if (typeof settings.icon.url === "string") {
      iconUrlEl.value = settings.icon.url;
    }
    if (typeof settings.icon.embedSvg === "boolean") {
      iconEmbedSvgEl.checked = settings.icon.embedSvg;
    }
    if (typeof settings.icon.scale === "string" || typeof settings.icon.scale === "number") {
      iconScaleEl.value = String(settings.icon.scale);
    }
    if (typeof settings.icon.colorVariant === "string") {
      setSelectedRadioValue("iconColorVariant", settings.icon.colorVariant);
    }
    uploadSvgText = typeof settings.icon.uploadSvgText === "string" ? settings.icon.uploadSvgText : "";
  }

  if (settings.fields && typeof settings.fields === "object") {
    if (typeof settings.fields.titleText === "string") getEl("titleText").value = settings.fields.titleText;
    if (typeof settings.fields.fqdnLabel === "string") getEl("fqdnLabel").value = settings.fields.fqdnLabel;
    if (typeof settings.fields.fqdnUrl === "string") getEl("fqdnUrl").value = settings.fields.fqdnUrl;
    if (typeof settings.fields.networkText === "string") getEl("networkText").value = settings.fields.networkText;
    if (typeof settings.fields.customText === "string") getEl("customText").value = settings.fields.customText;

    if (Array.isArray(settings.fields.configLocations)) {
      configLocationsEl.innerHTML = "";
      const values = settings.fields.configLocations.length > 0 ? settings.fields.configLocations : [{ icon: "📁", value: "" }];
      for (const value of values) {
        if (value && typeof value === "object") {
          configLocationsEl.append(createConfigLocationInput(String(value.value || ""), String(value.icon || "📁")));
        } else {
          configLocationsEl.append(createConfigLocationInput(String(value), "📁"));
        }
      }
    }
  }

  if (settings.rows && typeof settings.rows === "object") {
    for (const { prefix } of rowConfigs) {
      applyRowState(prefix, settings.rows[prefix] || {});
    }
  }

  await prepareIcon();
}

function exportSettings() {
  const payload = JSON.stringify(collectSettings(), null, 2);
  const blob = new Blob([payload], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "pve-notebuddy-settings.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function importSettingsFromFile(event) {
  const [file] = event.target.files || [];
  if (!file) {
    return;
  }

  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    await applySettings(parsed);
  } catch {
    setIconStatus("Import failed: invalid JSON file.", true);
  } finally {
    importFileEl.value = "";
  }
}

async function loadPresetByNumber(number) {
  const preset = Number.parseInt(String(number), 10);
  if (!Number.isFinite(preset) || preset < 1 || preset > 5) {
    return;
  }

  try {
    const res = await fetch(`./presets/pve-notebuddy-preset${preset}.json`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    const parsed = await res.json();
    await applySettings(parsed);
    setIconStatus(`Preset ${preset} loaded.`);
  } catch {
    setIconStatus(`Could not load preset ${preset}.`, true);
  }
}

function renderOutput() {
  iconScaleValueEl.textContent = `${iconScaleEl.value} px`;
  const noteHtml = buildNoteHtml();
  outputEl.value = noteHtml;
  previewCard.innerHTML = noteHtml;
  updateLengthState(noteHtml);
}

function iconCanUseScale() {
  const mode = getIconMode();
  if (mode === "upload") {
    return Boolean(uploadSvgText);
  }

  if (mode === "external") {
    const url = iconUrlEl.value.trim();
    return isSvgUrl(url) && iconEmbedSvgEl.checked;
  }

  return false;
}

function updateIconControls() {
  const mode = getIconMode();
  iconUrlWrap.classList.toggle("hidden", mode !== "external");
  iconSelfhstWrap.classList.toggle("hidden", mode !== "external");
  iconEmbedWrap.classList.toggle("hidden", mode !== "external");
  iconUploadWrap.classList.toggle("hidden", mode !== "upload");

  const url = iconUrlEl.value.trim();
  const rasterLink = mode === "external" && isRasterUrl(url);
  const externalSvg = mode === "external" && isSvgUrl(url);
  const showVariantControls = mode === "upload" || externalSvg;
  if (iconVariantWrapEl) {
    iconVariantWrapEl.classList.toggle("hidden", !showVariantControls);
  }
  if (iconScaleWrapEl) {
    iconScaleWrapEl.classList.toggle("hidden", mode === "none");
  }

  if (rasterLink) {
    iconEmbedSvgEl.checked = false;
    iconEmbedSvgEl.disabled = true;
  } else {
    iconEmbedSvgEl.disabled = false;
  }

  iconScaleEl.disabled = !iconCanUseScale();
  const disableColor = !iconCanUseScale();
  for (const radio of iconColorVariantEls) {
    radio.disabled = disableColor;
  }
}

async function prepareIcon() {
  const token = ++prepareToken;
  updateIconControls();

  const mode = getIconMode();
  if (mode === "none") {
    iconResolvedSrc = "";
    setIconStatus("App-Icon disabled. Select a source to enable it again.");
    renderOutput();
    return;
  }

  if (mode === "upload") {
    if (!uploadSvgText) {
      iconResolvedSrc = "";
      setIconStatus("Upload an SVG to embed the icon.");
      renderOutput();
      return;
    }

    try {
      const resized = resizeSvg(uploadSvgText, iconScaleEl.value);
      const colorized = transformSvgColors(resized, getIconColorVariant());
      if (token !== prepareToken) {
        return;
      }
      iconResolvedSrc = encodeSvgDataUrl(colorized);
      setIconStatus(`Uploaded SVG embedded at ${iconScaleEl.value}px width.`);
      updateIconControls();
      renderOutput();
      return;
    } catch {
      iconResolvedSrc = "";
      setIconStatus("Could not process uploaded SVG.", true);
      renderOutput();
      return;
    }
  }

  const url = iconUrlEl.value.trim();
  if (!url) {
    iconResolvedSrc = "";
    setIconStatus("Add an external image URL.");
    renderOutput();
    return;
  }

  if (isRasterUrl(url)) {
    iconResolvedSrc = url;
    setIconStatus("Raster image detected: link-only mode (no scaling). Use CDN-sized assets.");
    updateIconControls();
    renderOutput();
    return;
  }

  if (!isSvgUrl(url)) {
    iconResolvedSrc = url;
    setIconStatus("Unknown extension: using direct link.");
    updateIconControls();
    renderOutput();
    return;
  }

  if (!iconEmbedSvgEl.checked) {
    iconResolvedSrc = url;
    setIconStatus("SVG link mode enabled. Scaling is disabled until embedding is enabled.");
    updateIconControls();
    renderOutput();
    return;
  }

  setIconStatus("Preparing embedded SVG...");
  try {
    const svgText = await getExternalSvgText(url);
    const resized = resizeSvg(svgText, iconScaleEl.value);
    const colorized = transformSvgColors(resized, getIconColorVariant());
    if (token !== prepareToken) {
      return;
    }

    iconResolvedSrc = encodeSvgDataUrl(colorized);
    setIconStatus(`External SVG embedded at ${iconScaleEl.value}px width.`);
    updateIconControls();
    renderOutput();
  } catch {
    if (token !== prepareToken) {
      return;
    }

    iconResolvedSrc = url;
    setIconStatus("Embedding failed. Falling back to direct SVG link.", true);
    updateIconControls();
    renderOutput();
  }
}

function setTheme(theme) {
  activeTheme = theme === "light" ? "light" : "dark";
  previewShell.classList.toggle("dark", activeTheme === "dark");
  previewShell.classList.toggle("light", activeTheme === "light");
  if (themeToggleBtn) {
    themeToggleBtn.setAttribute("aria-pressed", activeTheme === "light" ? "true" : "false");
    themeToggleBtn.setAttribute("title", activeTheme === "dark" ? "Switch to light mode" : "Switch to dark mode");
  }
  if (themeIconEl) {
    themeIconEl.textContent = activeTheme === "dark" ? "🌙" : "☀️";
  }
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
  iconClear.textContent = "X";
  iconClear.title = "Clear icon";
  iconClear.addEventListener("click", () => {
    iconInput.value = "";
    renderOutput();
  });

  iconWrap.append(iconInput, iconClear);
  iconField.append(iconWrap);

  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "/ETC/APP/CONFIG.YML";
  input.value = initialValue;
  input.setAttribute("data-config-location", "1");

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "panel-action ghost";
  remove.textContent = "X";
  remove.addEventListener("click", () => {
    row.remove();
    renderOutput();
  });

  row.append(iconField, input, remove);
  iconInput.addEventListener("input", renderOutput);
  input.addEventListener("input", renderOutput);
  return row;
}

async function onIconUploadChange(event) {
  const [file] = event.target.files;
  if (!file) {
    uploadSvgText = "";
    await prepareIcon();
    return;
  }

  const byType = file.type === "image/svg+xml";
  const byName = /\.svg$/i.test(file.name);
  if (!byType && !byName) {
    iconUploadEl.value = "";
    uploadSvgText = "";
    setIconStatus("Only SVG upload is allowed. Use a CDN link for PNG/JPG/WEBP.", true);
    await prepareIcon();
    return;
  }

  try {
    uploadSvgText = await readTextFile(file);
    await prepareIcon();
  } catch {
    uploadSvgText = "";
    setIconStatus("Could not read uploaded SVG.", true);
    await prepareIcon();
  }
}

async function copyOutput() {
  if (copyBtn.disabled) {
    return;
  }

  try {
    await navigator.clipboard.writeText(outputEl.value);
    copyBtn.textContent = "Copied";
    setTimeout(() => {
      copyBtn.textContent = "Copy HTML";
    }, 1200);
  } catch {
    copyBtn.textContent = "Clipboard blocked";
    setTimeout(() => {
      copyBtn.textContent = "Copy HTML";
    }, 1400);
  }
}

async function loadGithubStarCount() {
  if (!githubStarCountEl) {
    return;
  }

  githubStarCountEl.textContent = "--";

  try {
    const res = await fetch("https://api.github.com/repos/JangaJones/pve-notebuddy");
    if (!res.ok) {
      return;
    }

    const data = await res.json();
    const stars = Number.parseInt(String(data?.stargazers_count ?? ""), 10);
    if (!Number.isFinite(stars)) {
      return;
    }

    githubStarCountEl.textContent = new Intl.NumberFormat("en-US").format(stars);
  } catch {
    // Keep fallback display when API is unavailable or rate-limited.
  }
}

function bootstrap() {
  mountStyleToolbars();
  bindStyleConflicts();

  configLocationsEl.append(createConfigLocationInput("/etc/app/config.yml"));

  addConfigBtn.addEventListener("click", () => {
    configLocationsEl.append(createConfigLocationInput(""));
    renderOutput();
  });

  form.addEventListener("input", () => {
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

    const clearBtn = target.closest(".icon-clear");
    if (!clearBtn) {
      return;
    }

    const inputId = clearBtn.getAttribute("data-target");
    const input = inputId ? getEl(inputId) : null;
    if (input) {
      input.value = "";
      renderOutput();
    }
  });

  clearBtn.addEventListener("click", clearTextFields);
  exportBtn.addEventListener("click", exportSettings);
  importBtn.addEventListener("click", () => importFileEl.click());
  importFileEl.addEventListener("change", importSettingsFromFile);
  for (const presetBtn of presetBtnEls) {
    presetBtn.addEventListener("click", () => {
      loadPresetByNumber(presetBtn.getAttribute("data-preset"));
    });
  }

  for (const radio of iconModeRadios) {
    radio.addEventListener("change", prepareIcon);
  }
  iconUrlEl.addEventListener("input", prepareIcon);
  iconEmbedSvgEl.addEventListener("change", prepareIcon);
  iconScaleEl.addEventListener("input", prepareIcon);
  iconUploadEl.addEventListener("change", onIconUploadChange);
  for (const radio of iconColorVariantEls) {
    radio.addEventListener("change", prepareIcon);
  }

  themeToggleBtn.addEventListener("click", () => {
    setTheme(activeTheme === "dark" ? "light" : "dark");
  });

  copyBtn.addEventListener("click", copyOutput);

  setTheme("dark");
  prepareIcon();
  loadGithubStarCount();
}

bootstrap();
