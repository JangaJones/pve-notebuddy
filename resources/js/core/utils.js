export function isPlainObject(value) {
  return Object.prototype.toString.call(value) === "[object Object]";
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function formatBytes(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) {
    return "0 B";
  }
  if (value >= 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (value >= 1024) {
    return `${Math.round(value / 1024)} KB`;
  }
  return `${Math.round(value)} B`;
}

export function getTextByteLength(text) {
  return new TextEncoder().encode(String(text || "")).length;
}

export function assertFileSizeWithinLimit(file, maxBytes, label) {
  if (file && Number.isFinite(file.size) && file.size > maxBytes) {
    throw new Error(`${label} exceeds the ${formatBytes(maxBytes)} limit.`);
  }
}

export function assertTextSizeWithinLimit(text, maxBytes, label) {
  if (getTextByteLength(text) > maxBytes) {
    throw new Error(`${label} exceeds the ${formatBytes(maxBytes)} limit.`);
  }
}

export function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsText(file);
  });
}

export function readDataUrlFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Could not read file."));
    reader.readAsDataURL(file);
  });
}

export function encodeSvgDataUrl(svgText) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svgText)}`;
}

export function isSvgUrl(url) {
  return /\.svg($|[?#])/i.test(url);
}

export function isRasterUrl(url) {
  return /\.(png|gif|jpe?g|tif|webp)($|[?#])/i.test(url);
}

export function isPathLikeUrl(value) {
  const raw = String(value || "").trim();
  return raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../");
}

export function hasAllowedIconImageExtension(value) {
  return /\.(svg|gif|jpe?g|png|tif|webp)($|[?#])/i.test(String(value || "").trim());
}

export function isAllowedIconImageUrl(value) {
  const raw = String(value || "").trim();
  if (!raw || !hasAllowedIconImageExtension(raw)) {
    return false;
  }
  return /^https?:/i.test(raw) || isPathLikeUrl(raw);
}

export function parseAbsoluteHttpUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return null;
  }

  try {
    const parsed = new URL(raw);
    return /^(https?:)$/i.test(parsed.protocol) ? parsed : null;
  } catch {
    return null;
  }
}

export function isCrossOriginHttpUrl(value) {
  const parsed = parseAbsoluteHttpUrl(value);
  if (!parsed) {
    return false;
  }
  return parsed.origin !== window.location.origin;
}

export function sanitizeFqdnHref(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }

  if (/^(https?:|mailto:)/i.test(raw)) {
    return raw;
  }

  if (/^[a-z0-9.-]+\.[a-z]{2,}(?:[/:?#]|$)/i.test(raw) || /^localhost(?:[/:?#]|$)/i.test(raw)) {
    return `https://${raw}`;
  }

  return "";
}
