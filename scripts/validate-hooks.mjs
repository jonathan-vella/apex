#!/usr/bin/env node
/**
 * VS Code Agent Hooks Validator
 *
 * Validates .github/hooks/ configuration:
 * 1. Each hooks.json has valid schema (correct event names, timeout range)
 * 2. Referenced scripts exist and shell hooks are invoked through bash
 * 3. Scripts follow shell conventions (shebang, set -euo pipefail)
 * 4. .vscode/settings.json chat.hookFilesLocations includes all hook directories
 * 5. Agent-scoped hooks (if enabled) have valid YAML syntax
 */

import { readFileSync, existsSync, readdirSync } from "node:fs";
import { resolve, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "./_lib/parse-jsonc.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

const HOOKS_DIR = resolve(REPO_ROOT, ".github/hooks");
const SETTINGS_PATH = resolve(REPO_ROOT, ".vscode/settings.json");

const VALID_EVENTS = new Set([
  "PreToolUse",
  "PostToolUse",
  "SessionStart",
  "UserPromptSubmit",
  "PreCompact",
  "SubagentStart",
  "SubagentStop",
  "Stop",
]);

const MIN_TIMEOUT = 1;
const MAX_TIMEOUT = 300;

let errors = 0;
let warnings = 0;

function pass(msg) {
  console.log(`  ✅ ${msg}`);
}

function fail(msg) {
  console.error(`  ❌ ${msg}`);
  errors++;
}

function warn(msg) {
  console.warn(`  ⚠️  ${msg}`);
  warnings++;
}

function parseCommand(command) {
  const normalized = command.trim();
  const bashPrefix = "bash ";

  if (normalized.startsWith(bashPrefix)) {
    return {
      scriptPath: normalized.slice(bashPrefix.length).trim(),
      usesBash: true,
    };
  }

  return {
    scriptPath: normalized,
    usesBash: false,
  };
}

console.log("🔍 Validating agent hooks configuration...\n");

// ── 1. Discover hook directories ──
if (!existsSync(HOOKS_DIR)) {
  fail(".github/hooks/ directory does not exist");
  process.exit(1);
}

const hookDirs = readdirSync(HOOKS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory())
  .map((d) => d.name);

if (hookDirs.length === 0) {
  fail("No hook directories found under .github/hooks/");
  process.exit(1);
}

console.log(
  `Found ${hookDirs.length} hook directories: ${hookDirs.join(", ")}\n`,
);

// ── 2. Validate each hook directory ──
const discoveredDirs = [];

for (const dir of hookDirs) {
  const dirPath = resolve(HOOKS_DIR, dir);
  const hookJsonPath = resolve(dirPath, "hooks.json");

  console.log(`📂 ${dir}/`);

  // 2a. hooks.json must exist
  if (!existsSync(hookJsonPath)) {
    fail(`${dir}/hooks.json not found`);
    continue;
  }

  // 2b. Parse JSON
  let hookConfig;
  try {
    hookConfig = JSON.parse(readFileSync(hookJsonPath, "utf-8"));
  } catch (e) {
    fail(`${dir}/hooks.json is invalid JSON: ${e.message}`);
    continue;
  }

  // 2c. Must have "hooks" key
  if (!hookConfig.hooks || typeof hookConfig.hooks !== "object") {
    fail(`${dir}/hooks.json missing top-level "hooks" object`);
    continue;
  }

  // 2d. Validate event names and entries
  for (const [event, entries] of Object.entries(hookConfig.hooks)) {
    if (!VALID_EVENTS.has(event)) {
      fail(
        `${dir}/hooks.json has invalid event name: "${event}". Valid: ${[...VALID_EVENTS].join(", ")}`,
      );
      continue;
    }

    if (!Array.isArray(entries)) {
      fail(`${dir}/hooks.json event "${event}" must be an array`);
      continue;
    }

    for (const entry of entries) {
      // 2e. Validate type
      if (entry.type !== "command") {
        fail(
          `${dir}/hooks.json entry type must be "command", got "${entry.type}"`,
        );
      }

      // 2f. Validate command path
      if (!entry.command) {
        fail(`${dir}/hooks.json entry missing "command" field`);
        continue;
      }

      const { scriptPath: commandScriptPath, usesBash } = parseCommand(
        entry.command,
      );

      if (commandScriptPath.endsWith(".sh") && !usesBash) {
        fail(
          `${dir}/hooks.json must invoke shell scripts via "bash <script>" to avoid execute-bit issues: ${entry.command}`,
        );
      } else if (commandScriptPath.endsWith(".sh") && usesBash) {
        pass(`Shell script uses durable bash invocation`);
      }

      const scriptPath = resolve(REPO_ROOT, commandScriptPath);
      if (!existsSync(scriptPath)) {
        fail(`${dir}/hooks.json references missing script: ${commandScriptPath}`);
      } else {
        pass(`Script exists: ${commandScriptPath}`);

        // 2g. Check shebang and set -euo pipefail
        const scriptContent = readFileSync(scriptPath, "utf-8");
        const lines = scriptContent.split("\n");
        if (!lines[0]?.startsWith("#!/usr/bin/env bash")) {
          fail(`Script ${commandScriptPath} missing shebang (#!/usr/bin/env bash)`);
        } else {
          pass(`Script has correct shebang`);
        }

        if (!scriptContent.includes("set -euo pipefail")) {
          fail(`Script ${commandScriptPath} missing "set -euo pipefail"`);
        } else {
          pass(`Script has set -euo pipefail`);
        }
      }

      // 2h. Validate timeout
      if (entry.timeout !== undefined) {
        if (
          typeof entry.timeout !== "number" ||
          entry.timeout < MIN_TIMEOUT ||
          entry.timeout > MAX_TIMEOUT
        ) {
          fail(
            `${dir}/hooks.json timeout must be ${MIN_TIMEOUT}-${MAX_TIMEOUT}s, got ${entry.timeout}`,
          );
        } else {
          pass(`Timeout: ${entry.timeout}s`);
        }
      }
    }
  }

  discoveredDirs.push(dir);
  console.log("");
}

// ── 3. Cross-check with .vscode/settings.json ──
console.log("📋 Cross-checking with .vscode/settings.json...\n");

if (!existsSync(SETTINGS_PATH)) {
  fail(".vscode/settings.json not found");
} else {
  let settings;
  try {
    settings = parseJsonc(readFileSync(SETTINGS_PATH, "utf-8"));
  } catch (e) {
    fail(`.vscode/settings.json parse error: ${e.message}`);
    settings = null;
  }

  if (settings) {
    const hookLocations = settings["chat.hookFilesLocations"] || {};

    for (const dir of discoveredDirs) {
      const settingsKey = `.github/hooks/${dir}`;
      if (hookLocations[settingsKey] === true) {
        pass(`settings.json includes ${settingsKey}`);
      } else {
        fail(`settings.json missing hook directory: ${settingsKey}`);
      }
    }

    // Check for stale entries in settings that don't exist on disk
    for (const key of Object.keys(hookLocations)) {
      const dirName = basename(key);
      if (!discoveredDirs.includes(dirName)) {
        warn(`settings.json references non-existent hook directory: ${key}`);
      }
    }
  }
}

// ── 4. Summary ──
console.log("\n" + "─".repeat(50));
if (errors === 0) {
  console.log(`\n✅ Hook validation passed (${warnings} warning(s))`);
} else {
  console.error(
    `\n❌ Hook validation failed: ${errors} error(s), ${warnings} warning(s)`,
  );
  process.exit(1);
}
