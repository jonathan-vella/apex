/**
 * Vendor-prompting fixture driver.
 *
 * Loads each fixture in fixtures/agents/ and fixtures/prompts/, parses it,
 * and asserts that the vendor-prompting checks fire the expected rule IDs.
 * The expected map is declared inline below — each fixture's filename maps
 * to the rule IDs we expect to see (or to an empty array for "good" fixtures).
 *
 * Run: node --test tools/tests/vendor-prompting/run.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  runVendorPrompting,
  runFrontmatterValidation,
  validateAgentPermissions,
  FAMILY_STATUS,
} from "../../scripts/validate-agents.mjs";
import { parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";
import { getAgents } from "../../scripts/_lib/workspace-index.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures", "agents");
const PROMPT_FIXTURES = path.join(__dirname, "fixtures", "prompts");

/**
 * Expected rule IDs per fixture. Order does not matter; superset is allowed
 * because future rules may legitimately fire on bad fixtures.
 */
const EXPECTATIONS = {
  "fixture-good-claude.agent.md": {
    mustHave: [],
    mustNotHave: ["claude-no-prefill-001", "handoff-enrichment-001", "frontmatter-model-style-001"],
  },
  "fixture-bad-claude.agent.md": {
    mustHave: ["claude-no-prefill-001", "handoff-enrichment-001"],
    mustNotHave: [],
  },
  "fixture-good-gpt55.agent.md": {
    mustHave: [],
    mustNotHave: [
      "gpt55-skeleton-001",
      "gpt-no-claude-xml-001",
      "personality-scoping-001",
      "gpt55-stop-rules-non-empty-001",
      "handoff-enrichment-001",
    ],
  },
  "fixture-bad-gpt55.agent.md": {
    mustHave: ["gpt55-skeleton-001", "gpt-no-claude-xml-001", "personality-scoping-001", "handoff-enrichment-001"],
    mustNotHave: [],
  },
};

/**
 * Expected rule IDs per prompt fixture. Mirrors EXPECTATIONS but for
 * `.prompt.md` files staged into `.github/prompts/`.
 */
const PROMPT_EXPECTATIONS = {
  "fixture-good-custom-agent.prompt.md": {
    mustHave: [],
    mustNotHave: ["prompt-model-source-001", "frontmatter-model-style-001"],
  },
  "fixture-bad-custom-agent-with-model.prompt.md": {
    mustHave: ["prompt-model-source-001"],
    mustNotHave: [],
  },
  "fixture-good-generic-agent.prompt.md": {
    mustHave: [],
    mustNotHave: ["prompt-model-source-001"],
  },
  "fixture-bad-generic-agent-no-model.prompt.md": {
    mustHave: [],
    mustNotHave: ["prompt-model-source-001", "frontmatter-model-style-001"],
  },
};

const catalog = {
  models: Object.fromEntries(
    [
      "gpt-5.6-sol",
      "GPT-5.6-Terra",
      "GPT-5.6-Luna",
      "GPT-5.5",
      "Claude Opus 4.7",
      "Claude Opus 5",
      "MAI-Code-1.1-Flash",
    ].map((label) => [label, { deprecated: false }]),
  ),
};
catalog.models["GPT-5.4"] = { deprecated: true };

const contract =
  "# Role\nReviewer.\n# Goal\nReview.\n# Success criteria\nVerified.\n# Constraints\nRead only.\n# Output\nFindings.\n# Stop rules\nStop on missing evidence.";
function item(frontmatter, body = contract, isSubagent = false) {
  return { frontmatter, content: body, path: path.join(__dirname, "synthetic.md"), isSubagent };
}
function lint({ agents = new Map(), prompts = new Map() } = {}) {
  return runVendorPrompting({ agents, prompts, catalog }).findings;
}
function lintFixture(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const fixture = { content, frontmatter: parseFrontmatter(content), path: filePath };
  if (filePath.endsWith(".agent.md")) return lint({ agents: new Map([[filePath, fixture]]) });
  const target = fixture.frontmatter.agent;
  const agents = new Map();
  if (target && target !== "agent") agents.set("target", item({ name: target, model: ["Claude Opus 5"] }));
  return lint({ agents, prompts: new Map([[filePath, fixture]]) }).filter((finding) =>
    finding.file.endsWith(path.basename(filePath)),
  );
}

for (const [fixture, exp] of Object.entries(EXPECTATIONS)) {
  test(`fixture ${fixture}`, async () => {
    const filePath = path.join(FIXTURES, fixture);
    assert.ok(fs.existsSync(filePath), `Missing fixture: ${filePath}`);

    const findings = lintFixture(filePath);

    const ruleIds = new Set(findings.map((f) => f.ruleId));
    for (const must of exp.mustHave) {
      assert.ok(ruleIds.has(must), `${fixture}: expected rule "${must}" to fire. Got: [${[...ruleIds].join(", ")}]`);
    }
    for (const mustNot of exp.mustNotHave) {
      assert.ok(
        !ruleIds.has(mustNot),
        `${fixture}: expected rule "${mustNot}" NOT to fire. Got: [${[...ruleIds].join(", ")}]`,
      );
    }
  });
}

for (const [fixture, exp] of Object.entries(PROMPT_EXPECTATIONS)) {
  test(`prompt fixture ${fixture}`, async () => {
    const filePath = path.join(PROMPT_FIXTURES, fixture);
    assert.ok(fs.existsSync(filePath), `Missing fixture: ${filePath}`);

    const findings = lintFixture(filePath);

    const ruleIds = new Set(findings.map((f) => f.ruleId));
    for (const must of exp.mustHave) {
      assert.ok(ruleIds.has(must), `${fixture}: expected rule "${must}" to fire. Got: [${[...ruleIds].join(", ")}]`);
    }
    for (const mustNot of exp.mustNotHave) {
      assert.ok(
        !ruleIds.has(mustNot),
        `${fixture}: expected rule "${mustNot}" NOT to fire. Got: [${[...ruleIds].join(", ")}]`,
      );
    }
  });
}

test("all fallback labels and families are checked, without weakening errors for MAI", () => {
  const findings = lint({
    agents: new Map([
      ["agent", item({ model: ["MAI-Code-1.1-Flash", "gpt-5.6-sol", "GPT-5.4", "unlisted"] }, "prefill the assistant")],
    ]),
  });
  assert.ok(findings.some((finding) => finding.ruleId === "gpt55-skeleton-001"));
  assert.ok(findings.some((finding) => finding.ruleId === "model-deprecation-001"));
  assert.ok(
    findings.some((finding) => finding.ruleId === "frontmatter-model-style-001" && finding.severity === "error"),
  );
  const scalar = lint({ agents: new Map([["agent", item({ model: "MAI-Code-1.1-Flash" })]]) });
  assert.ok(scalar.some((finding) => finding.severity === "error"));
});

test("ordinary labels are exact; platform-qualified handoff labels are allowed", () => {
  for (const model of ["GPT-5.6-Sol", "gpt-5.6-sol ", "gpt-5.6-sol (copilot)", false, null]) {
    assert.ok(
      lint({ agents: new Map([["agent", item({ model: [model] })]]) }).some((finding) => finding.severity === "error"),
    );
  }
  const findings = lint({
    agents: new Map([["agent", item({ model: ["gpt-5.6-sol"], handoffs: [{ model: "GPT-5.6-Terra (copilot)" }] })]]),
  });
  assert.equal(findings.filter((finding) => finding.severity === "error").length, 0);
});

test("inherited custom prompt checks every family and generic picker inheritance is valid", () => {
  const agents = new Map([["parent", item({ name: "Parent", model: ["gpt-5.6-sol", "Claude Opus 5"] })]]);
  const prompts = new Map([["prompt", item({ agent: "Parent" }, "prefill the assistant")]]);
  assert.ok(lint({ agents, prompts }).some((finding) => finding.ruleId === "claude-no-prefill-001"));
  for (const agent of [undefined, "agent", "ask", "edit", "plan"]) {
    assert.equal(lint({ prompts: new Map([["prompt", item({ agent })]]) }).length, 0);
  }
  assert.ok(
    lint({ prompts: new Map([["prompt", item({ agent: "Unknown" })]]) }).some(
      (finding) => finding.ruleId === "prompt-model-source-001",
    ),
  );
});

test("leaf workers need a role contract, not main body sections or personality", () => {
  for (const model of ["gpt-5.6-sol", "GPT-5.6-Luna", "GPT-5.6-Terra"]) {
    const good = item(
      { model: [model] },
      "# Reviewer\n## Inputs\nEvidence.\n## Outputs\nFindings. Return to parent on failure.",
      true,
    );
    assert.equal(lint({ agents: new Map([["leaf", good]]) }).length, 0);
    const bad = item({ model: [model] }, "# Reviewer\nDo things.", true);
    assert.ok(lint({ agents: new Map([["leaf", bad]]) }).some((finding) => finding.ruleId === "gpt55-skeleton-001"));
  }
});

test("main outcome contracts require role and nonempty stop rules across Sol, Terra and Luna", () => {
  for (const model of ["gpt-5.6-sol", "GPT-5.6-Luna", "GPT-5.6-Terra"]) {
    const body = contract.replace("# Role\nReviewer.\n", "").replace("Stop on missing evidence.", "");
    const findings = lint({ agents: new Map([["main", item({ model: [model] }, body)]]) });
    assert.ok(findings.some((finding) => finding.ruleId === "gpt55-skeleton-001"));
    assert.ok(findings.some((finding) => finding.ruleId === "gpt55-stop-rules-non-empty-001"));
  }
});

test("empty agents needs no tool; explicit allowlists override target disable-model-invocation", () => {
  const target = item({ name: "Generic-Target", "disable-model-invocation": true });
  const agents = new Map([["target", target]]);
  assert.deepEqual(validateAgentPermissions({ agents: [], tools: ["read"], "disable-model-invocation": true }), []);
  assert.deepEqual(validateAgentPermissions({ agents: ["Generic-Target"], tools: ["agent"] }, { agents }), []);
  assert.ok(validateAgentPermissions({ agents: ["Generic-Target"], tools: ["read"] }, { agents }).length);
  assert.ok(validateAgentPermissions({ agents: ["missing"], tools: ["agent"] }, { agents }).length);
  for (const tools of [
    ["agent"],
    ["agent/runSubagent"],
    ["functions/runSubagent"],
    ["todo"],
    ["functions/manage_todo_list"],
    ["vscode/askQuestions"],
    ["vscode"],
    ["*"],
    [false],
  ]) {
    assert.ok(validateAgentPermissions({ agents: [], tools }, { isSubagent: true }).length);
  }
  assert.ok(validateAgentPermissions({ agents: ["nested"], tools: ["read"] }, { isSubagent: true }).length);
  assert.deepEqual(validateAgentPermissions({ agents: [], tools: ["read", "execute"] }, { isSubagent: true }), []);
});

test("shared authoring policy and family registry match the implemented contracts", () => {
  const root = path.resolve(__dirname, "../../..");
  const read = (filename) => fs.readFileSync(path.join(root, filename), "utf8");
  const registry = JSON.parse(read(".github/skills/apex-vendor-prompting/rules.json"));
  assert.deepEqual(Object.fromEntries(registry.families.map(({ family, status }) => [family, status])), FAMILY_STATUS);
  for (const ruleId of ["gpt55-skeleton-001", "gpt55-stop-rules-non-empty-001", "gpt-no-claude-xml-001"]) {
    const rule = registry.rules.find(({ id }) => id === ruleId);
    assert.equal(rule.policy_origin, "repository-convention");
    for (const family of ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna"])
      assert.ok(rule.model_families.includes(family));
    assert.ok(registry.sources.some(({ id }) => id === rule.source_id));
  }
  const skill = read(".github/skills/apex-vendor-prompting/SKILL.md");
  assert.doesNotMatch(skill, /audit:vendor-prompting|generate-skill-digests|FIRST entry|first entry decides/);
  assert.match(skill, /node tools\/scripts\/fetch-vendor-prompting-guides\.mjs/);
  assert.ok(fs.existsSync(path.join(root, "tools/scripts/fetch-vendor-prompting-guides.mjs")));
  const authoring = read(".github/instructions/agent-authoring.instructions.md");
  assert.match(authoring, /nonempty `agents` list requires/);
  assert.match(authoring, /`agents: \[\]` does not/);
  assert.match(authoring, /allowlists must not override/);
  assert.match(authoring, /human handoff\s+to `10-Challenger`/);
  assert.doesNotMatch(authoring, /first frontmatter model/);
  const context = read(".github/instructions/context-optimization.instructions.md");
  assert.match(context, /Do not infer runtime cost-tier eligibility/);
  assert.match(context, /Shared skills inherit the caller's model\/tools/);
  assert.doesNotMatch(context, /requires `<context_awareness>`|pool roughly\s+doubles/);
  assert.doesNotMatch(read("tools/scripts/validate-agents.mjs"), /E2E Orchestrator|e2e-orchestrator/);
});

test("production reviewer policy forbids allowlist overrides and nested main wrappers", () => {
  const root = path.resolve(__dirname, "../../..");
  for (const filename of [
    ".github/instructions/agent-authoring.instructions.md",
    ".github/skills/apex-agent-authoring/references/runtime-guardrails.md",
  ]) {
    const content = fs.readFileSync(path.join(root, filename), "utf8").replace(/\s+/g, " ");
    assert.match(content, /reviewer is unavailable, stop and request a human handoff to `10-Challenger`/, filename);
    assert.match(
      content,
      /Missing or empty reviewer output permits exactly one identical-input retry, then stop and request a human handoff to `10-Challenger`/,
      filename,
    );
    assert.match(content, /Never invoke a nested main-agent wrapper or fabricate an inline review/, filename);
    assert.match(content, /caller allowlists must not override this production boundary/, filename);
    assert.doesNotMatch(content, /allowlist can override|only (?:when|if) explicitly allowlisted/, filename);
  }
});

test("production handoff and terminology guidance cannot revive retired E2E launch", () => {
  const root = path.resolve(__dirname, "../../..");
  const handoffs = fs.readFileSync(
    path.join(root, ".github/skills/apex-workflow-engine/references/handoff-validation-rules.md"),
    "utf8",
  );
  assert.match(handoffs, /E2E launch subsystem is retired/);
  assert.doesNotMatch(handoffs, /E2E Orchestrator|handoffs SHOULD align/);
  assert.match(handoffs, /explicit caller allowlists must not override/);
  const blocklist = JSON.parse(fs.readFileSync(path.join(root, ".github/terminology-blocklist.json"), "utf8"));
  const retired = blocklist.rules.find(({ id }) => id === "e2e-conductor-filename");
  assert.ok(retired);
  assert.match(retired.replacement, /remove retired E2E/);
  for (const rule of blocklist.rules) {
    assert.doesNotMatch(rule.replacement, /e2e-orchestrator|E2E Orchestrator/);
  }
});

test("agent documentation preserves canonical models and human-selected harness boundaries", () => {
  const root = path.resolve(__dirname, "../../..");
  const docs = fs.readFileSync(path.join(root, "site/src/content/docs/concepts/how-it-works/agents.md"), "utf8");
  assert.match(docs, /Agent frontmatter is the canonical model assignment/);
  assert.match(docs, /Requirements, Architect, IaC Planner, Context Optimizer \| `gpt-5\.6-sol`/);
  assert.match(docs, /Design, Bicep CodeGen, Terraform CodeGen, As-Built, Diagnose, Challenger \| `GPT-5\.6-Terra`/);
  assert.match(docs, /Governance, Bicep Deploy, Terraform Deploy \| `GPT-5\.6-Luna`/);
  assert.match(docs, /Orchestrator \| `MAI-Code-1\.1-Flash`/);
  assert.match(docs, /Local prompt files are adapters, not Agent Host entry points/);
  assert.match(docs, /Skills inherit the caller's model\/tools/);
  assert.match(docs, /allowlists must not override that boundary/);
  assert.doesNotMatch(docs, /Claude Opus 5|Claude Sonnet 5|Anthropic XML-tagged|delegates to a step agent/);
});

test("prompt and skill authoring distinguish Local adapters from Host execution", () => {
  const root = path.resolve(__dirname, "../../..");
  for (const filename of [
    ".github/instructions/prompt.instructions.md",
    ".github/instructions/agent-skills.instructions.md",
  ]) {
    const content = fs.readFileSync(path.join(root, filename), "utf8").replace(/\s+/g, " ");
    assert.match(content, /Local prompt files are adapters, not Agent Host entry points/, filename);
    assert.match(content, /explicitly select its owning main agent before consequential work/, filename);
    assert.match(content, /Skills inherit the caller's model\/tools/, filename);
    assert.match(content, /Keep needed Local discovery settings/, filename);
  }
});

test("frontmatter validator accepts generic coordinators and explicitly allowlisted human targets", () => {
  const target = item({
    name: "Generic-Target",
    description: "Review",
    model: ["GPT-5.6-Terra"],
    tools: ["read"],
    agents: [],
    "user-invocable": true,
    "disable-model-invocation": true,
  });
  const main = item({
    name: "Generic-Coordinator",
    description: "Route",
    model: ["MAI-Code-1.1-Flash"],
    tools: ["read"],
    agents: [],
    "user-invocable": true,
    "disable-model-invocation": true,
  });
  const agents = new Map([
    ["main", main],
    ["target", target],
  ]);
  assert.equal(runFrontmatterValidation({ agents }).errors, 0);
  main.frontmatter.agents = ["Generic-Target"];
  main.frontmatter.tools.push("agent");
  assert.equal(runFrontmatterValidation({ agents }).errors, 0);
  main.frontmatter.tools = ["read"];
  assert.ok(runFrontmatterValidation({ agents }).errors > 0);
  main.frontmatter.agents = [];
  main.frontmatter.tools = false;
  assert.ok(runFrontmatterValidation({ agents }).errors > 0);
});

function productionFleet() {
  return structuredClone(getAgents());
}

function productionFindings(agents) {
  return runFrontmatterValidation({ agents }).findings.filter(
    (finding) => finding.ruleId === "production-agent-policy" && finding.severity === "error",
  );
}

test("production names outside the production directories retain generic platform semantics", () => {
  const agents = new Map(
    ["01-Orchestrator", "10-Challenger"].map((name) => {
      const agent = item({
        name,
        description: "Generic fixture",
        model: ["MAI-Code-1.1-Flash"],
        tools: ["agent"],
        agents: ["10-Challenger"],
        "user-invocable": true,
        "disable-model-invocation": false,
      });
      agent.path = path.join(__dirname, "fixtures", ".github", "agents", `${name}.agent.md`);
      return [name, agent];
    }),
  );
  agents.get("10-Challenger").frontmatter["disable-model-invocation"] = true;
  assert.equal(runFrontmatterValidation({ agents }).errors, 0);
});

test("production frontmatter accepts the current fleet and human handoffs", () => {
  assert.equal(runFrontmatterValidation({ agents: productionFleet() }).errors, 0);
});

test("production main agents require disable-model-invocation true", () => {
  for (const [filename, agent] of productionFleet()) {
    if (agent.isSubagent) continue;
    for (const value of [false, undefined, "true"]) {
      const agents = productionFleet();
      const frontmatter = agents.get(filename).frontmatter;
      if (value === undefined) delete frontmatter["disable-model-invocation"];
      else frontmatter["disable-model-invocation"] = value;
      assert.ok(
        productionFindings(agents).some(
          (finding) => finding.file === agent.path && /require disable-model-invocation: true/.test(finding.message),
        ),
        `${agent.frontmatter.name}: ${value}`,
      );
    }
  }
});

test("production callers cannot allowlist any main agent or wildcard, despite generic platform permission", () => {
  const targets = [...productionFleet().values()].filter((agent) => !agent.isSubagent);
  for (const [filename, caller] of productionFleet()) {
    for (const target of [...targets.map((agent) => agent.frontmatter.name), "*"]) {
      const agents = productionFleet();
      const frontmatter = agents.get(filename).frontmatter;
      frontmatter.agents = [target];
      frontmatter.tools = ["agent"];
      assert.deepEqual(validateAgentPermissions(frontmatter, { agents }), []);
      assert.ok(
        productionFindings(agents).some(
          (finding) =>
            finding.file === caller.path &&
            finding.message === `Production agents cannot allowlist main agents or wildcard targets (got: ${target})`,
        ),
        `${caller.frontmatter.name} -> ${target}`,
      );
    }
  }
});

test("production Orchestrator requires an explicit empty allowlist and no delegation tools", () => {
  const worker = [...productionFleet().values()].find((agent) => agent.isSubagent).frontmatter.name;
  for (const override of [
    { agents: undefined },
    { agents: [worker], tools: ["agent"] },
    ...["agent", "agent/runSubagent", "functions/runSubagent", "*"].map((tool) => ({ tools: [tool] })),
  ]) {
    const agents = productionFleet();
    const main = [...agents.values()].find((agent) => agent.frontmatter.name === "01-Orchestrator");
    Object.assign(main.frontmatter, override);
    if (override.agents === undefined && "agents" in override) delete main.frontmatter.agents;
    assert.ok(productionFindings(agents).length > 0, JSON.stringify(override));
  }
});

test("production workers remain hidden leaves", () => {
  for (const override of [
    { "user-invocable": true },
    { "user-invocable": undefined },
    { agents: ["*"] },
    { agents: undefined },
    ...["agent", "agent/runSubagent", "functions/runSubagent", "todo", "vscode/askQuestions", "*"].map((tool) => ({
      tools: [tool],
    })),
  ]) {
    const agents = productionFleet();
    const worker = [...agents.values()].find((agent) => agent.isSubagent);
    Object.assign(worker.frontmatter, override);
    assert.ok(productionFindings(agents).length > 0, JSON.stringify(override));
  }
});
