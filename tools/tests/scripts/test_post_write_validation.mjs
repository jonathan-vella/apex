#!/usr/bin/env node
/**
 * test_post_write_validation.mjs — guard the post-write validation
 * contract added for issue #425.
 *
 * The actual validation runs inside agent execution (one-liner shape
 * checks after each artifact write), so the executable invariant is
 * documentary: the table must exist in azure-artifacts SKILL.md with
 * rows for every artifact type, and the shared operating frame must
 * link to it so all main step agents inherit the rule.
 *
 * Run via:
 *   node --test tools/tests/scripts/test_post_write_validation.mjs
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");

const SKILL = path.join(ROOT, ".github/skills/azure-artifacts/SKILL.md");
const OPFRAME = path.join(ROOT, ".github/instructions/agent-operating-frame.instructions.md");

test("azure-artifacts SKILL.md declares the Post-write validation section", () => {
  const body = fs.readFileSync(SKILL, "utf8");
  assert.match(body, /^## Post-write validation$/m, "missing H2");
});

test("Post-write validation table covers every artifact type", () => {
  const body = fs.readFileSync(SKILL, "utf8");
  // The required artifact-type rows. Each row references the verifier
  // command for that file type. Markdown delegates to lefthook.
  const required = [
    { type: "*.json", verifier: "python -m json.tool" },
    { type: "*.bicep", verifier: "bicep build --stdout" },
    { type: "*.tf", verifier: "terraform fmt -check" },
    { type: "challenge-findings-*.json", verifier: "validate-challenger-findings.mjs" },
    { type: "challenge-findings-*-decisions.json", verifier: "validate-challenge-findings-decisions.mjs" },
    { type: "*.md", verifier: "lefthook" },
  ];
  for (const { type, verifier } of required) {
    const escapedType = type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Allow optional qualifier text (e.g. "(sidecar JSON)") between the
    // backticked type and the closing pipe — the table is human-readable
    // and may carry an annotation for non-obvious rows.
    const row = new RegExp(`\\|\\s*\`${escapedType}\`[^|]*\\|.*${verifier}`);
    assert.match(body, row, `Post-write validation table missing row for ${type} (verifier: ${verifier})`);
  }
});

test("Operating frame links to the Post-write validation section", () => {
  const body = fs.readFileSync(OPFRAME, "utf8");
  assert.match(body, /## Validate every artifact after writing/, "missing H2 in operating frame");
  // Anchor-bearing link to the SKILL section so every step agent
  // inherits the rule via the shared frame.
  assert.match(
    body,
    /azure-artifacts\/SKILL\.md#post-write-validation/,
    "missing anchored link to azure-artifacts post-write-validation",
  );
});

test("shared reading guidance respects phase inputs, freshness and actual attachment", () => {
  const body = fs.readFileSync(OPFRAME, "utf8");
  assert.match(body, /only the current phase's required inputs/);
  assert.match(body, /Missing required predecessors block/);
  assert.match(body, /source change,\s+compaction, or a new chat/);
  assert.match(body, /does not establish runtime attachment/);
  assert.match(body, /explicit mutation contract/);
  assert.doesNotMatch(body, /codegen-model-mix-2026|plan → 04\/05|exactly once at boot/);
  const copilot = fs.readFileSync(path.join(ROOT, ".github/copilot-instructions.md"), "utf8");
  assert.match(copilot, /A file inventory is not its content/);
  assert.match(copilot, /does not waive required inputs or approvals/);
  assert.match(copilot, /independent Step 2 cost-feasibility review/);
});

test("Planner loads phase-specific guidance after prerequisites without recreating governance", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/05-iac-planner.agent.md"), "utf8");
  assert.match(body, /First run \[Prerequisites Check\]/);
  assert.match(body, /Missing inputs return to their owner before bulk skill reads/);
  assert.match(body, /Before Phase 4 diagrams/);
  assert.match(body, /Before Phase 2\.5 checks/);
  assert.match(body, /On an L0\/L1 drift signal, before choosing a return route/);
  assert.match(body, /consult the Markdown counterpart only when JSON is ambiguous/);
  assert.doesNotMatch(body, /04-governance-constraints\.template\.md|Before doing ANY work/);
  for (const required of [
    "iac-cost-monitoring.md",
    "iac-policy-compliance.md",
    "iac-security-baseline.md",
    "avm-version-freeze-gate.md",
  ]) {
    assert.ok(body.includes(required));
  }
});

test("both CodeGen tracks check inputs first and use the manifest without weakening readiness", () => {
  for (const file of ["06b-bicep-codegen.agent.md", "06t-terraform-codegen.agent.md"]) {
    const body = fs.readFileSync(path.join(ROOT, ".github/agents", file), "utf8");
    assert.match(body, /First check that the required predecessor files exist/);
    assert.match(body, /return to its owner before bulk\s+skill reads/);
    assert.match(body, /Use `sku-manifest.json` for authoritative SKU\/tier selections/);
    assert.match(body, /refresh missing\s+or changed sections on resume/);
    assert.match(body, /Plan-Readiness Precondition \(MANDATORY\)/);
    assert.match(body, /decisions.plan_status == "APPROVED"/);
    assert.match(body, /L0 envelope cross-check/);
    assert.match(body, /If any condition fails, STOP/);
    assert.doesNotMatch(body, /Before doing any work, read these skills\.|Also read `02-architecture-assessment.md`/);
  }
});
