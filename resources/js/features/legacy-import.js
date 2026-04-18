const LEGACY_VERSION_CUTOFF = "1.5.0";
const LEGACY_FIELD_KEYS = ["fqdnLabel", "fqdnUrl", "networkText", "customText"];

function parseVersionParts(value) {
  const raw = String(value || "")
    .trim()
    .replace(/^v/i, "");
  if (!raw) {
    return null;
  }

  const match = raw.match(/^(\d+)(?:\.(\d+))?(?:\.(\d+))?/);
  if (!match) {
    return null;
  }

  const major = Number.parseInt(match[1] || "0", 10);
  const minor = Number.parseInt(match[2] || "0", 10);
  const patch = Number.parseInt(match[3] || "0", 10);
  if (!Number.isFinite(major) || !Number.isFinite(minor) || !Number.isFinite(patch)) {
    return null;
  }
  return [major, minor, patch];
}

function compareVersionParts(left, right) {
  for (let index = 0; index < 3; index += 1) {
    const a = left[index] || 0;
    const b = right[index] || 0;
    if (a > b) {
      return 1;
    }
    if (a < b) {
      return -1;
    }
  }
  return 0;
}

function isLegacyV1Marker(value) {
  if (value === 1) {
    return true;
  }
  const raw = String(value || "").trim().toLowerCase();
  return raw === "1" || raw === "v1";
}

function hasLegacyFieldShape(settings) {
  if (!settings || typeof settings !== "object" || !settings.fields || typeof settings.fields !== "object") {
    return false;
  }
  return LEGACY_FIELD_KEYS.some((key) => key in settings.fields);
}

function isPre150Version(value) {
  const current = parseVersionParts(value);
  const cutoff = parseVersionParts(LEGACY_VERSION_CUTOFF);
  if (!current || !cutoff) {
    return false;
  }
  return compareVersionParts(current, cutoff) < 0;
}

export function detectLegacyImport(settings) {
  if (!settings || typeof settings !== "object") {
    return { isLegacy: false, reason: "" };
  }

  if (isLegacyV1Marker(settings.version)) {
    return { isLegacy: true, reason: "version-v1" };
  }
  if (isPre150Version(settings.version)) {
    return { isLegacy: true, reason: "version-pre-1.5.0" };
  }
  if (hasLegacyFieldShape(settings)) {
    return { isLegacy: true, reason: "legacy-fields-shape" };
  }

  return { isLegacy: false, reason: "" };
}

export function routeLegacyTemplateImport(settings, options = {}) {
  const source = options && typeof options === "object" ? String(options.source || "unknown") : "unknown";
  const legacy = detectLegacyImport(settings);

  if (legacy.isLegacy) {
    console.info(`[legacy-import] caught pre-1.5.0 payload (${legacy.reason}) from ${source}.`);
  }

  // Placeholder hook: structure normalization will be implemented later.
  return { settings, legacy };
}

