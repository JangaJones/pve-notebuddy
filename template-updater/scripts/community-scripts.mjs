#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { ensureString, sanitizeSlug, writeJson } from "./lib/script-utils.mjs";

const SOURCE_ENDPOINT = "https://db.community-scripts.org/api/collections/script_scripts/";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const UPDATER_DIR = path.resolve(SCRIPT_DIR, "..");
const TEMP_DIR = path.join(UPDATER_DIR, "temp");
const CRAWL_TEMP_DIR = path.join(TEMP_DIR, "community-scripts");
const REPORT_PATH = path.join(TEMP_DIR, "community-scripts-log.json");

const DRY_RUN = process.argv.includes("--dry-run");
const PER_PAGE = 200;

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

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "pve-notebuddy-crawler",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

async function ensureTempDir() {
  await fs.rm(CRAWL_TEMP_DIR, { recursive: true, force: true });
  await fs.mkdir(CRAWL_TEMP_DIR, { recursive: true });
}

function toRecordsEndpoint(baseUrl) {
  const trimmed = baseUrl.replace(/\/+$/g, "");
  return trimmed.toLowerCase().endsWith("/records") ? trimmed : `${trimmed}/records`;
}

function pickItems(payload) {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && typeof payload === "object") {
    if (Array.isArray(payload.items)) {
      return payload.items;
    }
    if (Array.isArray(payload.data)) {
      return payload.data;
    }
  }
  return [];
}

async function fetchAllRecords(baseUrl) {
  const recordsEndpoint = toRecordsEndpoint(baseUrl);

  const firstUrl = new URL(recordsEndpoint);
  firstUrl.searchParams.set("page", "1");
  firstUrl.searchParams.set("perPage", String(PER_PAGE));

  let firstPayload;
  try {
    firstPayload = await fetchJson(firstUrl.toString());
  } catch {
    // Some proxies expose the list directly without /records.
    firstPayload = await fetchJson(baseUrl);
  }

  const initialItems = pickItems(firstPayload);
  const totalPages = Number.parseInt(String(firstPayload?.totalPages || "1"), 10);
  renderProgress("Fetching pages", 1, Number.isFinite(totalPages) && totalPages > 0 ? totalPages : 1);

  if (!Number.isFinite(totalPages) || totalPages <= 1) {
    return initialItems;
  }

  const all = [...initialItems];
  for (let page = 2; page <= totalPages; page += 1) {
    const pageUrl = new URL(recordsEndpoint);
    pageUrl.searchParams.set("page", String(page));
    pageUrl.searchParams.set("perPage", String(PER_PAGE));
    const payload = await fetchJson(pageUrl.toString());
    all.push(...pickItems(payload));
    renderProgress("Fetching pages", page, totalPages);
  }

  return all;
}

function deriveFileName(record, slugUseCount) {
  const rawSlug = ensureString(record?.slug) || ensureString(record?.name) || ensureString(record?.id);
  const baseSlug = sanitizeSlug(rawSlug);
  const currentCount = slugUseCount.get(baseSlug) || 0;
  slugUseCount.set(baseSlug, currentCount + 1);
  const slug = currentCount === 0 ? baseSlug : `${baseSlug}-${currentCount + 1}`;
  return `${slug}.json`;
}

async function main() {
  await ensureTempDir();

  const report = {
    source: { endpoint: SOURCE_ENDPOINT },
    scannedRecords: 0,
    crawledFiles: 0,
    errors: [],
    crawled: [],
    dryRun: DRY_RUN,
  };

  let records = [];
  try {
    records = await fetchAllRecords(SOURCE_ENDPOINT);
  } catch (error) {
    console.error("Failed to fetch records:", error.message);
    process.exitCode = 1;
    return;
  }

  report.scannedRecords = records.length;
  const slugUseCount = new Map();

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const fileName = deriveFileName(record, slugUseCount);
    const crawledPath = path.join(CRAWL_TEMP_DIR, fileName);

    try {
      if (!DRY_RUN) {
        await writeJson(crawledPath, record);
      }
      report.crawledFiles += 1;
      report.crawled.push({
        id: ensureString(record?.id),
        slug: ensureString(record?.slug),
        file: fileName,
      });
    } catch (error) {
      report.errors.push({
        id: ensureString(record?.id),
        slug: ensureString(record?.slug),
        error: error.message,
      });
    }
    if (shouldRenderProgress(index + 1, records.length)) {
      renderProgress("Writing records", index + 1, records.length);
    }
  }

  await writeJson(REPORT_PATH, report);

  console.log(`Source endpoint: ${SOURCE_ENDPOINT}`);
  console.log(`Scanned records: ${report.scannedRecords}`);
  console.log(`Crawled files: ${report.crawledFiles}`);
  console.log(`Errors: ${report.errors.length}`);
  if (DRY_RUN) {
    console.log("Dry run mode: no files written to /template-updater/temp/community-scripts.");
  }
  console.log(`Wrote crawl report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
