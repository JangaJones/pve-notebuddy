#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const SOURCE_ENDPOINT = "https://db.community-scripts.org/api/collections/script_scripts/";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CRAWL_TEMP_DIR = path.join(SCRIPT_DIR, "community-scripts-temp");
const REPORT_PATH = path.join(SCRIPT_DIR, "community-scripts-log.json");

const DRY_RUN = process.argv.includes("--dry-run");
const PER_PAGE = 200;

function ensureString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function sanitizeSlug(input) {
  const base = String(input || "")
    .toLowerCase()
    .replace(/\.json$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || "template";
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

async function writeJson(filePath, data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, "utf8");
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

  for (const record of records) {
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
  }

  await writeJson(REPORT_PATH, report);

  console.log(`Source endpoint: ${SOURCE_ENDPOINT}`);
  console.log(`Scanned records: ${report.scannedRecords}`);
  console.log(`Crawled files: ${report.crawledFiles}`);
  console.log(`Errors: ${report.errors.length}`);
  if (DRY_RUN) {
    console.log("Dry run mode: no files written to /templates/scripts/community-scripts-temp.");
  }
  console.log(`Wrote crawl report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
