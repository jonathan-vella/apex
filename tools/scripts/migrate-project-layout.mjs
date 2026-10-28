#!/usr/bin/env node
/**
 * Migrate an agent-output/{project}/ directory from layout_version 1 (flat)
 * to layout_version 2 (Markdown-only root + assets/, contracts/, reviews/, _meta/).
 *
 * Preserves exact bytes of all challenger-reviewed Markdown deliverables and
 * frozen JSON contracts so SHA-256 provenance remains intact.
 *
 * Usage:
 *   node tools/scripts/migrate-project-layout.mjs <project> [--dry-run]
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LAYOUT_SUBDIRS } from "./_lib/project-paths.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const CANONICAL_CONTRACTS = new Set([
  "sku-manifest.json",
  "02-cost-estimate.json",
  "04-policy-feasibility.json",
  "04-governance-constraints.json",
  "04-iac-contract.json",
  "04-policy-property-map.json",
  "04-environment-manifest.json",
  "05-iac-handoff.json",
  "07-ab-cost-estimate.json",
  "09-lessons-learned.json",
]);

const MUTABLE_MARKDOWN = new Set([
  "README.md",
  "00-handoff.md",
  "05-implementation-reference.md",
  "09-lessons-learned.md",
]);

function classifyEntry(entry) {
  const name = entry.name;
  if (LAYOUT_SUBDIRS.includes(name) || name.startsWith(".")) return null;
  if (name === "__pycache__") return { action: "delete" };

  if (entry.isDirectory()) {
    if (/^\d{2}-inputs$/.test(name)) return { action: "move", dest: path.join("_meta", "inputs", name) };
    if (name.endsWith(".retail-evidence")) return { action: "move", dest: path.join("_meta", "pricing", name) };
    return { action: "move", dest: path.join("_meta", "scratch", name) };
  }

  if (name.endsWith(".preview.md")) {
    return { action: "move", dest: path.join("_meta", "previews", name) };
  }
  if (/^assessment-step-.*\.(json|md)$/.test(name)) {
    return { action: "move", dest: path.join("_meta", name) };
  }
  if (name.endsWith(".md")) {
    return null; // Keep human-facing Markdown deliverables at root
  }
  if (name.startsWith("00-session-state.json")) {
    return { action: "move", dest: path.join("_meta", name) };
  }
  if (CANONICAL_CONTRACTS.has(name)) {
    return { action: "move", dest: path.join("contracts", name) };
  }
  if (name.startsWith("challenge-findings-") && name.endsWith(".json")) {
    return { action: "move", dest: path.join("reviews", name) };
  }
  if (/\.(py|png|svg)$/i.test(name)) {
    return { action: "move", dest: path.join("assets", name) };
  }
  if (name.endsWith(".request.json") || /^02-cost-candidates-.*\.json$/.test(name)) {
    return { action: "move", dest: path.join("_meta", "pricing", name) };
  }
  return { action: "move", dest: path.join("_meta", "scratch", name) };
}

export function migrateProject(project, { dryRun = false, root = ROOT } = {}) {
  const projDir = path.join(root, "agent-output", project);
  if (!fs.existsSync(projDir) || !fs.statSync(projDir).isDirectory()) {
    throw new Error(`Project directory not found: ${projDir}`);
  }

  const entries = fs.readdirSync(projDir, { withFileTypes: true });
  const operations = [];
  const movedMap = new Map(); // oldName -> newRelPath

  for (const entry of entries) {
    const plan = classifyEntry(entry);
    if (!plan) continue;
    operations.push({ name: entry.name, ...plan });
    if (plan.action === "move") {
      movedMap.set(entry.name, plan.dest.split(path.sep).join("/"));
    }
  }

  if (!dryRun) {
    for (const sub of LAYOUT_SUBDIRS) {
      fs.mkdirSync(path.join(projDir, sub), { recursive: true });
    }
    for (const metaSub of ["inputs", "pricing", "previews", "scratch"]) {
      fs.mkdirSync(path.join(projDir, "_meta", metaSub), { recursive: true });
    }

    for (const op of operations) {
      const src = path.join(projDir, op.name);
      if (op.action === "delete") {
        fs.rmSync(src, { recursive: true, force: true });
      } else if (op.action === "move") {
        const dst = path.join(projDir, op.dest);
        fs.mkdirSync(path.dirname(dst), { recursive: true });
        if (fs.existsSync(dst)) {
          fs.rmSync(dst, { recursive: true, force: true });
        }
        fs.renameSync(src, dst);
      }
    }

    // Update layout_version: 2 in _meta/00-session-state.json
    const statePath = path.join(projDir, "_meta", "00-session-state.json");
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
      state.layout_version = 2;
      if (state.metadata?.policy_feasibility?.path === `agent-output/${project}/04-policy-feasibility.json`) {
        state.metadata.policy_feasibility.path = `agent-output/${project}/contracts/04-policy-feasibility.json`;
      }
      if (state.review_selections) {
        for (const sel of Object.values(state.review_selections)) {
          if (sel && typeof sel.path === "string") {
            const base = path.basename(sel.path);
            if (movedMap.has(base)) {
              sel.path = `agent-output/${project}/${movedMap.get(base)}`;
            }
          }
        }
      }
      fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
    }

    // Update links in non-frozen companion Markdown files
    for (const mdName of MUTABLE_MARKDOWN) {
      const mdPath = path.join(projDir, mdName);
      if (!fs.existsSync(mdPath)) continue;
      let text = fs.readFileSync(mdPath, "utf8");
      let changed = false;
      for (const [oldName, newRel] of movedMap.entries()) {
        const escaped = oldName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const linkRe = new RegExp(`(\\]\\((?:\\.\\/)?)${escaped}(\\))`, "g");
        const next = text.replace(linkRe, `$1${newRel}$2`);
        if (next !== text) {
          text = next;
          changed = true;
        }
      }
      if (changed) fs.writeFileSync(mdPath, text);
    }
  }

  return { project, dryRun, operationsCount: operations.length, operations };
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const project = args.find((a) => !a.startsWith("--"));
  if (!project) {
    console.error("Usage: node tools/scripts/migrate-project-layout.mjs <project> [--dry-run]");
    process.exit(2);
  }
  const res = migrateProject(project, { dryRun });
  console.log(
    `${dryRun ? "[DRY-RUN] " : ""}Migrated agent-output/${project}/ (${res.operationsCount} items moved into assets/, contracts/, reviews/, _meta/)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main();
}
