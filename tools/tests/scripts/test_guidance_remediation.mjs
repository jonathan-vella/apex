import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { runFetcher } from "../../scripts/fetch-vendor-prompting-guides.mjs";
import { ARTIFACT_HEADINGS } from "../../scripts/_lib/artifact-headings.mjs";

const root = new URL("../../../", import.meta.url);
const read = (file) => readFileSync(new URL(file, root), "utf8");
const skill = (file) => read(`.github/skills/${file}`);

test("design-only governance trace checks L0/L1 without waiving the full chain", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "governance-stage-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const project = path.join(directory, "agent-output/synthetic");
  mkdirSync(project, { recursive: true });
  const constraints = {
    discovery_metadata: {
      discovery_status: "COMPLETE",
      discovered_at: new Date().toISOString(),
      ttl_days: 7,
      completeness_signature: `sha256:${"0".repeat(64)}`,
    },
  };
  const source = path.join(project, "04-governance-constraints.json");
  writeFileSync(source, JSON.stringify(constraints));
  writeFileSync(
    path.join(project, "04-implementation-plan.md"),
    "## 🛡️ Governance Compliance Matrix\n\n| Resource ID | Status |\n| --- | --- |\n| fixture | ✅ satisfied |\n",
  );
  const script = fileURLToPath(new URL("tools/scripts/validate-governance-trace.mjs", root));
  const run = (...args) =>
    spawnSync(process.execPath, [script, "--project", "synthetic", ...args], { cwd: directory, encoding: "utf8" });
  const design = run("--through", "L1");
  assert.equal(design.status, 0, design.stdout + design.stderr);
  assert.match(design.stdout, /L2\/L3 are not evaluated/);
  assert.equal(run().status, 1);
  constraints.discovery_metadata.discovered_at = "invalid";
  writeFileSync(source, JSON.stringify(constraints));
  assert.equal(run("--through", "L1").status, 1);
});

test("policy map validation recognizes emitted Deny effects and rejects empty explicit targets", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "policy-map-coverage-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const validator = fileURLToPath(new URL("tools/scripts/validate-policy-property-map.mjs", root));
  const target = path.join(directory, "04-policy-property-map.json");
  const source = path.join(directory, "04-governance-constraints.json");
  const map = {
    schema_version: "policy-property-map-v1",
    project: "fixture",
    generated_at: "2026-09-15T00:00:00Z",
    governance_depth: "light",
    policies: [],
  };
  const run = (input = target) => spawnSync(process.execPath, [validator, input], { encoding: "utf8" });
  writeFileSync(target, JSON.stringify(map));
  for (const effect of ["Deny", "deny", "DENY"]) {
    writeFileSync(source, JSON.stringify({ policies: [{ effect, policy_id: "required-policy" }] }));
    assert.equal(run().status, 1, `Missing ${effect} policy must fail`);
  }
  assert.equal(run(path.join(directory, "missing.json")).status, 1);
  for (const shape of ["policies", "effective_policies", "findings"]) {
    writeFileSync(source, JSON.stringify({ [shape]: [{ effect: "deny", policy_id: "required-policy" }] }));
    assert.equal(run().status, 1);
  }
  map.policies = [
    {
      policy_id: "required-policy",
      display_name: "Required control",
      effect: "Deny",
      target_property: {
        resource_type: "Microsoft.Storage/storageAccounts",
        property_path: "properties.allowBlobPublicAccess",
      },
      evidence_required: "CodeGen property assertion",
    },
  ];
  writeFileSync(target, JSON.stringify(map));
  assert.equal(run().status, 0);
  map.policies[0].effect = "Audit";
  writeFileSync(target, JSON.stringify(map));
  assert.equal(run().status, 1, "A required Deny policy cannot be mapped as Audit");
  map.policies[0].effect = "Deny";
  writeFileSync(target, JSON.stringify(map));
  for (const invalid of ["{", "{}", '{"policies":[{"effect":"deny"}]}']) {
    writeFileSync(source, invalid);
    assert.equal(run().status, 1);
  }
});

test("planning validators reject nonexistent explicit targets rather than claiming zero-file success", () => {
  for (const name of ["iac-contract", "iac-contract-consistency", "environment-manifest", "policy-property-map"]) {
    const validator = fileURLToPath(new URL(`tools/scripts/validate-${name}.mjs`, root));
    const result = spawnSync(process.execPath, [validator, "nonexistent-planning-fixture-42"], { encoding: "utf8" });
    assert.equal(result.status, 1, name);
    assert.match(result.stderr, /Explicit target matched no files/);
    const help = spawnSync(process.execPath, [validator, "--help"], { encoding: "utf8" });
    assert.equal(help.status, 0);
    assert.match(help.stdout, /Usage:/);
  }
});

test("scheduled-action contracts reject incomplete provider constraints before review", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "scheduled-action-contract-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const validator = fileURLToPath(new URL("tools/scripts/validate-iac-contract.mjs", root));
  const target = path.join(directory, "04-iac-contract.json");
  const contract = {
    schema_version: "iac-contract-v0",
    project: "fixture",
    iac_tool: "Bicep",
    generated_at: "2026-09-15T00:00:00Z",
    plan_ref: { path: "plan.md", sha256: "0".repeat(64) },
    l1m_ref: { path: "map.json" },
    resources: [{ logical_name: "cost-anomaly", type: "Microsoft.CostManagement/scheduledActions", sku: null }],
    modules: {},
    identity: { type: "none" },
    params: [{ name: "workspaceId", type: "string" }],
    diagnostics: { mode: "avm", workspace_id_param: "workspaceId", log_categories: [], metric_categories: [] },
  };
  const deployment = {
    kind: "InsightAlert",
    scope: "subscription",
    module_scope: "subscription",
    display_name_max_length: 25,
    view_scope: "same-subscription",
    schedule: { anchor: "deployment-date", start_time: "00:00:00Z", end_time: "00:00:00Z", max_duration_days: 365 },
  };
  const run = () => {
    writeFileSync(target, JSON.stringify(contract));
    return spawnSync(process.execPath, [validator, target], { encoding: "utf8" });
  };
  assert.equal(run().status, 1);
  for (const track of ["Bicep", "Terraform"]) {
    contract.iac_tool = track;
    contract.resources[0].deployment = structuredClone(deployment);
    if (track === "Terraform") delete contract.resources[0].deployment.module_scope;
    const valid = run();
    assert.equal(valid.status, 0, valid.stdout + valid.stderr);
    for (const key of ["schedule", "display_name_max_length", "view_scope"]) {
      contract.resources[0].deployment = structuredClone(deployment);
      delete contract.resources[0].deployment[key];
      assert.equal(run().status, 1, `${track}: missing ${key}`);
    }
    for (const invalid of [
      { scope: "resourceGroup" },
      { display_name_max_length: 26 },
      { schedule: { ...deployment.schedule, end_time: "23:59:59Z" } },
      { schedule: { ...deployment.schedule, max_duration_days: 366 } },
      { schedule: { ...deployment.schedule, anchor: "hardcoded-date" } },
    ]) {
      contract.resources[0].deployment = { ...structuredClone(deployment), ...invalid };
      assert.equal(run().status, 1, JSON.stringify(invalid));
    }
  }
  contract.iac_tool = "Bicep";
  contract.resources[0].deployment = { ...deployment, module_scope: "resourceGroup" };
  assert.equal(run().status, 1);
  contract.resources[0].deployment = { kind: "Email", scope: "resourceGroup" };
  assert.equal(run().status, 0, "Non-anomaly scheduled actions retain their own provider contract");
  contract.capability_checks = [
    {
      id: "operator-query",
      owner: "Architect",
      required_now: true,
      security_obligation: false,
      status: "unresolved",
      consumers: ["operator"],
      dependencies: [],
      evidence: [],
      runtime_status: "unverified",
    },
  ];
  assert.equal(run().status, 1);
  const capability = contract.capability_checks[0];
  capability.status = "designed";
  capability.dependencies = ["approved client route", "DNS", "identity"];
  capability.evidence = ["reviewed design section"];
  assert.equal(run().status, 0, "Design readiness need not claim live runtime verification");
  capability.status = "deferred";
  assert.equal(run().status, 1);
  capability.approval_ref = "synthetic explicit capability decision";
  capability.revisit_condition = "Before operational query use";
  assert.equal(run().status, 0);
  capability.security_obligation = true;
  assert.equal(run().status, 1, "Mandatory security cannot be deferred");
  capability.status = "designed";
  capability.dependencies = ["capability:private-route"];
  contract.capability_checks.push({
    id: "private-route",
    owner: "Platform",
    required_now: false,
    security_obligation: false,
    status: "unresolved",
    consumers: ["operator"],
    dependencies: [],
    evidence: [],
    runtime_status: "unverified",
  });
  assert.equal(run().status, 1, "Required design cannot depend on an unresolved declared capability");
  contract.capability_checks[1].status = "designed";
  contract.capability_checks[1].dependencies = ["existing network"];
  contract.capability_checks[1].evidence = ["approved route design"];
  assert.equal(run().status, 0);
  assert.equal(spawnSync(process.execPath, [validator, path.join(directory, "missing.json")]).status, 1);
});

test("Planner batches provider feasibility checks before spending its bounded review allowance", () => {
  const agent = read(".github/agents/05-iac-planner.agent.md");
  const contract = skill("apex-iac-common/references/contract-emission-and-handoff.md");
  assert.match(agent, /pre-review feasibility gate \(read and run before review\)/);
  assert.match(contract, /every allowed environment with the full shared suffix/);
  assert.match(contract, /remaining name budget/);
  assert.match(contract, /separate subscription module/);
  assert.match(contract, /"max_duration_days": 365/);
  assert.match(contract, /'P365D'/);
  assert.match(contract, /actual plan path for `validate:plan-avm-pins`/);
  assert.match(contract, /apex-recall decisions --project <project> --json/);
  assert.match(contract, /return all substantiated findings together/);
  assert.match(contract, /Do not increase the auto-fix cap/);
  const approval = skill("apex-iac-common/references/iac-planner-approval-gate.md");
  assert.match(approval, /--plan-review-reason/);
  assert.match(approval, /without asking the same approval again/);
  assert.match(approval, /not a Step 4 completion gate because L2 CodeGen and L3 Deploy do not exist yet/);
  assert.match(approval, /a later pass number is not the total/);
  assert.match(approval, /entire tool-computed digest/);
  assert.match(approval, /check:h2-order -- <project> README\.md/);
  assert.match(approval, /check:h2-order -- <project> 00-handoff\.md/);
  assert.match(approval, /wc -l < agent-output\/<project>\/00-handoff\.md/);
  assert.match(approval, /-lt 60/);
  assert.match(approval, /Editor diagnostics and a line-width scan do not verify/);
  assert.match(approval, /do not rerun completion, reopen approval or edit reviewed inputs/);
});

test("CodeGen preflight distinguishes cached names, verified types and deferred graph validation", () => {
  for (const track of ["06b-bicep", "06t-terraform"]) {
    const body = read(`.github/agents/${track}-codegen.agent.md`);
    assert.match(body, /Explicitly selected confirmations supersede historical failures/);
    assert.doesNotMatch(body, /Every plan-level challenger pass|every challenger pass returned APPROVED/);
    assert.match(body, /adversarial-review-protocol\.md#review-lifecycle/);
  }
  const lifecycle = skill("apex-azure-defaults/references/adversarial-review-protocol.md");
  assert.match(lifecycle, /A findings verdict is not an execution retry/);
  assert.match(lifecycle, /Selection, approval, successful completion and permission/);
  assert.match(lifecycle, /Fix the finding without inventing topology/);
  const workflow = skill("apex-iac-common/references/codegen-shared-workflow.md");
  assert.match(workflow, /explicitly selected, audited confirmation/);
  assert.match(workflow, /Do not pass a bare project name/);
  assert.match(workflow, /wrapped `modules\[\]` response is not a top-level array/);
  assert.match(workflow, /Discover actual cache files/);
  assert.match(workflow, /Listing `parameters \| keys` verifies names only/);
  assert.match(workflow, /required\/defaulted fields, allowed values, nested definitions/);
  assert.match(workflow, /do not create deployment dependencies/);
  assert.match(workflow, /add explicit prerequisite `dependsOn` edges/);
  assert.match(workflow, /Check emitted ARM dependencies once the scaffold builds/);
  assert.match(workflow, /defer only errors traced to known, not-yet-emitted approved module files/);
  assert.match(workflow, /bounded validated batch cadence/);
  const bicep = read(".github/instructions/iac-bicep-best-practices.instructions.md");
  assert.match(bicep, /add explicit edges when constructed IDs hide dependencies/);
  assert.match(bicep, /subscriptionResourceId\('Microsoft.Resources\/resourceGroups', resourceGroupName\)/);
  assert.match(bicep, /Constructed IDs and module declaration order do not establish dependencies/);
});

test("Bicep scope-function symbols must not shadow resourceGroup calls", (context) => {
  const available = spawnSync("bicep", ["--version"], { encoding: "utf8" });
  if (available.error?.code === "ENOENT") return context.skip("Bicep CLI unavailable");
  assert.equal(available.status, 0, available.stderr);
  const directory = mkdtempSync(path.join(tmpdir(), "bicep-scope-shadow-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(
    path.join(directory, "group.bicep"),
    "targetScope = 'subscription'\noutput marker string = 'fixture'\n",
  );
  writeFileSync(
    path.join(directory, "child.bicep"),
    "targetScope = 'resourceGroup'\noutput marker string = 'fixture'\n",
  );
  const target = path.join(directory, "main.bicep");
  const source = (symbol) => `targetScope = 'subscription'
module ${symbol} 'group.bicep' = {
  name: 'group-fixture'
}
module foundation 'child.bicep' = {
  name: 'foundation-fixture'
  scope: resourceGroup('fixture-rg')
  dependsOn: [${symbol}]
}
`;
  writeFileSync(target, source("resourceGroup"));
  const broken = spawnSync("bicep", ["build", "--stdout", target], { encoding: "utf8" });
  assert.notEqual(broken.status, 0);
  assert.match(broken.stderr, /BCP265/);
  writeFileSync(target, source("projectResourceGroup"));
  const fixed = spawnSync("bicep", ["build", "--stdout", target], { encoding: "utf8" });
  assert.equal(fixed.status, 0, fixed.stderr);
  const arm = JSON.parse(fixed.stdout);
  const deployments = Array.isArray(arm.resources) ? arm.resources : Object.values(arm.resources);
  assert.ok(deployments.find((resource) => resource.name === "foundation-fixture").dependsOn.length > 0);
  assert.match(read(".github/instructions/iac-bicep-best-practices.instructions.md"), /Prefer role-specific names/);
  assert.match(skill("apex-iac-common/references/codegen-shared-workflow.md"), /Missing module interfaces can mask/);
});

test("private observability requires an approved client path rather than disabled flags alone", () => {
  const workflow = skill("apex-iac-common/references/codegen-shared-workflow.md");
  const planning = skill("apex-iac-common/references/contract-emission-and-handoff.md");
  assert.match(workflow, /disabled public ingestion\/query flags are access restrictions/);
  assert.match(workflow, /resource associations, its private endpoint, service-correct DNS/);
  assert.match(workflow, /return\s+the discrepancy to Planner/);
  assert.match(workflow, /Do not enable public access, add AMPLS\/resources/);
  assert.match(workflow, /platform diagnostics and SDK\/agent traffic/);
  assert.match(workflow, /reported as deferred, not operationally ready/);
  assert.match(planning, /Before freezing private Log Analytics\/Application Insights settings/);
  assert.match(planning, /Establish ownership of existing shared monitoring connectivity/);
  assert.match(planning, /not a project-owned AMPLS/);
  assert.match(planning, /not found within the inspected scope/);
  assert.match(planning, /Generic resource listings do not\s+prove effective routes/);
  assert.match(planning, /distinguish support from observed delivery/);
  assert.match(planning, /minimum allocation is a lower bound/);
  assert.match(planning, /route new estimates through `cost-estimate-subagent`/);
  assert.match(planning, /additional DNS zones\/queries/);
  assert.match(planning, /dated\s+currency conversion/);
  assert.match(planning, /No identified AMPLS meter is not proof of no charge/);
  assert.match(planning, /Adding a resource type invalidates any policy-map justification/);
  assert.match(planning, /unrestricted SKU listing is not Azure Policy/);
  assert.match(planning, /software-installation\/patching egress/);
  assert.match(planning, /group creation gate provisioning, not drafting/);
  assert.match(planning, /at most 16 remain, not at least 16/);
  assert.match(planning, /deallocation ownership and runtime sensitivity/);
  assert.match(planning, /Share current, identical common-meter evidence/);
  assert.match(planning, /Timestamps and untracked\s+Git status do not prove unchanged bytes/);
});

test("private networking defaults distinguish public web, private APIs and verified DNS ownership", () => {
  const baseline = read(".github/instructions/references/iac-security-baseline.md");
  assert.match(baseline, /every environment/);
  assert.match(baseline, /App Service hosting an API.*Private endpoint and public network access disabled/);
  assert.match(baseline, /public-facing web application.*Public HTTPS ingress permitted/);
  assert.match(baseline, /Private DNS resolution is mandatory/);
  assert.match(baseline, /zone groups does not prove zones or VNet links exist/);
  assert.match(baseline, /existing noncompliant resources may require an authorized remediation task/);
  assert.match(baseline, /do not require AMPLS solely because they\s+support Private Link/);
  assert.match(baseline, /effective Azure Policy and\s+approved requirements allow them/);
  assert.match(baseline, /Require AMPLS when effective Azure Policy or approved isolation requirements/);
  assert.match(baseline, /does not extend to Storage, SQL, Key Vault, ACR/);
  for (const file of ["AGENTS.md", ".github/copilot-instructions.md"]) {
    assert.match(read(file), /authenticated public query\/ingestion/);
  }
  for (const file of [
    "apex-azure-defaults/SKILL.md",
    "apex-azure-defaults/references/adversarial-checklists.md",
    "apex-azure-defaults/references/policy-effect-decision-tree.md",
    "apex-azure-bicep-patterns/references/private-endpoint-pattern.md",
    "apex-terraform-patterns/references/private-endpoint-pattern.md",
  ]) {
    assert.match(skill(file), /iac-security-baseline\.md/, file);
  }
});

test("Requirements reuses supplied facts and batches authorized fixes without waiving review", () => {
  const agent = read(".github/agents/02-requirements.agent.md");
  assert.match(agent, /Explicit brief answers satisfy their fields without reconfirmation/);
  assert.match(agent, /suggestions and inferred defaults do not/);
  assert.match(agent, /unanswered classes require questions/);
  assert.match(agent, /not an opt-out menu/);
  assert.match(agent, /deployable host\/image/);
  assert.match(agent, /Do not ask again whether to apply it/);
  assert.match(agent, /comprehensive regression review/);
  assert.match(agent, /same blocker persists/);
  assert.match(agent, /no unresolved `must_fix` remains/);
  assert.doesNotMatch(agent, /the question must always be asked|still let\s+the user confirm/);
  const worker = read(".github/agents/_subagents/challenger-review-subagent.agent.md");
  assert.match(worker, /retain unresolved prior issues/);
  assert.match(worker, /Never interpret a parent's disposition as proof/);
});

test("network scanner blocks public data and unapproved APIs while allowing scoped public web files", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "private-network-baseline-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const validator = fileURLToPath(new URL("tools/scripts/validate-iac-security-baseline.mjs", root));
  const cases = [
    {
      extension: "bicep",
      web: "resource web 'Microsoft.Web/sites@2024-04-01' = {\n properties: {\n publicNetworkAccess: 'Enabled'\n }\n}",
      data: "resource data 'Microsoft.Storage/storageAccounts@2023-05-01' = {\n properties: {\n publicNetworkAccess: 'Enabled'\n }\n}",
      monitoring:
        "resource workspace 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {\n properties: {\n publicNetworkAccessForQuery: 'Enabled'\n publicNetworkAccessForIngestion: 'Enabled'\n }\n}\nresource insights 'Microsoft.Insights/components@2020-02-02' = {\n properties: {\n publicNetworkAccessForQuery: 'Enabled'\n publicNetworkAccessForIngestion: 'Enabled'\n DisableLocalAuth: true\n }\n}",
    },
    {
      extension: "tf",
      web: 'resource "azurerm_linux_web_app" "web" {\n public_network_access_enabled = true\n}',
      data: 'resource "azurerm_storage_account" "data" {\n public_network_access_enabled = true\n}',
      monitoring:
        'resource "azurerm_log_analytics_workspace" "workspace" {\n internet_query_enabled = true\n internet_ingestion_enabled = true\n local_authentication_disabled = true\n}\nresource "azurerm_application_insights" "insights" {\n internet_query_enabled = true\n internet_ingestion_enabled = true\n local_authentication_disabled = true\n}',
    },
  ];
  for (const { extension, web, data, monitoring } of cases) {
    const track = extension === "tf" ? "terraform" : "bicep";
    const relative = `infra/${track}/test/main.${extension}`;
    const target = path.join(directory, relative);
    mkdirSync(path.dirname(target), { recursive: true });
    const run = (...args) => spawnSync(process.execPath, [validator, ...args], { cwd: directory, encoding: "utf8" });
    writeFileSync(target, monitoring);
    const publicMonitoring = run();
    assert.equal(publicMonitoring.status, 0, publicMonitoring.stdout + publicMonitoring.stderr);
    writeFileSync(target, `${monitoring}\n${data}`);
    assert.equal(run().status, 1, "Public monitoring must not exempt adjacent private data services");
    for (const content of [web, data, `${web}\n${data}`]) {
      writeFileSync(target, content);
      assert.equal(run().status, 1, content);
      const result = run("--public-web-app", relative);
      assert.equal(result.status, content === web ? 0 : 1, result.stdout + result.stderr);
    }
    writeFileSync(target, web.replace("'Enabled'", "'Disabled'").replace("= true", "= false"));
    assert.equal(run().status, 0);
    const avm =
      extension === "bicep"
        ? "module web 'br/public:avm/res/web/site:1.0.0' = {\n params: {\n publicNetworkAccess: 'Enabled'\n }\n}"
        : 'module "web" {\n source = "Azure/avm-res-web-site/azurerm"\n public_network_access_enabled = true\n}';
    writeFileSync(target, avm);
    assert.equal(run("--public-web-app", relative).status, 0);
    writeFileSync(
      target,
      avm.replace("web/site", "storage/storage-account").replace("res-web-site", "res-storage-storageaccount"),
    );
    assert.equal(run("--public-web-app", relative).status, 1);
    writeFileSync(target, `${web}\n${extension === "bicep" ? "httpsOnly: false" : "https_only = false"}`);
    assert.equal(run("--public-web-app", relative).status, 1);
    rmSync(target);
  }
});

test("SK25: templates preserve governed headings without deciding completion or routing", () => {
  for (const name of [
    "02-architecture-assessment",
    "04-implementation-plan",
    "04-governance-constraints",
    "04-preflight-check",
  ]) {
    const template = skill(`apex-azure-artifacts/templates/${name}.template.md`);
    const headings = template.split("\n").filter((line) => line.startsWith("## "));
    const required = ARTIFACT_HEADINGS[`${name}.md`];
    assert.deepEqual(headings.slice(0, required.length), required, name);
    if (name.startsWith("04-")) {
      const summary = skill("apex-azure-artifacts/references/04-plan-template.md");
      const section = summary.split(`### ${name}.md`)[1].split("### ")[0];
      const summarized = section.split("\n").filter((line) => line.startsWith("## "));
      assert.deepEqual(
        summarized.filter((heading) => heading !== "## References"),
        required,
      );
      for (const heading of headings.filter((heading) => !required.includes(heading))) {
        assert.ok(section.includes(heading), `${name}: preserve ${heading}`);
      }
    }
  }
  const architecture = skill("apex-azure-artifacts/templates/02-architecture-assessment.template.md");
  assert.doesNotMatch(architecture, /proceed to iac-planner|architecture is approved for implementation/);
  assert.match(architecture, /decisions.skip_design/);
  assert.match(architecture, /independent cost-feasibility/);
  assert.match(skill("apex-azure-artifacts/SKILL.md"), /a write alone is not completion/);
  const readme = skill("apex-azure-artifacts/templates/PROJECT-README.template.md");
  assert.match(readme, /3\.5\s+\| Governance/);
  assert.match(readme, /Generated files are not completed steps/);
});

test("SK23: VNet guidance preserves Azure reserved addresses, Overlay separation and all prefixes", () => {
  const body = skill("apex-azure-defaults/references/vnet-planning.md");
  const row = body.split("\n").find((line) => line.includes("**Private Endpoint subnet**"));
  for (const [prefix, total, usable] of [
    [29, 8, 3],
    [27, 32, 27],
  ]) {
    assert.equal(2 ** (32 - prefix) - 5, usable);
    assert.ok(row.includes(`/${prefix}\` = ${total} total / ${usable} usable`));
  }
  assert.match(body, /Pods use a separate non-overlapping pod CIDR, not VNet IPs/);
  assert.match(body, /preserve all live `addressSpace.addressPrefixes`/);
  assert.doesNotMatch(body, /5 usable IPs|trust user input|addressPrefixes\[0\]/);
  assert.match(body, /block confirmation\/codegen\/deployment/);
  const gates = skill("apex-azure-defaults/references/workflow-gates.md");
  assert.doesNotMatch(gates, /Same-region \(silent default\)|trust user input|addressPrefixes\[0\]/);
});

test("SK21: exact AVM interfaces and full anomaly-view IDs control validation", () => {
  const defaults = skill("apex-azure-defaults/references/security-baseline-full.md");
  assert.match(defaults, /workspace:0\.15\.1/);
  assert.doesNotMatch(defaults, /dailyQuotaGb` is `int` in AVM/);
  assert.match(defaults, /interface remains unknown/);
  const pitfalls = skill("apex-azure-bicep-patterns/references/avm-pitfalls.md");
  assert.match(pitfalls, /pending explicit\s+version validation/);
  assert.doesNotMatch(pitfalls, /python3 - <<|safe to ignore/);
  const checklist = skill("apex-azure-defaults/references/adversarial-checklists.md");
  assert.match(checklist, /ByResourceGroup` describes grouping/);
  const snippets = skill("apex-azure-defaults/references/cost-alerts-bicep.md");
  const identifier = "${subscription().id}/providers/Microsoft.CostManagement/views/ms:DailyAnomalyByResourceGroup";
  assert.ok(checklist.includes(identifier));
  assert.ok(snippets.includes(identifier));
});

test("SK24: governance confirms current inputs before review and recovers full blocker evidence", () => {
  const disposition = skill("apex-azure-governance-discovery/references/reconciliation-disposition.md");
  assert.match(disposition, /Keep Gate-2_5 closed; acceptance is not verified closure/);
  assert.match(disposition, /request a human handoff to `10-Challenger`/);
  assert.match(disposition, /cannot be deferred to Planner/);
  assert.match(disposition, /05-IaC Planner/);
  assert.doesNotMatch(disposition, /Re-present the Phase 3 final/);
  assert.match(disposition, /check:h2-order -- <project> 04-governance-constraints\.md/);
  assert.match(disposition, /wc -l < agent-output\/<project>\/00-handoff\.md/);
  assert.match(disposition, /-lt 60/);
  assert.match(disposition, /immediate\s+owner is `10-Challenger`/);
  assert.match(disposition, /Structure: PASS\/FAIL/);
  assert.match(disposition, /Review freshness: CURRENT\/STALE\/UNAVAILABLE/);
  assert.match(disposition, /Blocker closure: VERIFIED\/AWAITING VERIFICATION/);
  assert.match(disposition, /do not emit "None"/);
  assert.match(read(".github/agents/04g-governance.agent.md"), /reconciliation-disposition.md#final-handoff-checklist/);
  const resolution = skill("apex-azure-governance-discovery/references/inline-resolution-gate.md");
  assert.match(resolution, /before challenger review/);
  assert.match(resolution, /captured \*\*before discovery\*\*/);
  assert.match(resolution, /subscription, target region/);
  assert.match(resolution, /0 <= age_days/);
  assert.match(resolution, /Unknown — block/);
  assert.match(resolution, /deny rule for one region does not establish an allow-list for another/);
  assert.match(resolution, /not evidence that Azure\s+Policy mandates it/);
  assert.match(resolution, /without populating policy-derived fields from preference alone/);
  assert.match(resolution, /reconcile every prior finding ID/);
  assert.match(resolution, /do not copy its allow-list or `true`/);
  assert.match(disposition, /independently of formatting checks/);
  assert.match(disposition, /untracked artifacts, `git diff --check` has no content coverage/);
  assert.match(disposition, /return to `04g-Governance` first/);
  assert.match(disposition, /inside existing sections, not new H2 sections/);
  assert.match(disposition, /Reconcile Key Decisions/);
  assert.match(disposition, /final exit status, not an earlier `OK`/);
  assert.match(disposition, /absent success marker or empty output is not a pass/);
  assert.match(disposition, /Never probe an invented file/);
  assert.match(disposition, /before\/after byte hashes/);
  assert.match(disposition, /Decisions, open findings and per-step status live under `\.session`/);
  assert.match(disposition, /Prior recall confirmations are historical assertions, not policy evidence/);
  assert.match(disposition, /not reintroduce a\s+policy allow-list or co-location mandate from stale recall/);
  assert.match(disposition, /validate-challenger-findings\.mjs --verify-cache <selected-findings-path>/);
  assert.match(disposition, /before presenting the approval gate/);
  assert.match(disposition, /If a required reference read returns no content, recover the named section/);
  assert.match(read(".github/agents/04g-governance.agent.md"), /blocked handoff, read the required/);
  assert.match(read(".github/agents/04g-governance.agent.md"), /handoff below 60 lines and `--verify-cache`/);
  assert.match(read(".github/agents/04g-governance.agent.md"), /Before spending the pass, trace policy claims/);
  const commands = skill("apex-azure-governance-discovery/references/terminal-commands.md");
  assert.match(commands, /every blocker, including overflow/);
  assert.match(commands, /Targeted follow-up queries are required/);
  assert.doesNotMatch(commands, /sed -n '1,120p'|2>\/dev\/null \|\| echo 0|do NOT issue follow-up/);
  assert.match(commands, /explicit\s+human approval/);
});

test("Challenger verification-only requests preserve reviewed bytes and return corrections to the owner", () => {
  const agent = read(".github/agents/10-challenger.agent.md");
  assert.match(agent, /Resolve verification-only scope before delegation/);
  assert.match(agent, /takes precedence over the default Apply workflow/);
  assert.match(agent, /without offering\s+Accept\/apply or Revise panels/);
  assert.match(agent, /later explicit user request may authorize edits/);
  assert.match(agent, /any byte change invalidates the review/);
  assert.match(agent, /report closure against each prior finding ID/);
  assert.match(agent, /should-fix is not automatically a must-fix/);
  assert.match(agent, /Stop without the decision\/apply panels below or artifact mutation/);
  assert.match(agent, /Only findings with `action: "accept"` are applied/);
});

test("shared retries cannot reset, skip gates or apply unapproved substitutions", () => {
  const body = skill("apex-iac-common/SKILL.md");
  const breaker = skill("apex-iac-common/references/circuit-breaker.md");
  for (const text of [body, breaker]) {
    for (const option of ["proceed-with-substitute", "change-region", "abort"]) assert.ok(text.includes(option));
    assert.match(text, /explicit approval/);
    assert.doesNotMatch(text, /Reset and retry|Skip step \(marks as skipped/);
  }
  assert.match(body, /stricter one identical-input retry/);
  assert.match(
    skill("apex-iac-common/references/deploy-shared-workflow.md"),
    /partial success is not completed deployment/,
  );
});

test("SK10: reachable dispatch guidance preserves main-agent boundaries and graph review floors", () => {
  for (const file of ["subagent-integration.md", "orchestrator-handoff-guide.md"]) {
    const body = skill(`apex-workflow-engine/references/${file}`);
    assert.match(body, /workflow-graph.json/);
    assert.match(body, /human-selected/);
    assert.match(body, /exactly one identical-input retry/);
    assert.match(body, /cost-feasibility/);
    assert.doesNotMatch(body, /`#runSubagent` OK|silently fall back to codex|within ceiling|invoke it now/);
  }
  const graph = JSON.parse(skill("apex-workflow-engine/templates/workflow-graph.json"));
  assert.deepEqual(graph.nodes["step-2"].challenger.default_lenses, ["comprehensive", "cost-feasibility"]);
  assert.equal(graph.nodes["step-5b"].challenger.default_passes, 0);
  assert.equal(graph.nodes["step-5t"].challenger.default_passes, 0);
});

test("SK34: the summary maps every unique principle to the canonical union", () => {
  const body = skill("apex-golden-principles/SKILL.md");
  const reference = skill("apex-golden-principles/references/principles.md");
  const titles = [...body.split("## Steps")[0].matchAll(/^\d+\. \*\*([^*]+)\*\* /gm)].map((match) => match[1]);
  assert.equal(titles.length, 14);
  for (const [index, title] of titles.entries()) assert.ok(reference.includes(`## ${index + 1}. ${title}`), title);
  for (const original of [
    "Body 7",
    "Body 8",
    "Body 9",
    "Body 10",
    "Reference 7",
    "Reference 8",
    "Reference 9",
    "Reference 10",
  ]) {
    assert.ok(reference.includes(`| ${original} |`), original);
  }
  assert.match(reference, /No unique principle is dropped/);
  assert.match(reference, /unresolved blocker stop in every mode/);
  assert.match(reference, /exactly one identical-input retry/);
});

test("assigned ADR guidance preserves alternative coverage and phase naming", () => {
  const body = skill("apex-azure-adr/SKILL.md");
  const guardrails = skill("apex-azure-adr/references/guardrails.md");
  const checklist = skill("apex-azure-adr/references/quality-checklist.md");
  assert.match(body, /at least 2-3 considered and rejected/);
  assert.match(guardrails, /at least 2-3 alternatives considered/);
  assert.match(checklist, /At least 2 alternatives documented with rejection reasons/);
  for (const prefix of ["03-des-adr-", "07-ab-adr-"]) {
    assert.ok(body.includes(prefix));
    assert.ok(checklist.includes(prefix));
  }
  assert.match(checklist, /number is sequential/);
  assert.match(checklist, /Proposed for design, Accepted for as-built/);
  assert.match(checklist, /WAF pillar analysis includes all 5 pillars/);
});

test("SK32: compaction recovers required guidance without latency-derived tokens", () => {
  for (const file of ["SKILL.md", "references/skill-loading.md", "references/hard-checkpoints.md"]) {
    const body = skill(`apex-context-management/${file}`);
    assert.match(body, /reload missing\s+required guidance/);
    assert.doesNotMatch(body, /Stop loading additional skills|only once per session|pin further skill reads/);
  }
  assert.match(skill("apex-context-management/references/hard-checkpoints.md"), /not a truncation budget/);
  const estimation = skill("apex-context-management/references/token-estimation.md");
  assert.match(estimation, /Never infer tokens from latency/);
  assert.match(estimation, /missing telemetry explicitly unknown/);
  assert.doesNotMatch(estimation, /Latency < 5s|30% more tokens/);
  assert.doesNotMatch(skill("apex-context-management/templates/optimization-report.md"), /Latency-to-token estimates/);
});

for (const outcome of [
  "cached",
  "success",
  "changed",
  "failed",
  "unknown-cache",
  "modified-cache",
  "freshness-only",
  "repeat-cache",
]) {
  test(`SK33: offline fetch fixture preserves truthful provenance: ${outcome}`, async (context) => {
    const rootDir = mkdtempSync(path.join(tmpdir(), "apex-guidance-"));
    context.after(() => rmSync(rootDir, { recursive: true, force: true }));
    const directory = path.join(rootDir, ".github/skills/apex-vendor-prompting");
    const snapshots = path.join(directory, "references/.snapshots");
    mkdirSync(snapshots, { recursive: true });
    mkdirSync(path.join(rootDir, "tools/registry"), { recursive: true });
    const sha256 = createHash("sha256").update("old").digest("hex");
    const oldDate = "2026-01-01T00:00:00.000Z";
    const newDate = "2026-09-14T00:00:00.000Z";
    const prior = { source_id: "fixture", sha256, fetched_at: oldDate };
    writeFileSync(path.join(directory, "rules.json"), JSON.stringify({ sources: [{ id: "fixture", sha256 }] }));
    writeFileSync(
      path.join(snapshots, "manifest.json"),
      JSON.stringify(["unknown-cache", "freshness-only"].includes(outcome) ? [] : [prior]),
    );
    const freshness = {
      sources: outcome === "unknown-cache" ? [] : [{ source_id: "fixture", sha256, last_fetched: oldDate }],
    };
    const freshnessPath = path.join(rootDir, "tools/registry/source-freshness.json");
    writeFileSync(freshnessPath, JSON.stringify(freshness));
    if (outcome !== "failed")
      writeFileSync(path.join(snapshots, "fixture.md"), outcome === "modified-cache" ? "modified" : "old");
    const success = ["success", "changed"].includes(outcome);
    const options = {
      rootDir,
      now: () => newDate,
      args: ["--fail-on-drift"],
      sources: [
        {
          id: "fixture",
          url: "https://example.invalid",
          snapshotName: "fixture.md",
          fetch: async () =>
            success
              ? { ok: true, method: "raw", body: outcome === "changed" ? "new" : "old" }
              : { ok: false, error: "offline fixture" },
        },
      ],
    };
    const code = await runFetcher(options);
    assert.equal(code, outcome === "failed" ? 2 : ["changed", "modified-cache"].includes(outcome) ? 1 : 0);
    if (outcome === "repeat-cache") assert.equal(await runFetcher(options), 0);
    const [entry] = JSON.parse(readFileSync(path.join(snapshots, "manifest.json")));
    assert.equal(entry.attempted_at, newDate);
    assert.equal(
      entry.fetched_at,
      success ? newDate : ["unknown-cache", "modified-cache"].includes(outcome) ? null : oldDate,
    );
    assert.equal(entry.fetch_method, success ? "raw" : outcome === "failed" ? "failed" : "cached");
    if (!success) assert.equal(entry.error, "offline fixture");
    const updated = JSON.parse(readFileSync(freshnessPath));
    if (success) assert.equal(updated.sources[0].last_fetched, newDate);
    else assert.deepEqual(updated, freshness);
  });
}
