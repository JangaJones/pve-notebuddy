#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { writeJson } from "./lib/script-utils.mjs";

const CDN_BASE = "https://cdn.jsdelivr.net/gh/selfhst/icons@main";
const INDEX_RAW_URL = "https://raw.githubusercontent.com/selfhst/icons/main/index.json";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const UPDATER_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_DIR = path.resolve(UPDATER_DIR, "..");

const TEMP_DIR = path.join(UPDATER_DIR, "temp", "selfhst");
const TEMP_INDEX_PATH = path.join(TEMP_DIR, "index.json");
const LOG_PATH = path.join(TEMP_DIR, "selfhst-log.json");
const OUTPUT_ICONS_DIR = path.join(REPO_DIR, "resources", "selfhst");
const OUTPUT_INDEX_PATH = path.join(REPO_DIR, "templates", "icon-sidepanel-index.json");
const DOWNLOAD_CONCURRENCY = Math.max(
  1,
  Number.parseInt(process.env.SELFHST_DOWNLOAD_CONCURRENCY || "", 10) || 12,
);

function renderProgress(label, current, total) {
  const safeTotal = Math.max(1, Number(total) || 1);
  const safeCurrent = Math.max(0, Math.min(Number(current) || 0, safeTotal));
  const width = 30;
  const ratio = safeCurrent / safeTotal;
  const filled = Math.round(width * ratio);
  const bar = `${"=".repeat(filled)}${" ".repeat(Math.max(0, width - filled))}`;
  process.stdout.write(`\r${label} [${bar}] ${safeCurrent}/${safeTotal}`);
  if (safeCurrent >= safeTotal) {
    process.stdout.write("\n");
  }
}

function shouldRenderProgress(current, total, step = 10) {
  return current === total || current === 1 || current % step === 0;
}

function normalizeSlug(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\.(svg|webp)$/i, "")
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseFlag(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const v = String(value || "").trim().toLowerCase();
  return v === "true" || v === "1" || v === "yes";
}

function buildVariantLinks(reference) {
  const ref = normalizeSlug(reference);
  return {
    svg: {
      normal: `${CDN_BASE}/svg/${ref}.svg`,
      light: `${CDN_BASE}/svg/${ref}-light.svg`,
      dark: `${CDN_BASE}/svg/${ref}-dark.svg`,
    },
    webp: {
      normal: `${CDN_BASE}/webp/${ref}.webp`,
      light: `${CDN_BASE}/webp/${ref}-light.webp`,
      dark: `${CDN_BASE}/webp/${ref}-dark.webp`,
    },
  };
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "pve-notebuddy-updater",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json,text/plain,*/*",
      "User-Agent": "pve-notebuddy-updater",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

async function downloadFile(url, outPath) {
  const res = await fetch(url, {
    headers: {
      Accept: "image/webp,*/*;q=0.1",
      "User-Agent": "pve-notebuddy-updater",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  const bytes = Buffer.from(await res.arrayBuffer());
  await fs.mkdir(path.dirname(outPath), { recursive: true });
  await fs.writeFile(outPath, bytes);
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function mapWithConcurrency(items, concurrency, worker) {
  const total = items.length;
  if (total === 0) {
    return;
  }
  let nextIndex = 0;
  const lanes = Array.from({ length: Math.min(concurrency, total) }, async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= total) {
        return;
      }
      await worker(items[current], current);
    }
  });
  await Promise.all(lanes);
}

function pickValue(record, key) {
  if (!record || typeof record !== "object") {
    return undefined;
  }
  if (key in record) {
    return record[key];
  }
  const target = key.toLowerCase();
  const foundKey = Object.keys(record).find((k) => k.toLowerCase() === target);
  return foundKey ? record[foundKey] : undefined;
}

function buildIndexEntry(raw) {
  const name = String(pickValue(raw, "Name") || "").trim();
  const referenceRaw = String(pickValue(raw, "Reference") || "").trim();
  const reference = normalizeSlug(referenceRaw);

  const svgAvailable = parseFlag(pickValue(raw, "SVG"));
  const webpAvailable = parseFlag(pickValue(raw, "WebP"));
  const lightAvailable = parseFlag(pickValue(raw, "Light"));
  const darkAvailable = parseFlag(pickValue(raw, "Dark"));

  if (!name || !reference) {
    return null;
  }

  const links = buildVariantLinks(reference);

  return {
    Name: name,
    Reference: referenceRaw,
    "reference-local": `resources/selfhst/${reference}.webp`,
    "reference-jsdelivr": `${CDN_BASE}/webp/${reference}.webp`,
    SVG: {
      normal: svgAvailable ? links.svg.normal : "",
      light: svgAvailable && lightAvailable ? links.svg.light : "",
      dark: svgAvailable && darkAvailable ? links.svg.dark : "",
    },
    WebP: {
      normal: webpAvailable ? links.webp.normal : "",
      light: webpAvailable && lightAvailable ? links.webp.light : "",
      dark: webpAvailable && darkAvailable ? links.webp.dark : "",
    },
  };
}

async function main() {
  const log = {
    source: {
      treeApi: "references-from-index-json",
      indexUrl: INDEX_RAW_URL,
    },
    startedAt: new Date().toISOString(),
    downloadedIcons: 0,
    skippedDownloads: 0,
    indexEntries: 0,
    skippedIndexEntries: 0,
    errors: [],
  };

  await fs.rm(TEMP_DIR, { recursive: true, force: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });
  await fs.mkdir(OUTPUT_ICONS_DIR, { recursive: true });

  console.log("Downloading selfh.st index.json...");
  const rawIndexText = await fetchText(INDEX_RAW_URL);
  await fs.writeFile(TEMP_INDEX_PATH, rawIndexText, "utf8");

  let rawIndex;
  try {
    rawIndex = JSON.parse(rawIndexText);
  } catch (error) {
    throw new Error(`Could not parse selfh.st index JSON: ${error.message}`);
  }

  const sourceEntries = Array.isArray(rawIndex)
    ? rawIndex
    : rawIndex && Array.isArray(rawIndex.icons)
      ? rawIndex.icons
      : [];
  const references = Array.from(
    new Set(
      sourceEntries
        .map((entry) => normalizeSlug(String(pickValue(entry, "Reference") || "")))
        .filter(Boolean),
    ),
  ).sort((a, b) => a.localeCompare(b));

  console.log(
    `Downloading ${references.length} webp icons via jsDelivr (concurrency: ${DOWNLOAD_CONCURRENCY})...`,
  );
  let processed = 0;
  await mapWithConcurrency(references, DOWNLOAD_CONCURRENCY, async (reference) => {
    const fileName = `${reference}.webp`;
    const rawUrl = `${CDN_BASE}/webp/${fileName}`;
    const outPath = path.join(OUTPUT_ICONS_DIR, fileName);
    try {
      const exists = await fileExists(outPath);
      if (exists) {
        log.skippedDownloads += 1;
      } else {
        await downloadFile(rawUrl, outPath);
        log.downloadedIcons += 1;
      }
    } catch (error) {
      log.errors.push({ step: "download-icon", file: `webp/${fileName}`, error: error.message });
    }
    processed += 1;
    if (shouldRenderProgress(processed, references.length)) {
      renderProgress("Downloading icons", processed, references.length);
    }
  });

  const icons = [];
  console.log(`Building sidepanel index from ${sourceEntries.length} entries...`);
  for (let i = 0; i < sourceEntries.length; i += 1) {
    const built = buildIndexEntry(sourceEntries[i]);
    if (built) {
      icons.push(built);
    } else {
      log.skippedIndexEntries += 1;
    }
    if (shouldRenderProgress(i + 1, sourceEntries.length)) {
      renderProgress("Building index", i + 1, sourceEntries.length);
    }
  }

  icons.sort((a, b) => String(a.Name).localeCompare(String(b.Name)));
  log.indexEntries = icons.length;
  log.finishedAt = new Date().toISOString();

  await writeJson(OUTPUT_INDEX_PATH, { icons });
  await writeJson(LOG_PATH, log);

  console.log(`Downloaded icons: ${log.downloadedIcons}`);
  console.log(`Skipped existing: ${log.skippedDownloads}`);
  console.log(`Index entries: ${log.indexEntries}`);
  console.log(`Skipped entries: ${log.skippedIndexEntries}`);
  console.log(`Errors: ${log.errors.length}`);
  console.log(`Wrote icon index: ${OUTPUT_INDEX_PATH}`);
  console.log(`Wrote log: ${LOG_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
