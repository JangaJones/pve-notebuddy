import fs from "node:fs/promises";
import path from "node:path";

export function ensureString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function sanitizeSlug(input) {
  const base = String(input || "")
    .toLowerCase()
    .replace(/\.json$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "template";
}

export async function writeJson(filePath, data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, "utf8");
}

export async function collectJsonFilesRecursive(dir, baseDir = dir, excludeNames = new Set()) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectJsonFilesRecursive(fullPath, baseDir, excludeNames)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.toLowerCase().endsWith(".json")) {
      continue;
    }
    if (excludeNames.has(entry.name)) {
      continue;
    }
    const relPath = path.relative(baseDir, fullPath);
    files.push({ fullPath, relPath });
  }

  return files;
}
