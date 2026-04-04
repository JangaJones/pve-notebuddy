import { isPlainObject } from "../core/utils.js";

export function createTemplateSettingsSchema({
  assertTextSizeWithinLimit,
  maxUploadSvgBytes,
  maxImportFileBytes,
  isValidRowKey,
  isCustomRowKey,
  normalizeCustomRowKey,
}) {
  function assertMaxTextBytes(value, maxBytes, label) {
    if (typeof value !== "string") {
      throw new Error(`${label} must be a string.`);
    }
    assertTextSizeWithinLimit(value, maxBytes, label);
  }

  function assertEnumValue(value, allowed, label) {
    if (value !== undefined && !allowed.includes(value)) {
      throw new Error(`${label} contains an unsupported value.`);
    }
  }

  function isLegacySettingsV1(value) {
    if (value === 1) {
      return true;
    }
    const raw = String(value || "").trim().toLowerCase();
    return raw === "1" || raw === "v1";
  }

  function getSettingsSchemaMode(settings) {
    if (!isPlainObject(settings)) {
      return "modern";
    }
    if (isLegacySettingsV1(settings.version)) {
      return "legacy";
    }
    if (settings.version === undefined && isPlainObject(settings.fields)) {
      const legacyFieldKeys = ["fqdnLabel", "fqdnUrl", "networkText", "customText"];
      if (legacyFieldKeys.some((key) => key in settings.fields)) {
        return "legacy";
      }
    }
    return "modern";
  }

  function validateSettingsSchema(settings, source = "settings") {
    if (!isPlainObject(settings)) {
      throw new Error("Invalid settings format.");
    }

    const topAllowed = new Set(["version", "rowOrder", "theme", "icon", "fields", "rows"]);
    for (const key of Object.keys(settings)) {
      if (!topAllowed.has(key)) {
        throw new Error(`${source} contains unsupported key "${key}".`);
      }
    }

    if (settings.version !== undefined && typeof settings.version !== "string" && typeof settings.version !== "number") {
      throw new Error(`${source} version must be a string or number.`);
    }
    const schemaMode = getSettingsSchemaMode(settings);

    if (settings.rowOrder !== undefined) {
      if (Array.isArray(settings.rowOrder)) {
        for (const key of settings.rowOrder) {
          if (!isValidRowKey(key)) {
            throw new Error(`${source} rowOrder contains an unknown row key.`);
          }
        }
      } else if (isPlainObject(settings.rowOrder)) {
        for (const [key, value] of Object.entries(settings.rowOrder)) {
          if (!isValidRowKey(key)) {
            throw new Error(`${source} rowOrder contains an unknown row key.`);
          }
          if (!["0", "1", 0, 1, false, true].includes(value)) {
            throw new Error(`${source} rowOrder visibility must be 0/1/true/false.`);
          }
        }
      } else {
        throw new Error(`${source} rowOrder must be an array or object.`);
      }
    }

    assertEnumValue(settings.theme, ["light", "dark"], `${source} theme`);

    if (settings.icon !== undefined) {
      if (!isPlainObject(settings.icon)) {
        throw new Error(`${source} icon must be an object.`);
      }
      const iconAllowed = new Set([
        "align",
        "mode",
        "url",
        "embedSvg",
        "resizeWithWsrv",
        "scale",
        "colorVariant",
        "uploadSvgText",
        "uploadImageDataUrl",
        "galleryItems",
        "galleryColumns",
        "gallerySpacing",
      ]);
      for (const key of Object.keys(settings.icon)) {
        if (!iconAllowed.has(key)) {
          throw new Error(`${source} icon contains unsupported key "${key}".`);
        }
      }
      assertEnumValue(settings.icon.align, ["left", "center", "right"], `${source} icon.align`);
      // Keep "none" for backward compatibility with older exported templates.
      assertEnumValue(settings.icon.mode, ["external", "upload", "gallery", "none"], `${source} icon.mode`);
      assertEnumValue(settings.icon.colorVariant, ["original", "dark", "light"], `${source} icon.colorVariant`);
      if (settings.icon.url !== undefined) assertMaxTextBytes(settings.icon.url, 4096, `${source} icon.url`);
      if (settings.icon.uploadSvgText !== undefined) {
        assertMaxTextBytes(settings.icon.uploadSvgText, maxUploadSvgBytes, `${source} icon.uploadSvgText`);
      }
      if (settings.icon.uploadImageDataUrl !== undefined) {
        assertMaxTextBytes(settings.icon.uploadImageDataUrl, maxImportFileBytes, `${source} icon.uploadImageDataUrl`);
      }
      if (settings.icon.galleryItems !== undefined) {
        if (!Array.isArray(settings.icon.galleryItems)) {
          throw new Error(`${source} icon.galleryItems must be an array.`);
        }
        if (settings.icon.galleryItems.length > 20) {
          throw new Error(`${source} icon.galleryItems exceeds maximum entries.`);
        }
        for (const item of settings.icon.galleryItems) {
          assertMaxTextBytes(String(item || ""), 4096, `${source} icon.galleryItems item`);
        }
      }
      if (settings.icon.embedSvg !== undefined && typeof settings.icon.embedSvg !== "boolean") {
        throw new Error(`${source} icon.embedSvg must be boolean.`);
      }
      if (settings.icon.resizeWithWsrv !== undefined && typeof settings.icon.resizeWithWsrv !== "boolean") {
        throw new Error(`${source} icon.resizeWithWsrv must be boolean.`);
      }
      if (settings.icon.galleryColumns !== undefined) {
        const columns = Number.parseInt(String(settings.icon.galleryColumns), 10);
        if (!Number.isFinite(columns) || columns < 1 || columns > 8) {
          throw new Error(`${source} icon.galleryColumns must be between 1 and 8.`);
        }
      }
      assertEnumValue(settings.icon.gallerySpacing, ["s", "m", "xl"], `${source} icon.gallerySpacing`);
      if (settings.icon.scale !== undefined) {
        const scale = Number.parseInt(String(settings.icon.scale), 10);
        if (!Number.isFinite(scale) || scale < 32 || scale > 320) {
          throw new Error(`${source} icon.scale must be between 32 and 320.`);
        }
      }
    }

    if (settings.fields !== undefined) {
      if (!isPlainObject(settings.fields)) {
        throw new Error(`${source} fields must be an object.`);
      }
      const fieldAllowed =
        schemaMode === "legacy"
          ? new Set(["titleText", "fqdnLabel", "fqdnUrl", "networkText", "configLocations", "customText"])
          : new Set(["titleText", "hostEntries", "networkEntries", "configLocations", "customRows"]);
      for (const key of Object.keys(settings.fields)) {
        if (!fieldAllowed.has(key)) {
          throw new Error(`${source} fields contains unsupported key "${key}".`);
        }
      }

      if (settings.fields.titleText !== undefined) assertMaxTextBytes(settings.fields.titleText, 2048, `${source} fields.titleText`);
      if (schemaMode === "legacy") {
        if (settings.fields.fqdnLabel !== undefined) assertMaxTextBytes(settings.fields.fqdnLabel, 2048, `${source} fields.fqdnLabel`);
        if (settings.fields.fqdnUrl !== undefined) assertMaxTextBytes(settings.fields.fqdnUrl, 4096, `${source} fields.fqdnUrl`);
        if (settings.fields.networkText !== undefined) assertMaxTextBytes(settings.fields.networkText, 4096, `${source} fields.networkText`);
        if (settings.fields.customText !== undefined) {
          assertMaxTextBytes(settings.fields.customText, maxImportFileBytes, `${source} fields.customText`);
        }
      }
      if (schemaMode !== "legacy" && settings.fields.customRows !== undefined) {
        if (!Array.isArray(settings.fields.customRows)) {
          throw new Error(`${source} fields.customRows must be an array.`);
        }
        if (settings.fields.customRows.length > 128) {
          throw new Error(`${source} fields.customRows exceeds maximum entries.`);
        }
        for (const entry of settings.fields.customRows) {
          if (!isPlainObject(entry)) {
            throw new Error(`${source} custom row must be an object.`);
          }
          const allowedKeys = new Set(["id", "text"]);
          for (const key of Object.keys(entry)) {
            if (!allowedKeys.has(key)) {
              throw new Error(`${source} custom row contains unsupported key "${key}".`);
            }
          }
          if (entry.id !== undefined) {
            const normalized = normalizeCustomRowKey(entry.id);
            if (!normalized) {
              throw new Error(`${source} custom row id must be "custom" or "customN".`);
            }
          }
          if (entry.text !== undefined) assertMaxTextBytes(entry.text, maxImportFileBytes, `${source} custom row text`);
        }
      }

      if (schemaMode !== "legacy" && settings.fields.hostEntries !== undefined) {
        if (!Array.isArray(settings.fields.hostEntries)) {
          throw new Error(`${source} fields.hostEntries must be an array.`);
        }
        if (settings.fields.hostEntries.length > 128) {
          throw new Error(`${source} fields.hostEntries exceeds maximum entries.`);
        }
        for (const entry of settings.fields.hostEntries) {
          if (!isPlainObject(entry)) {
            throw new Error(`${source} host entry must be an object.`);
          }
          const allowedKeys = new Set(["icon", "label", "url"]);
          for (const key of Object.keys(entry)) {
            if (!allowedKeys.has(key)) {
              throw new Error(`${source} host entry contains unsupported key "${key}".`);
            }
          }
          if (entry.icon !== undefined) assertMaxTextBytes(entry.icon, 64, `${source} host entry icon`);
          if (entry.label !== undefined) assertMaxTextBytes(entry.label, 2048, `${source} host entry label`);
          if (entry.url !== undefined) assertMaxTextBytes(entry.url, 4096, `${source} host entry url`);
        }
      }

      if (schemaMode !== "legacy" && settings.fields.networkEntries !== undefined) {
        if (!Array.isArray(settings.fields.networkEntries)) {
          throw new Error(`${source} fields.networkEntries must be an array.`);
        }
        if (settings.fields.networkEntries.length > 128) {
          throw new Error(`${source} fields.networkEntries exceeds maximum entries.`);
        }
        for (const entry of settings.fields.networkEntries) {
          if (!isPlainObject(entry)) {
            throw new Error(`${source} network entry must be an object.`);
          }
          const allowedKeys = new Set(["icon", "value"]);
          for (const key of Object.keys(entry)) {
            if (!allowedKeys.has(key)) {
              throw new Error(`${source} network entry contains unsupported key "${key}".`);
            }
          }
          if (entry.icon !== undefined) assertMaxTextBytes(entry.icon, 64, `${source} network entry icon`);
          if (entry.value !== undefined) assertMaxTextBytes(entry.value, 4096, `${source} network entry value`);
        }
      }

      if (settings.fields.configLocations !== undefined) {
        if (!Array.isArray(settings.fields.configLocations)) {
          throw new Error(`${source} fields.configLocations must be an array.`);
        }
        if (settings.fields.configLocations.length > 128) {
          throw new Error(`${source} fields.configLocations exceeds maximum entries.`);
        }
        for (const entry of settings.fields.configLocations) {
          if (typeof entry === "string") {
            assertMaxTextBytes(entry, 4096, `${source} config location`);
            continue;
          }
          if (!isPlainObject(entry)) {
            throw new Error(`${source} config location entries must be strings or objects.`);
          }
          const allowedKeys = new Set(["icon", "value"]);
          for (const key of Object.keys(entry)) {
            if (!allowedKeys.has(key)) {
              throw new Error(`${source} config location contains unsupported key "${key}".`);
            }
          }
          if (entry.icon !== undefined) assertMaxTextBytes(entry.icon, 64, `${source} config location icon`);
          if (entry.value !== undefined) assertMaxTextBytes(entry.value, 4096, `${source} config location value`);
        }
      }
    }

    if (settings.rows !== undefined) {
      if (!isPlainObject(settings.rows)) {
        throw new Error(`${source} rows must be an object.`);
      }
      for (const [prefix, row] of Object.entries(settings.rows)) {
        if (!(isCustomRowKey(prefix) || normalizeCustomRowKey(prefix) === "custom1" || ["title", "fqdn", "network", "config"].includes(prefix))) {
          throw new Error(`${source} rows contains unknown row "${prefix}".`);
        }
        if (!isPlainObject(row)) {
          throw new Error(`${source} row "${prefix}" must be an object.`);
        }
        const rowAllowed = new Set(["emoji", "align", "heading", "bold", "italic", "strong", "code"]);
        for (const key of Object.keys(row)) {
          if (!rowAllowed.has(key)) {
            throw new Error(`${source} row "${prefix}" contains unsupported key "${key}".`);
          }
        }
        if (row.emoji !== undefined) assertMaxTextBytes(row.emoji, 64, `${source} row "${prefix}" emoji`);
        assertEnumValue(row.align, ["left", "center", "right"], `${source} row "${prefix}" align`);
        assertEnumValue(row.heading, ["", "h1", "h2", "h3", "h4", "h5"], `${source} row "${prefix}" heading`);
        for (const flag of ["bold", "italic", "strong", "code"]) {
          if (row[flag] !== undefined && typeof row[flag] !== "boolean") {
            throw new Error(`${source} row "${prefix}" ${flag} must be boolean.`);
          }
        }
      }
    }
  }

  return {
    validateSettingsSchema,
  };
}
