#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Source tree root used when mapping crawled files back to upstream paths in reports.
const JSON_ROOT = "frontend/public/json/";

// Local paths: read from crawl cache, write transformed templates + index.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(SCRIPT_DIR, "..");
const SERVICES_DIR = path.join(ROOT_DIR, "templates", "services");
const CRAWL_TEMP_DIR = path.join(SCRIPT_DIR, "crawl-temp");
const INDEX_PATH = path.join(SERVICES_DIR, "index.json");
const REPORT_PATH = path.join(CRAWL_TEMP_DIR, "generate-report.json");

// Entries that are not actual container service templates.
const BLACKLIST_NAMES = new Set(
  [
    "All Templates",
    "Intel e1000e NIC Offloading Fix",
    "PBS 4 Upgrade",
    "PBS Post Install",
    "PBS Processor Microcode",
    "PMG Post Install",
    "PVE Clean Orphaned LVM",
    "PVE CPU Scaling Governor",
    "PVE Cron LXC Updater",
    "PVE Host Backup",
    "PVE Kernel Clean",
    "PVE Kernel Pin",
    "PVE LXC Apps Updater",
    "PVE LXC Cleaner",
    "PVE LXC Deletion",
    "PVE LXC Execute Command",
    "PVE LXC Filesystem Trim",
    "PVE LXC Tag",
    "PVE LXC Updater",
    "PVE Monitor-All",
    "PVE Post Install",
    "PVE Privilege Converter",
    "PVE Processor Microcode",
    "PVE Update Repositories",
  ].map((name) => name.toLowerCase())
);

const DRY_RUN = process.argv.includes("--dry-run");
// Maximum embedded SVG XML size accepted by the app import workflow.
const MAX_SVG_CHARS = 6500;

// Keep filenames stable and filesystem-safe.
function sanitizeSlug(input) {
  const base = String(input || "")
    .toLowerCase()
    .replace(/\.json$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "template";
}

function ensureString(value) {
  return typeof value === "string" ? value.trim() : "";
}

// config_path can be a string or list and may contain comma/pipe delimiters.
function splitConfigPaths(configPath) {
  const splitAndClean = (input) =>
    String(input)
      .split(/[|,]/)
      .map((item) => item.trim())
      .filter(Boolean);

  if (!configPath) {
    return [];
  }

  if (Array.isArray(configPath)) {
    return configPath
      .map((item) => ensureString(item))
      .flatMap((item) => splitAndClean(item));
  }

  return splitAndClean(ensureString(configPath));
}

function normalizeWebsite(website) {
  const raw = ensureString(website);
  if (!raw) {
    return "";
  }
  return raw;
}

// UI label should not include protocol or trailing slash noise.
function websiteToLabel(website) {
  return normalizeWebsite(website).replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
}

// Convert known raster icon urls to their svg equivalent (same icon provider).
function toCandidateSvgUrl(logo) {
  const raw = ensureString(logo);
  if (!raw) {
    return "";
  }

  let converted = raw;
  converted = converted.replace(/\/(webp|png|jpg|jpeg|avif)\//i, "/svg/");
  converted = converted.replace(/\.(webp|png|jpg|jpeg|avif)([?#].*)?$/i, ".svg$2");
  return converted;
}

function toConfigLocations(configPath) {
  return splitConfigPaths(configPath).map((value) => ({ icon: "📁", value }));
}

function isSvgUrl(url) {
  return /\.svg($|[?#])/i.test(String(url || "").trim());
}

// Fetch helper used for SVG validation.
async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "pve-notebuddy-template-generator",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.text();
}

// Decide whether to use the svg variant:
// - use svg only if the candidate URL exists/replies and XML length is within MAX_SVG_CHARS
// - otherwise keep original logo URL and mark fallback.
// Results are cached per svg URL for performance.
async function resolveLogoUrl(logo, logoDecisionCache) {
  const raw = ensureString(logo);
  if (!raw) {
    return { url: "", fallbackToOriginal: false };
  }

  const candidateSvgUrl = toCandidateSvgUrl(raw);
  if (!candidateSvgUrl || candidateSvgUrl === raw) {
    return { url: raw, fallbackToOriginal: false };
  }

  if (logoDecisionCache.has(candidateSvgUrl)) {
    const shouldUseSvg = logoDecisionCache.get(candidateSvgUrl);
    return {
      url: shouldUseSvg ? candidateSvgUrl : raw,
      fallbackToOriginal: !shouldUseSvg,
    };
  }

  try {
    const svgText = await fetchText(candidateSvgUrl);
    const shouldUseSvg = svgText.length <= MAX_SVG_CHARS;
    logoDecisionCache.set(candidateSvgUrl, shouldUseSvg);
    return {
      url: shouldUseSvg ? candidateSvgUrl : raw,
      fallbackToOriginal: !shouldUseSvg,
    };
  } catch {
    logoDecisionCache.set(candidateSvgUrl, false);
    return { url: raw, fallbackToOriginal: true };
  }
}

// Build a minimal "service overlay" payload that only sets content values.
async function buildTemplate(source, logoDecisionCache) {
  const name = ensureString(source.name);
  const slug = sanitizeSlug(ensureString(source.slug) || name);
  const website = normalizeWebsite(source.website);
  const logoResolution = await resolveLogoUrl(source.logo, logoDecisionCache);
  const iconUrl = logoResolution.url;
  const interfacePort = source.interface_port;

  const networkText =
    interfacePort === null || interfacePort === undefined || String(interfacePort).trim() === ""
      ? ""
      : `Default Port: ${String(interfacePort).trim()}`;

  const icon = isSvgUrl(iconUrl)
    ? {
        mode: "external",
        url: iconUrl,
        embedSvg: true,
        resizeWithWsrv: false,
        colorVariant: "original",
      }
    : {
        mode: "external",
        url: iconUrl,
      };
  if (!isSvgUrl(iconUrl) && logoResolution.fallbackToOriginal) {
    icon.resizeWithWsrv = true;
  }

  return {
    slug,
    template: {
      icon,
      fields: {
        titleText: name,
        fqdnLabel: websiteToLabel(website),
        fqdnUrl: website,
        networkText,
        configLocations: toConfigLocations(source.config_path),
      },
    },
  };
}

function looksLikeTemplateJson(parsed) {
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.name && parsed.slug;
}

function isBlacklistedTemplateName(name) {
  return BLACKLIST_NAMES.has(ensureString(name).toLowerCase());
}

// Pretty-print helper for generated templates, index, and reports.
async function writeJson(filePath, data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, "utf8");
}

// Regeneration always rewrites outputs, so clear existing service JSON files first.
async function cleanupServiceJsonOutputs() {
  const entries = await fs.readdir(SERVICES_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.toLowerCase().endsWith(".json")) {
      continue;
    }
    await fs.rm(path.join(SERVICES_DIR, entry.name), { force: true });
  }
}

// Read every crawled json file recursively, excluding generator/crawl reports.
async function collectCrawledJsonFiles(dir, baseDir = dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectCrawledJsonFiles(fullPath, baseDir)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.toLowerCase().endsWith(".json")) {
      continue;
    }
    if (entry.name === "crawl-report.json" || entry.name === "generate-report.json") {
      continue;
    }
    const relPath = path.relative(baseDir, fullPath);
    files.push({ fullPath, relPath });
  }

  return files;
}

function toSourcePath(relPath) {
  const normalized = relPath.split(path.sep).join("/");
  return `${JSON_ROOT}${normalized}`;
}

async function main() {
  await fs.mkdir(SERVICES_DIR, { recursive: true });

  let crawledFiles = [];
  try {
    crawledFiles = await collectCrawledJsonFiles(CRAWL_TEMP_DIR);
  } catch (error) {
    console.error(`Could not read crawl cache at ${CRAWL_TEMP_DIR}:`, error.message);
    process.exitCode = 1;
    return;
  }

  if (!DRY_RUN) {
    await cleanupServiceJsonOutputs();
  }

  // Generation report captures conversion health and skip/error details.
  const report = {
    source: { root: JSON_ROOT, crawlTempDir: CRAWL_TEMP_DIR },
    scannedFiles: crawledFiles.length,
    generatedTemplates: 0,
    skippedFiles: 0,
    errors: [],
    generated: [],
    dryRun: DRY_RUN,
  };

  const indexTemplates = [];
  const slugUseCount = new Map();
  // Shared decision cache avoids repeated svg size checks for same icon URL.
  const logoDecisionCache = new Map();

  for (const file of crawledFiles) {
    const sourcePath = toSourcePath(file.relPath);
    let parsed;

    try {
      const rawText = await fs.readFile(file.fullPath, "utf8");
      parsed = JSON.parse(rawText);
    } catch (error) {
      report.errors.push({ sourcePath, file: file.relPath, error: error.message });
      continue;
    }

    if (!looksLikeTemplateJson(parsed)) {
      report.skippedFiles += 1;
      continue;
    }
    if (isBlacklistedTemplateName(parsed.name)) {
      report.skippedFiles += 1;
      continue;
    }

    const built = await buildTemplate(parsed, logoDecisionCache);
    const baseSlug = built.slug;
    const currentCount = slugUseCount.get(baseSlug) || 0;
    slugUseCount.set(baseSlug, currentCount + 1);
    const slug = currentCount === 0 ? baseSlug : `${baseSlug}-${currentCount + 1}`;

    const outFile = `${slug}.json`;
    const outPath = path.join(SERVICES_DIR, outFile);

    if (!DRY_RUN) {
      await writeJson(outPath, built.template);
    }

    const entryName = ensureString(parsed.name) || slug;
    indexTemplates.push({
      name: entryName,
      file: outFile,
      source: sourcePath,
    });

    report.generatedTemplates += 1;
    report.generated.push({ sourcePath, file: outFile, name: entryName });
  }

  indexTemplates.sort((a, b) => a.name.localeCompare(b.name));

  if (!DRY_RUN) {
    await writeJson(INDEX_PATH, { templates: indexTemplates });
  }
  await writeJson(REPORT_PATH, report);

  console.log(`Scanned crawled JSON files: ${report.scannedFiles}`);
  console.log(`Generated templates: ${report.generatedTemplates}`);
  console.log(`Skipped files: ${report.skippedFiles}`);
  console.log(`Errors: ${report.errors.length}`);
  if (DRY_RUN) {
    console.log("Dry run mode: no files written to /templates/services.");
  } else {
    console.log(`Wrote template index: ${INDEX_PATH}`);
  }
  console.log(`Wrote generate report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
