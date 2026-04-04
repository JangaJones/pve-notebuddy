#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import {
  collectJsonFilesRecursive,
  ensureString,
  sanitizeSlug,
  writeJson,
} from "./lib/script-utils.mjs";

const SOURCE_ENDPOINT = "https://db.community-scripts.org/api/collections/script_scripts/";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const TEMPLATES_DIR = path.resolve(SCRIPT_DIR, "..");
const COMMUNITY_SCRIPTS_DIR = path.join(TEMPLATES_DIR, "community-scripts");
const SELFHST_DIR = path.join(TEMPLATES_DIR, "selfhst");
const CUSTOM_DIR = path.join(TEMPLATES_DIR, "custom");
const CRAWL_TEMP_DIR = path.join(SCRIPT_DIR, "community-scripts-temp");
const INDEX_PATH = path.join(TEMPLATES_DIR, "index.json");
const REPORT_PATH = path.join(CRAWL_TEMP_DIR, "generate-report.json");
const DATASET_CONFIG = [
  { key: "community-scripts", dir: COMMUNITY_SCRIPTS_DIR, tag: "PVE Scripts" },
  { key: "selfhst", dir: SELFHST_DIR, tag: "selfh.st" },
  { key: "custom", dir: CUSTOM_DIR, tag: "Custom" },
];

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
    "PVE LXC Execute",
  ].map((name) => name.toLowerCase())
);

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_SVG_CHARS = 6500;

function prettyNameFromPath(relPath) {
  const base = relPath.replace(/\\/g, "/").replace(/\.json$/i, "").split("/").pop() || "template";
  return base.replace(/[-_]+/g, " ").trim() || base;
}

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
  return raw || "";
}

function websiteToLabel(website) {
  return normalizeWebsite(website).replace(/^https?:\/\//i, "").replace(/\/+$/g, "");
}

function normalizePortText(rawPort) {
  if (rawPort === null || rawPort === undefined) {
    return "";
  }

  if (typeof rawPort === "number") {
    return rawPort > 0 ? String(rawPort) : "";
  }

  const value = ensureString(rawPort);
  if (!value) {
    return "";
  }

  if (/^\d+$/.test(value)) {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? String(parsed) : "";
  }

  return value;
}

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

async function buildTemplate(source, logoDecisionCache) {
  const name = ensureString(source.name);
  const slug = sanitizeSlug(ensureString(source.slug) || name);
  const website = normalizeWebsite(source.website);
  const logoResolution = await resolveLogoUrl(source.logo, logoDecisionCache);
  const iconUrl = logoResolution.url;
  const portText = normalizePortText(source.port);
  const networkText = portText ? `Default Port: ${portText}` : "";

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

function deriveTemplateDisplayName(parsed, relPath) {
  const titleText = ensureString(parsed?.fields?.titleText);
  if (titleText) {
    return titleText;
  }
  const parsedName = ensureString(parsed?.name);
  if (parsedName) {
    return parsedName;
  }
  return prettyNameFromPath(relPath);
}

async function cleanupCommunityJsonOutputs() {
  const entries = await fs.readdir(COMMUNITY_SCRIPTS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.toLowerCase().endsWith(".json")) {
      continue;
    }
    await fs.rm(path.join(COMMUNITY_SCRIPTS_DIR, entry.name), { force: true });
  }
}

async function collectDatasetIndexEntries(dataset, report) {
  let files = [];
  try {
    files = await collectJsonFilesRecursive(dataset.dir);
  } catch (error) {
    if (error?.code === "ENOENT") {
      return [];
    }
    report.errors.push({
      dataset: dataset.key,
      file: dataset.dir,
      error: `Could not read dataset directory: ${error.message}`,
    });
    return [];
  }

  const entries = [];
  for (const file of files) {
    const relPath = file.relPath.split(path.sep).join("/");
    const indexFile = `${dataset.key}/${relPath}`;
    let parsed;
    try {
      const rawText = await fs.readFile(file.fullPath, "utf8");
      parsed = JSON.parse(rawText);
    } catch (error) {
      report.errors.push({
        dataset: dataset.key,
        file: indexFile,
        error: `Could not parse template JSON: ${error.message}`,
      });
      continue;
    }

    entries.push({
      name: deriveTemplateDisplayName(parsed, relPath),
      file: indexFile,
      source: `${dataset.key}/${relPath}`,
      tag: dataset.tag,
    });
  }
  return entries;
}

async function main() {
  await fs.mkdir(COMMUNITY_SCRIPTS_DIR, { recursive: true });
  await fs.mkdir(CRAWL_TEMP_DIR, { recursive: true });

  let crawledFiles = [];
  try {
    crawledFiles = await collectJsonFilesRecursive(
      CRAWL_TEMP_DIR,
      CRAWL_TEMP_DIR,
      new Set(["crawl-report.json", "generate-report.json"])
    );
  } catch (error) {
    console.error(`Could not read crawl cache at ${CRAWL_TEMP_DIR}:`, error.message);
    process.exitCode = 1;
    return;
  }

  if (!DRY_RUN) {
    await cleanupCommunityJsonOutputs();
  }

  const report = {
    source: { endpoint: SOURCE_ENDPOINT, crawlTempDir: CRAWL_TEMP_DIR },
    scannedFiles: crawledFiles.length,
    generatedTemplates: 0,
    indexedTemplates: 0,
    skippedFiles: 0,
    duplicateEntries: 0,
    errors: [],
    generated: [],
    duplicates: [],
    datasets: [],
    dryRun: DRY_RUN,
  };

  const slugUseCount = new Map();
  const logoDecisionCache = new Map();

  for (const file of crawledFiles) {
    const sourcePath = file.relPath.split(path.sep).join("/");
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
    const outPath = path.join(COMMUNITY_SCRIPTS_DIR, outFile);

    if (!DRY_RUN) {
      await writeJson(outPath, built.template);
    }

    report.generatedTemplates += 1;
    report.generated.push({ sourcePath, file: `community-scripts/${outFile}`, name: ensureString(parsed.name) || slug });
  }

  const indexTemplates = [];
  for (const dataset of DATASET_CONFIG) {
    const entries = await collectDatasetIndexEntries(dataset, report);
    report.datasets.push({
      dataset: dataset.key,
      tag: dataset.tag,
      indexedEntries: entries.length,
    });
    indexTemplates.push(...entries);
  }
  report.indexedTemplates = indexTemplates.length;

  indexTemplates.sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file));
  const dedupedIndexTemplates = [];
  const seenFiles = new Map();
  for (const entry of indexTemplates) {
    const key = ensureString(entry.file).toLowerCase();
    if (!key) {
      dedupedIndexTemplates.push(entry);
      continue;
    }
    const firstSeen = seenFiles.get(key);
    if (firstSeen) {
      report.duplicateEntries += 1;
      report.duplicates.push({
        name: entry.name,
        file: entry.file,
        source: entry.source,
        duplicateOf: firstSeen.source,
      });
      continue;
    }
    seenFiles.set(key, entry);
    dedupedIndexTemplates.push(entry);
  }

  if (!DRY_RUN) {
    await writeJson(INDEX_PATH, { templates: dedupedIndexTemplates });
  }
  await writeJson(REPORT_PATH, report);

  console.log(`Scanned crawled JSON files: ${report.scannedFiles}`);
  console.log(`Generated templates: ${report.generatedTemplates}`);
  console.log(`Indexed templates: ${report.indexedTemplates}`);
  console.log(`Skipped files: ${report.skippedFiles}`);
  console.log(`Duplicate entries skipped: ${report.duplicateEntries}`);
  console.log(`Errors: ${report.errors.length}`);
  if (DRY_RUN) {
    console.log("Dry run mode: no files written to /templates/community-scripts.");
  } else {
    console.log(`Wrote template index: ${INDEX_PATH}`);
  }
  console.log(`Wrote generate report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
