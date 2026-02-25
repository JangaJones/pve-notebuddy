#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

// Upstream source repository and folder containing service metadata.
const OWNER = "community-scripts";
const REPO = "ProxmoxVE";
const JSON_ROOT = "frontend/public/json/";

// Local output paths. This script only crawls raw JSON into crawl-temp.
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const CRAWL_TEMP_DIR = path.join(SCRIPT_DIR, "crawl-temp");
const REPORT_PATH = path.join(CRAWL_TEMP_DIR, "crawl-report.json");

const DRY_RUN = process.argv.includes("--dry-run");

// Fetch helper for GitHub API endpoints returning JSON.
async function fetchJson(url) {
  const res = await fetch(url, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "pve-notebuddy-crawler",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.json();
}

// Fetch helper for raw file content.
async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent": "pve-notebuddy-crawler",
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} for ${url}`);
  }
  return res.text();
}

// Resolve latest commit so each crawl always uses current upstream data.
async function getLatestCommit() {
  const commitsUrl = `https://api.github.com/repos/${OWNER}/${REPO}/commits?per_page=1`;
  const commits = await fetchJson(commitsUrl);
  if (!Array.isArray(commits) || commits.length === 0 || !commits[0]?.sha) {
    throw new Error("Could not resolve latest commit SHA.");
  }
  return String(commits[0].sha);
}

// Enumerate JSON blobs from the target tree path.
async function listJsonBlobs(commitSha) {
  const treeUrl = `https://api.github.com/repos/${OWNER}/${REPO}/git/trees/${commitSha}?recursive=1`;
  const payload = await fetchJson(treeUrl);
  const tree = Array.isArray(payload?.tree) ? payload.tree : [];

  return tree
    .filter((node) => node?.type === "blob")
    .map((node) => String(node.path || ""))
    .filter((p) => p.startsWith(JSON_ROOT) && p.toLowerCase().endsWith(".json"));
}

function buildRawUrl(commitSha, sourcePath) {
  return `https://raw.githubusercontent.com/${OWNER}/${REPO}/${commitSha}/${sourcePath}`;
}

// Pretty-print JSON reports to disk.
async function writeJson(filePath, data) {
  const text = `${JSON.stringify(data, null, 2)}\n`;
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, text, "utf8");
}

// Start from a clean temporary crawl cache on each run.
async function ensureTempDir() {
  await fs.rm(CRAWL_TEMP_DIR, { recursive: true, force: true });
  await fs.mkdir(CRAWL_TEMP_DIR, { recursive: true });
}

async function main() {
  await ensureTempDir();

  // Report is intentionally crawl-only; template generation is handled separately.
  const report = {
    source: { owner: OWNER, repo: REPO, commit: "", root: JSON_ROOT },
    scannedFiles: 0,
    crawledFiles: 0,
    errors: [],
    crawled: [],
    dryRun: DRY_RUN,
  };

  let commitSha = "";
  let blobPaths = [];

  try {
    commitSha = await getLatestCommit();
    blobPaths = await listJsonBlobs(commitSha);
  } catch (error) {
    console.error("Failed to resolve source files:", error.message);
    process.exitCode = 1;
    return;
  }

  report.source.commit = commitSha;
  report.scannedFiles = blobPaths.length;

  for (const sourcePath of blobPaths) {
    const rawUrl = buildRawUrl(commitSha, sourcePath);
    const sourceFileName = sourcePath.slice(JSON_ROOT.length);
    const crawledPath = path.join(CRAWL_TEMP_DIR, sourceFileName);

    try {
      const rawText = await fetchText(rawUrl);
      if (!DRY_RUN) {
        // Preserve source folder structure inside crawl-temp for traceability.
        await fs.mkdir(path.dirname(crawledPath), { recursive: true });
        await fs.writeFile(crawledPath, rawText, "utf8");
      }
      report.crawledFiles += 1;
      report.crawled.push({ sourcePath, file: sourceFileName });
    } catch (error) {
      report.errors.push({ sourcePath, error: error.message });
    }
  }

  await writeJson(REPORT_PATH, report);

  console.log(`Latest commit: ${commitSha}`);
  console.log(`Scanned JSON files: ${report.scannedFiles}`);
  console.log(`Crawled files: ${report.crawledFiles}`);
  console.log(`Errors: ${report.errors.length}`);
  if (DRY_RUN) {
    console.log("Dry run mode: no files written to /crawl-script/crawl-temp.");
  }
  console.log(`Wrote crawl report: ${REPORT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
