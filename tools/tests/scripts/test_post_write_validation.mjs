#!/usr/bin/env node
/**
 * test_post_write_validation.mjs — guard the post-write validation
 * contract added for issue #425.
 *
 * The actual validation runs inside agent execution (one-liner shape
 * checks after each artifact write), so the executable invariant is
 * documentary: the table must exist in apex-azure-artifacts SKILL.md with
 * rows for every artifact type, and the shared operating frame retains
 * actual write checks without assuming runtime attachment to main agents.
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
  assert.match(guidance, /catalog field and can be empty/);
  assert.match(guidance, /remove unverified SKU\/meter filters first/);
  assert.match(guidance, /Reuse the same service response across candidate tiers/);
  assert.match(guidance, /corresponding `<Tier> Registry Unit` meter/);
  assert.match(guidance, /Key Vault is operation\/key-type billing/);
  assert.match(guidance, /billable_days/);
  assert.doesNotMatch(guidance, /`armSkuName` is the deployed ARM SKU/);
  assert.match(worker, /removing unverified SKU\/meter/);
  const parent = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md"),
    "utf8",
  );
  assert.match(parent, /full-input equivalence checks/);
  assert.match(parent, /preserves the independent cost-feasibility review/);
  assert.match(parent, /effective overrides and explicit usage/);
});

test("network pricing recipes use verified billing mappings without omitting variable charges", () => {
  const guidance = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-defaults/references/pricing-guidance.md"),
    "utf8",
  );
  const section = guidance.split("## Private Endpoint and private DNS meters\n")[1].split("## Meter selection")[0];
  const queries = [...section.matchAll(/```json\n([\s\S]*?)```/g)].map((match) => JSON.parse(match[1]));
  assert.deepEqual(queries, [
    {
      serviceName: "Virtual Network",
      armRegionName: "Global",
      meterName: "Standard Private Endpoint",
      priceType: "Consumption",
      currencyCode: "USD",
    },
    { serviceName: "Azure DNS", meterName: "Private Zone", priceType: "Consumption", currencyCode: "USD" },
    { serviceName: "Azure DNS", meterName: "Private Queries", priceType: "Consumption", currencyCode: "USD" },
  ]);
  assert.match(section, /Virtual Network Private Link/);
  assert.match(section, /Standard Data Processed - Ingress/);
  assert.match(section, /Standard Data Processed - Egress/);
  assert.match(section, /No internet egress does not imply zero/);
  assert.match(section, /whether totals cover all endpoints or are per endpoint/);
  assert.match(section, /not additive resources/);
  assert.match(section, /preserve distinct `tierMinimumUnits` bands/);
  assert.match(section, /per hosted zone per month, not hourly or a one-time purchase/);
  assert.match(section, /including existing zones where required/);
  assert.match(section, /explicit monthly query count/);
  assert.match(section, /document shared-cost allocation or exclusion/);
  assert.match(section, /Resolver endpoints\/rulesets and DNS security policy are separate products/);
  assert.match(section, /actual parameters, response\/error, pagination state/);
  assert.match(section, /do not reset retry allowances/);
  assert.match(section, /Do not hardcode observed rates/);
  assert.match(section, /keep the affected estimate blocked/);
  const parent = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md"),
    "utf8",
  );
  assert.match(parent, /pricing-guidance\.md#private-endpoint-and-private-dns-meters/);
  assert.match(parent, /endpoint count\/hours, inbound\/outbound GB with aggregation scope/);
  assert.match(parent, /do not invent zero usage/);
});

test("cost worker prices only through Azure MCP pricing and no ARM MCP tools", () => {
  const worker = path.join(ROOT, ".github/agents/_subagents/cost-estimate-subagent.agent.md");
  const frontmatter = parseFrontmatter(fs.readFileSync(worker, "utf8"));
  const tools = [].concat(frontmatter.tools).join(" ");
  assert.match(tools, /azure-mcp\/pricing/);
  assert.doesNotMatch(tools, /azure-resource-manager-mcp/);
  const guidance = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-defaults/references/pricing-guidance.md"),
    "utf8",
  );
  assert.doesNotMatch(guidance, /get_retail_prices/);
  assert.match(guidance, /`pricing_get`/);
});

test("retail fallback stays worker-owned with shared budgets, source evidence and approval gates", () => {
  const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
  const worker = read(".github/agents/_subagents/cost-estimate-subagent.agent.md");
  const guidance = read(".github/skills/apex-azure-defaults/references/pricing-guidance.md");
  const parent = read(".github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md");
  assert.match(worker, /fetch-retail-price-evidence\.mjs/);
  assert.match(worker, /MCP calls plus direct requests must not exceed 20/);
  assert.match(worker, /do not repeat successful or empty identical requests/);
  assert.match(worker, /Do not label direct API data as MCP-verified/);
  assert.match(worker, /retail_api_evidence\[\]/);
  assert.match(guidance, /Authentication\/authorization failures, missing usage, ambiguous meter selection/);
  assert.match(guidance, /raw response strings and SHA-256/);
  assert.match(guidance, /Both independent reviews and final human approval remain/);
  assert.match(parent, /does not authorize parent-side pricing/);
  assert.match(parent, /No fallback to parametric knowledge or the Azure Pricing Calculator/);
  const checklist = read(".github/skills/apex-azure-defaults/references/adversarial-checklists.md");
  assert.match(checklist, /missing evidence blocks approval/);
  assert.match(checklist, /raw responses\/hashes, selected meter IDs and tier bands/);
});

test("review finalization freezes inputs while keeping mutable approval outside reviewed Step 2 documents", () => {
  const protocol = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-defaults/references/adversarial-review-protocol.md"),
    "utf8",
  );
  assert.match(protocol, /finish all content edits, rendering, permitted formatting and validation/);
  assert.match(protocol, /parent must not edit its target or shared evidence/);
  assert.match(protocol, /complete input sets remain unchanged/);
  assert.match(protocol, /stable pointer to those records/);
  assert.match(protocol, /immediately before completion and again when the next owner resumes/);
  assert.match(protocol, /Even formatting-only changes invalidate exact-byte evidence/);
  assert.match(protocol, /never normalize hashes or restamp an old review/);
  const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
  const architect = read(".github/agents/03-architect.agent.md");
  assert.match(architect, /Do not edit reviewed inputs while either reviewer runs/);
  assert.ok(architect.includes("--supporting-input"));
  assert.match(architect, /(?:approval|decision)[\s\S]{0,150}outside reviewed/i);
  const reviewer = read(".github/agents/_subagents/challenger-review-subagent.agent.md");
  assert.match(reviewer, /Optional `supporting_inputs` binds immutable evidence/);
  assert.match(reviewer, /Preserve supplied `cache_inputs`\/`supporting_inputs` unchanged/);
  assert.match(reviewer, /The parent captures them before dispatch/);
  for (const name of ["02-architecture-assessment", "03-des-cost-estimate"]) {
    const template = read(`.github/skills/apex-azure-artifacts/templates/${name}.template.md`);
    assert.match(template, /\[Review and approval status\]\(README.md#-workflow-progress\)/);
    assert.doesNotMatch(template, /badge\/Status-|\[ \] \*\*Approved\*\*/);
  }
  const orchestrator = read(".github/agents/01-orchestrator.agent.md");
  for (const field of ["cost-feasibility", "review freshness", "Stale evidence", "review hashes"])
    assert.ok(orchestrator.includes(field), field);
});

test("pricing recovery distinguishes historical evidence from current requests and preserves interrupted allowances", () => {
  const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
  const worker = read(".github/agents/_subagents/cost-estimate-subagent.agent.md");
  const parent = read(".github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md");
  assert.match(worker, /Counts describe requests actually issued by this invocation/);
  assert.match(worker, /new invocation counts\s+do not create a fresh allowance/);
  assert.match(worker, /Publication-only recovery makes zero new requests/);
  assert.match(worker, /Optional `recovery` supplies `draft_path`, `evidence_paths`, `remaining_requests`/);
  assert.match(parent, /existing retry allowance or explicit human authorization/);
  assert.match(parent, /finite nonnegative line-item costs/);
  assert.match(parent, /hashes, exact query and selected meter IDs\/tiers/);
  assert.match(parent, /do not rely on a shared terminal's cwd/);
  assert.match(parent, /A listed command is not a result/);
  assert.match(parent, /then emit the required compact summary/);
  assert.match(parent, /No alias named `02-cost-estimate.json` is needed/);
});

test("Architecture bounds research payloads and prices only viable alternatives", () => {
  const architect = fs.readFileSync(path.join(ROOT, ".github/agents/03-architect.agent.md"), "utf8");
  const research = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-defaults/references/research-workflow.md"),
    "utf8",
  );
  assert.match(architect, /Exclude capability\/pin violations/);
  assert.match(architect, /no invented alternatives/);
  assert.match(architect, /does not[^.\n]*evict context/);
  assert.ok(architect.includes("apex-context-management/SKILL.md"));
  assert.match(research, /do not fan out more calls to that server/);
  assert.match(research, /Start with one necessary page/);
  assert.match(research, /resume only from verified state/);
  const headings = research.match(/^## .+$/gm);
  assert.equal(new Set(headings).size, headings.length);
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
    assert.ok(body.includes("05-iac-handoff.json"));
    for (const field of ["validation", "preview", "Step 6"]) assert.ok(body.includes(field), `${file}: ${field}`);
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
  assert.match(shared, /After each edit, check build readiness/);
  assert.match(shared, /deferred \(not passed\)/);
  assert.match(shared, /no completion or handoff with deferred checks/);
  assert.match(shared, /existence alone does not prove a complete write/);
  assert.match(shared, /at most three new source files per batch/);
  assert.match(shared, /A batch boundary is not a\s+human approval gate/);
  assert.doesNotMatch(shared, /End the turn\. Wait|exactly one file per response turn/);
  assert.doesNotMatch(shared, /wasting the entire 200K\+ output/);
});

test("Diagnose writes its report separately from session finding registration", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/09-diagnose.agent.md"), "utf8");
  for (const field of ["08-resource-health-report.md", "recall findings", "approval", "actual effect"])
    assert.ok(body.includes(field), field);
  assert.doesNotMatch(body, /diagnose-report-\*|Save the file via/);
  assert.match(body, /Read-only[\s\S]{0,90}autonomously within confirmed scope/);
  assert.match(body, /Do not execute side effects without exact current authority/);
});

test("Challenger resolves canonical stems and consumes persisted schema fields", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/10-challenger.agent.md"), "utf8");
  assert.match(body, /`implementation-plan` \| `plan`/);
  assert.ok(body.includes("`governance-constraints-pass1`"));
  assert.match(body, /`06-deploy-approval.json` \| `deployment-preview`/);
  for (const field of [
    "preserve explicit caller output paths",
    "distinct output paths",
    "batch_results",
    "output_path",
  ])
    assert.ok(body.includes(field), field);
  assert.doesNotMatch(body, /artifact_type=comprehensive|set `artifact_type` to `"comprehensive"`/);
  assert.match(body, /Missing optional fixes stay\s+unspecified/);
  const worker = fs.readFileSync(
    path.join(ROOT, ".github/agents/_subagents/challenger-review-subagent.agent.md"),
    "utf8",
  );
  for (const field of ["deployment-preview", "design-adr", "prior_findings", "overall_assessment", "cache_inputs"])
    assert.ok(worker.includes(field), field);
  assert.match(worker, /Return one raw JSON object/);
  assert.doesNotMatch(worker, /CHALLENGE COMPLETE|file_path:not_written/);
});

test("review reuse and deployment routing cannot bypass current evidence", () => {
  const governance = fs.readFileSync(path.join(ROOT, ".github/agents/04g-governance.agent.md"), "utf8");
  for (const field of ["--verify-cache", "TTL", "signature", "--refresh", "review"])
    assert.ok(governance.includes(field), field);
  const resume = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-governance-discovery/references/resume-checks.md"),
    "utf8",
  );
  assert.match(resume, /reviewed\s+architecture and governance inputs are unchanged/);
  assert.match(resume, /If only review validity fails/);
  const deploy = fs.readFileSync(path.join(ROOT, ".github/agents/07t-terraform-deploy.agent.md"), "utf8");
  assert.match(deploy, /azd[\s\S]{0,100}does not waive any following gate/);
  assert.doesNotMatch(deploy, /Skip to Step 6 .*after `azd provision` completes/);
  const preview = fs.readFileSync(path.join(ROOT, ".github/agents/_subagents/bicep-whatif-subagent.agent.md"), "utf8");
  assert.match(preview, /`Deploy`\s*\| Deployment; changes unknown/);
  assert.doesNotMatch(preview, /No-op deploy/);
  const orchestrator = fs.readFileSync(path.join(ROOT, ".github/agents/01-orchestrator.agent.md"), "utf8");
  assert.ok(orchestrator.includes("exact input paths/revisions"));
  assert.doesNotMatch(orchestrator, /Extract key facts \(region/);
  const asBuilt = fs.readFileSync(path.join(ROOT, ".github/agents/08-as-built.agent.md"), "utf8");
  assert.match(asBuilt, /Only full verified suite completion runs/);
  assert.doesNotMatch(asBuilt, /Read ALL prior artifacts/);
});

test("shared references preserve consolidated deployment rules", () => {
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
  assert.match(agent, /Missing fields are not zero/);
  assert.doesNotMatch(agent, /Estimate token cost from latency/);
  assert.match(methodology, /Missing usage remains unknown/);
  assert.doesNotMatch(methodology, /Likely Context Size|context is growing without hand-offs/);
});

test("CodeGen uses its combined validation worker and preserves the security gate", () => {
  for (const track of ["bicep", "terraform"]) {
    const prefix = track === "bicep" ? "06b" : "06t";
    const body = fs.readFileSync(path.join(ROOT, `.github/agents/${prefix}-${track}-codegen.agent.md`), "utf8");
    assert.ok(body.includes(`${track}-validate-subagent`));
    assert.match(body, /APPROVED/);
    assert.doesNotMatch(body, /Invoke both validation subagents|Await both results/);
    assert.match(body, /validate:iac-security-baseline/);
    assert.match(body, /(?:skip|optional)/i);
  }
});

test("IaC tag consumers follow discovered keys and do not mandate provenance tags", () => {
  for (const track of ["bicep", "terraform"]) {
    const worker = fs.readFileSync(
      path.join(ROOT, `.github/agents/_subagents/${track}-validate-subagent.agent.md`),
      "utf8",
    );
    for (const field of ["tag", "keys", "values", "casing", "policy"]) assert.ok(worker.includes(field), field);
    assert.match(worker, /greenfield fallback only when no tag policy applies/);
    assert.match(worker, /`ManagedBy`[\s\S]{0,30}(?:is )?optional provenance/);
    assert.match(worker, /(?:CRITICAL|Mismatched)[\s\S]{0,100}FAILED/);
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

test("retired site guidance leaves product documentation triggers intact", () => {
  assert.equal(fs.existsSync(path.join(ROOT, ".github/instructions/markdown-docs.instructions.md")), false);
  assert.equal(fs.existsSync(path.join(ROOT, ".github/instructions/docs.instructions.md")), false);
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

test("Operating frame preserves post-write shape checks and Git/review ownership", () => {
  const body = fs.readFileSync(OPFRAME, "utf8");
  assert.match(body, /Validate written non-Markdown shapes and actual commands/);
  assert.match(body, /Markdown artifact validation follows the designated Git\/review owner/);
  assert.doesNotMatch(body, /\| Artifact type\s+\|/);
  assert.ok(fs.readFileSync(SKILL, "utf8").includes("## Post-write validation"));
});

test("shared harness guidance preserves human selection and does not infer model permissions", () => {
  for (const file of ["AGENTS.md", ".github/copilot-instructions.md"]) {
    const body = fs.readFileSync(path.join(ROOT, file), "utf8");
    assert.match(body, /disable-model-invocation: true/, file);
    assert.match(body, /SDK harness inside VS Code/, file);
    assert.match(body, /readiness/, file);
    assert.match(body, /not prove runtime|not routing evidence/, file);
    assert.match(body, /without granting permissions|grant no permissions/, file);
    assert.match(body, /cost-tier\s+eligibility/, file);
  }
  const parent = fs.readFileSync(
    path.join(ROOT, ".github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md"),
    "utf8",
  );
  assert.match(parent, /Active agent definitions do not pin model or reasoning effort/);
  assert.match(parent, /operator and\s+runtime control selection/);
  assert.match(parent, /picker selection and model-source labels are diagnostic only/);
  assert.match(parent, /not acceptance gates/);
  assert.match(parent, /does not establish runtime cost-tier eligibility/);
  assert.match(parent, /Do not infer effort settings/);
});

test("shared reading guidance respects phase inputs, freshness and actual attachment", () => {
  const body = fs.readFileSync(OPFRAME, "utf8");
  for (const field of ["current-phase", "required guidance", "source changes", "compaction", "new chat"])
    assert.ok(body.includes(field), field);
  assert.match(body, /does not prove runtime attachment/);
  assert.match(body, /Respect domain ownership\/frozen inputs/);
  assert.doesNotMatch(body, /codegen-model-mix-2026|plan → 04\/05|exactly once at boot/);
  const copilot = fs.readFileSync(path.join(ROOT, ".github/copilot-instructions.md"), "utf8");
  assert.match(copilot, /A file inventory is not its content/);
  assert.match(copilot, /does not waive required inputs or approvals/);
  assert.match(copilot, /independent Step 2 cost-feasibility review/);
});

test("Planner loads phase-specific guidance after prerequisites without recreating governance", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/05-iac-planner.agent.md"), "utf8");
  assert.ok(body.indexOf("## Prerequisites") < body.indexOf("## Phase 1"));
  assert.match(body, /Missing architecture returns to `03-Architect` first/);
  for (const field of ["plan-consistency-checks.md", "governance-drift-routing.md", "apex-python-diagrams"])
    assert.ok(body.includes(field), field);
  assert.match(body, /Governance prose resolves ambiguity/);
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
  assert.match(body, /public (?:Terraform )?Registry API/);
  assert.ok(body.includes("X.Y.Z"));
  assert.match(body, /not proof no AVM exists/);
});

test("both CodeGen tracks check inputs first and use the manifest without weakening readiness", () => {
  for (const file of ["06b-bicep-codegen.agent.md", "06t-terraform-codegen.agent.md"]) {
    const body = fs.readFileSync(path.join(ROOT, ".github/agents", file), "utf8");
    assert.match(body, /Missing predecessors return to their owner before bulk skill reads/);
    assert.ok(body.includes("sku-manifest.json"));
    assert.match(body, /(?:missing|changed)[\s\S]{0,100}(?:guidance|sections)/);
    assert.match(body, /decisions.plan_status == "APPROVED"/);
    for (const field of ["completeness_signature", "discovery_signature", "05-IaC Planner", "04g-Governance"])
      assert.ok(body.includes(field), field);
    assert.match(body, /No[\s\S]{0,180}(?:upstream|governance)[\s\S]{0,120}edits/);
    assert.doesNotMatch(body, /Before doing any work, read these skills\.|Also read `02-architecture-assessment.md`/);
  }
});

test("Planner resolves the earliest missing prerequisite to its exact owning agent", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/05-iac-planner.agent.md"), "utf8");
  assert.match(body, /Missing architecture returns to `03-Architect` first/);
  assert.match(body, /otherwise missing\/stale governance returns to `04g-Governance`/);
});

test("Terraform CodeGen verifies approved exact pins without retired MCP tools or version drift", () => {
  const body = fs.readFileSync(path.join(ROOT, ".github/agents/06t-terraform-codegen.agent.md"), "utf8");
  assert.doesNotMatch(
    body,
    /terraform\/(?:search_modules|get_module_details|get_latest_module_version|search_providers)/,
  );
  assert.doesNotMatch(body, /pin version band/);
  assert.ok(body.includes("X.Y.Z"));
  assert.match(body, /(?:pins|version)[\s\S]{0,160}05-IaC Planner/);
  assert.match(body, /terraform providers schema -json/);
  assert.match(body, /backend-disabled init/i);
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
    assert.match(body, /(?:compaction|compression|context|resume)/i, file);
    assert.doesNotMatch(body, /stop loading additional skills|Context reaches ~80%/i);
  }
  const asBuilt = fs.readFileSync(path.join(ROOT, ".github/agents/08-as-built.agent.md"), "utf8");
  assert.match(asBuilt, /On resume re-query state and compare inventory\/inputs/);
  assert.match(asBuilt, /checkpoints are not freshness/);
  for (const field of ["approved plan/rationale", "Missing/unaccepted deployment", "evidence gaps"])
    assert.ok(asBuilt.includes(field), field);
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
  assert.match(body, /Bounded Validated Batches/);
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
  assert.match(agent, /TTL expiry or signature drift forces live/);
  assert.match(agent, /discover\.py --refresh/);
  assert.doesNotMatch(agent, /pass `--refresh` only when the user asks|Pass `--refresh` only when/);
  assert.match(reference, /bypass baseline selection and cached reuse/);
});
