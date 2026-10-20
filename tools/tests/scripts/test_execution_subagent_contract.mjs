#!/usr/bin/env node
/**
 * test_execution_subagent_contract.mjs — guard the
 * `execution-subagent.prompt.md` template added for issue #425 Wave 3a.
 *
 * The contract targets runtime subagent-invocation prompts (parent → child)
 * and is documentary; source-contract assertions guard output modes and
 * authority as well as the three required H2 slots in order.
 *
 * Run via:
 *   node --test tools/tests/scripts/test_execution_subagent_contract.mjs
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getAgentBodyStructure } from "../../scripts/validate-agents.mjs";
import { parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");
const CONTRACT = path.join(ROOT, ".github/skills/apex-workflow-engine/references/execution-subagent.md");
const contractBody = fs.readFileSync(CONTRACT, "utf8");

const WORKER_CONTRACTS = [
  {
    name: "bicep-validate-subagent",
    mode: "Text summary",
    fields: ["BICEP VALIDATION RESULT", "Verdict: {APPROVED|NEEDS_REVISION|FAILED}"],
    preserved: ["source", "parameters", "artifacts", "findings", "recall"],
  },
  {
    name: "bicep-whatif-subagent",
    mode: "Text summary",
    fields: ["WHAT-IF ANALYSIS RESULT", "Status: [PASS|FAIL|WARNING]"],
    preserved: ["source", "parameters", "findings"],
  },
  {
    name: "terraform-validate-subagent",
    mode: "Text summary",
    fields: ["TERRAFORM VALIDATION RESULT", "Verdict: {APPROVED|NEEDS_REVISION|FAILED}"],
    preserved: ["source", "tfvars", "lockfile", "artifact", "findings", "recall"],
  },
  {
    name: "terraform-plan-subagent",
    mode: "Text summary",
    fields: ["TERRAFORM PLAN RESULT", "Status: [PASS|WARNING|FAIL]", "Plan File: {path/to/tfplan}"],
    preserved: ["source", "tfvars", "lockfile", "findings"],
  },
  {
    name: "policy-precheck-subagent",
    mode: "File JSON",
    fields: ["POLICY PRECHECK RESULT", "Deploy gate: [PROCEED|BLOCK]", "Status: [CLEAN|INFORMATIONAL|BLOCKED|FAILED]"],
    preserved: ["output_path"],
  },
  {
    name: "cost-estimate-subagent",
    mode: "File JSON",
    fields: ["COST ESTIMATE {COMPLETE | FAILED}", "file_path"],
    preserved: ["output_path"],
  },
  {
    name: "challenger-review-subagent",
    mode: "Returned JSON",
    fields: ["overall_assessment", "batch_results"],
    preserved: ["output_path"],
  },
];

const REQUIRED_H2S = ["## Inputs", "## Activities", "## Outputs"];

for (const { name, mode, fields, preserved } of WORKER_CONTRACTS) {
  test(`${name} output mode stays bound to its current source contract`, () => {
    const section = contractBody.split(`### ${name}\n`)[1]?.split(/\n### /)[0];
    assert.ok(section, `missing named worker contract: ${name}`);
    const sourceLink = section.match(/\]\(([^)]+\.agent\.md)\)/)?.[1];
    assert.ok(sourceLink, `missing source authority link: ${name}`);
    const sourcePath = path.resolve(path.dirname(CONTRACT), sourceLink);
    assert.equal(sourcePath, path.join(ROOT, `.github/agents/_subagents/${name}.agent.md`));
    const source = fs.readFileSync(sourcePath, "utf8");
    assert.ok(section.includes(`${mode}:`), `wrong output mode for ${name}`);
    const frontmatter = parseFrontmatter(source);
    assert.equal(frontmatter["user-invocable"], false);
    assert.deepEqual(frontmatter.agents, []);
    const constraints = getAgentBodyStructure(source).headings.find((heading) =>
      ["constraints", "scope", "operating posture"].includes(heading.title.toLowerCase()),
    );
    assert.ok(constraints?.content, `worker write scope missing: ${name}`);
    for (const field of preserved) assert.ok(source.includes(field), `${name}: ${field}`);
    for (const field of fields) {
      assert.ok(source.includes(field), `field no longer matches worker: ${name}: ${field}`);
      assert.ok(section.includes(field), `reference omits worker field: ${name}: ${field}`);
    }
    if (name === "challenger-review-subagent") {
      assert.deepEqual(frontmatter.tools, ["read", "search"]);
      assert.match(source, /No writes, including findings/);
      assert.match(section, /record-review\.mjs/);
      assert.doesNotMatch(section, /CHALLENGE COMPLETE|File JSON:/);
    }
    if (mode === "Text summary") {
      assert.match(source, /```text\n/);
      assert.match(section, /no findings-file writes/i);
      assert.doesNotMatch(section, /File JSON:|deployment-preview-v1|06-bicep-whatif\.json/);
    } else if (mode === "File JSON") {
      assert.match(section, /caller `output_path`/);
      assert.match(source, /(?:Emit JSON|Write this shape|Single-lens JSON required fields|\*\*On disk\*\*)/);
      assert.match(section, /persistence/);
    }
  });
}

test("shared output alternatives preserve worker authority and conditional parent persistence", () => {
  assert.match(contractBody, /\*\*File JSON\*\*/);
  assert.match(contractBody, /\*\*Fixed verdict\*\*/);
  assert.match(contractBody, /\*\*Text summary\*\*/);
  assert.match(contractBody, /agent definition and its explicitly delegated I\/O reference\s+are the source authority/);
  assert.match(
    contractBody,
    /parent persists returned evidence only if its own contract explicitly owns that\s+artifact/,
  );
  assert.match(contractBody, /named worker's failure shape/);
  assert.doesNotMatch(contractBody, /Specify the on-disk path and schema for structured output/);
});

test("Bicep preview example requests the real text contract, not a JSON artifact", () => {
  const inputs = contractBody.split("## Inputs\n")[1].split("## Activities\n")[0];
  const source = fs.readFileSync(path.join(ROOT, ".github/agents/_subagents/bicep-whatif-subagent.agent.md"), "utf8");
  for (const field of [
    "template_path",
    "parameters_path",
    "resource_group",
    "WHAT-IF ANALYSIS RESULT",
    "Status: [PASS|FAIL|WARNING]",
  ]) {
    assert.ok(inputs.includes(field), `example missing ${field}`);
    assert.ok(source.includes(field), `example field absent from worker: ${field}`);
  }
  assert.match(inputs, /No findings file is written/);
  assert.doesNotMatch(inputs, /06-bicep-whatif\.json|deployment-preview-v1|output_path/);
});

test("execution contract is an active reference, not a Local prompt adapter", () => {
  assert.ok(fs.existsSync(CONTRACT), `missing contract: ${CONTRACT}`);
  assert.match(contractBody, /reference-only parent-to-worker contract/);
});

for (const filePath of [CONTRACT]) {
  test(`${path.basename(filePath)} preserves exactly the three required H2 slots in order`, () => {
    const body = fs.readFileSync(filePath, "utf8");
    let inFence = false;
    const h2s = [];
    for (const line of body.split(/\r?\n/)) {
      if (/^```/.test(line.trim())) {
        inFence = !inFence;
        continue;
      }
      if (!inFence && /^## /.test(line)) {
        h2s.push(line.trim());
      }
    }
    assert.deepEqual(h2s, REQUIRED_H2S);
  });
}

test("preflight plan and module substitutions require a Planner handoff, not CodeGen self-edit", () => {
  const workflow = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-iac-common/references/codegen-shared-workflow.md"),
    "utf8",
  );
  const form = workflow.split("### Preflight Blocker Form\n")[1].split("\n### ")[0];
  const fixOption = form.split("`Fix and re-run preflight`")[1].split("`Abort")[0];
  assert.match(fixOption, /plan-input revisions or\s+module substitutions/);
  assert.match(fixOption, /STOP and present the Return to Step 4 human handoff\s+to Planner/);
  assert.match(fixOption, /CodeGen must not edit plan inputs or substitute modules itself/);
  assert.match(fixOption, /Await Planner's revised, approved inputs before re-entering Phase 1/);
  assert.doesNotMatch(fixOption, /agent revises the plan\s+inputs or substitutes an alternative module/);
});

test("authoring instructions link native lifecycle guidance without requiring a historical call heading", () => {
  const auth = path.join(ROOT, ".github/instructions/agent-authoring.instructions.md");
  const body = fs.readFileSync(auth, "utf8");
  assert.match(body, /apex-workflow-engine\/references\/worker-readiness\.md/, "missing native lifecycle link");
  assert.ok(fs.existsSync(CONTRACT));
});
