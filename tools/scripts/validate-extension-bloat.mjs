#!/usr/bin/env node

// validate-extension-bloat.mjs
//
// Rejects dev-container additions of VS Code extensions known to ship heavy
// Copilot chat customizations (chatSkills / chatAgents / chatPromptFiles)
// that duplicate the APEX workflow and inflate per-turn input-token cost
// by ~5-7k each.
//
// Denylist is intentionally conservative: only extensions audited as
// adding bloat WITHOUT serving the APEX workflow. Borderline cases
// (Cosmos DB, GitHub PR review) stay off the denylist; they are
// `unwantedRecommendations` only.
//
// Linked docs:
//   - docs/devcontainer-hygiene.md (rationale + per-developer cleanup)
//   - .vscode/extensions.json (unwantedRecommendations dialog)
//
// Known gap: this validator only scans the literal `extensions` array, not
// the transitive `extensionPack` members of an installed pack. As of
// 2026-06-30, `ms-vscode.vscode-node-azure-pack` (Azure Tools) is declared
// in devcontainer.json and its extensionPack bundles two DENYLIST entries
// (vscode-azure-github-copilot, ms-windows-ai-studio) — those install
// transitively and are NOT caught here. Disable them manually per the
// devcontainer.json comment near `customizations.vscode.extensions`.

import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseJsonc } from "./_lib/parse-jsonc.mjs";
import { Reporter } from "./_lib/reporter.mjs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const repoRoot = resolve(__dirname, "../..");
const devcontainerPath = resolve(repoRoot, ".devcontainer/devcontainer.json");

// Extensions audited as contributing heavy Copilot chat customizations
// without serving the APEX workflow. Source: extension package.json
// `contributes.chatSkills` / `chatAgents` / `chatPromptFiles` inspection
// against the test03 debug log (a3ca0888).
const DENYLIST = new Map([
  [
    "ms-azuretools.vscode-azure-github-copilot",
    "9 chatAgents + 7 chatPromptFiles duplicating APEX's own end-to-end agent set",
  ],
  ["ms-windows-ai-studio", "AI Toolkit: 2 chatSkills + 2 chatAgents, out of scope for APEX"],
  ["teamsdevapp.vscode-ai-foundry", "AI Foundry chatAgents, out of scope for APEX"],
]);

const r = new Reporter("Extension Bloat Validator");
r.header();

if (!existsSync(devcontainerPath)) {
  r.error("Missing .devcontainer/devcontainer.json");
  r.summary();
  r.exitOnError();
}

let dc;
try {
  dc = parseJsonc(readFileSync(devcontainerPath, "utf-8"));
} catch (error) {
  r.error(`Invalid JSONC in .devcontainer/devcontainer.json: ${error.message}`);
  r.summary();
  r.exitOnError();
}

const extensions = dc?.customizations?.vscode?.extensions ?? [];
if (!Array.isArray(extensions)) {
  r.error("customizations.vscode.extensions is not an array");
  r.summary();
  r.exitOnError();
}

// Case-insensitive compare (VS Code extension IDs are typically lowercase but
// `.devcontainer/devcontainer.json` may use mixed case e.g. `HashiCorp.terraform`).
const lowerDenylist = new Map(Array.from(DENYLIST, ([k, v]) => [k.toLowerCase(), { id: k, reason: v }]));

for (const ext of extensions) {
  if (typeof ext !== "string") continue;
  const hit = lowerDenylist.get(ext.toLowerCase());
  if (hit) {
    r.errorAnnotation(".devcontainer/devcontainer.json", `Bloat extension declared: ${hit.id} — ${hit.reason}`);
    console.log(`  Fix: Remove "${hit.id}" from customizations.vscode.extensions[]. See docs/devcontainer-hygiene.md.`);
  }
}

console.log(
  `Checked ${extensions.length} dev-container extension(s) against ${DENYLIST.size} denylisted bloat contributor(s).`,
);

r.summary();
r.exitOnError();
