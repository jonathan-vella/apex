import assert from "node:assert/strict";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
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
} from "../../scripts/validate-agents.mjs";
import { MAX_BODY_LINES } from "../../scripts/_lib/paths.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const agentRoot = path.join(root, ".github/agents");
const read = (name) => readFileSync(path.join(agentRoot, `${name}.agent.md`), "utf8");
test("Orchestrator distinguishes the Requirements owner from its step and artifact prefix", () => {
  const text = read("01-orchestrator");
  const requirements = parseFrontmatter(read("02-requirements"));
  const handoff = parseFrontmatter(text).handoffs.find((entry) => entry.label === "Step 1: Gather Requirements");
  assert.equal(handoff.agent, requirements.name);
  assert.ok(getBody(text).includes(`Step 1 uses \`${requirements.name}\``));
  assert.match(getBody(text), /including in\s+routing-only answers/);
  assert.match(getBody(text), /Step numbers and artifact prefixes are not agent IDs/);
  assert.match(getBody(text), /explanation-only or hypothetical routing question/);
  assert.match(getBody(text), /When the user prohibits tools, answer only from\s+available context/);
  assert.match(getBody(text), /do not search, read files, load skills, or call todo tools/);
  assert.match(getBody(text), /state the limitation and stop/);
  assert.match(getBody(text), /does not\s+waive required discovery, reviews, or approvals/);
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
    assert.ok(Array.isArray(frontmatter.model), name);
    assert.doesNotMatch(body, /<\/?(?:context_awareness|output_contract|scope_fencing)>/, name);
    if (name.startsWith("_subagents/")) {
      assert.equal(frontmatter["user-invocable"], false, name);
      assert.deepEqual(frontmatter.agents, [], name);
    } else {
      assert.equal(frontmatter["disable-model-invocation"], true, name);
    }
  });
}

test("AB-01/15 one-H1 normalization supports nonempty H2 contracts", () => {
  const original = read("03-architect");
  const frontmatter = parseFrontmatter(original);
  const agent = {
    frontmatter,
    content: original,
    path: path.join(agentRoot, "03-architect.agent.md"),
    isSubagent: false,
  };
  const result = runVendorPrompting({
    agents: new Map([[agent.path, agent]]),
    prompts: new Map(),
    catalog: { models: Object.fromEntries(frontmatter.model.map((model) => [model, { deprecated: false }])) },
  });
  const blockers = result.findings.filter((finding) =>
    ["gpt55-skeleton-001", "gpt55-stop-rules-non-empty-001"].includes(finding.ruleId),
  );
  assert.deepEqual(blockers, []);
});

test("AB-02 fresh setup has one owner; resume preserves recovery and mandatory gate breaks", () => {
  const body = read("01-orchestrator");
  assert.match(section(body, "## Starting a New Project", "## Resuming a Project"), /Use the single ONE-SHOT/);
  assert.match(body, /use an explicitly supplied project without reconfirming it/);
  assert.match(body, /empty \/ "no project found"[\s\S]*?NOT a/);
  assert.doesNotMatch(body, /Gates 2 and 3 recommend|Recommend session break at Gates/);
  assert.match(body, /Every accepted Gate \(1, 2, 2.5, 3, 4, 5\) ends with a mandatory/);
  assert.match(body, /orchestrator never auto-invokes/);
});

test("AB-03 complete prerequisites precede review; compliance none differs from missing", () => {
  const body = read("02-requirements");
  const draft = section(body, "## Phase 5: Draft", "## Auto-Trigger Blocker");
  const markers = [
    "01-requirements.md",
    "README.md",
    "sku-manifest.json",
    "sku-manifest.md",
    "shape checks",
    "Record mandatory decisions",
    "Checkpoint",
    "chain into Phase 6a",
  ];
  let offset = 0;
  for (const marker of markers) {
    const next = draft.indexOf(marker, offset);
    assert.ok(next >= offset, marker);
    offset = next + marker.length;
  }
  assert.match(body, /A requirements write alone is not review readiness/);
  assert.match(body, /unanswered compliance question is not equivalent to "none"/);
  assert.match(body, /failed rendering\/checks block review/);
});

test("AB-04/22 candidate comparison cannot approve SKUs or write back manifest prices", () => {
  const architect = read("03-architect");
  const cost = read("_subagents/cost-estimate-subagent");
  assert.match(architect, /Comparison-only `candidate_sets` is the sole pre-approval exception/);
  assert.match(architect, /manifest_path` or `resource_list` pricing unless/);
  assert.match(architect, /challenge-findings-cost-estimate.json/);
  assert.doesNotMatch(architect, /\$450|\$500|Include this table in/);
  assert.match(cost, /Exactly one input mode/);
  assert.doesNotMatch(cost, /Mode [BC] adds/);
  assert.match(cost, /comparison advice only; it is not SKU approval and never changes the manifest/);
  assert.match(cost, /only on COMPLETE with\s+`manifest_writeback: true`/);
});

test("AB-05 ADR creation is not architecture approval; execution failure is not findings", () => {
  const body = read("04-design");
  assert.match(body, /Architect review and human approval before any architecture change/);
  assert.match(body, /ADR creation alone is insufficient/);
  assert.match(body, /An execution failure\s+is not findings/);
  assert.doesNotMatch(body, /Log subagent failures[\s\S]{0,65}and continue/);
});

test("AB-06/07 governance final inputs precede review; exhausted stale review blocks", () => {
  const body = read("04g-governance");
  assert.match(body, /Execution order is 2 → 2.7 → 2.5 → 3/);
  assert.match(body, /single pass was already consumed, STOP/);
  assert.match(body, /newly\s+written `decisions.discovery_signature` cannot attest old answers/);
  assert.match(body, /Explicit refresh\s+invalidates prior confirmations even if the signature stays equal/);
  assert.match(body, /COMPLETE empty-policy result still resolves all topics/);
  assert.match(body, /validly reused across sessions/);
  assert.doesNotMatch(
    body,
    /two required confirmations|answered in the same chat session|On Refresh governance\*\*: restart from Phase 0.45/,
  );
});

for (const refresh of [false, true]) {
  test(`SK-02 governance binds confirmed subscription in source command (refresh=${refresh})`, (context) => {
    const body = read("04g-governance");
    const phase = section(body, "### Phase 1: Governance Discovery", "### Phase 2: Generate Artifacts");
    assert.match(phase, /If missing or ambiguous, STOP for\s+confirmation/);
    assert.match(phase, /never default to the active Azure CLI subscription/);
    assert.match(body, /discover\.py --subscription "<confirmed-subscription-id>" --refresh/);
    const command = blocks(phase, "bash").find((block) => block.includes("scripts/discover.py"));
    assert.ok(command);
    const directory = scratch(context);
    const env = stub(directory, "python", "console.log(JSON.stringify(process.argv.slice(2))); ");
    const invocation = command
      .trim()
      .replaceAll("{project}", "fixture-project")
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
  assert.match(body, /explicit manifest-backed SKU inputs/);
  assert.match(body, /Preserve both historical review aliases/);
  assert.match(body, /environment-manifest.json` for the downstream deploy contract on every project/);
  assert.match(body, /diagram `.py`, `.png`, `.svg` siblings/);
});

for (const track of ["bicep", "terraform"]) {
  const prefix = track === "bicep" ? "b" : "t";
  test(`AB-09/16 ${track} preliminary acceptance cannot bypass L3 or final approval`, () => {
    const body = read(`07${prefix}-${track}-deploy`);
    assert.match(body, /Preview accepted; apply not yet approved/);
    assert.match(body, /Only explicit approval of this current block authorizes apply/);
    assert.match(body, /BLOCKING drift or a text\/JSON gate mismatch blocks/);
    assert.match(body, /Missing or stale pricing returns to\s+`03-Architect`/);
    assert.match(body, /If `cost_delta` exceeds envelope by >20%/);
    assert.match(body, /Failed, partial and preview-only\s+summaries do not complete Step 6/);
  });
  test(`AB-10/15 ${track} completion remains mandatory outside optional review`, () => {
    const body = read(`06${prefix}-${track}-codegen`);
    const completion = section(body, "### Phase 4.6 + Phase 6", "## ");
    assert.match(completion, /These completion checks run even when Phase 4.5 is skipped/);
    assert.match(completion, /Mechanical Auto-Fix Before Exiting/);
    assert.match(completion, /Save `05-implementation-reference.md` in every mode/);
    assert.match(body, /one file per response turn/);
    assert.match(body, /never migrate persisted keys silently/);
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
    assert.match(body, /L2 request without `project` returns FAILED/);
    assert.match(body, /L2 not evaluated: project not supplied/);
    assert.match(body, /CodeGen owns/);
  });
}

test("AB-11 partial As-Built cannot complete Step 7 and inventory owns every chart sibling", () => {
  const body = read("08-as-built");
  const output = section(body, "## Output Contract", "## Scope");
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
  assert.match(output, /`.py` \+ `.png` \+ `.svg`/);
  assert.match(output, /Do not mark Step 7 complete, call `complete-step 7`/);
  assert.match(body, /Partial requests\s+select only the required rows/);
  assert.match(body, /Preserve persisted keys/);
});

test("AB-12 actual diagnostic severity table maps without losing source severity", () => {
  const body = read("09-diagnose");
  const rows = [...body.matchAll(/^\| (Critical|High|Medium|Low) \| (critical|warning|info) \|$/gm)];
  assert.deepEqual(Object.fromEntries(rows.map((row) => [row[1], row[2]])), {
    Critical: "critical",
    High: "warning",
    Medium: "warning",
    Low: "info",
  });
  assert.match(body, /listing is\s+not diagnosis or remediation authorization/);
  assert.match(body, /expansion does not authorize bulk remediation/);
  assert.match(body, /Use the exact Phase 6 report headings/);
});

test("AB-13 requested pass and resolved paths survive decision/apply/review return", () => {
  const body = read("10-challenger");
  const single = section(body, "### Single-Pass Review", "### Multi-Pass Review");
  assert.match(single, /resolved requested pass/);
  assert.doesNotMatch(single, /`pass_number` = `1`/);
  assert.match(body, /Machine-readable detail is in `\{findings_path\}`/);
  assert.match(body, /Required re-review blocks advancement/);
  assert.match(body, /final aggregated gate, accepted edits\s+if authorized and not frozen, validation, apply summary/);
});

test("AB-14 missing telemetry permits source-only auditing without measured claims", () => {
  const body = read("11-context-optimizer");
  assert.match(body, /For source-only requests, skip log collection and Phase 2/);
  assert.match(body, /cannot claim observed loading,\s+runtime quality, latency or token savings/);
  assert.doesNotMatch(body, /each adds ~50-100 tokens|Avg latency \(Opus\)/);
  assert.match(body, /no snapshots,\s+report files, temporary exports/);
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

test("AB-18 extracted Bicep checks short-circuit persistent errors and retain compiled evidence", (context) => {
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
  const command = blocks(read("_subagents/bicep-validate-subagent"), "bash")[0].replaceAll(
    "{template_path}",
    "main.bicep",
  );
  for (const fail of ["lint", "build", "none"]) {
    writeFileSync(calls, "");
    const result = shell(command, directory, { ...env, TMPDIR: directory, CALLS: calls, FAIL_AT: fail });
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
  const command = blocks(read("_subagents/terraform-validate-subagent"), "bash")[0].replaceAll(
    "{module_path}",
    directory,
  );
  for (const fail of ["fmt", "init", "validate", "none"]) {
    writeFileSync(calls, "");
    const result = shell(command, directory, { ...env, TMPDIR: directory, CALLS: calls, FAIL_AT: fail });
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

test("AB-21 empty-artifact payload from actual example validates; ad hoc failure and partial JSON fail", (context) => {
  const directory = scratch(context);
  const output = path.join(directory, "agent-output/demo");
  mkdirSync(output, { recursive: true });
  const body = read("_subagents/challenger-review-subagent");
  const payload = JSON.parse(blocks(body, "json").find((block) => block.includes('"schema_version"')));
  payload.artifact_type = "requirements";
  payload.review_focus = "comprehensive";
  payload.risk_level = "high";
  payload.must_fix_count = 1;
  Object.assign(payload.findings[0], {
    id: "abcdef01",
    severity: "must_fix",
    category: "missing_failure_mode",
    claim: "Artifact is empty or contains no substantive content.",
  });
  const file = path.join(output, "challenge-findings-requirements.json");
  const validator = path.join(root, "tools/scripts/validate-challenger-findings.mjs");
  const run = (value) => {
    writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
    return spawnSync(process.execPath, [validator], { cwd: directory, encoding: "utf8" });
  };
  assert.equal(run(payload).status, 0);
  assert.equal(run({ batch_results: [payload, { ...payload, pass_number: 2 }] }).status, 0);
  assert.equal(run({ status: "artifact_not_found", artifact_path: "missing", findings: [] }).status, 1);
  assert.equal(run('{"partial":').status, 1);
  assert.match(body, /file_path: not_written/);
  assert.match(body, /unwritable output[\s\S]*?Preserve existing files/);
});

test("AB-16 parent follow-up: policy validator must accept BLOCKING drift without fabricated violations", (context) => {
  const directory = scratch(context);
  const scripts = path.join(directory, "tools/scripts");
  mkdirSync(path.join(scripts, "_lib"), { recursive: true });
  for (const file of ["validate-policy-precheck.mjs", "_lib/reporter.mjs"])
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
      what_if_summary: { policy_violations_in_what_if: 0 },
      attestation: { envelope_status: "FRESH" },
      drift_signal: { severity: "BLOCKING" },
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
