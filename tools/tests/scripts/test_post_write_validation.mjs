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

test("Planner exposes relevant tools and uses supported Terraform metadata discovery", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/05-iac-planner.agent.md"), "utf8");
  const frontmatter = body.split("---")[1];
  assert.doesNotMatch(
    frontmatter,
    /vscodeNotebooks|vscodeGeneral\/(?:rename|usages)|ms-azuretools.vscode-azureresourcegroups/,
  );
  for (const capability of ["execute", "read", "agent", "edit", "search", "web", "azure-mcp/*", "bicep/*"]) {
    assert.ok(frontmatter.includes(capability));
  }
  assert.doesNotMatch(
    body,
    /terraform\/(?:search_modules|get_module_details|get_latest_module_version)|all 4 required tags/,
  );
  assert.match(body, /public Terraform Registry API/);
  assert.match(body, /exact `X.Y.Z`/);
  assert.match(body, /failed lookup is not proof of absence/);
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

test("Terraform CodeGen verifies approved exact pins without retired MCP tools or version drift", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/06t-terraform-codegen.agent.md"), "utf8");
  assert.doesNotMatch(
    body,
    /terraform\/(?:search_modules|get_module_details|get_latest_module_version|search_providers)/,
  );
  assert.doesNotMatch(body, /pin version band/);
  assert.match(body, /Preserve the approved exact `X.Y.Z`/);
  assert.match(body, /version change returns to the Planner/);
  assert.match(body, /terraform providers schema -json/);
  assert.match(body, /terraform init -backend=false -input=false/);
});

test("workflow agents do not explicitly load notebook tools for non-notebook outputs", () => {
  const files = fs.readdirSync(path.join(ROOT, ".github/agents")).filter((file) => /^0[1-8].*\.agent\.md$/.test(file));
  for (const file of files) {
    const frontmatter = fs.readFileSync(path.join(ROOT, ".github/agents", file), "utf8").split("---")[1];
    assert.doesNotMatch(frontmatter, /vscodeNotebooks\//, file);
    for (const capability of ["execute", "read", "edit"])
      assert.ok(frontmatter.includes(capability), `${file}: ${capability}`);
    if (!/^0[67]/.test(file)) assert.doesNotMatch(frontmatter, /vscodeGeneral\/(?:rename|usages)/, file);
  }
});

test("compaction permits required deferred guidance and As-Built verifies resume freshness", () => {
  for (const file of [
    "03-architect.agent.md",
    "05-iac-planner.agent.md",
    "06b-bicep-codegen.agent.md",
    "06t-terraform-codegen.agent.md",
    "08-as-built.agent.md",
  ]) {
    const body = fs.readFileSync(path.join(ROOT, ".github/agents", file), "utf8");
    assert.match(body, /missing required\s+phase guidance/);
    assert.doesNotMatch(body, /stop loading additional skills|Context reaches ~80%/i);
  }
  const asBuilt = fs.readFileSync(path.join(ROOT, ".github/agents/08-as-built.agent.md"), "utf8");
  assert.match(asBuilt, /A checkpoint does not prove inventory freshness/);
  assert.match(asBuilt, /If inputs changed, refresh affected inventory/);
  assert.match(asBuilt, /live resource query cannot recover design rationale/);
  assert.match(asBuilt, /On a new chat, re-query the target resources/);
  assert.match(asBuilt, /Missing or inconsistent evidence prevents marking the phase current/);
});

test("shared read budgets permit recovery without introducing skill digest tiers", () => {
  const skills = fs.readFileSync(path.join(ROOT, ".github/instructions/agent-skills.instructions.md"), "utf8");
  assert.match(skills, /same available, unchanged inputs/);
  assert.match(skills, /refresh only the needed sections/);
  assert.match(skills, /never permits guessing missing constraints or skipping validation/);
  const context = fs.readFileSync(path.join(ROOT, ".github/instructions/context-optimization.instructions.md"), "utf8");
  assert.match(context, /tiers apply to artifacts, not alternate skill digests/);
  assert.match(context, /must not prevent loading missing required guidance/);
});
