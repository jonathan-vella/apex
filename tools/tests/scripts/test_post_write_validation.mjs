#!/usr/bin/env node
/**
 * test_post_write_validation.mjs — guard the post-write validation
 * contract added for issue #425.
 *
 * The actual validation runs inside agent execution (one-liner shape
 * checks after each artifact write), so the executable invariant is
 * documentary: the table must exist in apex-azure-artifacts SKILL.md with
 * rows for every artifact type, and the shared operating frame must
 * link to it without assuming runtime attachment to main step agents.
 *
 * Run via:
 *   node --test tools/tests/scripts/test_post_write_validation.mjs
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../..");

const SKILL = path.join(ROOT, ".github/skills/apex-azure-artifacts/SKILL.md");
const OPFRAME = path.join(ROOT, ".github/instructions/agent-operating-frame.instructions.md");

test("pricing preserves deployment quantities and reuses only current equivalent evidence", () => {
  const worker = fs.readFileSync(path.join(ROOT, ".github/agents/_subagents/cost-estimate-subagent.agent.md"), "utf8");
  const guidance = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-defaults/references/pricing-guidance.md"),
    "utf8",
  );
  assert.doesNotMatch(worker, /\.regions\[0\]/);
  assert.match(worker, /environments, regions, and stamps/);
  assert.match(worker, /Preserve the original query timestamp/);
  assert.match(worker, /manifest mode with `manifest_writeback: true`/);
  assert.match(worker, /persisted inputs for equivalence checks; missing inputs prevent reuse/);
  assert.match(guidance, /inherit unspecified nested fields/);
  assert.match(guidance, /shares rates, not deployment quantities/);
  assert.match(guidance, /not multiplied by quantity twice/);
  assert.match(guidance, /not future-dated/);
  assert.match(guidance, /APEX_SKU_PRICING_TTL_DAYS/);
  assert.match(guidance, /planned versus deployed scope/);
  assert.match(guidance, /recalculate every affected total/);
  assert.match(guidance, /Region comparisons and\s+candidate alternatives are not additional deployed resources/);
  const parent = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md"),
    "utf8",
  );
  assert.match(parent, /full-input equivalence checks/);
  assert.match(parent, /preserves the independent cost-feasibility review/);
  assert.match(parent, /effective overrides and explicit usage/);
});

test("research routes by service and availability, not shared query language", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/skills/apex-azure-prepare/references/research.md"), "utf8");
  assert.match(body, /Log Analytics.*apex-azure-diagnostics/);
  assert.doesNotMatch(body, /\| Log Analytics[^\n]*apex-azure-kusto/);
  assert.match(body, /Azure Data Explorer.*apex-azure-kusto/);
  assert.match(body, /current session's skill catalog/);
  assert.match(body, /never invent a skill path/);
  assert.match(body, /Greenfield or proposed-resource pricing.*cost-estimate-subagent/);
  assert.match(body, /Existing deployment spend or rightsizing.*apex-azure-cost-optimization/);
  assert.match(body, /unavailable pricing workers block pricing/);
});

test("Azure context reuse requires confirmation and preserves current checks and approval", () => {
  const context = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-prepare/references/azure-context.md"),
    "utf8",
  );
  assert.match(context, /Reuse unchanged user-confirmed subscription and region without asking again/);
  assert.match(context, /environment variable alone is not\s+confirmation/);
  assert.match(context, /After compaction or a new chat, recover persisted confirmation/);
  assert.match(context, /permission, policy, availability, capacity, and resource-group compatibility/);
  assert.match(context, /does not authorize\s+deployment/);
  for (const file of [
    "apex-azure-prepare/SKILL.md",
    "apex-azure-deploy/references/pre-deploy-checklist.md",
    "apex-azure-validate/references/recipes/azd/environment.md",
    "apex-azure-validate/references/recipes/azd/README.md",
  ]) {
    const body = fs.readFileSync(path.join(ROOT, ".github/skills", file), "utf8");
    assert.match(body, /azure-context.md#confirmation-reuse/);
    assert.match(body, /missing or invalidated/);
  }
  const environment = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-validate/references/recipes/azd/environment.md"),
    "utf8",
  );
  assert.doesNotMatch(environment, /proceed with `azd up/);
  assert.match(environment, /Validation-only stops with results/);
});

test("instruction accuracy matches configuration, parser, and enforcement boundaries", () => {
  const instruction = (name) =>
    fs.readFileSync(path.join(ROOT, `.github/instructions/${name}.instructions.md`), "utf8");
  const terraform = instruction("iac-terraform-best-practices");
  assert.match(terraform, />= 4\.0\.0, < 5\.0\.0/);
  assert.doesNotMatch(terraform, /~> 4\.0` minor-version|minor-version constraints to allow patch/);
  assert.doesNotMatch(instruction("python"), /pyproject.toml` sets `basic`/);
  assert.doesNotMatch(fs.readFileSync(path.join(ROOT, "pyproject.toml"), "utf8"), /typeCheckingMode/);
  assert.match(instruction("shell"), /use `set -eu` for POSIX sh/);
  assert.match(instruction("shell"), /while \[ "\$#" -gt 0 \]/);
  assert.match(instruction("javascript"), /tools\/scripts\/_lib\/parse-frontmatter.mjs/);
  assert.doesNotMatch(instruction("javascript"), /function parseFrontmatter\(/);
  assert.match(instruction("javascript"), /js-yaml/);
  assert.match(instruction("javascript"), /yaml.JSON_SCHEMA/);
  assert.match(instruction("javascript"), /booleans,[\s\S]*nested maps/);
  assert.match(instruction("javascript"), /Do not treat parse errors as absent frontmatter/);
  assert.doesNotMatch(instruction("javascript"), /YAML-like|not a full YAML parser/);
  assert.deepEqual(parseFrontmatter('---\r\nName: Example\r\nmodel: ["one", "two"]\r\n---\r\n'), {
    name: "Example",
    model: ["one", "two"],
  });
  assert.match(instruction("context-optimization"), /Warning only/);
  assert.match(instruction("context-optimization"), /not runtime read\/token enforcement/);
  assert.match(instruction("agent-skills"), /same line as `\*\*REQUIRED\*\*`/);
  assert.match(instruction("agent-skills"), /does not\s+count runtime reads/);
  const lessons = instruction("lesson-collection");
  assert.match(lessons, /apex-recall init <project> --json/);
  assert.match(lessons, /preserve existing lesson entries/);
  assert.match(lessons, /--artifact agent-output\/<project>\/09-lessons-learned.json --json/);
  assert.match(lessons, /never patch session state directly/);
  assert.match(lessons, /no lessons recorded/);
  assert.doesNotMatch(lessons, /Update `00-session-state.json`|\/\/ agent-output/);
  assert.match(lessons, /New workflow logs use `"production"`/);
  assert.match(lessons, /historical `"e2e"` value/);
  assert.doesNotMatch(lessons, /### E2E Orchestrator Triggers|Phase H|Set `workflow_mode` to `"e2e"`/);
  assert.match(instruction("no-interactive-shell"), /there is no `apex-recall lessons` subcommand/);
});

test("Azure entry points distinguish APEX handoffs from generic proof and validation-only intent", () => {
  for (const recipe of ["azd", "azcli", "bicep", "terraform"]) {
    const body = fs.readFileSync(
      path.join(ROOT, `.github/skills/apex-azure-validate/references/recipes/${recipe}/README.md`),
      "utf8",
    );
    assert.match(body, /Validation-only stops/);
    assert.doesNotMatch(body, /All checks pass → \*\*apex-azure-deploy\*\*/);
  }
  for (const file of ["07b-bicep-deploy.agent.md", "07t-terraform-deploy.agent.md"]) {
    const body = fs.readFileSync(path.join(ROOT, ".github/agents", file), "utf8");
    assert.match(body, /no generic `\.azure\/plan.md`/);
    assert.match(body, /neither handoff path is usable/);
    assert.match(body, /actual validation evidence and current applicable checks/);
    assert.match(body, /Neither completes Step 6 as deployed/);
    assert.doesNotMatch(body, /via apex-azure-prepare/);
  }
  const readSkill = (skill) => fs.readFileSync(path.join(ROOT, `.github/skills/${skill}/SKILL.md`), "utf8");
  const validate = readSkill("apex-azure-validate");
  assert.match(validate, /No generic `\.azure\/plan.md` is required/);
  assert.match(validate, /validation-only returns passed, failed, and unperformed checks and stops/);
  assert.match(validate, /Section 7/);
  assert.doesNotMatch(validate, /If missing → run apex-azure-prepare first/);
  assert.match(validate, /Only this workflow updates generic plan status/);
  assert.doesNotMatch(validate, /MUST.*invoke \*\*apex-azure-deploy\*\* to execute/);
  assert.match(
    readSkill("apex-azure-prepare"),
    /All remaining phases, plan prerequisites, and references here apply to generic/,
  );
  assert.match(readSkill("apex-azure-deploy"), /then stop this generic\s+pipeline/);
  const shared = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-iac-common/references/deploy-shared-workflow.md"),
    "utf8",
  );
  assert.match(shared, /actual validation evidence/);
  assert.match(shared, /zero-match success/);
  assert.match(shared, /CodeGen owns handoff re-emission/);
  assert.match(shared, /no Challenger review to Step 6/);
  assert.match(shared, /live policy precheck \(L3\)/);
});

test("CodeGen has one build-checkpoint owner and never passes an incomplete scaffold", () => {
  const order = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-iac-common/references/codegen-file-order.md"),
    "utf8",
  );
  assert.doesNotMatch(order, /after files 6, 9, 12|after files 3, 6, 9/);
  assert.equal((order.match(/Build cadence is owned by the shared workflow/g) ?? []).length, 2);
  const shared = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-iac-common/references/codegen-shared-workflow.md"),
    "utf8",
  );
  assert.match(shared, /After every \*\*3 files written\*\*/);
  assert.match(shared, /deferred \(not passed\)/);
  assert.match(shared, /no completion or handoff with deferred checks/);
  assert.match(shared, /existence alone does not prove a complete write/);
  assert.match(shared, /exactly one file per response turn/);
  assert.match(shared, /changing models does not authorize batching file bodies/);
  assert.doesNotMatch(shared, /wasting the entire 200K\+ output/);
});

test("Diagnose writes its report separately from session finding registration", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/09-diagnose.agent.md"), "utf8");
  assert.match(body, /Write or update the report using file-editing tools/);
  assert.match(body, /finding registration does not write the report/);
  assert.doesNotMatch(body, /diagnose-report-\*|Save the file via/);
  assert.match(body, /Stop before each Azure CLI, KQL, or remediation command until the user approves/);
});

test("Challenger resolves canonical stems and consumes persisted schema fields", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/10-challenger.agent.md"), "utf8");
  assert.match(body, /`implementation-plan` \| `plan`/);
  assert.match(body, /`governance-constraints` \/ `-pass1`/);
  assert.match(body, /`06-deploy-approval.json` \| `deployment-preview`/);
  assert.match(body, /Preserve explicit caller-supplied `output_path`/);
  assert.match(body, /ask for distinct pass-one and remaining-batch paths/);
  assert.match(body, /output_path` = resolved remaining-batch findings_path/);
  assert.doesNotMatch(body, /artifact_type=comprehensive|set `artifact_type` to `"comprehensive"`/);
  assert.match(body, /\{suggested_fix.proposed_edit\}/);
  const worker = fs.readFileSync(
    path.join(ROOT, ".github/agents/_subagents/challenger-review-subagent.agent.md"),
    "utf8",
  );
  assert.match(worker, /`deployment-preview`, `design-adr` \(required\)/);
  assert.match(worker, /`prior_findings`: Compact string/);
  assert.match(worker, /return only the Parent-Facing Summary in chat/);
  assert.doesNotMatch(worker, /Return ONLY valid JSON matching/);
});

test("review reuse and deployment routing cannot bypass current evidence", () => {
  const governance = fs.readFileSync(path.join(ROOT, ".github/agents/04g-governance.agent.md"), "utf8");
  assert.match(governance, /existing `cache_inputs` match the current artifact/);
  assert.match(governance, /signature` alone is not review freshness evidence/);
  assert.match(governance, /TTL expiry, signature drift, or explicit refresh still requires live discovery/);
  assert.match(governance, /including review validity/);
  assert.match(governance, /return to Phase 2\.5/);
  const resume = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-governance-discovery/references/resume-checks.md"),
    "utf8",
  );
  assert.match(resume, /reviewed\s+architecture and governance inputs are unchanged/);
  assert.match(resume, /If only review validity fails/);
  const deploy = fs.readFileSync(path.join(ROOT, ".github/agents/07t-terraform-deploy.agent.md"), "utf8");
  assert.match(deploy, /azd path does not bypass any gate/);
  assert.doesNotMatch(deploy, /Skip to Step 6 .*after `azd provision` completes/);
  const preview = fs.readFileSync(path.join(ROOT, ".github/agents/_subagents/bicep-whatif-subagent.agent.md"), "utf8");
  assert.match(preview, /`Deploy`\s*\| Deployment; changes unknown/);
  assert.doesNotMatch(preview, /No-op deploy/);
  const orchestrator = fs.readFileSync(path.join(ROOT, ".github/agents/01-orchestrator.agent.md"), "utf8");
  assert.match(orchestrator, /canonical source paths only/);
  assert.doesNotMatch(orchestrator, /Extract key facts \(region/);
  const asBuilt = fs.readFileSync(path.join(ROOT, ".github/agents/08-as-built.agent.md"), "utf8");
  assert.match(asBuilt, /full Step 7 suite still requires every listed output/);
  assert.doesNotMatch(asBuilt, /Read ALL prior artifacts/);
});

test("shared references preserve consolidated documentation and deployment rules", () => {
  const docs = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-docs-writer/references/extended-workflows.md"),
    "utf8",
  );
  assert.match(docs, /Starlight supplies the H1/);
  assert.doesNotMatch(docs, /File header: `# \{Title\}`/);
  const strategies = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-iac-common/references/deployment-strategies.md"),
    "utf8",
  );
  assert.match(strategies, /guide owns the comparison matrix/);
  assert.match(strategies, /Single Deployment \(only for <5 resources, dev\/test\)/);
  assert.match(strategies, /Still requires user approval/);
  assert.doesNotMatch(strategies, /azd env new prod/);
  const guide = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-iac-common/references/azd-vs-deploy-guide.md"),
    "utf8",
  );
  assert.match(guide, /AZURE_SUBSCRIPTION_ID, AZURE_RESOURCE_GROUP, AZURE_LOCATION, AZURE_ENV_NAME/);
});

test("optimization guidance uses edit capabilities and recorded token evidence", () => {
  for (const file of [
    ".github/instructions/context-optimization.instructions.md",
    ".github/instructions/azure-artifacts.instructions.md",
    ".github/skills/apex-azure-artifacts/references/revision-workflow.md",
    ".github/skills/apex-iac-common/references/iac-planner-approval-gate.md",
  ]) {
    const body = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(body, /apply_patch/);
    assert.doesNotMatch(body, /`create_file` \((?:with logged ADR|documented in ADR|rationale logged)\)/);
    assert.doesNotMatch(body, /20–60×|8–18 K output tokens|A 24-finding revision/);
    assert.doesNotMatch(body, /single\s+`multi_replace_string_in_file`|One pass, one tool call/);
    assert.match(body, /validate before dependent follow-up edits/);
  }
  const agent = fs.readFileSync(path.join(ROOT, ".github/agents/11-context-optimizer.agent.md"), "utf8");
  const methodology = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-context-management/references/analysis-methodology.md"),
    "utf8",
  );
  assert.match(agent, /when absent, report unknown/);
  assert.doesNotMatch(agent, /Estimate token cost from latency/);
  assert.match(methodology, /Missing usage remains unknown/);
  assert.doesNotMatch(methodology, /Likely Context Size|context is growing without hand-offs/);
});

test("CodeGen uses its combined validation worker and preserves the security gate", () => {
  for (const track of ["bicep", "terraform"]) {
    const prefix = track === "bicep" ? "06b" : "06t";
    const body = fs.readFileSync(path.join(ROOT, `.github/agents/${prefix}-${track}-codegen.agent.md`), "utf8");
    assert.match(body, /Invoke the listed validation subagent once/);
    assert.match(body, /Await APPROVED before Phase 4\.5/);
    assert.doesNotMatch(body, /Invoke both validation subagents|Await both results/);
    assert.match(body, /validate:iac-security-baseline/);
    assert.match(body, /Phase 4\.5 is \*\*skipped\*\*/);
  }
});

test("IaC tag consumers follow discovered keys and do not mandate provenance tags", () => {
  for (const track of ["bicep", "terraform"]) {
    const worker = fs.readFileSync(
      path.join(ROOT, `.github/agents/_subagents/${track}-validate-subagent.agent.md`),
      "utf8",
    );
    assert.match(worker, /validate tag keys, values, and casing against the discovered policy contract/);
    assert.match(worker, /greenfield fallback only when no tag policy applies/);
    assert.match(worker, /`ManagedBy` is optional provenance/);
    assert.match(worker, /Any of the three forces `Overall Status: FAILED`/);
    assert.doesNotMatch(worker, /four baseline|four\s+baseline|relevant `apex-azure-defaults` digest/);
    const guidance = fs.readFileSync(path.join(ROOT, `infra/${track}/AGENTS.md`), "utf8");
    assert.match(guidance, /copilot-instructions\.md#required-tags-azure-policy-enforced/);
    assert.doesNotMatch(guidance, /Every resource gets the \d+ required tags/);
  }
});

test("Terraform testing guidance uses file filters and preserves cleanup authorization", () => {
  for (const file of ["SKILL.md", "references/test-execution.md"]) {
    const body = fs.readFileSync(path.join(ROOT, ".github/skills/apex-terraform-test", file), "utf8");
    assert.match(body, /terraform test -filter=tests\/defaults_unit_test\.tftest\.hcl/);
    assert.doesNotMatch(body, /terraform test tests\/|-no-cleanup|-count=1|-filter=test_resource_group/);
    assert.match(body, /authoriz/);
  }
});

test("pattern and Storage examples retain drift and identity safeguards", () => {
  const patterns = fs.readFileSync(path.join(ROOT, ".github/skills/apex-terraform-patterns/SKILL.md"), "utf8");
  assert.match(patterns, /ignore_changes` only for blocks managed externally/);
  assert.match(patterns, /do not suppress Terraform-owned changes/);
  const storage = fs.readFileSync(path.join(ROOT, ".github/skills/apex-azure-storage/SKILL.md"), "utf8");
  const commands = storage.split("\n").filter((line) => /^az storage (blob|container) /.test(line));
  assert.equal(commands.length, 4);
  for (const command of commands) assert.match(command, /--auth-mode login/);
  assert.match(storage, /Storage Blob Data Reader/);
  assert.match(storage, /Storage Blob Data Contributor/);
});

test("site guidance consolidation preserves Markdown/MDX scope without absorbing update triggers", () => {
  assert.equal(fs.existsSync(path.join(ROOT, ".github/instructions/markdown-docs.instructions.md")), false);
  const body = fs.readFileSync(path.join(ROOT, ".github/instructions/docs.instructions.md"), "utf8");
  const patterns = parseFrontmatter(body)
    .applyto.split(",")
    .map((pattern) => pattern.trim());
  for (const file of [
    "site/src/content/docs/index.mdx",
    "site/src/content/docs/guides/example.md",
    "site/src/content/docs/deep/nested/example.mdx",
    "site/src/components/Example.astro",
    "docs/example.md",
    "agent-output/example/01-requirements.md",
    ".github/agents/example.agent.md",
  ]) {
    assert.equal(
      patterns.some((pattern) => path.matchesGlob(file, pattern)),
      path.matchesGlob(file, "site/src/content/docs/**/*.{md,mdx}"),
      file,
    );
  }
  assert.match(body, /Starlight renders the frontmatter title/);
  assert.match(body, /preserve canonical template H2 order/);
  assert.match(body, /component imports after frontmatter/);
  assert.match(body, /badge rows, collapsible TOCs/);
  assert.doesNotMatch(body, /# \{Title\}|Current Version|npm run (?:check:links|build:site)/);
  const triggers = fs.readFileSync(path.join(ROOT, ".github/instructions/docs-trigger.instructions.md"), "utf8");
  assert.match(parseFrontmatter(triggers).applyto, /agent\.md/);
  assert.match(triggers, /Agent or skill definitions are added, renamed, or removed/);
});

test("apex-azure-artifacts SKILL.md declares the Post-write validation section", () => {
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
  assert.match(
    body,
    /apex-azure-artifacts\/SKILL\.md#post-write-validation/,
    "missing anchored link to apex-azure-artifacts post-write-validation",
  );
  assert.doesNotMatch(body, /\| Artifact type\s+\|/);
  assert.match(body, /Deferred checks are not passes/);
});

test("shared harness guidance preserves human selection and does not infer model permissions", () => {
  for (const file of [
    "AGENTS.md",
    ".github/copilot-instructions.md",
    ".github/skills/apex-docs-writer/references/repo-architecture.md",
  ]) {
    const body = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(body, /disable-model-invocation: true/, file);
    assert.match(body, /Local prompt files are adapters/, file);
    assert.match(body, /Agent Host/, file);
    assert.match(body, /not a security boundary/, file);
    assert.match(body, /runtime cost-tier/, file);
  }
  const inventory = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-docs-writer/references/repo-architecture.md"),
    "utf8",
  );
  for (const match of inventory.matchAll(/\|[^\n|]+\| `(\d[^`]+\.agent\.md)`\s+\| ([^|]+)\|/g)) {
    const header = parseFrontmatter(fs.readFileSync(path.join(ROOT, ".github/agents", match[1]), "utf8"));
    assert.equal(match[2].trim(), header.model[0], match[1]);
    assert.equal(header["disable-model-invocation"], true, match[1]);
  }
  assert.doesNotMatch(inventory, /e2e-orchestrator\.agent\.md|Claude (?:Sonnet|Opus) 5/);
  const parent = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md"),
    "utf8",
  );
  assert.match(parent, /`03-Architect` uses `gpt-5.6-sol`/);
  assert.match(parent, /`08-As-Built` uses `GPT-5.6-Terra`/);
  assert.match(parent, /`cost-estimate-subagent` uses `GPT-5.6-Luna`/);
  assert.match(parent, /cost-feasibility review with `challenger-review-subagent` \(`GPT-5.6-Terra`\)/);
  assert.match(parent, /Do not infer effort settings/);
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
    assert.match(body, /targeting \*\*05-IaC Planner\*\*/);
    assert.match(body, /\*\*04g-Governance\*\* owns discovery/);
    assert.match(body, /neither Planner nor CodeGen generates governance artifacts/);
    assert.doesNotMatch(body, /Before doing any work, read these skills\.|Also read `02-architecture-assessment.md`/);
  }
});

test("Planner resolves the earliest missing prerequisite to its exact owning agent", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/05-iac-planner.agent.md"), "utf8");
  assert.match(body, /Missing architecture takes precedence/);
  assert.match(body, /targeting \*\*03-Architect\*\*/);
  assert.match(body, /targeting \*\*04g-Governance\*\*/);
  assert.match(body, /not file basenames/);
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

test("shared CodeGen reference matches supported discovery, exact pins and compaction recovery", () => {
  const body = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-iac-common/references/codegen-shared-workflow.md"),
    "utf8",
  );
  assert.doesNotMatch(body, /terraform\/(?:search_modules|get_module_details|get_latest_module_version)/);
  assert.doesNotMatch(body, /Stop loading additional skills|Context reaches ~80%/);
  assert.match(body, /Preserve the plan's exact module pins/);
  assert.match(body, /returns to the Planner/);
  assert.match(body, /load missing required phase guidance/);
  assert.match(body, /refresh only the needed sections/);
  assert.match(body, /ONE FILE PER TURN/);
  assert.match(body, /No self-edit/);
  const contract = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-iac-common/references/contract-emission-and-handoff.md"),
    "utf8",
  );
  assert.doesNotMatch(contract, /terraform\/get_module_details/);
  assert.match(contract, /approved exact version/);
});

test("Governance expiry forces live refresh instead of returning to the invalid cache", () => {
  const agent = fs.readFileSync(path.join(ROOT, ".github/agents/04g-governance.agent.md"), "utf8");
  const reference = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-governance-discovery/references/resume-checks.md"),
    "utf8",
  );
  assert.match(agent, /TTL expiry or signature drift bypasses Phases 0\.45 and 0\.5/);
  assert.match(agent, /Phase 1 live discovery with `--refresh`/);
  assert.doesNotMatch(agent, /pass `--refresh` only when the user asks|Pass `--refresh` only when/);
  assert.match(reference, /bypass baseline selection and cached reuse/);
});
