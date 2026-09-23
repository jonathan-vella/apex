import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";

const skills = new URL("../../../.github/skills/", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, skills), "utf8");
const codeBlocks = (source) => [...source.matchAll(/```[a-z]*\n([\s\S]*?)```/g)].map((match) => match[1]);

function markdownFiles(directory) {
  return readdirSync(new URL(directory, skills), { withFileTypes: true }).flatMap((entry) => {
    const relative = `${directory}${entry.name}`;
    if (entry.isDirectory()) return markdownFiles(`${relative}/`);
    return entry.name.endsWith(".md") ? [relative] : [];
  });
}

test("prepare SQL samples are Entra-only and private", () => {
  const bicep = read("apex-azure-prepare/references/services/sql-database/bicep.md");
  const auth = read("apex-azure-prepare/references/services/sql-database/auth.md");
  for (const block of [...codeBlocks(bicep), ...codeBlocks(auth)]) {
    assert.doesNotMatch(block, /administratorLogin|User ID=|Password=/);
    assert.doesNotMatch(block, /firewallRules|0\.0\.0\.0/);
  }
  assert.match(bicep, /publicNetworkAccess: 'Disabled'/);
  for (const source of [bicep, auth]) {
    assert.match(source, /@allowed\(\['User', 'Group', 'Application'\]\)\nparam principalType string = 'User'/);
  }
  assert.match(auth, /Always include an `Authentication` parameter/);
});

test("deploy CI sample waits for environment approval and Step 0 asks first", () => {
  const workflow = read("apex-azure-deploy/references/recipes/cicd/examples/github-bicep.yml");
  assert.match(workflow, /^ {4}environment: \$\{\{ vars\.ENVIRONMENT \}\}$/m);
  assert.match(workflow, /^ {2}id-token: write$/m);
  const skill = read("apex-azure-deploy/SKILL.md");
  assert.doesNotMatch(skill, /Do not ask the user|Auto-Prepare Gate/);
  assert.match(skill, /stop and ask whether to run \*\*apex-azure-prepare\*\*/);
});

test("validate recipes run from the per-project IaC folder", () => {
  for (const [recipe, iac] of [
    ["bicep", "bicep"],
    ["azcli", "bicep"],
    ["terraform", "terraform"],
  ]) {
    const source = read(`apex-azure-validate/references/recipes/${recipe}/README.md`);
    assert.ok(source.includes(`\`infra/${iac}/{project}/\` (never the repository root)`), recipe);
    assert.doesNotMatch(source, /^cd infra$/m, recipe);
  }
});

test("cost reports stay in the project folder and prices come from ARM MCP", () => {
  for (const file of ["SKILL.md", ...markdownFiles("apex-azure-cost-optimization/references/")]) {
    const relative = file.startsWith("apex-") ? file : `apex-azure-cost-optimization/${file}`;
    assert.doesNotMatch(read(relative), /(?<!agent-)output\//, relative);
  }
  const steps = read("apex-azure-cost-optimization/references/detailed-workflow-steps.md");
  const pricing = steps.split("## Step 5: Validate Pricing")[1].split("\n## ")[0];
  assert.match(pricing, /`get_retail_prices`/);
  assert.doesNotMatch(pricing, /fetch_webpage/);
});

test("tag queries use contract keys, not PascalCase defaults", () => {
  for (const relative of [
    "apex-azure-compliance/references/azure-resource-graph.md",
    "apex-azure-cost-optimization/references/azure-resource-graph.md",
  ]) {
    const source = read(relative);
    assert.doesNotMatch(source, /tags\['(Environment|CostCenter|Owner|Project)'\]/, relative);
    assert.match(source, /tag_contract/, relative);
  }
});

test("entra bulk cleanup previews and deletes only with --confirm", () => {
  const source = read("apex-entra-app-registration/references/cli-commands.md");
  const script = source.split("### Cleanup script")[1].match(/```bash\n([\s\S]*?)```/)[1];
  assert.match(script, /set -euo pipefail/);
  assert.match(script, /Would delete:/);
  assert.ok(script.indexOf('!= "--confirm"') < script.indexOf("az ad app delete"));
});

test("quotas keep one troubleshooting procedure and no US example regions", () => {
  const commands = read("apex-azure-quotas/references/commands.md");
  assert.doesNotMatch(commands, /Known Support Status|Common Error Codes|Try different region/);
  for (const file of markdownFiles("apex-azure-quotas/references/")) {
    assert.doesNotMatch(read(file), /locations\/(eastus|westus|centralus)/, file);
  }
});

test("rbac Bicep samples use defined symbols and AVM roleAssignments", () => {
  const source = read("apex-azure-rbac/SKILL.md");
  const bicep = codeBlocks(source).filter((block) => block.includes("roleAssignments"));
  assert.ok(bicep.some((block) => /roleAssignments: \[/.test(block) && /roleDefinitionIdOrName:/.test(block)));
  assert.ok(bicep.every((block) => !/guid\(resourceId,/.test(block)));
  assert.match(source, /name: guid\(targetResource\.id, principalId, roleDefinitionGuid\)/);
});

test("kusto common issues are indexed and bounded", () => {
  const skill = read("apex-azure-kusto/SKILL.md");
  assert.match(skill, /\| `references\/common-issues\.md`/);
  const issues = read("apex-azure-kusto/references/common-issues.md");
  assert.match(issues, /^<!-- ref:common-issues-v1 -->/);
  assert.match(issues, /Timestamp between \(\.\.\.\)` filter and `take`/);
});

test("SKU availability helper separates available, restricted, not offered and unknown", () => {
  const source = read("apex-azure-quotas/references/sku-availability.md");
  const helper = source.split("## Checked SKU Availability")[1].match(/```bash\n([\s\S]*?)```/)[1];
  const dir = mkdtempSync(join(tmpdir(), "sku-availability-"));
  const write = (name, value) => {
    const file = join(dir, name);
    writeFileSync(file, typeof value === "string" ? value : JSON.stringify(value));
    return file;
  };
  const listing = (restrictions = [], zones = ["1", "2", "3"]) => [
    {
      name: "Standard_D4s_v5",
      locations: ["swedencentral"],
      locationInfo: [{ location: "swedencentral", zones }],
      restrictions,
    },
  ];
  const restriction = (type, zones) => ({
    type,
    values: ["swedencentral"],
    restrictionInfo: { locations: ["swedencentral"], ...(zones ? { zones } : {}) },
    reasonCode: "NotAvailableForSubscription",
  });
  const run = (file, ...args) =>
    spawnSync("bash", ["-c", `${helper}\nsku_availability "$@"`, "sku-test", file, ...args], { encoding: "utf8" });
  try {
    const open = write("open.json", listing());
    let result = run(open, "swedencentral", "standard_d4s_v5", "1,2,3");
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /^AVAILABLE; allocation capacity: unknown$/m);

    result = run(write("blocked.json", listing([restriction("Location")])), "swedencentral", "Standard_D4s_v5");
    assert.equal(result.status, 1);
    assert.match(result.stdout, /RESTRICTED: NotAvailableForSubscription/);

    const zonal = write("zonal.json", listing([restriction("Zone", ["2"])]));
    result = run(zonal, "swedencentral", "Standard_D4s_v5", "1,2,3");
    assert.equal(result.status, 1);
    assert.match(result.stdout, /RESTRICTED: zones 2 unavailable/);
    assert.equal(run(zonal, "swedencentral", "Standard_D4s_v5", "1,3").status, 0);
    assert.equal(run(write("regional.json", listing([], [])), "swedencentral", "Standard_D4s_v5", "1").status, 1);

    result = run(open, "germanywestcentral", "Standard_D4s_v5");
    assert.equal(result.status, 1);
    assert.match(result.stdout, /NOT_OFFERED/);

    for (const file of [
      write("broken.json", "not json"),
      write("object.json", {}),
      write("unnamed.json", [{ locations: ["swedencentral"] }]),
    ]) {
      const unknown = run(file, "swedencentral", "Standard_D4s_v5");
      assert.equal(unknown.status, 2, file);
      assert.doesNotMatch(unknown.stdout, /AVAILABLE/);
    }
    for (const args of [
      ["Sweden Central", "Standard_D4s_v5"],
      ["swedencentral", "Standard D4"],
      ["swedencentral", "Standard_D4s_v5", "a"],
    ]) {
      assert.equal(run(open, ...args).status, 2, args.join(" "));
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("deploy pre-flight and SKU escalation use the SKU availability contract", () => {
  const github = new URL("../../../.github/", import.meta.url);
  for (const relative of [
    "agents/07b-bicep-deploy.agent.md",
    "agents/07t-terraform-deploy.agent.md",
    "instructions/sku-manifest.instructions.md",
  ]) {
    const source = readFileSync(new URL(relative, github), "utf8");
    assert.match(source, /apex-azure-quotas\/references\/sku-availability\.md/, relative);
    assert.match(source, /`RESTRICTED`/, relative);
  }
  assert.match(read("apex-azure-quotas/SKILL.md"), /\| `references\/sku-availability\.md`/);
  assert.match(read("apex-azure-quotas/references/sku-availability.md"), /^<!-- ref:sku-availability-v1 -->/);
});

test("role checks report gaps and never change assignments", () => {
  for (const [skill, reference] of [
    ["apex-azure-validate", "role-verification"],
    ["apex-azure-deploy", "live-role-verification"],
  ]) {
    const source = read(`${skill}/references/${reference}.md`);
    assert.match(source, new RegExp(`^<!-- ref:${reference}-v1 -->`));
    for (const block of codeBlocks(source)) assert.doesNotMatch(block, /az role assignment (create|delete|update)/);
    assert.match(source, /06b-Bicep CodeGen/);
    const entry = read(`${skill}/SKILL.md`);
    assert.match(entry, new RegExp(`\\(references/${reference}\\.md\\)`));
    assert.match(entry, new RegExp(`\\| \`references/${reference}\\.md\``));
  }
  assert.match(read("apex-azure-validate/references/role-verification.md"), /static, report-only review/);
  assert.match(read("apex-azure-deploy/references/live-role-verification.md"), /never creates, changes or deletes/);
});

test("deploy guidance covers template variables, ACR pulls and existing environments", () => {
  const terraform = read("apex-azure-validate/references/recipes/terraform/README.md");
  assert.match(terraform, /grep -n '\{\{ \*\\\.Env\\\.' main\.tfvars\.json/);
  const checklist = read("apex-azure-deploy/references/pre-deploy-checklist.md");
  assert.match(checklist, /### Container Apps — Existing Environments/);
  assert.match(checklist, /### Container Apps With ACR — AcrPull Before App Deploy/);
  assert.ok(checklist.indexOf("azd provision --no-prompt") < checklist.indexOf("azd deploy --no-prompt"));
  const errors = read("apex-azure-deploy/references/recipes/azd/errors.md");
  for (const heading of ["## Principal Type Mismatch", "## Container App Revision Timeout"]) {
    assert.ok(errors.includes(heading), heading);
  }
  assert.match(errors, /Assigning it by CLI needs explicit approval/);
});

test("run-ig creates the privileged debug pod only with explicit approval", () => {
  const scripts = new URL("apex-azure-diagnostics/scripts/", skills);
  const dir = mkdtempSync(join(tmpdir(), "run-ig-"));
  const kubectl = join(dir, "kubectl");
  writeFileSync(kubectl, '#!/bin/sh\necho "FAKE kubectl $*"\n', { mode: 0o755 });
  const env = { ...process.env, PATH: `${dir}:${process.env.PATH}` };
  const cases = [
    [
      "bash",
      [new URL("run-ig.sh", scripts).pathname, "--gadget", "trace_dns", "--node", "n1"],
      "--dry-run",
      "--approve",
    ],
    [
      "pwsh",
      ["-NoProfile", "-File", new URL("run-ig.ps1", scripts).pathname, "-Gadget", "trace_dns", "-Node", "n1"],
      "-DryRun",
      "-Approve",
    ],
  ];
  try {
    for (const [shell, args, dryRun, approve] of cases) {
      const run = (...extra) => spawnSync(shell, [...args, ...extra], { encoding: "utf8", env });
      const refused = run();
      assert.equal(refused.status, 3, `${shell}: ${refused.stderr}`);
      assert.doesNotMatch(refused.stdout, /FAKE kubectl/);
      assert.equal(run(dryRun).status, 0, shell);
      const approved = run(approve);
      assert.equal(approved.status, 0, `${shell}: ${approved.stderr}`);
      assert.match(approved.stdout, /FAKE kubectl debug --profile=sysadmin node\/n1/);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("imported diagnostics guides follow APEX tool names, secrets and routing rules", () => {
  const skill = read("apex-azure-diagnostics/SKILL.md");
  const guides = ["references/", "scripts/"].flatMap((folder) =>
    folder === "scripts/"
      ? readdirSync(new URL(`apex-azure-diagnostics/${folder}`, skills)).map(
          (name) => `apex-azure-diagnostics/${folder}${name}`,
        )
      : markdownFiles(`apex-azure-diagnostics/${folder}`),
  );
  for (const file of guides) {
    const source = read(file);
    assert.doesNotMatch(source, /mcp_azure_mcp_/, file);
    for (const [command] of source.matchAll(/appsettings list(?:[^\n]*\\\n)*[^\n]*/g)) {
      assert.match(command, /--query "\[\]\.name"/, file);
    }
    assert.doesNotMatch(source, /\]\(auth-best-practices\.md\)/, file);
  }
  for (const link of [
    "references/app-service/README.md",
    "references/aks/aks-troubleshooting.md",
    "references/compute/vm-troubleshooting.md",
    "references/messaging/README.md",
  ]) {
    assert.ok(skill.includes(`](${link})`), link);
  }
  const shells = readdirSync(new URL("apex-azure-diagnostics/scripts/", skills));
  for (const script of shells.filter((name) => name.endsWith(".sh"))) {
    const base = script.replace(/\.sh$/, "");
    assert.ok(shells.includes(`${base}.ps1`), `${base} lacks a PowerShell pair`);
    assert.ok(skill.includes(`| \`${base}\``), `${base} missing from the scripts table`);
  }
  assert.match(skill, /node debug pods \(`run-ig` with `--approve`\)/);
});

test("imported prepare guides are linked and carry the APEX network baseline", () => {
  const services = "apex-azure-prepare/references/services";
  for (const [folder, guides] of [
    ["app-service", ["sku-selection", "networking", "custom-domains"]],
    ["container-apps", ["networking", "revisions", "day2-operations", "terraform"]],
    ["functions", ["hosting-plans", "cold-start"]],
  ]) {
    const readme = read(`${services}/${folder}/README.md`);
    for (const guide of guides) assert.ok(readme.includes(`](${guide}.md)`), `${folder}/${guide}`);
  }
  assert.match(read(`${services}/app-service/networking.md`), /APEX baseline:\*\* App Service APIs are private/);
  assert.match(read(`${services}/container-apps/networking.md`), /use internal ingress for APIs and back ends/);
  assert.match(read(`${services}/container-apps/terraform.md`), /APEX Terraform CodeGen is AVM-first/);
});

test("cost query and forecast use ARM MCP without temp folders or attribution headers", () => {
  const cost = "apex-azure-cost-optimization";
  for (const [workflow, tool] of [
    ["cost-query", "query_costs"],
    ["cost-forecast", "forecast_costs"],
  ]) {
    for (const file of markdownFiles(`${cost}/references/${workflow}/`)) {
      const source = read(file);
      assert.doesNotMatch(source, /ClientType=|New-Item -ItemType Directory -Path "temp"|@temp\//, file);
    }
    assert.match(read(`${cost}/references/${workflow}/workflow.md`), new RegExp(`ARM MCP \`${tool}\``));
  }
  const skill = read(`${cost}/SKILL.md`);
  assert.match(skill, /## Scope Reference \(Shared Across All Workflows\)/);
  assert.match(skill, /\*\*Show the total bill\*\*/);
  const storage = read(`${cost}/references/azure-storage-tiers.md`);
  assert.doesNotMatch(storage, /\$\d/);
  assert.doesNotMatch(storage, /"delete"\s*:/);
  for (const block of codeBlocks(storage).filter((query) => query.startsWith("Resources"))) {
    assert.match(block, /\| project id, subscriptionId,/);
  }
});

test("cloud-migrate scenarios hand off to prepare instead of CLI deployment guides", () => {
  const skill = read("apex-azure-cloud-migrate/SKILL.md");
  for (const scenario of [
    "beanstalk-to-app-service",
    "heroku-to-app-service",
    "app-engine-to-app-service",
    "fargate-to-container-apps",
    "k8s-to-container-apps",
    "cloudrun-to-container-apps",
    "spring-apps-to-aca",
  ]) {
    assert.ok(skill.includes(`${scenario}.md`), scenario);
  }
  assert.match(skill, /Kubernetes DNS names/);
  for (const file of markdownFiles("apex-azure-cloud-migrate/references/")) {
    const source = read(file);
    assert.doesNotMatch(
      source,
      /deployment-guide\.md|mcp_azure_mcp_|preparation-manifest|az (acr|containerapp) create/,
      file,
    );
  }
});

test("resources, storage and compute keep secrets out and delegate availability checks", () => {
  const resources = read("apex-azure-resources/SKILL.md");
  assert.match(resources, /No secrets in diagrams or inventories/);
  assert.match(resources, /List web apps, websites or App Services/);
  assert.match(read("apex-azure-resources/references/visualize.md"), /in `agent-output\/\{project\}\/`/);
  assert.match(read("apex-azure-storage/SKILL.md"), /"hot vs cool vs archive"/);
  const compute = read("apex-azure-compute/SKILL.md");
  assert.match(compute, /apex-azure-quotas\/references\/sku-availability\.md/);
  for (const file of ["apex-azure-compute/SKILL.md", ...markdownFiles("apex-azure-compute/references/")]) {
    assert.doesNotMatch(read(file), /eastus|westus/, file);
  }
});
