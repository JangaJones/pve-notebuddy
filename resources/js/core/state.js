import { storageGetItem, storageRemoveItem, storageSetItem } from "../services/storage.service.js";
import { isPlainObject } from "./utils.js";

export function normalizeSidebarPanel(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (raw === "emoji" || raw === "settings") {
    return raw;
  }
  return "templates";
}

export function normalizeLocalTemplateCatalog(value) {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .filter((entry) => entry && typeof entry === "object")
    .map((entry) => ({
      id: typeof entry.id === "string" ? entry.id : "",
      name: typeof entry.name === "string" ? entry.name : "",
      settings: entry.settings && typeof entry.settings === "object" ? entry.settings : null,
      updatedAt: typeof entry.updatedAt === "number" ? entry.updatedAt : 0,
    }))
    .filter((entry) => entry.id && entry.name && entry.settings);
}

export function normalizeWeservDomain(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  const withScheme = /^[a-z]+:\/\//i.test(raw) ? raw : `https://${raw}`;
  try {
    const parsed = new URL(withScheme);
    if (!parsed.hostname) {
      return "";
    }
    return parsed.origin;
  } catch {
    return "";
  }
}

export function normalizeSvgPreferredMode(value) {
  const raw = String(value || "").trim().toLowerCase();
  return raw === "resize" ? "resize" : "embed";
}

export function normalizePreviewSidebarWidth(value, fallback = 468) {
  const numeric = Number.parseInt(String(value || ""), 10);
  const base = Number.isFinite(numeric) ? numeric : Number.parseInt(String(fallback || ""), 10);
  const safe = Number.isFinite(base) ? base : 468;
  return Math.min(600, Math.max(358, safe));
}

export function createAppStateStore({
  storageKey,
  legacyKeys = {},
  defaultState,
}) {
  function createDefaultAppState() {
    return {
      ui: {
        sidebarCollapsed: Boolean(defaultState?.ui?.sidebarCollapsed),
        activeSidebarPanel: normalizeSidebarPanel(defaultState?.ui?.activeSidebarPanel),
        previewSidebarWidth: normalizePreviewSidebarWidth(defaultState?.ui?.previewSidebarWidth, 468),
      },
      settings: {
        weservDomain: normalizeWeservDomain(defaultState?.settings?.weservDomain),
        svgPreferredMode: normalizeSvgPreferredMode(defaultState?.settings?.svgPreferredMode),
      },
      templates: {
        localCatalog: [],
      },
    };
  }

  function normalizeAppState(value) {
    const defaults = createDefaultAppState();
    if (!isPlainObject(value)) {
      return defaults;
    }

    const normalized = createDefaultAppState();
    if (isPlainObject(value.ui)) {
      if (typeof value.ui.sidebarCollapsed === "boolean") {
        normalized.ui.sidebarCollapsed = value.ui.sidebarCollapsed;
      }
      if (value.ui.activeSidebarPanel !== undefined) {
        normalized.ui.activeSidebarPanel = normalizeSidebarPanel(value.ui.activeSidebarPanel);
      }
      if (value.ui.previewSidebarWidth !== undefined) {
        normalized.ui.previewSidebarWidth = normalizePreviewSidebarWidth(
          value.ui.previewSidebarWidth,
          defaults.ui.previewSidebarWidth
        );
      }
    }
    if (isPlainObject(value.settings)) {
      normalized.settings.weservDomain = normalizeWeservDomain(value.settings.weservDomain);
      normalized.settings.svgPreferredMode = normalizeSvgPreferredMode(value.settings.svgPreferredMode);
    }
    if (isPlainObject(value.templates)) {
      normalized.templates.localCatalog = normalizeLocalTemplateCatalog(value.templates.localCatalog);
    }
    return normalized;
  }

  function readLegacySidebarCollapsed() {
    if (!legacyKeys.sidebarCollapsed) {
      return false;
    }
    return storageGetItem(legacyKeys.sidebarCollapsed) === "1";
  }

  function readLegacyLocalTemplateCatalog() {
    if (!legacyKeys.localTemplates) {
      return [];
    }
    try {
      const raw = storageGetItem(legacyKeys.localTemplates);
      if (!raw) {
        return [];
      }
      return normalizeLocalTemplateCatalog(JSON.parse(raw));
    } catch {
      return [];
    }
  }

  function clearLegacyStorageKeys() {
    if (legacyKeys.emojiRail) {
      storageRemoveItem(legacyKeys.emojiRail);
    }
    if (legacyKeys.localTemplates) {
      storageRemoveItem(legacyKeys.localTemplates);
    }
    if (legacyKeys.sidebarCollapsed) {
      storageRemoveItem(legacyKeys.sidebarCollapsed);
    }
  }

  function readAppState() {
    const defaults = createDefaultAppState();
    try {
      const raw = storageGetItem(storageKey);
      if (!raw) {
        defaults.ui.sidebarCollapsed = readLegacySidebarCollapsed();
        defaults.templates.localCatalog = readLegacyLocalTemplateCatalog();
        return defaults;
      }
      return normalizeAppState(JSON.parse(raw));
    } catch {
      return defaults;
    }
  }

  let appState = readAppState();

  function getState() {
    return appState;
  }

  function persist() {
    storageSetItem(storageKey, JSON.stringify(appState));
    clearLegacyStorageKeys();
  }

  function patch(patchFn) {
    patchFn(appState);
    appState = normalizeAppState(appState);
    persist();
  }

  function replace(nextState) {
    appState = normalizeAppState(nextState);
    persist();
  }

  return {
    getState,
    patch,
    replace,
    normalizeAppState,
  };
}
