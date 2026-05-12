#!/usr/bin/env node
/**
 * One-time legacy challenger-findings migration to v1.0.
 *
 * Migrates `agent-output/{project}/challenge-findings-*.json` sidecars
 * (NOT `*-decisions.json`) from the legacy shape:
 *
 *   {
 *     "$schema": "../schemas/challenge-findings-decisions.schema.json",  // dangling
 *     "challenged_artifact": "...",
 *     "issues": [
 *       {
 *         "severity": "must_fix",
 *         "category": "governance_gap",
 *         "title": "...",
 *         "description": "...",
 *         "failure_scenario": "...",
 *         "artifact_section": "...",
 *         "suggested_mitigation": "..."
 *       }
 *     ]
 *   }
 *
 * to the v1.0 shape:
 *
 *   {
 *     "schema_version": "1.0",
 *     "challenged_artifact": "...",
 *     "findings": [
 *       {
 *         "id": "<8-char sha256 of category|claim|artifact_section>",
 *         "severity": "must_fix",
 *         "category": "governance_gap",
 *         "claim": "...",
 *         "evidence": "...",
 *         "impact": "...",
 *         "artifact_section": "...",
 *         "suggested_fix": {                  // REQUIRED for must_fix
 *           "artifact_path": "<challenged_artifact>",
 *           "proposed_edit": "<suggested_mitigation>"
 *         },
 *         "traces_to": []
 *       }
 *     ],
 *     "cache_inputs": {
 *       "artifact_sha": "legacy-migration",   // placeholder; can't be reconstructed
 *       "checklists_sha": "legacy-migration",
 *       "protocol_sha": "legacy-migration",
 *       "subagent_sha": "legacy-migration",
 *       "model": "legacy-migration",
 *       "artifact_hash": "legacy-migration"
 *     }
 *   }
 *
 * Field map (per plan-simplifyChallengerReviews.prompt.md, Phase 8):
 *   issues               → findings
 *   title                → claim
 *   description          → evidence
 *   failure_scenario     → impact
 *   suggested_mitigation → suggested_fix.proposed_edit
 *
 * Idempotent: second run is a no-op (already-migrated files are
 * detected via `schema_version === "1.0"`).
 *
 * Usage:
 *   node tools/scripts/migrate-legacy-findings.mjs              # migrate
 *   node tools/scripts/migrate-legacy-findings.mjs --dry-run    # preview only
 */

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const ROOT = "agent-output";
const DRY_RUN = process.argv.includes("--dry-run");

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, acc);
    } else if (
      entry.isFile() &&
      entry.name.startsWith("challenge-findings-") &&
      entry.name.endsWith(".json") &&
      !entry.name.endsWith("-decisions.json")
    ) {
      acc.push(full);
    }
  }
  return acc;
}

function computeId(category, claim, artifactSection) {
  const input = `${category ?? ""}|${claim ?? ""}|${artifactSection ?? ""}`;
  return crypto.createHash("sha256").update(input).digest("hex").slice(0, 8);
}

function legacyCacheInputs() {
  return {
    artifact_sha: "legacy-migration",
    checklists_sha: "legacy-migration",
    protocol_sha: "legacy-migration",
    subagent_sha: "legacy-migration",
    model: "legacy-migration",
    artifact_hash: "legacy-migration",
  };
}

function migrateFinding(item) {
  const claim = item.claim ?? item.title ?? "";
  const evidence = item.evidence ?? item.description ?? "";
  const impact = item.impact ?? item.failure_scenario ?? "";
  const artifactSection = item.artifact_section ?? "";
  const id = item.id ?? computeId(item.category, claim, artifactSection);
  const out = {
    id,
    severity: item.severity,
    category: item.category,
    claim,
    evidence,
    impact,
    artifact_section: artifactSection,
    traces_to: Array.isArray(item.traces_to) ? item.traces_to : [],
  };
  // Preserve existing suggested_fix when already present (post-migration files).
  if (item.suggested_fix && typeof item.suggested_fix === "object") {
    out.suggested_fix = item.suggested_fix;
  } else if (item.suggested_mitigation) {
    // Legacy: promote suggested_mitigation into suggested_fix.proposed_edit.
    out.suggested_fix = { proposed_edit: item.suggested_mitigation };
  }
  // must_fix MUST carry suggested_fix.artifact_path; default to the
  // challenged artifact path if missing.
  if (out.severity === "must_fix") {
    if (!out.suggested_fix) out.suggested_fix = {};
    if (!out.suggested_fix.proposed_edit) {
      out.suggested_fix.proposed_edit = item.suggested_mitigation ?? "(no edit specified in legacy sidecar)";
    }
  }
  if (item.requires_step) out.requires_step = item.requires_step;
  return out;
}

function migrateOne(doc, challengedArtifact) {
  const findings = Array.isArray(doc.findings) ? doc.findings : Array.isArray(doc.issues) ? doc.issues : [];
  const migratedFindings = findings.map(migrateFinding);
  // Ensure every must_fix finding has artifact_path filled.
  for (const f of migratedFindings) {
    if (f.severity === "must_fix" && f.suggested_fix && !f.suggested_fix.artifact_path) {
      f.suggested_fix.artifact_path = challengedArtifact;
    }
  }
  return migratedFindings;
}

function migrateDoc(doc) {
  if (doc.schema_version === "1.0" && Array.isArray(doc.findings)) {
    return { migrated: doc, changed: false };
  }
  // Batch mode
  if (Array.isArray(doc.batch_results)) {
    const out = { ...doc };
    out.schema_version = "1.0";
    delete out.$schema;
    out.batch_results = doc.batch_results.map((entry) => {
      const sub = migrateDoc(entry).migrated;
      return sub;
    });
    if (!out.cache_inputs) out.cache_inputs = legacyCacheInputs();
    return { migrated: out, changed: true };
  }
  const out = { schema_version: "1.0", ...doc };
  delete out.$schema;
  const challengedArtifact = doc.challenged_artifact ?? "";
  out.findings = migrateOne(doc, challengedArtifact);
  delete out.issues;
  if (!out.cache_inputs) out.cache_inputs = legacyCacheInputs();
  return { migrated: out, changed: true };
}

const files = walk(ROOT);
let touched = 0;
let skipped = 0;

console.log(`\n🔄 Migrating challenger findings sidecars under ${ROOT}/ ...\n`);

for (const file of files) {
  let raw;
  try {
    raw = fs.readFileSync(file, "utf-8");
  } catch (e) {
    console.error(`  ❌ ${file}: cannot read (${e.message})`);
    process.exitCode = 1;
    continue;
  }
  let doc;
  try {
    doc = JSON.parse(raw);
  } catch (e) {
    console.error(`  ❌ ${file}: invalid JSON (${e.message})`);
    process.exitCode = 1;
    continue;
  }
  const { migrated, changed } = migrateDoc(doc);
  if (!changed) {
    console.log(`  ⏭️  ${file}: already v1.0`);
    skipped++;
    continue;
  }
  if (DRY_RUN) {
    console.log(`  📝 ${file}: would migrate (${(migrated.findings ?? []).length} findings)`);
  } else {
    const tmp = `${file}.tmp`;
    fs.writeFileSync(tmp, `${JSON.stringify(migrated, null, 2)}\n`);
    fs.renameSync(tmp, file);
    console.log(`  ✅ ${file}: migrated (${(migrated.findings ?? []).length} findings)`);
  }
  touched++;
}

console.log(`\nDone. ${touched} file(s) ${DRY_RUN ? "would be" : ""} migrated, ${skipped} already v1.0.`);
