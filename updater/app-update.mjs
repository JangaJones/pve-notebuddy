#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const UPDATER_DIR = path.dirname(__filename);
const APP_ROOT = path.resolve(UPDATER_DIR, "..");
const TEMP_ROOT = path.join(UPDATER_DIR, "temp", "app-update");
const DOWNLOAD_ZIP = path.join(TEMP_ROOT, "release.zip");
const EXTRACT_DIR = path.join(TEMP_ROOT, "extracted");

const GITHUB_OWNER = "JangaJones";
const GITHUB_REPO = "pve-notebuddy";
const RELEASE_API_URL = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const RELEASE_ASSET_PATTERN = /-selfhosted\.zip$/i;
const ALLOWED_REDIRECT_HOSTS = new Set(["github.com", "objects.githubusercontent.com"]);

const PROTECTED_NO_DELETE_PATHS = new Set([
  "templates/custom",
]);

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeVersion(versionText) {
  const cleaned = String(versionText || "").trim().replace(/^v/i, "");
  const match = cleaned.match(/^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/);
  if (!match) {
    return null;
  }
  return {
    raw: cleaned,
    parts: [Number.parseInt(match[1], 10), Number.parseInt(match[2], 10), Number.parseInt(match[3], 10)],
  };
}

function compareVersions(a, b) {
  for (let i = 0; i < 3; i += 1) {
    if (a.parts[i] > b.parts[i]) return 1;
    if (a.parts[i] < b.parts[i]) return -1;
  }
  return 0;
}

async function readLocalVersion() {
  const indexPath = path.join(APP_ROOT, "index.html");
  const html = await fs.readFile(indexPath, "utf8");
  const metaMatch = html.match(/<meta\s+name=["']app-version["']\s+content=["']([^"']+)["']/i);
  if (!metaMatch) {
    throw new Error(`Could not find app version meta tag in ${indexPath}`);
  }
  return metaMatch[1].trim();
}

async function fetchLatestRelease() {
  const response = await fetch(RELEASE_API_URL, {
    headers: {
      Accept: "application/vnd.github+json",
      "User-Agent": "pve-notebuddy-updater",
    },
  });

  if (!response.ok) {
    throw new Error(`GitHub API request failed (${response.status} ${response.statusText})`);
  }

  const release = await response.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  let zipAsset = assets.find((asset) => RELEASE_ASSET_PATTERN.test(String(asset?.name || "")));
  if (!zipAsset) {
    zipAsset = assets.find((asset) => String(asset?.name || "").toLowerCase().endsWith(".zip"));
  }
  if (!zipAsset) {
    throw new Error("No zip asset found in latest release. Expected a *-selfhosted.zip asset.");
  }

  return {
    tag: String(release.tag_name || "").trim(),
    name: String(release.name || "").trim(),
    assetName: String(zipAsset.name || "").trim(),
    assetUrl: String(zipAsset.browser_download_url || "").trim(),
  };
}

async function askForConfirmation(localVersion, remoteVersion, releaseInfo) {
  stdout.write("========================================\n");
  stdout.write("   PVE NoteBuddy App Selfhost Updater\n");
  stdout.write("========================================\n");
  stdout.write(`Local version : ${localVersion}\n`);
  stdout.write(`Latest remote : ${remoteVersion}\n`);
  stdout.write(`Release tag   : ${releaseInfo.tag || "(unknown)"}\n`);
  stdout.write(`Asset         : ${releaseInfo.assetName}\n\n`);

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question("Update now? [y/N]: ");
    return /^y(?:es)?$/i.test(String(answer || "").trim());
  } finally {
    rl.close();
  }
}

async function prepareTempWorkspace() {
  await fs.rm(TEMP_ROOT, { recursive: true, force: true });
  await fs.mkdir(EXTRACT_DIR, { recursive: true });
}

function validateReleaseAssetUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("Release asset URL is invalid.");
  }

  if (parsed.protocol !== "https:") {
    throw new Error("Release asset URL must use HTTPS.");
  }

  if (parsed.hostname !== "github.com") {
    throw new Error(`Release asset URL host is not allowed: ${parsed.hostname}`);
  }

  if (!parsed.pathname.startsWith(`/${GITHUB_OWNER}/${GITHUB_REPO}/releases/download/`)) {
    throw new Error("Release asset URL path is not allowed.");
  }

  return parsed.toString();
}

function validateFinalDownloadUrl(rawUrl) {
  let parsed;
  try {
    parsed = new URL(String(rawUrl || "").trim());
  } catch {
    throw new Error("Final download URL is invalid.");
  }

  if (parsed.protocol !== "https:" || !ALLOWED_REDIRECT_HOSTS.has(parsed.hostname)) {
    throw new Error(`Final download URL is not allowed: ${parsed.hostname || "(unknown host)"}`);
  }
}

async function downloadFile(url, destination) {
  const safeUrl = validateReleaseAssetUrl(url);
  let currentUrl = safeUrl;
  for (let i = 0; i < 5; i += 1) {
    const response = await fetch(currentUrl, {
      redirect: "manual",
      headers: {
        Accept: "application/octet-stream",
        "User-Agent": "pve-notebuddy-updater",
      },
    });

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) {
        throw new Error("Download redirect missing Location header.");
      }
      const nextUrl = new URL(location, currentUrl).toString();
      validateFinalDownloadUrl(nextUrl);
      currentUrl = nextUrl;
      continue;
    }

    if (!response.ok || !response.body) {
      throw new Error(`Download failed (${response.status} ${response.statusText})`);
    }

    validateFinalDownloadUrl(response.url || currentUrl);
    await pipeline(response.body, createWriteStream(destination));
    return;
  }

  throw new Error("Download failed: too many redirects.");
}

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "inherit" });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function extractZip(zipFile, targetDir) {
  if (process.platform === "win32") {
    await runCommand("powershell", [
      "-NoProfile",
      "-Command",
      `Expand-Archive -LiteralPath '${zipFile.replace(/'/g, "''")}' -DestinationPath '${targetDir.replace(/'/g, "''")}' -Force`,
    ]);
    return;
  }

  await runCommand("unzip", ["-oq", zipFile, "-d", targetDir]);
}

async function findPayloadRoot(extractRoot) {
  const entries = await fs.readdir(extractRoot, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const candidate = path.join(extractRoot, entry.name);
    if (await exists(path.join(candidate, "index.html"))) {
      return candidate;
    }
  }

  if (await exists(path.join(extractRoot, "index.html"))) {
    return extractRoot;
  }

  throw new Error("Could not locate extracted payload root (index.html missing).");
}

function toPosixRelative(absPath, basePath) {
  return path.relative(basePath, absPath).split(path.sep).join("/");
}

function isProtectedNoDelete(relPath) {
  if (!relPath) return false;
  if (PROTECTED_NO_DELETE_PATHS.has(relPath)) return true;
  for (const protectedPath of PROTECTED_NO_DELETE_PATHS) {
    if (relPath.startsWith(`${protectedPath}/`)) {
      return true;
    }
  }
  return false;
}

async function syncDirectory(sourceDir, targetDir, context, options = {}) {
  const { additiveOnly = false } = options;
  await fs.mkdir(targetDir, { recursive: true });

  const sourceEntries = await fs.readdir(sourceDir, { withFileTypes: true });
  const sourceNames = new Set(sourceEntries.map((entry) => entry.name));

  for (const sourceEntry of sourceEntries) {
    const sourcePath = path.join(sourceDir, sourceEntry.name);
    const targetPath = path.join(targetDir, sourceEntry.name);
    const rel = toPosixRelative(targetPath, APP_ROOT);
    const childAdditiveOnly = additiveOnly || isProtectedNoDelete(rel);

    if (sourceEntry.isDirectory()) {
      await syncDirectory(sourcePath, targetPath, context, { additiveOnly: childAdditiveOnly });
      continue;
    }

    if (sourceEntry.isFile()) {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.copyFile(sourcePath, targetPath);
      context.updated += 1;
      continue;
    }

    if (sourceEntry.isSymbolicLink()) {
      const linkTarget = await fs.readlink(sourcePath);
      const existing = await exists(targetPath);
      if (existing) {
        await fs.rm(targetPath, { recursive: true, force: true });
      }
      await fs.symlink(linkTarget, targetPath);
      context.updated += 1;
      continue;
    }

    stdout.write(`Skipping unsupported entry type: ${rel}\n`);
  }

  if (additiveOnly || isProtectedNoDelete(toPosixRelative(targetDir, APP_ROOT))) {
    return;
  }

  const targetEntries = await fs.readdir(targetDir, { withFileTypes: true });
  for (const targetEntry of targetEntries) {
    if (sourceNames.has(targetEntry.name)) {
      continue;
    }

    const targetPath = path.join(targetDir, targetEntry.name);
    const rel = toPosixRelative(targetPath, APP_ROOT);
    if (isProtectedNoDelete(rel)) {
      continue;
    }

    await fs.rm(targetPath, { recursive: true, force: true });
    context.deleted += 1;
  }
}

async function applyPayload(payloadRoot) {
  const context = { updated: 0, deleted: 0 };
  const topEntries = await fs.readdir(payloadRoot, { withFileTypes: true });

  for (const entry of topEntries) {
    const sourcePath = path.join(payloadRoot, entry.name);
    const targetPath = path.join(APP_ROOT, entry.name);

    if (entry.isDirectory()) {
      await syncDirectory(sourcePath, targetPath, context, { additiveOnly: false });
      continue;
    }

    if (entry.isFile()) {
      await fs.copyFile(sourcePath, targetPath);
      context.updated += 1;
      continue;
    }
  }

  return context;
}

async function main() {
  const localVersionText = await readLocalVersion();
  const release = await fetchLatestRelease();

  const localVersion = normalizeVersion(localVersionText);
  const remoteVersion = normalizeVersion(release.tag);

  if (!localVersion) {
    throw new Error(`Local version \"${localVersionText}\" is not valid semver (x.y.z).`);
  }
  if (!remoteVersion) {
    throw new Error(`Remote release tag \"${release.tag}\" is not valid semver (x.y.z or vx.y.z).`);
  }

  const comparison = compareVersions(remoteVersion, localVersion);
  if (comparison <= 0) {
    stdout.write(`Already up to date. Local version ${localVersion.raw} >= remote ${remoteVersion.raw}.\n`);
    return;
  }

  const approved = await askForConfirmation(localVersion.raw, remoteVersion.raw, release);
  if (!approved) {
    stdout.write("Update canceled by user.\n");
    return;
  }

  await prepareTempWorkspace();
  stdout.write("Downloading release asset...\n");
  await downloadFile(release.assetUrl, DOWNLOAD_ZIP);

  stdout.write("Extracting release package...\n");
  await extractZip(DOWNLOAD_ZIP, EXTRACT_DIR);

  const payloadRoot = await findPayloadRoot(EXTRACT_DIR);
  stdout.write(`Applying update from ${path.basename(payloadRoot)} ...\n`);
  const result = await applyPayload(payloadRoot);

  stdout.write(`Update completed. Files updated: ${result.updated}, deleted: ${result.deleted}.\n`);
  stdout.write("Protected path preserved from deletions: templates/custom\n");
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});
