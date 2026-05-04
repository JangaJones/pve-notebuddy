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
const TEMPLATE_DOCUMENT_FORMAT_VERSION = 1;
const TEMPLATE_DOCUMENT_TYPE_CONTENT = "content-template";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const UPDATER_DIR = path.resolve(SCRIPT_DIR, "..");
const REPO_DIR = path.resolve(UPDATER_DIR, "..");
const TEMPLATES_DIR = path.join(REPO_DIR, "templates");
const TEMPLATE_SEARCH_DIR = path.join(TEMPLATES_DIR, "template-search");
const CUSTOM_DIR = path.join(TEMPLATES_DIR, "custom");
const CRAWL_TEMP_DIR = path.join(UPDATER_DIR, "temp", "community-scripts");
const INDEX_PATH = path.join(TEMPLATES_DIR, "template-search-index.json");
const REPORT_PATH = path.join(UPDATER_DIR, "temp", "generate-report.json");
const BLACKLIST_PATH = path.join(UPDATER_DIR, "community-scripts-blacklist.txt");
const DATASET_CONFIG = [
  { key: "template-search", dir: TEMPLATE_SEARCH_DIR, tag: "PVE Scripts" },
  { key: "custom", dir: CUSTOM_DIR, tag: "Custom" },
];

const DRY_RUN = process.argv.includes("--dry-run");
const MAX_TEMPLATE_ICON_SVG_CHARS = 4000;
const TEMPLATE_BUILD_CONCURRENCY = 12;
const iconUrlResolutionCache = new Map();

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

function normalizeUrl(value) {
  const text = ensureString(value);
  return /^https?:\/\//i.test(text) ? text : "";
}

function hasAllowedIconImageExtension(value) {
  const text = normalizeUrl(value);
  if (!text) {
    return false;
  }
  return /\.(svg|gif|jpe?g|png|tif|webp)($|[?#])/i.test(text);
}

function toIndexedTextMap(values, keyPrefix = "URL") {
  const out = {};
  let index = 1;
  for (const value of values) {
    const text = ensureString(value);
    if (!text) {
      continue;
    }
    out[`${keyPrefix}${index}`] = text;
    index += 1;
  }
  return out;
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

function toConfigLocations(configPath) {
  return splitConfigPaths(configPath).map((value) => ({ icon: "📁", value }));
}

function toHostEntries(source) {
  const entries = [];
  const documentationUrl = normalizeUrl(source?.documentation);
  const githubUrl = normalizeUrl(source?.github);

  if (documentationUrl) {
    entries.push({
      icon: "🔗",
      label: "Documentation",
      url: documentationUrl,
    });
  }
  if (githubUrl) {
    entries.push({
      icon: "🔗",
      label: "GitHub",
      url: githubUrl,
    });
  }

  return entries;
}

function toNetworkEntries(rawPort) {
  const portText = normalizePortText(rawPort);
  if (!portText) {
    return [];
  }
  return [{ icon: "🖥️", value: `Default Port: ${portText}` }];
}

function deriveSvgCandidateUrl(iconUrl) {
  const normalized = ensureString(iconUrl);
  if (!normalized || !/^https?:\/\//i.test(normalized)) {
    return "";
  }
  if (/\.svg(\?|#|$)/i.test(normalized)) {
    return normalized;
  }

  const webpMatch = normalized.match(/^(https?:\/\/.+\/)webp\/([^/?#]+)\.webp([?#].*)?$/i);
  if (webpMatch) {
    return `${webpMatch[1]}svg/${webpMatch[2]}.svg`;
  }

  const genericMatch = normalized.match(/^(https?:\/\/.+\/)([^/?#]+)\.(png|jpe?g|gif|webp)([?#].*)?$/i);
  if (genericMatch) {
    return `${genericMatch[1]}${genericMatch[2]}.svg`;
  }

  return "";
}

async function resolvePreferredIconUrl(iconUrl) {
  const normalized = ensureString(iconUrl);
  if (!normalized) {
    return "";
  }
  if (iconUrlResolutionCache.has(normalized)) {
    return iconUrlResolutionCache.get(normalized);
  }

  const svgCandidate = deriveSvgCandidateUrl(normalized);
  if (!svgCandidate || svgCandidate === normalized) {
    iconUrlResolutionCache.set(normalized, normalized);
    return normalized;
  }

  try {
    const res = await fetch(svgCandidate, {
      headers: {
        Accept: "image/svg+xml,text/plain;q=0.9,*/*;q=0.1",
        "User-Agent": "pve-notebuddy-updater",
      },
    });
    if (!res.ok) {
      iconUrlResolutionCache.set(normalized, normalized);
      return normalized;
    }

    const contentLength = Number.parseInt(res.headers.get("content-length") || "", 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_TEMPLATE_ICON_SVG_CHARS) {
      iconUrlResolutionCache.set(normalized, normalized);
      return normalized;
    }

    const text = await res.text();
    if (!text || text.length > MAX_TEMPLATE_ICON_SVG_CHARS || !/<svg[\s>]/i.test(text)) {
      iconUrlResolutionCache.set(normalized, normalized);
      return normalized;
    }

    iconUrlResolutionCache.set(normalized, svgCandidate);
    return svgCandidate;
  } catch {
    iconUrlResolutionCache.set(normalized, normalized);
    return normalized;
  }
}

async function toContentPayload(source) {
  const name = ensureString(source.name);
  const slug = sanitizeSlug(ensureString(source.slug) || name);
  const iconUrl = await resolvePreferredIconUrl(source.logo);
  const websiteUrl = normalizeUrl(source.website);
  const iconUrls = toIndexedTextMap(iconUrl ? [iconUrl] : [], "URL");
  const iconLinkUrls = toIndexedTextMap(websiteUrl ? [websiteUrl] : [], "URL");
  return {
    slug,
    template: {
      meta: {
        formatVersion: TEMPLATE_DOCUMENT_FORMAT_VERSION,
        appVersion: "dev",
        type: TEMPLATE_DOCUMENT_TYPE_CONTENT,
      },
      payload: {
        schema: "template-document-payload-v1",
        content: {
          titleText: name,
          icon: {
            ...(Object.keys(iconUrls).length > 0 ? { urls: iconUrls } : {}),
            ...(Object.keys(iconLinkUrls).length > 0 ? { linkUrls: iconLinkUrls } : {}),
          },
          hostEntries: toHostEntries(source),
          networkEntries: toNetworkEntries(source.port),
          configLocations: toConfigLocations(source.config_path),
        },
      },
    },
  };
}

function looksLikeTemplateJson(parsed) {
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) && parsed.name && parsed.slug;
}

async function loadBlacklistSet() {
  try {
    const raw = await fs.readFile(BLACKLIST_PATH, "utf8");
    const names = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"));
    return new Set(names.map((name) => name.toLowerCase()));
  } catch (error) {
    if (error?.code === "ENOENT") {
      return new Set();
    }
    throw error;
  }
}

function isBlacklistedTemplateName(name, blacklistSet) {
  return blacklistSet.has(ensureString(name).toLowerCase());
}

function deriveTemplateDisplayName(parsed, relPath) {
  const payloadTitleText = ensureString(parsed?.payload?.content?.titleText);
  if (payloadTitleText) {
    return payloadTitleText;
  }
  const metaName = ensureString(parsed?.meta?.name);
  if (metaName) {
    return metaName;
  }
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
  const entries = await fs.readdir(TEMPLATE_SEARCH_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }
    if (!entry.name.toLowerCase().endsWith(".json")) {
      continue;
    }
    await fs.rm(path.join(TEMPLATE_SEARCH_DIR, entry.name), { force: true });
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

async function loadAppVersion() {
  const packageJsonPath = path.join(REPO_DIR, "package.json");
  try {
    const raw = await fs.readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw);
    const version = ensureString(parsed?.version);
    return version || "dev";
  } catch {
    return "dev";
  }
}

async function main() {
  await fs.mkdir(TEMPLATE_SEARCH_DIR, { recursive: true });
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
    blacklistedTemplates: 0,
    entriesWithoutIcon: 0,
    entriesWithUnsupportedLogoUrl: 0,
    customTemplates: 0,
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
  const appVersion = await loadAppVersion();
  const blacklistSet = await loadBlacklistSet();
  let completedFiles = 0;

  const tasks = crawledFiles.map(async (file) => {
    const sourcePath = file.relPath.split(path.sep).join("/");
    let parsed;

    try {
      const rawText = await fs.readFile(file.fullPath, "utf8");
      parsed = JSON.parse(rawText);
    } catch (error) {
      return { kind: "error", sourcePath, file: file.relPath, error: error.message };
    } finally {
      completedFiles += 1;
      if (shouldRenderProgress(completedFiles, crawledFiles.length)) {
        renderProgress("Generating templates", completedFiles, crawledFiles.length);
      }
    }

    if (!looksLikeTemplateJson(parsed)) {
      return { kind: "skip" };
    }
    if (isBlacklistedTemplateName(parsed.name, blacklistSet)) {
      return { kind: "blacklisted" };
    }
    if (!ensureString(parsed.logo)) {
      return { kind: "missing-logo" };
    }
    if (!hasAllowedIconImageExtension(parsed.logo)) {
      return { kind: "unsupported-logo-url" };
    }

    const built = await toContentPayload(parsed);
    built.template.meta.appVersion = appVersion;
    built.template.meta.name = ensureString(parsed.name) || built.template.payload.content.titleText;
    const baseSlug = built.slug;
    const currentCount = slugUseCount.get(baseSlug) || 0;
    slugUseCount.set(baseSlug, currentCount + 1);
    const slug = currentCount === 0 ? baseSlug : `${baseSlug}-${currentCount + 1}`;

    const outFile = `${slug}.json`;
    const outPath = path.join(TEMPLATE_SEARCH_DIR, outFile);

    if (!DRY_RUN) {
      await writeJson(outPath, built.template);
    }

    return {
      kind: "generated",
      sourcePath,
      file: `template-search/${outFile}`,
      name: ensureString(parsed.name) || slug,
    };
  });

  const active = new Set();
  const results = [];
  for (const task of tasks) {
    const tracked = task.finally(() => active.delete(tracked));
    active.add(tracked);
    results.push(tracked);
    if (active.size >= TEMPLATE_BUILD_CONCURRENCY) {
      await Promise.race(active);
    }
  }
  const settledResults = await Promise.all(results);

  for (const result of settledResults) {
    if (result.kind === "error") {
      report.errors.push({ sourcePath: result.sourcePath, file: result.file, error: result.error });
      continue;
    }
    if (result.kind === "generated") {
      report.generatedTemplates += 1;
      report.generated.push({ sourcePath: result.sourcePath, file: result.file, name: result.name });
      continue;
    }
    if (result.kind === "blacklisted") {
      report.blacklistedTemplates += 1;
      report.skippedFiles += 1;
      continue;
    }
    if (result.kind === "missing-logo") {
      report.entriesWithoutIcon += 1;
      report.skippedFiles += 1;
      continue;
    }
    if (result.kind === "unsupported-logo-url") {
      report.entriesWithUnsupportedLogoUrl += 1;
      report.skippedFiles += 1;
      continue;
    }
    if (result.kind === "skip") {
      report.skippedFiles += 1;
    }
  }

  const indexTemplates = [];
  for (let datasetIndex = 0; datasetIndex < DATASET_CONFIG.length; datasetIndex += 1) {
    const dataset = DATASET_CONFIG[datasetIndex];
    const entries = await collectDatasetIndexEntries(dataset, report);
    report.datasets.push({
      dataset: dataset.key,
      tag: dataset.tag,
      indexedEntries: entries.length,
    });
    if (dataset.key === "custom") {
      report.customTemplates = entries.length;
    }
    indexTemplates.push(...entries);
    renderProgress("Indexing datasets", datasetIndex + 1, DATASET_CONFIG.length);
  }
  report.indexedTemplates = indexTemplates.length;

  indexTemplates.sort((a, b) => a.name.localeCompare(b.name) || a.file.localeCompare(b.file));
  const dedupedIndexTemplates = [];
  const seenFiles = new Map();
  for (let dedupeIndex = 0; dedupeIndex < indexTemplates.length; dedupeIndex += 1) {
    const entry = indexTemplates[dedupeIndex];
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
    if (shouldRenderProgress(dedupeIndex + 1, indexTemplates.length)) {
      renderProgress("Deduplicating index", dedupeIndex + 1, indexTemplates.length);
    }
  }

  if (!DRY_RUN) {
    await writeJson(INDEX_PATH, { templates: dedupedIndexTemplates });
  }
  await writeJson(REPORT_PATH, report);

  console.log(`Scanned JSON files: ${report.scannedFiles}`);
  console.log(`Generated Community-Script Templates: ${report.generatedTemplates}`);
  console.log(`Blacklisted Community-Script Templates: ${report.blacklistedTemplates}`);
  console.log(`Entries without Icon (skipped): ${report.entriesWithoutIcon}`);
  console.log(`Entries with unsupported logo URL (skipped): ${report.entriesWithUnsupportedLogoUrl}`);
  console.log(`Found Custom Templates: ${report.customTemplates}`);
  console.log(`Indexed Templates: ${report.indexedTemplates}`);
  console.log(`Duplicate entries skipped: ${report.duplicateEntries}`);
  console.log(`Errors: ${report.errors.length}`);
  if (DRY_RUN) {
    console.log("Dry run mode: no files written to /templates/template-search.");
  } else {
    console.log(`Wrote template index: ${INDEX_PATH}`);
  }
  console.log(`Wrote generate report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
