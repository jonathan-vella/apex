#!/usr/bin/env node
/**
 * VS Code Configuration Validator
 *
 * Validates that VS Code 1.109 orchestration settings are correctly configured:
 * 1. Required settings exist in devcontainer.json
 * 2. Extensions.json includes all required extensions
 * 3. Devcontainer.json extensions match extensions.json
 */

import { readFileSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..");

// Required VS Code 1.109 settings
const REQUIRED_SETTINGS = [
  "chat.customAgentInSubagent.enabled",
  "chat.agentFilesLocations",
  "chat.agentSkillsLocations",
  "chat.useAgentSkills",
];

// Required extensions for full orchestration support
const REQUIRED_EXTENSIONS = [
  "GitHub.copilot",
  "GitHub.copilot-chat",
  "ms-azuretools.vscode-azure-github-copilot",
  "ms-azuretools.vscode-bicep",
  "DavidAnson.vscode-markdownlint",
];

let errors = [];
let warnings = [];

/**
 * Parse JSON with comments (JSONC) - handles devcontainer.json format
 */
function parseJsonc(content) {
  // Step 1: Remove block comments /* ... */
  let result = content.replace(/\/\*[\s\S]*?\*\//g, "");
  
  // Step 2: Remove single-line comments // ... but not in strings
  // We do this line by line to be safe
  const lines = result.split("\n");
  const processedLines = lines.map((line) => {
    // Find the first // that's not inside a string
    let inString = false;
    let escapeNext = false;
    for (let i = 0; i < line.length - 1; i++) {
      const char = line[i];
      
      if (escapeNext) {
        escapeNext = false;
        continue;
      }
      
      if (char === "\\") {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        inString = !inString;
        continue;
      }
      
      if (!inString && char === "/" && line[i + 1] === "/") {
        return line.substring(0, i);
      }
    }
    return line;
  });
  
  result = processedLines.join("\n");
  
  // Step 3: Remove trailing commas before } or ]
  result = result.replace(/,(\s*[\]}])/g, "$1");
  
  return JSON.parse(result);
}

/**
 * Check devcontainer.json for required settings
 */
function validateDevcontainer() {
  const devcontainerPath = resolve(REPO_ROOT, ".devcontainer/devcontainer.json");

  if (!existsSync(devcontainerPath)) {
    errors.push("❌ .devcontainer/devcontainer.json not found");
    return;
  }

  console.log("📋 Checking devcontainer.json...");

  try {
    const content = readFileSync(devcontainerPath, "utf-8");
    const config = parseJsonc(content);

    const settings = config?.customizations?.vscode?.settings || {};
    const extensions = config?.customizations?.vscode?.extensions || [];

    // Check required settings
    for (const setting of REQUIRED_SETTINGS) {
      if (!(setting in settings)) {
        errors.push(`❌ Missing required setting: ${setting}`);
      } else {
        console.log(`   ✓ ${setting}`);
      }
    }

    // Check if subagent setting is true
    if (settings["chat.customAgentInSubagent.enabled"] !== true) {
      errors.push(
        "❌ chat.customAgentInSubagent.enabled must be true for Conductor orchestration"
      );
    }

    // Check agent paths
    const agentPaths = settings["chat.agentFilesLocations"] || {};
    if (!agentPaths[".github/agents"]) {
      warnings.push("⚠️  .github/agents not in chat.agentFilesLocations");
    }
    if (!agentPaths[".github/agents/_subagents"]) {
      warnings.push(
        "⚠️  .github/agents/_subagents not in chat.agentFilesLocations"
      );
    }

    // Check skills path
    const skillPaths = settings["chat.agentSkillsLocations"] || {};
    if (!skillPaths[".github/skills"]) {
      warnings.push("⚠️  .github/skills not in chat.agentSkillsLocations");
    }

    // Store extensions for cross-check
    return extensions;
  } catch (e) {
    errors.push(`❌ Failed to parse devcontainer.json: ${e.message}`);
    return [];
  }
}

/**
 * Check extensions.json for required extensions
 */
function validateExtensions() {
  const extensionsPath = resolve(REPO_ROOT, ".vscode/extensions.json");

  if (!existsSync(extensionsPath)) {
    warnings.push(
      "⚠️  .vscode/extensions.json not found (optional but recommended)"
    );
    return [];
  }

  console.log("\n📦 Checking extensions.json...");

  try {
    const content = readFileSync(extensionsPath, "utf-8");
    const config = JSON.parse(content);
    const recommendations = config?.recommendations || [];

    for (const ext of REQUIRED_EXTENSIONS) {
      const found = recommendations.some(
        (r) => r.toLowerCase() === ext.toLowerCase()
      );
      if (!found) {
        warnings.push(`⚠️  Missing recommended extension: ${ext}`);
      } else {
        console.log(`   ✓ ${ext}`);
      }
    }

    return recommendations;
  } catch (e) {
    errors.push(`❌ Failed to parse extensions.json: ${e.message}`);
    return [];
  }
}

/**
 * Cross-check devcontainer extensions with extensions.json
 */
function crossCheckExtensions(devcontainerExts, extensionsJsonExts) {
  if (devcontainerExts.length === 0 || extensionsJsonExts.length === 0) {
    return;
  }

  console.log("\n🔗 Cross-checking extension lists...");

  const devLower = devcontainerExts.map((e) => e.toLowerCase());
  const extLower = extensionsJsonExts.map((e) => e.toLowerCase());

  // Check for required extensions in devcontainer
  for (const ext of REQUIRED_EXTENSIONS) {
    const lower = ext.toLowerCase();
    if (!devLower.includes(lower)) {
      warnings.push(`⚠️  ${ext} in extensions.json but not in devcontainer.json`);
    }
  }

  console.log(`   ✓ ${devcontainerExts.length} extensions in devcontainer.json`);
  console.log(`   ✓ ${extensionsJsonExts.length} extensions in extensions.json`);
}

// Main execution
console.log("🔍 VS Code 1.109 Configuration Validator\n");
console.log("=".repeat(50) + "\n");

const devcontainerExts = validateDevcontainer();
const extensionsJsonExts = validateExtensions();
crossCheckExtensions(devcontainerExts, extensionsJsonExts);

// Summary
console.log("\n" + "=".repeat(50));
console.log("📊 Validation Summary\n");

if (warnings.length > 0) {
  console.log("Warnings:");
  warnings.forEach((w) => console.log("  " + w));
}

if (errors.length > 0) {
  console.log("\nErrors:");
  errors.forEach((e) => console.log("  " + e));
  console.log("\n❌ Validation FAILED with " + errors.length + " error(s)");
  console.log("\n🔧 Remediation:");
  console.log("   1. Review devcontainer.json customizations.vscode.settings");
  console.log("   2. Ensure all required VS Code 1.109 settings are present");
  console.log("   3. Check .vscode/extensions.json for recommended extensions");
  process.exit(1);
} else {
  console.log("\n✅ VS Code configuration is valid for 1.109 orchestration");
  process.exit(0);
}
