import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import test from "node:test";
import { parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";
import { getPromptFiles } from "../../scripts/_lib/workspace-index.mjs";

const root = new URL("../../../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");

test("pricing leaf retains Azure MCP scope for model-agnostic deferred tool loading while enforcing pricing-only usage", () => {
  const body = read(".github/agents/_subagents/cost-estimate-subagent.agent.md");
  const metadata = parseFrontmatter(body);
  assert.deepEqual(metadata.tools, ["execute", "read", "edit", "search", "azure-mcp/*"]);
  assert.deepEqual(metadata.agents, []);
  assert.equal(metadata["user-invocable"], false);
  const config = JSON.parse(read(".mcp.json"));
  assert.ok(config.mcpServers["azure-mcp"]);
  const snapshot = JSON.parse(read("tools/registry/azure-mcp-tools.json"));
  assert.ok(snapshot.tools.pricing.commands.pricing_get);
  assert.match(body, /invoke ONLY the `pricing` tool/);
  assert.match(body, /Never call any other Azure MCP tool/);
  const guidance = read(".github/skills/apex-azure-defaults/references/pricing-guidance.md");
  assert.match(guidance, /declares `azure-mcp\/\*` in frontmatter/);
  assert.match(guidance, /restricts usage strictly to the `pricing` capability/);
  assert.doesNotMatch(guidance, /Invoke `mcp_azure_mcp_ser_pricing` directly/);
  const parent = read(".github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md");
  assert.match(parent, /cached session/);
  assert.match(parent, /Do not require worker self-attestation/);
  assert.match(parent, /keep usage restricted to the pricing tool/);
});

for (const [entry, reference] of [
  ["apex-workflow-start", "apex-workflow-engine/references/workflow-entry.md"],
  ["apex-debug-log-export", "apex-context-management/references/debug-log-export.md"],
]) {
  test(`${entry} is manual, model-inheriting and permission-neutral`, () => {
    const content = read(`.github/skills/${entry}/SKILL.md`);
    const metadata = parseFrontmatter(content);
    assert.equal(metadata.name, entry);
    assert.equal(metadata["user-invocable"], true);
    assert.equal(metadata["disable-model-invocation"], true);
    for (const key of ["agent", "agents", "model", "tools", "allowed-tools", "context", "hooks"]) {
      assert.equal(Object.hasOwn(metadata, key), false, `${entry}: ${key}`);
    }
    assert.ok(content.includes(`../${reference}`));
    assert.ok(existsSync(new URL(`.github/skills/${reference}`, root)));
    assert.match(content, /(?:cannot change|does not bind)/);
    assert.match(content, /(?:widen tools|widening tools|grant permission)/);
    assert.match(content, /(?:STOP|blocker)/);
  });
}

test("Local roots are archived and never active prompt sources", () => {
  assert.equal(getPromptFiles().size, 0);
  for (const [retired, archived] of [
    [".github/prompts", "github-prompts"],
    ["tools/apex-prompts", "apex-prompts"],
    [".github/instructions/prompt.instructions.md", "prompt.instructions.md"],
  ]) {
    assert.equal(existsSync(new URL(retired, root)), false, retired);
    assert.equal(existsSync(new URL(`.archive/pre-cpharness/${archived}`, root)), false, archived);
  }
  assert.equal(Object.hasOwn(JSON.parse(read("tools/registry/agent-registry.json")), "prompts"), false);
});

test("only Orchestrator dispatches main agents; steps dispatch leaves only", () => {
  const mains = readdirSync(new URL(".github/agents/", root))
    .filter((file) => file.endsWith(".agent.md"))
    .map((file) => parseFrontmatter(read(`.github/agents/${file}`)));
  const names = new Set(mains.map((agent) => agent.name));
  const orchestrator = mains.find((agent) => agent.name === "01-Orchestrator");
  for (const agent of mains) {
    assert.equal(agent["user-invocable"], true, agent.name);
    assert.ok(agent.tools.includes("ask_user"), `${agent.name}: native direct questioning`);
    for (const key of ["handoffs", "model", "reasoning-effort"]) {
      assert.equal(Object.hasOwn(agent, key), false, `${agent.name}: ${key}`);
    }
  }
  assert.equal(orchestrator["disable-model-invocation"], true);
  assert.ok(orchestrator.agents.length > 0);
  assert.ok(orchestrator.tools.includes("agent"));
  for (const target of orchestrator.agents) {
    assert.ok(names.has(target) || target === "challenger-review-subagent", target);
    assert.notEqual(target, orchestrator.name);
  }
  for (const agent of mains.filter((agent) => agent !== orchestrator)) {
    const manualEntries = new Set(["07b-Bicep Deploy", "07t-Terraform Deploy", "09-Diagnose", "10-Challenger"]);
    assert.equal(agent["disable-model-invocation"], manualEntries.has(agent.name), agent.name);
    assert.equal(agent["user-invocable"], true, agent.name);
    for (const target of agent.agents ?? []) assert.ok(!names.has(target), `${agent.name}: ${target}`);
  }
});

test("Orchestrator can relay independent review without requiring nested worker delegation", () => {
  const orchestrator = read(".github/agents/01-orchestrator.agent.md");
  const metadata = parseFrontmatter(orchestrator);
  assert.ok(metadata.agents.includes("challenger-review-subagent"));
  assert.ok(orchestrator.includes("REVIEW_REQUIRED"));
  assert.match(orchestrator, /independent sibling task/);
  assert.match(orchestrator, /complete captured-answer ledger/);
  const requirements = read(".github/agents/02-requirements.agent.md");
  assert.match(requirements, /Run the independent review automatically/);
  assert.ok(requirements.includes("REVIEW_REQUIRED"));
  assert.match(requirements, /requirements-discovery\.mjs/);
});

test("Requirements and its interactive parent preserve the native form wrapper", () => {
  for (const file of [
    ".github/agents/01-orchestrator.agent.md",
    ".github/agents/02-requirements.agent.md",
    ".github/instructions/agent-operating-frame.instructions.md",
  ]) {
    const body = read(file);
    assert.match(body, /`requestedSchema` contains only `properties`/, file);
    assert.match(body, /only\s+`message` and `requestedSchema`/, file);
    for (const keyword of ["type", "required", "additionalProperties"]) {
      assert.ok(body.includes(`\`${keyword}\``), `${file}: unsupported root ${keyword}`);
    }
  }
  assert.match(read(".github/agents/01-orchestrator.agent.md"), /Return malformed forms to the producer/);
  assert.match(read(".github/agents/01-orchestrator.agent.md"), /one schema-only correction/);
});

test("every question-capable agent carries the shared form contract, including future agents", () => {
  const questionAgents = readdirSync(new URL(".github/agents/", root))
    .filter((file) => file.endsWith(".agent.md"))
    .filter((file) => parseFrontmatter(read(`.github/agents/${file}`)).tools.includes("ask_user"));
  assert.ok(questionAgents.length > 0);
  for (const file of questionAgents) {
    const body = read(`.github/agents/${file}`);
    assert.ok(body.includes("copilot-instructions.md#user-question-forms"), file);
    for (const rule of [
      "Before direct display or delegated return",
      "distinct contextual titles",
      "no unconditional companion note fields",
      "reuse custom answers",
      "only triggered follow-ups",
    ]) {
      assert.ok(body.includes(rule), `${file}: ${rule}`);
    }
  }
  const shared = read(".github/copilot-instructions.md").split("## User Question Forms\n")[1]?.split("\n## ")[0];
  assert.ok(shared, "Shared runtime guidance must cover general questions, not just reviews");
  assert.match(shared, /every agent.*form/s);
  assert.ok(shared.includes("validate_question_batching.py --form <scoped-form.json>"));
  assert.match(shared, /read-only roles.*in memory/);
  assert.match(shared, /only the validated payload to `ask_user`/);
  assert.ok(shared.includes("--context <question-context.json> --require-context"));
  assert.ok(shared.includes("validate_payload(form, context, require_context=True)"));
  assert.ok(shared.includes("kind: input|follow_up|approval|disposition"));
  const frame = read(".github/instructions/agent-operating-frame.instructions.md");
  const authoring = read(".github/instructions/agent-authoring.instructions.md");
  for (const body of [frame, authoring]) {
    assert.ok(body.includes("copilot-instructions.md#user-question-forms"));
  }
});

test("review owners preflight and record attempts without inventing root role selection", () => {
  for (const file of readdirSync(new URL(".github/agents/", root)).filter((file) => file.endsWith(".agent.md"))) {
    const body = read(`.github/agents/${file}`);
    const metadata = parseFrontmatter(body);
    if (!(metadata.agents ?? []).includes("challenger-review-subagent")) continue;
    assert.match(body, /preflight the exact request/i, file);
    assert.match(body, /(?:record|persist) `started`/, file);
    assert.match(body, /actual (?:invocation )?outcome/, file);
  }
  const entry = read(".github/skills/apex-workflow-engine/references/workflow-entry.md");
  assert.match(entry, /report unknown/);
  assert.match(entry, /default coordinating chat/);
  assert.match(entry, /historical step status/);
});

test("explicit resume does not turn absent role telemetry into another workflow gate", () => {
  const entry = read(".github/skills/apex-workflow-engine/references/workflow-entry.md");
  assert.match(entry, /missing role label alone is not a blocker/);
  assert.ok(entry.includes("`session.metadata`"));
  assert.ok(entry.includes("`get_current_session`"));
  assert.match(entry, /not role-selection evidence/);
  assert.match(entry, /Do not dispatch.*role-verification worker/);
  assert.match(entry, /known incompatible role/);
  assert.match(entry, /actual tools, calling constraints, scope and human approvals/);
  assert.match(entry, /Loading a definition.*not native activation/);
  for (const file of [
    ".github/copilot-instructions.md",
    ".github/agents/01-orchestrator.agent.md",
    ".github/instructions/agent-operating-frame.instructions.md",
  ]) {
    const body = read(file);
    assert.match(body, /role telemetry is not a workflow gate/, file);
    assert.match(body, /(?:unknown|Unknown)/, file);
  }
  const orchestrator = parseFrontmatter(read(".github/agents/01-orchestrator.agent.md"));
  assert.equal(orchestrator["disable-model-invocation"], true);
  const architect = parseFrontmatter(read(".github/agents/03-architect.agent.md"));
  assert.deepEqual(architect.agents, ["cost-estimate-subagent", "challenger-review-subagent"]);
});

test("full-phase coordination preserves owner contracts and rejects draft-only handoffs", () => {
  const parent = read(".github/agents/01-orchestrator.agent.md");
  const architect = read(".github/agents/03-architect.agent.md");
  const lifecycle = read(".github/skills/apex-workflow-engine/references/worker-readiness.md");
  const execution = read(".github/skills/apex-workflow-engine/references/execution-subagent.md");
  const pricing = read(".github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md");
  const entry = read(".github/skills/apex-workflow-engine/references/workflow-entry.md");
  const shared = read(".github/copilot-instructions.md");
  for (const body of [parent, lifecycle]) {
    assert.match(body, /owner.*contract/);
    assert.match(body, /approved requirements/i);
    assert.match(body, /partial result/);
  }
  assert.match(parent, /JSON syntax.*not.*phase completion/);
  assert.match(parent, /status.*`COMPLETE`/);
  assert.match(parent, /continue.*remaining authorized work/);
  assert.match(architect, /required capability.*not.*optional/);
  assert.match(architect, /provisional ranges/);
  assert.match(architect, /draft-only/);
  assert.match(execution, /Delegated mains may invoke only their declared leaves/);
  assert.match(execution, /actual nested task capability/);
  assert.match(execution, /Leaves never delegate/);
  assert.doesNotMatch(execution, /They do not ask the user questions,[\s\S]{0,70}dispatch subagents/);
  assert.doesNotMatch(pricing, /same-worker ACK|tool-free turns/);
  assert.match(pricing, /No readiness handshake/);
  assert.ok(entry.includes("01-orchestrator.agent.md"));
  assert.match(shared, /owner contracts.*before delegation/);
});

test("graph runtime metadata is descriptive while domain owners remain actual main definitions", () => {
  const graph = JSON.parse(read(".github/skills/apex-workflow-engine/templates/workflow-graph.json"));
  for (const key of ["harness", "delegation", "interaction", "handoffs", "permissions"]) {
    assert.equal(typeof graph.metadata.runtime_contract[key], "string", key);
    assert.ok(graph.metadata.runtime_contract[key].trim(), key);
  }
  const names = new Set(
    readdirSync(new URL(".github/agents/", root))
      .filter((file) => file.endsWith(".agent.md"))
      .map((file) => parseFrontmatter(read(`.github/agents/${file}`)).name),
  );
  for (const node of Object.values(graph.nodes).filter((node) => node.type === "agent-step")) {
    assert.ok(names.has(node.agent), `${node.id}: ${node.agent}`);
    assert.ok(Array.isArray(node.requires), `${node.id}: domain prerequisites`);
    assert.ok(Array.isArray(node.produces), `${node.id}: domain outputs`);
  }
});

test("selected Orchestrator continues new-project discovery rather than stopping at initialization", () => {
  const body = read(".github/agents/01-orchestrator.agent.md");
  const setup = body.split("## Project setup\n")[1]?.split("\n## Native delegation")[0];
  assert.ok(setup, "Project startup behavior must be defined");
  for (const field of ["02-Requirements", "native `task`", "ask_user", "initialization-only"]) {
    assert.ok(setup.includes(field), `Startup continuation: ${field}`);
  }
  assert.match(setup, /Do not ask the user to select this same role again/);
  const entry = read(".github/skills/apex-workflow-engine/references/workflow-entry.md");
  assert.match(entry, /only if that role is not already active/);
  assert.match(entry, /An existing record with Step 1 pending is resumed, not reinitialized/);
  const start = read(".github/skills/apex-workflow-start/SKILL.md");
  assert.match(start, /If the requested owner is already active, continue there/);
});
