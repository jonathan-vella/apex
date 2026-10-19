import assert from "node:assert/strict";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { getBody, parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";
import {
  getAgentBodyStructure,
  runVendorPrompting,
  validateProductionAgentBody,
  validateProductionAgentPolicy,
  validateAgentPermissions,
} from "../../scripts/validate-agents.mjs";
import { MAX_BODY_LINES } from "../../scripts/_lib/paths.mjs";
import { getAgents } from "../../scripts/_lib/workspace-index.mjs";
import { cacheInputs, findingId } from "../../scripts/validate-challenger-findings.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const agentRoot = path.join(root, ".github/agents");
const read = (name) => readFileSync(path.join(agentRoot, `${name}.agent.md`), "utf8");

test("automatic and manual callers share the same structured reviewer and actual-event recorder", () => {
  for (const name of [
    "02-requirements",
    "03-architect",
    "04-design",
    "04g-governance",
    "05-iac-planner",
    "06b-bicep-codegen",
    "06t-terraform-codegen",
  ]) {
    const content = read(name);
    const frontmatter = parseFrontmatter(content);
    assert.ok(frontmatter.agents.includes("challenger-review-subagent"), name);
    assert.ok(!frontmatter.agents.includes("rubber-duck"), name);
    assert.match(content, /one-shot-review\.md/, name);
    assert.match(content, /record-review\.mjs/, name);
    assert.ok(frontmatter.tools.includes("agent"), name);
  }
  assert.deepEqual(parseFrontmatter(read("10-challenger")).agents, ["challenger-review-subagent"]);
  const contract = readFileSync(
    path.join(root, ".github/skills/apex-azure-defaults/references/one-shot-review.md"),
    "utf8",
  );
  assert.match(contract, /APEX_REVIEW/);
  assert.match(contract, /--reviewer challenger-review-subagent/);
  assert.match(contract, /--verify-cache/);
  assert.match(contract, /not a parent-authored reconstruction/i);
});
test("main agents expose direct questions and delegated pending-input fields without worker preflights", () => {
  for (const file of readdirSync(agentRoot).filter(
    (file) => file.endsWith(".agent.md") && file !== "01-orchestrator.agent.md",
  )) {
    const body = getBody(readFileSync(path.join(agentRoot, file), "utf8"));
    for (const field of [
      "ask_user",
      "USER_INPUT_REQUIRED",
      "request_id",
      "phase",
      "message",
      "requestedSchema.properties",
    ])
      assert.ok(body.includes(field), `${file}: ${field}`);
    assert.doesNotMatch(body, /APEX_WORKER_HANDSHAKE|WORKER_READY|WORKER_EXECUTE|verify-worker-ready\.mjs/, file);
  }
});

test("leaf agents have bounded native task permissions, not synthetic readiness envelopes", () => {
  const leafRoot = path.join(agentRoot, "_subagents");
  for (const file of readdirSync(leafRoot).filter((file) => file.endsWith(".agent.md"))) {
    const content = readFileSync(path.join(leafRoot, file), "utf8");
    const frontmatter = parseFrontmatter(content);
    assert.deepEqual(validateAgentPermissions(frontmatter, { isSubagent: true }), [], file);
    assert.doesNotMatch(
      getBody(content),
      /APEX_WORKER_HANDSHAKE|WORKER_READY|WORKER_EXECUTE|verify-worker-ready\.mjs/,
      file,
    );
  }
});

test("active main body contracts remain validated without a pinned model family", () => {
  const agent = {
    path: path.join(agentRoot, "fixture.agent.md"),
    frontmatter: { name: "Fixture" },
    content: `---
name: Fixture
---
# Fixture

## Role
Perform the bounded role.

## Goal
Reach the stated goal.

## Success criteria
Meet the measurable criteria.

## Constraints
Keep the workflow boundaries.

## Output
Return the required output.

## Stop rules
Stop when a required input is missing.
`,
  };
  assert.deepEqual(validateProductionAgentBody(agent), []);
  agent.content = agent.content.replace("## Stop rules\nStop when a required input is missing.\n", "");
  assert.ok(validateProductionAgentBody(agent).some((issue) => issue.includes("Stop rules")));
});

test("native Markdown essentials do not require personality, goals or model-specific XML", () => {
  const agent = {
    path: path.join(agentRoot, "fixture.agent.md"),
    frontmatter: { name: "Fixture" },
    content: `---
name: Fixture
---
# Fixture

## Role
Perform the bounded role.

## Constraints
Keep the workflow boundaries.

## Output
Return the required output.

## Stop rules
Stop when a required input is missing.
`,
  };
  assert.deepEqual(validateProductionAgentBody(agent), []);
  agent.content = agent.content.replace("## Output\nReturn the required output.", "## Output");
  assert.ok(validateProductionAgentBody(agent).some((issue) => issue.includes("Output")));
});

test("production policy rejects UI handoffs, missing direct tools, model pins and invalid leaf tools", () => {
  const main = {
    path: path.join(agentRoot, "fixture.agent.md"),
    frontmatter: { name: "Fixture", "user-invocable": true, agents: [], tools: ["read", "ask_user"] },
  };
  assert.deepEqual(validateProductionAgentPolicy(main), []);
  for (const change of [
    { handoffs: [] },
    { tools: ["read"] },
    { "user-invocable": false },
    { model: ["fixture"] },
    { "reasoning-effort": "high" },
  ]) {
    assert.ok(validateProductionAgentPolicy({ ...main, frontmatter: { ...main.frontmatter, ...change } }).length);
  }
  const worker = {
    path: path.join(agentRoot, "_subagents/fixture.agent.md"),
    frontmatter: { name: "Worker", "user-invocable": false, agents: [], tools: ["read"] },
  };
  assert.deepEqual(validateProductionAgentPolicy(worker), []);
  for (const tool of ["ask_user", "agent", "todo", "*", "vscode/askQuestions"]) {
    assert.ok(
      validateProductionAgentPolicy({ ...worker, frontmatter: { ...worker.frontmatter, tools: [tool] } }).length,
    );
  }
  for (const tools of ["read", [null], [""]]) {
    assert.ok(validateAgentPermissions({ tools }).length);
  }
});

test("production body rejects retired preflights while historical fixture paths remain exempt", () => {
  const content = read("02-requirements");
  const frontmatter = parseFrontmatter(content);
  for (const ritual of [
    "APEX_WORKER_HANDSHAKE",
    "WORKER_READY",
    "WORKER_READY_ACK",
    "WORKER_EXECUTE",
    "verify-worker-ready.mjs",
  ]) {
    assert.ok(
      validateProductionAgentBody({
        path: path.join(agentRoot, "02-requirements.agent.md"),
        frontmatter,
        content: `${content}\n${ritual}`,
      }).some((issue) => issue.includes("retired")),
    );
    assert.deepEqual(
      validateProductionAgentBody({
        path: path.join(root, "tools/tests/fixtures/historical.agent.md"),
        frontmatter,
        content: `${content}\n${ritual}`,
      }),
      [],
    );
  }
});

test("Terraform preview-only stops at missing backend without soliciting expanded approval", () => {
  const body = getBody(read("07t-terraform-deploy"));
  assert.match(body, /(?:Preview|preview)[\s\S]{0,150}missing backend stops/);
  assert.match(body, /bootstrap scripts only under separate exact authorization/);
  const shared = readFileSync(
    path.join(root, ".github/skills/apex-iac-common/references/deploy-shared-workflow.md"),
    "utf8",
  );
  assert.match(shared, /A successful preview\s+does not expand that scope/);
  assert.match(shared, /only as information, not an approval gate/);
  assert.match(shared, /Changed inputs invalidate\s+earlier approval/);
  assert.match(shared, /Within an explicitly requested deployment/);
});

test("CodeGen recovery does not infer edit permission from invalid or conflicting content", () => {
  for (const agent of ["06b-bicep-codegen", "06t-terraform-codegen"]) {
    const body = getBody(read(agent));
    assert.match(body, /(?:uncertain|ambiguous)[\s\S]{0,30}ownership|ownership[\s\S]{0,30}(?:uncertain|ambiguous)/i);
    assert.match(body, /failure alone does not authorize/);
  }
  const shared = readFileSync(
    path.join(root, ".github/skills/apex-iac-common/references/codegen-shared-workflow.md"),
    "utf8",
  );
  assert.match(shared, /repair a confirmed partial agent write/);
  assert.match(shared, /user explicitly authorizes the specific edit/);
  assert.match(
    shared,
    /Syntax errors, validation failures\s+and plan conflicts do not establish ownership or authorize deletion or replacement/,
  );
  assert.match(shared, /stop for clarification and keep the\s+affected validation and deployment handoff blocked/);
});

test("Orchestrator distinguishes the Requirements owner from its step and artifact prefix", () => {
  const text = read("01-orchestrator");
  const requirements = parseFrontmatter(read("02-requirements"));
  const graph = JSON.parse(
    readFileSync(path.join(root, ".github/skills/apex-workflow-engine/templates/workflow-graph.json"), "utf8"),
  );
  assert.equal(graph.nodes["step-1"].agent, requirements.name);
  assert.ok(parseFrontmatter(text).agents.includes(requirements.name));
  assert.match(getBody(text), /Main worker names come from actual definitions\/registry/);
  assert.match(getBody(text), /explanation-only/i);
  assert.match(getBody(text), /not numbered file presence/);
});

const blocks = (text, language) =>
  [...text.matchAll(new RegExp(String.raw`\x60{3}${language}\n([\s\S]*?)\x60{3}`, "g"))].map((match) => match[1]);
const section = (text, start, end) => {
  const offset = text.indexOf(start);
  assert.notEqual(offset, -1, start);
  const limit = end ? text.indexOf(end, offset + start.length) : text.length;
  assert.notEqual(limit, -1, end);
  return text.slice(offset, limit);
};

function scratch(context) {
  const directory = mkdtempSync(path.join(tmpdir(), "apex-agent-body-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

function stub(directory, name, source) {
  const bin = path.join(directory, "bin");
  mkdirSync(bin, { recursive: true });
  const executable = path.join(bin, name);
  writeFileSync(executable, `#!${process.execPath}\n${source}`, { mode: 0o755 });
  const syntax = spawnSync(process.execPath, ["--check", executable], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
  return { ...process.env, PATH: `${bin}:${process.env.PATH}` };
}

function shell(command, cwd, env) {
  return spawnSync("bash", ["--noprofile", "--norc"], { input: command, cwd, env, encoding: "utf8" });
}

function shellAsync(command, cwd, env) {
  return new Promise((resolve, reject) => {
    const child = spawn("bash", ["--noprofile", "--norc"], { cwd, env });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (status) => resolve({ status, stdout, stderr }));
    child.stdin.end(command);
  });
}

const agentFiles = readdirSync(agentRoot).filter((name) => name.endsWith(".agent.md"));
agentFiles.push(
  ...readdirSync(path.join(agentRoot, "_subagents"))
    .filter((name) => name.endsWith(".agent.md"))
    .map((name) => `_subagents/${name}`),
);
for (const name of agentFiles) {
  test(`AB-01/15 ${name} has a named H1, nonempty H2 contracts and unchanged hard limits`, () => {
    const text = readFileSync(path.join(agentRoot, name), "utf8");
    const frontmatter = parseFrontmatter(text);
    const body = getBody(text);
    assert.ok(body.split("\n").length <= MAX_BODY_LINES, name);
    const delimiter = text.indexOf("\n---", text.indexOf("---") + 3);
    assert.ok(text.substring(delimiter + 4).split("\n").length <= MAX_BODY_LINES, name);
    assert.deepEqual(
      getAgentBodyStructure(text)
        .headings.filter((heading) => heading.level === 1)
        .map((heading) => heading.title),
      [frontmatter.name],
    );
    assert.deepEqual(validateProductionAgentBody({ path: path.join(agentRoot, name), content: text, frontmatter }), []);
    assert.equal(Object.hasOwn(frontmatter, "model"), false, `${name}: model pin`);
    assert.equal(Object.hasOwn(frontmatter, "reasoning-effort"), false, `${name}: effort pin`);
    if (name.startsWith("_subagents/")) {
      assert.equal(frontmatter["user-invocable"], false, name);
      assert.deepEqual(frontmatter.agents, [], name);
      assert.deepEqual(validateAgentPermissions(frontmatter, { isSubagent: true }), [], name);
    } else {
      const manualEntries = [
        "01-orchestrator.agent.md",
        "07b-bicep-deploy.agent.md",
        "07t-terraform-deploy.agent.md",
        "09-diagnose.agent.md",
        "10-challenger.agent.md",
      ];
      assert.equal(frontmatter["disable-model-invocation"], manualEntries.includes(name), name);
    }
    assert.deepEqual(
      validateProductionAgentPolicy({ path: path.join(agentRoot, name), frontmatter }, getAgents()),
      [],
      name,
    );
  });
}

test("AB-01/15 historical pinned-fixture vendor validation is independent of active Markdown bodies", () => {
  const frontmatter = { name: "Historical", model: ["Claude Sonnet 5.5 (copilot)"] };
  const original =
    "---\nname: Historical\n---\n# Historical\n\n## Role\nReview evidence.\n\n<scope_fencing>\nRead only.\n</scope_fencing>\n<output_contract>\nReturn findings.\n</output_contract>\n<stop_conditions>\nStop after reporting.\n</stop_conditions>\n";
  const agent = {
    frontmatter,
    content: original,
    path: path.join(root, "tools/tests/fixtures/historical.agent.md"),
    isSubagent: false,
  };
  const result = runVendorPrompting({
    agents: new Map([[agent.path, agent]]),
    prompts: new Map(),
    catalog: {
      models: Object.fromEntries(frontmatter.model.map((model) => [model, { deprecated: false }])),
    },
  });
  const blockers = result.findings.filter((finding) =>
    ["gpt-outcome-contract-001", "gpt-stop-rules-non-empty-001", "claude-output-contract-001"].includes(finding.ruleId),
  );
  assert.deepEqual(blockers, []);
});

test("AB-02 fresh setup has one owner; resume preserves recovery and native dispatch boundaries", () => {
  const body = read("01-orchestrator");
  assert.match(body, /supplied project name without redundant confirmation/);
  assert.match(body, /If recall is empty[\s\S]{0,130}existing artifacts before treating the project as new/);
  assert.doesNotMatch(body, /Gates 2 and 3 recommend|Recommend session break at Gates/);
  for (const field of ["workflow-graph.json", "ask_user", "USER_INPUT_REQUIRED", "apex-recall transition"])
    assert.ok(body.includes(field), field);
  assert.doesNotMatch(body, /APEX_WORKER_HANDSHAKE|WORKER_READY|WORKER_EXECUTE|verify-worker-ready\.mjs/);
});

test("runtime guidance leaves model selection to the operator rather than synthetic attestations", () => {
  for (const file of [
    ".github/copilot-instructions.md",
    ".github/instructions/agent-authoring.instructions.md",
    ".github/skills/apex-agent-authoring/references/model-policy.md",
    ".github/skills/apex-workflow-engine/references/worker-readiness.md",
    ".github/skills/apex-workflow-start/SKILL.md",
    "tools/tests/integration/smoke-run.md",
  ]) {
    const body = readFileSync(path.join(root, file), "utf8");
    assert.match(body, /\bmodel/i, file);
    assert.doesNotMatch(body, /MODEL_VERIFIED|operator explicitly selects Auto|matching configured\/dispatched/, file);
    assert.doesNotMatch(body, /configured model, and its permitted tools|`MAI-Code-1.1-Flash` model/, file);
  }
  for (const file of readdirSync(agentRoot).filter((file) => file.endsWith(".agent.md"))) {
    const body = readFileSync(path.join(agentRoot, file), "utf8");
    assert.doesNotMatch(body, /Missing[^.\n]*runtime model evidence|Require `MODEL_VERIFIED`/, file);
  }
  const protocol = readFileSync(
    path.join(root, ".github/skills/apex-workflow-engine/references/worker-readiness.md"),
    "utf8",
  );
  assert.match(protocol, /(?:historical|diagnostic|native)/i);
  assert.doesNotMatch(protocol, /Require `MODEL_VERIFIED`/);
});

test("preview workers declare the complete native status enum rather than a bare blocked result", () => {
  for (const name of ["bicep-whatif-subagent", "terraform-plan-subagent"]) {
    const source = read(`_subagents/${name}`);
    const statuses = source
      .match(/^Status:\s*\[([^\]]+)\]/m)?.[1]
      .split("|")
      .sort();
    assert.deepEqual(statuses, ["FAIL", "PASS", "WARNING"], name);
    assert.match(source, /missing[\s\S]{0,150}(?:FAIL|failure shape)/i, name);
  }
});

test("AB-03 complete prerequisites precede review; compliance none differs from missing", () => {
  const body = read("02-requirements");
  const draft = section(body, "## Phase 5", "## Phase 6");
  const markers = [
    "01-requirements.md",
    "README.md",
    "sku-manifest.json",
    "sku-manifest.md",
    "shape checks",
    "Record",
    "Checkpoint",
  ];
  let offset = 0;
  for (const marker of markers) {
    const next = draft.indexOf(marker, offset);
    assert.ok(next >= offset, marker);
    offset = next + marker.length;
  }
  assert.match(body, /write\s+alone is not review readiness/);
  assert.match(body, /(?:unanswered|missing)[\s\S]{0,100}(?:none|compliance)/i);
  assert.match(body, /repair failures before proceeding/);
});

test("AB-04/22 candidate comparison cannot approve SKUs or write back manifest prices", () => {
  const architect = read("03-architect");
  const cost = read("_subagents/cost-estimate-subagent");
  assert.ok(architect.includes("candidate_sets"));
  assert.match(architect, /comparison-only/);
  assert.match(architect, /(?:manifest_path|resource_list)[\s\S]{0,100}approved/);
  assert.match(architect, /challenge-findings-cost-estimate.json/);
  assert.doesNotMatch(architect, /\$450|\$500|Include this table in/);
  assert.match(cost, /Exactly one input mode/);
  assert.doesNotMatch(cost, /Mode [BC] adds/);
  assert.match(cost, /comparison advice only; it is not SKU approval and never changes the manifest/);
  assert.match(cost, /only on COMPLETE with\s+`manifest_writeback: true`/);
});

test("AB-05 ADR creation is not architecture approval; execution failure is not findings", () => {
  const body = read("04-design");
  assert.match(
    body,
    /architecture change[\s\S]{0,150}(?:approval|authorization)|(?:approval|authorization)[\s\S]{0,150}architecture change/,
  );
  assert.match(body, /(?:proposal|informational)[\s\S]{0,100}(?:authorization|permission)/);
  assert.match(body, /(?:failed reviewer|execution failure)[\s\S]{0,150}(?:different|separate|not)/i);
  assert.doesNotMatch(body, /Log subagent failures[\s\S]{0,65}and continue/);
});

test("AB-06/07 governance final inputs precede review; exhausted stale review blocks", () => {
  const body = read("04g-governance");
  const confirmations = body.indexOf("## Phase 2.7");
  const review = body.indexOf("## Phase 2.5");
  assert.ok(confirmations > 0 && review > confirmations);
  assert.match(body, /[Ee]xhausted review budget/);
  assert.match(body, /new value does not attest old confirmations/);
  assert.match(body, /refresh[\s\S]{0,200}(?:old confirmations|invalidat)/i);
  assert.match(body, /COMPLETE zero-assignment result is valid/);
  assert.match(body, /Reuse completed evidence/);
  assert.doesNotMatch(
    body,
    /two required confirmations|answered in the same chat session|On Refresh governance\*\*: restart from Phase 0.45/,
  );
});

for (const refresh of [false, true]) {
  test(`SK-02 governance binds confirmed subscription in source command (refresh=${refresh})`, (context) => {
    const body = read("04g-governance");
    const phase = section(body, "## Phase 1", "## Phase 2");
    assert.match(body, /never default to the active Azure CLI subscription/);
    assert.match(body, /--refresh/);
    const command = blocks(phase, "bash").find((block) => block.includes("scripts/discover.py"));
    assert.ok(command);
    const directory = scratch(context);
    const env = stub(directory, "python", "console.log(JSON.stringify(process.argv.slice(2))); ");
    const invocation = command
      .trim()
      .replaceAll("{project}", "fixture-project")
      .replaceAll("<project>", "fixture-project")
      .replaceAll("<confirmed-subscription-id>", "confirmed-subscription");
    const result = shell(`${invocation}${refresh ? " --refresh" : ""}`, directory, env);
    assert.equal(result.status, 0, result.stderr);
    const args = JSON.parse(result.stdout);
    assert.deepEqual(args, [
      ".github/skills/apex-azure-governance-discovery/scripts/discover.py",
      "--project",
      "fixture-project",
      "--subscription",
      "confirmed-subscription",
      "--out",
      "agent-output/fixture-project/04-governance-constraints.json",
      "--arch",
      "agent-output/fixture-project/02-architecture-assessment.md",
      ...(refresh ? ["--refresh"] : []),
    ]);
  });
}

test("AB-08 Planner pins override defaults and persisted aliases remain compatible", () => {
  const body = read("05-iac-planner");
  assert.doesNotMatch(body, /trust default SKUs|two-stage gate/);
  assert.match(body, /explicit manifest SKUs/);
  for (const field of ["review_depth", "environment-manifest.json", "py", "png", "svg"])
    assert.ok(body.includes(field), field);
});

for (const track of ["bicep", "terraform"]) {
  const prefix = track === "bicep" ? "b" : "t";
  test(`AB-09/16 ${track} preliminary acceptance cannot bypass L3 or final approval`, () => {
    const body = read(`07${prefix}-${track}-deploy`);
    assert.match(body, /Preview accepted; apply not yet approved/);
    const schema = JSON.parse(readFileSync(path.join(root, "tools/schemas/deployment-preview.schema.json"), "utf8"));
    for (const field of ["deploy_gate", "cost_delta_monthly_usd"]) assert.ok(schema.properties[field], field);
    for (const field of ["Architect", "approval", "06-deploy-approval.json"]) assert.ok(body.includes(field), field);
    assert.match(
      body,
      /(?:preview|Preview)[\s\S]{0,150}(?:not final approval|not.*approv|does not.*approv|not apply permission)/,
    );
    assert.match(
      body,
      /(?:partial|preview-only)[\s\S]{0,180}(?:not|never|do not|cannot)[\s\S]{0,100}(?:complet|deployed)/i,
    );
  });
  test(`AB-10/15 ${track} completion remains mandatory outside optional review`, () => {
    const body = read(`06${prefix}-${track}-codegen`);
    const completion = section(body, "## Phase 4.6 + Phase 6", "## Output");
    assert.match(completion, /(?:even when|including skipped)[\s\S]{0,80}(?:optional review|review is skipped)/);
    for (const field of [
      "05-iac-handoff.json",
      "validation_summary.validate_gate",
      "--tree-hash",
      "validate:iac-handoff",
    ])
      assert.ok(completion.includes(field), field);
    assert.ok(body.includes("05-implementation-reference.md"));
    assert.match(body, /(?:bounded[\s\S]{0,50}batches|at most three new source files per batch)/);
    assert.ok(body.includes("phase_6_handoff"));
    assert.doesNotMatch(body, /If valid, treat the finding as informational/);
  });
  test(`AB-18 ${track} failures retain text fields and project L2 requires context`, () => {
    const body = read(`_subagents/${track}-validate-subagent`);
    const output = blocks(body, "text")[0];
    for (const field of [
      "Phase 1 - Lint:",
      "Phase 2 - Review:",
      "Overall Status:",
      "Detailed Findings:",
      "Verdict:",
      "Recommendation:",
    ]) {
      assert.ok(output.includes(field), field);
    }
    assert.doesNotMatch(body, /transient: true|emit `Lint Status:/);
    assert.match(body, /Required for an APEX L2 request/);
    assert.match(body, /L2 not evaluated: project not supplied/);
    assert.match(body, /CodeGen owns/);
  });
}

test("AB-11 partial As-Built cannot complete Step 7 and inventory owns every chart sibling", () => {
  const body = read("08-as-built");
  const output = body;
  for (const name of [
    "07-ab-cost-estimate.json",
    "07-ab-diagram",
    "07-ab-cost-distribution",
    "07-ab-cost-projection",
    "07-ab-cost-comparison",
    "07-ab-compliance-gaps",
  ]) {
    assert.ok(output.includes(name), name);
  }
  for (const extension of ["py", "png", "svg"]) assert.ok(body.toLowerCase().includes(extension));
  assert.match(output, /Only full verified suite completion runs/);
  assert.match(body, /Partial requests record only actual progress/);
  for (const alias of ["phase_3_pricing", "phase_4_cost"]) assert.ok(body.includes(alias));
});

test("AB-12 diagnostic severity mapping preserves source severity and bounded authority", () => {
  const body = read("09-diagnose");
  for (const mapping of ["Critical→critical", "High/Medium→warning", "Low→info"]) assert.ok(body.includes(mapping));
  assert.match(body, /Unknown severity stays unknown/);
  assert.match(body, /does not authorize diagnosing\/remediating all/);
  assert.ok(body.includes("08-resource-health-report.md"));
});

test("AB-13 requested pass and resolved paths survive decision/apply/review return", () => {
  const body = read("10-challenger");
  for (const field of ["pass_number", "prior_findings", "output_path", "batch_results", "file_path"])
    assert.ok(body.includes(field), field);
  assert.match(body, /exact requested pass/);
  assert.match(body, /changed inputs invalidate affected reviews/i);
  assert.match(body, /frozen artifacts return to their owner/i);
});

test("AB-14 missing telemetry permits source-only auditing without measured claims", () => {
  const body = read("11-context-optimizer");
  for (const field of ["source-only", "unknown", "comparable runs", "explicitly supplied"])
    assert.ok(body.includes(field), field);
  assert.doesNotMatch(body, /each adds ~50-100 tokens|Avg latency \(Opus\)/);
  assert.match(body, /no snapshots/);
});

test("AB-16 extracted first-match policy truth table fails closed across combinations", () => {
  const body = read("_subagents/policy-precheck-subagent");
  const table = section(body, "| Evidence | Envelope", "Apply this stricter gate");
  const rows = table
    .split("\n")
    .filter((line) => /^\| (invalid\/unknown|valid) \|/.test(line))
    .map((line) =>
      line
        .split("|")
        .slice(1, -1)
        .map((cell) => cell.trim()),
    );
  assert.equal(rows.length, 7);
  for (const evidence of ["valid", "invalid/unknown"]) {
    for (const envelope of ["FRESH", "STALE"]) {
      for (const drift of ["NONE", "INFORMATIONAL", "BLOCKING"]) {
        for (const violations of ["none", "present"]) {
          for (const accepted of ["true", "false"]) {
            const input = [evidence, envelope, drift, violations, accepted];
            const row = rows.find((candidate) =>
              candidate
                .slice(0, 5)
                .every(
                  (cell, index) =>
                    cell === "any" || cell === input[index] || (cell === "nonblocking" && drift !== "BLOCKING"),
                ),
            );
            assert.ok(row, JSON.stringify(input));
            const expected =
              evidence !== "valid"
                ? ["BLOCK", "FAILED"]
                : drift === "BLOCKING" || violations === "present"
                  ? ["BLOCK", "BLOCKED"]
                  : envelope === "STALE"
                    ? ["BLOCK", "INFORMATIONAL"]
                    : drift === "INFORMATIONAL" && accepted === "false"
                      ? ["PROCEED", "INFORMATIONAL"]
                      : ["PROCEED", "CLEAN"];
            assert.deepEqual(row.slice(5), expected, JSON.stringify(input));
          }
        }
      }
    }
  }
  assert.match(body, /plan success does not validate ARM deployment-time Deny effects/);
});

test("AB-17 extracted token/group/sub commands bind requested subscription despite active mismatch", (context) => {
  const directory = scratch(context);
  const env = stub(
    directory,
    "az",
    String.raw`
const assert = require("node:assert/strict");
const args = process.argv.slice(2);
assert.equal(args[args.indexOf("--subscription") + 1], "requested-sub");
assert.notEqual(process.env.ACTIVE_SUBSCRIPTION, "requested-sub");
if (args[0] === "deployment") {
  assert.equal(args[args.indexOf("--out") + 1], "json");
  console.log(JSON.stringify({changes: [{changeType: "Deploy", resourceId: "fixture-id"}]}));
}
`,
  );
  const commands = blocks(read("_subagents/bicep-whatif-subagent"), "bash");
  assert.equal(commands.length, 3);
  for (const command of commands) {
    const concrete = command
      .replaceAll("{subscription}", "requested-sub")
      .replaceAll(/\{(?:resource_group|location|template_path|parameters_path)\}/g, "fixture");
    const result = shell(concrete, directory, { ...env, ACTIVE_SUBSCRIPTION: "other-sub" });
    assert.equal(result.status, 0, result.stderr);
    if (command.includes("az deployment")) assert.equal(JSON.parse(result.stdout).changes[0].changeType, "Deploy");
  }
  assert.match(read("_subagents/bicep-whatif-subagent"), /`Deploy`, an unrecognized changeType[\s\S]*?`WARNING`/);
});

test("AB-18 extracted Bicep checks report persistent errors and retain current compiled evidence", (context) => {
  const directory = scratch(context);
  const calls = path.join(directory, "calls.jsonl");
  const env = stub(
    directory,
    "bicep",
    String.raw`
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS, JSON.stringify(args) + "\n");
if (args[0] === process.env.FAIL_AT) process.exit(7);
if (args[0] === "build") fs.writeFileSync(args[args.indexOf("--outfile") + 1], JSON.stringify({resources: []}));
`,
  );
  const command = blocks(read("_subagents/bicep-validate-subagent"), "bash")[0]
    .replaceAll("{template_path}", "main.bicep")
    .replaceAll("{scratch_dir}", directory);
  for (const fail of ["lint", "build", "none"]) {
    writeFileSync(calls, "");
    const result = shell(`set -e\n${command}`, directory, { ...env, TMPDIR: directory, CALLS: calls, FAIL_AT: fail });
    assert.equal(result.status, fail === "none" ? 0 : 7, result.stderr);
    const invoked = readFileSync(calls, "utf8").trim().split("\n").map(JSON.parse);
    assert.equal(invoked.length, fail === "lint" ? 1 : 2);
    if (fail === "none") assert.deepEqual(JSON.parse(readFileSync(invoked[1].at(-1), "utf8")), { resources: [] });
  }
});

test("AB-18 extracted Terraform validation never initializes the deployment backend", (context) => {
  const directory = scratch(context);
  const calls = path.join(directory, "calls.jsonl");
  const env = stub(
    directory,
    "terraform",
    String.raw`
const fs = require("node:fs");
const assert = require("node:assert/strict");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS, JSON.stringify(args) + "\n");
if (args[0] === "init") for (const flag of ["-backend=false", "-input=false", "-lockfile=readonly"]) assert.ok(args.includes(flag));
if (args[0] !== "fmt") assert.ok(process.env.TF_DATA_DIR.startsWith(process.env.TMPDIR));
if (args[0] === process.env.FAIL_AT) process.exit(9);
`,
  );
  const command = blocks(read("_subagents/terraform-validate-subagent"), "bash")[0]
    .replaceAll("{module_path}", directory)
    .replaceAll("{validation_data_dir}", directory);
  for (const fail of ["fmt", "init", "validate", "none"]) {
    writeFileSync(calls, "");
    const result = shell(`set -e\n${command}`, directory, { ...env, TMPDIR: directory, CALLS: calls, FAIL_AT: fail });
    assert.equal(result.status, fail === "none" ? 0 : 9, result.stderr);
    const invoked = readFileSync(calls, "utf8").trim().split("\n").map(JSON.parse);
    assert.equal(invoked.length, fail === "fmt" ? 1 : fail === "init" ? 2 : 3);
  }
});

test("AB-19 actual replacement table preserves both action orders", () => {
  const body = read("_subagents/terraform-plan-subagent");
  const rows = [...body.matchAll(/^\s*\| `([^`]+)`\s*\| `(\[[^`]+\])`\s*\|/gm)];
  assert.deepEqual(
    rows.map((row) => [row[1], JSON.parse(row[2])]),
    [
      ["-/+", ["delete", "create"]],
      ["+/-", ["create", "delete"]],
    ],
  );
  assert.match(body, /Count either replacement once under Replace/);
  assert.match(body, /Quote the exact `address` and `actions` array/);
});

test("AB-20 extracted scratch allocation isolates simultaneous same-project calls", async (context) => {
  const directory = scratch(context);
  const command = blocks(read("_subagents/policy-precheck-subagent"), "bash")[0];
  const allocations = await Promise.all(
    Array.from({ length: 4 }, async () => {
      const result = await shellAsync(`${command}\nprintf '%s' "$scratch_dir"`, directory, {
        ...process.env,
        TMPDIR: directory,
      });
      assert.equal(result.status, 0, result.stderr);
      return result.stdout;
    }),
  );
  assert.equal(new Set(allocations).size, allocations.length);
  for (const allocated of allocations) assert.equal(path.dirname(allocated), directory);
  assert.doesNotMatch(read("_subagents/policy-precheck-subagent"), /\/tmp\/\{project\}/);
});

test("AB-21 declared empty-artifact payload validates; ad hoc failure and partial JSON fail", (context) => {
  const directory = scratch(context);
  const output = path.join(directory, "agent-output/demo");
  mkdirSync(output, { recursive: true });
  const body = read("_subagents/challenger-review-subagent");
  const payload = JSON.parse(
    readFileSync(
      path.join(root, "tools/tests/fixtures/subagent-file-contract/challenger-review.findings.json"),
      "utf8",
    ),
  );
  payload.artifact_type = "requirements";
  payload.review_focus = "comprehensive";
  payload.risk_level = "high";
  payload.must_fix_count = 1;
  payload.should_fix_count = 0;
  payload.suggestion_count = 0;
  payload.findings = [payload.findings[0]];
  const artifact = path.join(output, "01-requirements.md");
  writeFileSync(artifact, "");
  payload.challenged_artifact = artifact;
  payload.cache_inputs = cacheInputs(artifact, root);
  Object.assign(payload.findings[0], {
    id: "abcdef01",
    severity: "must_fix",
    category: "missing_failure_mode",
    claim: "Artifact is empty or contains no substantive content.",
  });
  payload.findings[0].suggested_fix.artifact_path = artifact;
  payload.findings[0].id = findingId(payload.findings[0]);
  const file = path.join(output, "challenge-findings-requirements.json");
  const validator = path.join(root, "tools/scripts/validate-challenger-findings.mjs");
  const run = (value) => {
    writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
    return spawnSync(process.execPath, [validator], { cwd: directory, encoding: "utf8" });
  };
  const single = run(payload);
  assert.equal(single.status, 0, single.stdout + single.stderr);
  const batch = run({ batch_results: [payload, { ...payload, pass_number: 2 }] });
  assert.equal(batch.status, 0, batch.stdout + batch.stderr);
  assert.equal(run({ status: "artifact_not_found", artifact_path: "missing", findings: [] }).status, 1);
  assert.equal(run('{"partial":').status, 1);
  assert.match(body, /status:"FAILED"/);
  assert.match(body, /No writes, including findings/);
  assert.deepEqual(parseFrontmatter(body).tools, ["read", "search"]);
});

test("AB-16 parent follow-up: policy validator must accept BLOCKING drift without fabricated violations", (context) => {
  const directory = scratch(context);
  const scripts = path.join(directory, "tools/scripts");
  mkdirSync(path.join(scripts, "_lib"), { recursive: true });
  for (const file of ["validate-policy-precheck.mjs", "summarize-deployment-preview.mjs", "_lib/reporter.mjs"])
    copyFileSync(path.join(root, "tools/scripts", file), path.join(scripts, file));
  const output = path.join(directory, "agent-output/demo");
  mkdirSync(output, { recursive: true });
  writeFileSync(
    path.join(output, "06-policy-precheck.json"),
    JSON.stringify({
      schema_version: "policy-precheck-v2",
      status: "BLOCKED",
      deploy_gate: "BLOCK",
      policies_that_will_block_deploy: [],
      live_policies_missing_from_constraints: [],
      live_policies_newer_than_envelope: [],
      what_if_summary: { policy_violations_in_what_if: 0 },
      attestation: { envelope_status: "FRESH" },
      drift_signal: { severity: "BLOCKING", missing_from_constraints_count: 0, newer_than_envelope_count: 0 },
    }),
  );
  const result = spawnSync(process.execPath, [path.join(scripts, "validate-policy-precheck.mjs")], {
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stdout + result.stderr);
});

test("AB-21 parent follow-up: explicit temporary-file validation must not scan zero files", (context) => {
  const directory = scratch(context);
  const file = path.join(directory, "findings.json.tmp");
  writeFileSync(file, "invalid JSON");
  const result = spawnSync(
    process.execPath,
    [path.join(root, "tools/scripts/validate-challenger-findings.mjs"), file],
    { cwd: directory, encoding: "utf8" },
  );
  assert.equal(result.status, 1, result.stdout + result.stderr);
});

test("review metadata is deterministic, read-only and detects source, identity and count drift", (context) => {
  const directory = scratch(context);
  const sources = [
    ".github/agents/_subagents/challenger-review-subagent.agent.md",
    ".github/skills/apex-azure-defaults/references/adversarial-checklists.md",
    ".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md",
  ];
  for (const source of sources) {
    mkdirSync(path.dirname(path.join(directory, source)), { recursive: true });
    copyFileSync(path.join(root, source), path.join(directory, source));
  }
  const artifact = path.join(directory, "requirements.md");
  writeFileSync(artifact, "# Requirements\nPrivate API\n");
  const payload = JSON.parse(
    readFileSync(
      path.join(root, "tools/tests/fixtures/subagent-file-contract/challenger-review.findings.json"),
      "utf8",
    ),
  );
  payload.challenged_artifact = artifact;
  payload.cache_inputs = cacheInputs(artifact, directory);
  for (const finding of payload.findings) finding.id = findingId(finding);
  for (const severity of ["must_fix", "should_fix", "suggestion"]) {
    payload[`${severity}_count`] = payload.findings.filter((finding) => finding.severity === severity).length;
  }
  const draft = path.join(directory, "review.json.tmp");
  const write = (value) => writeFileSync(draft, JSON.stringify(value));
  write(payload);
  const original = readFileSync(draft, "utf8");
  const run = (...args) =>
    spawnSync(process.execPath, [path.join(root, "tools/scripts/validate-challenger-findings.mjs"), ...args], {
      cwd: directory,
      encoding: "utf8",
    });
  const metadata = run("--metadata", artifact, "--finding-ids", draft);
  assert.equal(metadata.status, 0, metadata.stdout + metadata.stderr);
  assert.deepEqual(JSON.parse(metadata.stdout).cache_inputs, payload.cache_inputs);
  assert.equal(payload.cache_inputs.model_policy, "runtime-managed");
  assert.equal(Object.hasOwn(payload.cache_inputs, "model"), false);
  const reviewerPath = path.join(directory, sources[0]);
  const reviewerSource = readFileSync(reviewerPath, "utf8");
  writeFileSync(reviewerPath, reviewerSource.replace(/^---\n/, '---\nmodel: ["Claude Sonnet 5.5 (copilot)"]\n'));
  const legacyCache = cacheInputs(artifact, directory);
  assert.equal(legacyCache.model_policy, "legacy-pinned");
  assert.equal(legacyCache.model, "Claude Sonnet 5.5 (copilot)");
  writeFileSync(reviewerPath, reviewerSource);
  assert.deepEqual(
    JSON.parse(metadata.stdout).finding_ids,
    payload.findings.map((finding, index) => ({
      index,
      id: finding.id,
    })),
  );
  assert.equal(readFileSync(draft, "utf8"), original);
  assert.equal(run("--verify-cache", draft).status, 0);
  write({ batch_results: [payload, { ...payload, pass_number: 2 }] });
  assert.equal(run("--verify-cache", draft).status, 0);
  write(payload);
  for (const source of [artifact, ...sources.map((source) => path.join(directory, source))]) {
    const before = readFileSync(source);
    writeFileSync(source, Buffer.concat([before, Buffer.from("\nchanged\n")]));
    assert.equal(run("--verify-cache", draft).status, 1, source);
    assert.equal(readFileSync(draft, "utf8"), original);
    writeFileSync(source, before);
  }
  for (const bad of [
    { ...payload, cache_inputs: { ...payload.cache_inputs, model: "wrong-model" } },
    { ...payload, must_fix_count: 999 },
    { ...payload, findings: [{ ...payload.findings[0], id: "00000000" }] },
    { batch_results: [] },
    { findings: [null] },
  ]) {
    write(bad);
    assert.equal(run("--verify-cache", draft).status, 1);
  }
  const code = path.join(directory, "iac");
  mkdirSync(code);
  assert.equal(run("--metadata", code).status, 1);
  writeFileSync(path.join(code, "main.tf"), "terraform {}\n");
  const directoryHash = cacheInputs(code, directory).artifact_sha;
  assert.equal(run("--metadata", code).status, 0);
  mkdirSync(path.join(code, ".terraform"));
  writeFileSync(path.join(code, ".terraform", "cache"), "not authored source");
  assert.equal(cacheInputs(code, directory).artifact_sha, directoryHash);
  writeFileSync(path.join(code, "module.tf"), "resource {}\n");
  assert.notEqual(cacheInputs(code, directory).artifact_sha, directoryHash);
  symlinkSync(artifact, path.join(code, "linked.md"));
  assert.equal(run("--metadata", code).status, 1);
  assert.equal(run("--metadata", "missing.md").status, 1);
  assert.equal(run("--metadata", artifact, "--verify-cache", draft).status, 1);
});
