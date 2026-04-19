import {
  TEMPLATE_DOCUMENT_TYPES,
  assertTemplateDocument,
  createTemplateDocumentEnvelope,
} from "./template-document-schema.js";
import {
  createTemplateDocumentFromSettings,
  extractRuntimeSettingsFromTemplateDocument,
  mergeDesignIntoSnapshotDocument,
} from "./template-document-model.js";

function assertDocumentType(type) {
  if (!Object.values(TEMPLATE_DOCUMENT_TYPES).includes(type)) {
    throw new Error(`Unsupported template document type "${String(type || "")}".`);
  }
}

// Phase 1 boundary: this is intentionally a thin envelope wrapper.
// Payload mapping to the new block architecture will be implemented later.
export function toTemplateDocument({ appVersion, type, name, payload }) {
  assertDocumentType(type);
  return createTemplateDocumentEnvelope({
    appVersion,
    type,
    name,
    payload,
  });
}

// Phase 1 boundary: this only validates and returns the payload untouched.
export function fromTemplateDocument(document, options = {}) {
  const source = options && typeof options === "object" ? String(options.source || "template document") : "template document";
  assertTemplateDocument(document, source);
  return {
    meta: document.meta,
    payload: document.payload,
  };
}

export function toTemplateDocumentFromSettings(settings, { appVersion, type, name } = {}) {
  return createTemplateDocumentFromSettings(settings, { appVersion, type, name });
}

export function toRuntimeSettingsFromTemplateDocument(document, options = {}) {
  return extractRuntimeSettingsFromTemplateDocument(document, options);
}

export function mergeDesignDocumentIntoSnapshot(snapshotDocument, designDocument, options = {}) {
  return mergeDesignIntoSnapshotDocument(snapshotDocument, designDocument, options);
}
