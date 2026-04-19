import { isPlainObject } from "../core/utils.js";

export const TEMPLATE_DOCUMENT_FORMAT_VERSION = 1;
export const TEMPLATE_DOCUMENT_TYPES = Object.freeze({
  CONTENT_TEMPLATE: "content-template",
  DESIGN: "design",
  SNAPSHOT: "snapshot",
});
export const TEMPLATE_DOCUMENT_LEGACY_CUTOFF_VERSION = "1.5.0";

const TEMPLATE_DOCUMENT_TYPE_VALUES = Object.freeze([
  TEMPLATE_DOCUMENT_TYPES.CONTENT_TEMPLATE,
  TEMPLATE_DOCUMENT_TYPES.DESIGN,
  TEMPLATE_DOCUMENT_TYPES.SNAPSHOT,
]);

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

export function isTemplateDocumentType(value) {
  return TEMPLATE_DOCUMENT_TYPE_VALUES.includes(String(value || "").trim());
}

export function isPreLegacyCutoffVersion(value, cutoff = TEMPLATE_DOCUMENT_LEGACY_CUTOFF_VERSION) {
  const current = parseVersionParts(value);
  const boundary = parseVersionParts(cutoff);
  if (!current || !boundary) {
    return false;
  }
  return compareVersionParts(current, boundary) < 0;
}

export function isTemplateDocument(value) {
  if (!isPlainObject(value)) {
    return false;
  }
  if (!isPlainObject(value.meta) || !isPlainObject(value.payload)) {
    return false;
  }
  if (value.meta.formatVersion !== TEMPLATE_DOCUMENT_FORMAT_VERSION) {
    return false;
  }
  if (!isTemplateDocumentType(value.meta.type)) {
    return false;
  }
  if (typeof value.meta.appVersion !== "string" || !value.meta.appVersion.trim()) {
    return false;
  }
  return true;
}

export function assertTemplateDocument(value, source = "template document") {
  if (!isPlainObject(value)) {
    throw new Error(`${source} must be an object.`);
  }
  if (!isPlainObject(value.meta)) {
    throw new Error(`${source} meta must be an object.`);
  }
  if (!isPlainObject(value.payload)) {
    throw new Error(`${source} payload must be an object.`);
  }

  const metaAllowed = new Set(["formatVersion", "appVersion", "type", "name", "createdAt"]);
  for (const key of Object.keys(value.meta)) {
    if (!metaAllowed.has(key)) {
      throw new Error(`${source} meta contains unsupported key "${key}".`);
    }
  }

  if (value.meta.formatVersion !== TEMPLATE_DOCUMENT_FORMAT_VERSION) {
    throw new Error(`${source} meta.formatVersion is unsupported.`);
  }
  if (!isTemplateDocumentType(value.meta.type)) {
    throw new Error(`${source} meta.type is unsupported.`);
  }
  if (typeof value.meta.appVersion !== "string" || !value.meta.appVersion.trim()) {
    throw new Error(`${source} meta.appVersion must be a non-empty string.`);
  }
  if (value.meta.name !== undefined && typeof value.meta.name !== "string") {
    throw new Error(`${source} meta.name must be a string when provided.`);
  }
  if (value.meta.createdAt !== undefined && typeof value.meta.createdAt !== "string") {
    throw new Error(`${source} meta.createdAt must be a string when provided.`);
  }
}

export function createTemplateDocumentEnvelope({ appVersion, type, name, payload }) {
  const next = {
    meta: {
      formatVersion: TEMPLATE_DOCUMENT_FORMAT_VERSION,
      appVersion: String(appVersion || "").trim() || "dev",
      type: String(type || "").trim(),
      createdAt: new Date().toISOString(),
    },
    payload: isPlainObject(payload) ? payload : {},
  };

  if (typeof name === "string" && name.trim()) {
    next.meta.name = name.trim();
  }

  assertTemplateDocument(next, "template document");
  return next;
}

