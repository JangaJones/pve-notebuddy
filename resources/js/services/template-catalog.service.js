function inferTagFromFile(file) {
  const clean = String(file || "").trim().toLowerCase();
  if (clean.startsWith("template-search/")) {
    return "PVE Scripts";
  }
  if (clean.startsWith("community-scripts/")) {
    return "PVE Scripts";
  }
  if (clean.startsWith("selfhst/")) {
    return "selfh.st";
  }
  if (clean.startsWith("custom/")) {
    return "Custom";
  }
  return "";
}

export function normalizeTemplateCatalog(payload) {
  const rows = Array.isArray(payload)
    ? payload
    : payload && Array.isArray(payload.templates)
      ? payload.templates
      : [];
  if (!Array.isArray(rows)) {
    return [];
  }

  const map = new Map();
  for (const row of rows) {
    if (typeof row === "string") {
      const file = row.replace(/^\.?\/*public\//i, "").trim();
      if (!file) {
        continue;
      }
      const name = file.replace(/\.json$/i, "").replace(/[-_]+/g, " ").trim() || file;
      map.set(file.toLowerCase(), { name, file, tag: inferTagFromFile(file) });
      continue;
    }

    if (row && typeof row === "object") {
      const fileRaw = typeof row.file === "string" ? row.file : "";
      const file = fileRaw.replace(/^\.?\/*public\//i, "").trim();
      if (!file) {
        continue;
      }
      const fallbackName = file.replace(/\.json$/i, "").replace(/[-_]+/g, " ").trim() || file;
      const name = typeof row.name === "string" && row.name.trim() ? row.name.trim() : fallbackName;
      const tag = typeof row.tag === "string" && row.tag.trim() ? row.tag.trim() : inferTagFromFile(file);
      map.set(file.toLowerCase(), { name, file, tag });
    }
  }

  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export async function loadPublicTemplateCatalog(fetchImpl = fetch) {
  try {
    const res = await fetchImpl("./templates/template-search-index.json", { cache: "no-store" });
    if (!res.ok) {
      return [];
    }
    const payload = await res.json();
    return normalizeTemplateCatalog(payload);
  } catch {
    return [];
  }
}
