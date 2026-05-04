#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, execPath } from "node:process";
import { fileURLToPath } from "node:url";

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ENTRY_BASENAME = path.basename(fileURLToPath(import.meta.url));
const APP_UPDATE_SCRIPT = path.resolve(SCRIPT_DIR, "..", "app-update.mjs");
const MENU_LABELS = new Map([
  ["app-update.mjs", "Update NoteBuddy App from GitHub Release"],
  ["community-scripts.mjs", "Update Templates from Community-Scripts"],
  ["generate-templates.mjs", "Generate Index Files"],
  ["selfhst.mjs", "Update selfh.st Icons + Sidepanel Index"],
]);

function toDisplayName(filePath) {
  const file = path.basename(filePath);
  return MENU_LABELS.get(file) || file;
}

async function listScripts(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const scripts = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mjs") && entry.name !== ENTRY_BASENAME)
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));

  try {
    await fs.access(APP_UPDATE_SCRIPT);
    scripts.unshift(APP_UPDATE_SCRIPT);
  } catch {
    // optional external script
  }

  return scripts;
}

async function askSelection(files) {
  stdout.write("========================================\n");
  stdout.write("   PVE NoteBuddy Updater CLI\n");
  stdout.write("========================================\n");
  stdout.write("Select an action:\n");
  files.forEach((file, index) => {
    stdout.write(`${index + 1}. ${toDisplayName(file)}\n`);
  });
  stdout.write(`${files.length + 1}. Quit\n`);

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question("Enter number: ");
    const selected = Number.parseInt(String(answer).trim(), 10);
    if (!Number.isFinite(selected) || selected < 1 || selected > files.length + 1) {
      return null;
    }
    if (selected === files.length + 1) {
      return "QUIT";
    }
    return files[selected - 1];
  } finally {
    rl.close();
  }
}

async function askPostRunAction(selectedFile, exitCode) {
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const canRunGenerate = selectedFile === "community-scripts.mjs" || selectedFile === "app-update.mjs";
    const choices = canRunGenerate
      ? ["1) Run Generate Index Files", "2) Back to menu", "3) Quit"]
      : ["1) Back to menu", "2) Quit"];
    const question = canRunGenerate ? "Next action [1-3]: " : "Next action [1-2]: ";

    stdout.write(`\nFinished ${selectedFile} with exit code ${exitCode}.\n`);
    for (const choice of choices) {
      stdout.write(`${choice}\n`);
    }
    const answer = await rl.question(question);
    const selected = Number.parseInt(String(answer).trim(), 10);
    if (canRunGenerate) {
      if (selected === 1) return "RUN_GENERATE";
      if (selected === 2) return "MENU";
      if (selected === 3) return "QUIT";
      return "INVALID";
    }
    if (selected === 1) return "MENU";
    if (selected === 2) return "QUIT";
    return "INVALID";
  } finally {
    rl.close();
  }
}

function runScript(scriptPath, passThroughArgs) {
  return new Promise((resolve) => {
    const child = spawn(execPath, [scriptPath, ...passThroughArgs], {
      stdio: "inherit",
    });
    child.on("close", (code) => resolve(typeof code === "number" ? code : 1));
    child.on("error", () => resolve(1));
  });
}

async function main() {
  let scripts = [];
  try {
    scripts = await listScripts(SCRIPT_DIR);
  } catch (error) {
    console.error(`Could not read scripts directory at ${SCRIPT_DIR}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (scripts.length === 0) {
    console.error(`No scripts found in ${SCRIPT_DIR}`);
    process.exitCode = 1;
    return;
  }

  const scriptByName = new Map(scripts.map((item) => [path.basename(item), item]));
  let shouldExit = false;
  let pendingRun = null;
  let lastExitCode = 0;

  while (!shouldExit) {
    const selected = pendingRun || (await askSelection(scripts));
    pendingRun = null;
    if (!selected) {
      console.error("Invalid selection.");
      process.exitCode = 1;
      return;
    }
    if (selected === "QUIT") {
      stdout.write("Aborted.\n");
      break;
    }

    const label = toDisplayName(selected);
    const selectedFile = path.basename(selected);
    stdout.write(`\n> Running: ${label} (${selectedFile}) ${argv.slice(2).join(" ")}\n`);
    lastExitCode = await runScript(selected, argv.slice(2));

    const action = await askPostRunAction(selectedFile, lastExitCode);
    if (action === "QUIT") {
      shouldExit = true;
      continue;
    }
    if (action === "MENU") {
      continue;
    }
    if (action === "RUN_GENERATE") {
      const generateScript = scriptByName.get("generate-templates.mjs");
      if (!generateScript) {
        console.error("Could not find generate-templates.mjs in scripts directory.");
        process.exitCode = 1;
        return;
      }
      pendingRun = generateScript;
      continue;
    }
    console.error("Invalid selection.");
    process.exitCode = 1;
    return;
  }

  process.exitCode = lastExitCode;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
