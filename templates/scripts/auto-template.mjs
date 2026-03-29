#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin, stdout, argv, execPath } from "node:process";
import { fileURLToPath } from "node:url";

const TEMPLATE_DIR = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.join(TEMPLATE_DIR, "scripts");

function toDisplayName(filePath) {
  return path.basename(filePath);
}

async function listScripts(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".mjs"))
    .map((entry) => path.join(dir, entry.name))
    .sort((a, b) => a.localeCompare(b));
}

async function askSelection(files) {
  stdout.write("Select a script to run:\n");
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
    scripts = await listScripts(SCRIPTS_DIR);
  } catch (error) {
    console.error(`Could not read scripts directory at ${SCRIPTS_DIR}: ${error.message}`);
    process.exitCode = 1;
    return;
  }

  if (scripts.length === 0) {
    console.error(`No scripts found in ${SCRIPTS_DIR}`);
    process.exitCode = 1;
    return;
  }

  const selected = await askSelection(scripts);
  if (!selected) {
    console.error("Invalid selection.");
    process.exitCode = 1;
    return;
  }
  if (selected === "QUIT") {
    stdout.write("Aborted.\n");
    return;
  }

  stdout.write(`Running: ${toDisplayName(selected)} ${argv.slice(2).join(" ")}\n`);
  const code = await runScript(selected, argv.slice(2));
  process.exitCode = code;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
