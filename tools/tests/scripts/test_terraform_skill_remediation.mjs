import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const skills = new URL("../../../.github/skills/", import.meta.url);
const read = (relative) => readFileSync(new URL(relative, skills), "utf8");
const blocks = (text, language) =>
  [...text.matchAll(new RegExp(String.raw`\x60{3}${language}\n([\s\S]*?)\x60{3}`, "g"))].map((match) => match[1]);

function mockExecutable(root, name, source) {
  const bin = path.join(root, "bin");
  mkdirSync(bin, { recursive: true });
  const target = path.join(bin, name);
  writeFileSync(target, `#!/usr/bin/env node\n${source}`, { mode: 0o755 });
  const checked = spawnSync("node", ["--check", target], { encoding: "utf8" });
  assert.equal(checked.status, 0, checked.stderr);
  return { ...process.env, PATH: `${bin}:${process.env.PATH}` };
}

function scratch(context) {
  const root = mkdtempSync(path.join(tmpdir(), "terraform-skill-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

test("SK-07 later phases retain earlier resource counts", (context) => {
  const root = scratch(context);
  const example = blocks(read("apex-terraform-patterns/references/project-scaffold.md"), "hcl").find((block) =>
    block.includes('variable "deployment_phase"'),
  );
  const configuration = example.slice(0, example.indexOf('module "'));
  const expression = example.match(/count\s*=\s*([^\n]+)/)[1];
  writeFileSync(path.join(root, "main.tf"), configuration);
  const counts = ["foundation", "security", "data", "compute", "edge", "all"].map((phase) => {
    const result = spawnSync("terraform", ["console", `-var=deployment_phase=${phase}`], {
      cwd: root,
      encoding: "utf8",
      input: `${expression}\n`,
    });
    assert.equal(result.status, 0, result.stderr);
    return Number(result.stdout.trim());
  });
  assert.deepEqual(counts, [0, 1, 1, 1, 1, 1]);
});

test("SK-30 schema failures differ from absent list capability without implicit init", (context) => {
  const root = scratch(context);
  const env = mockExecutable(
    root,
    "terraform",
    String.raw`
const assert = require("node:assert/strict");
assert.deepEqual(process.argv.slice(2), ["providers", "schema", "-json"]);
if (process.env.SCHEMA_FAIL === "yes") { console.error("schema failed"); process.exit(7); }
console.log(process.env.SCHEMA);
`,
  );
  const script = new URL("apex-terraform-search-import/scripts/list_resources.sh", skills).pathname;
  const run = (schema, extra = {}, args = ["azurerm"]) =>
    spawnSync("bash", [script, ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...env, SCHEMA: JSON.stringify(schema), ...extra },
    });
  const schema = { provider_schemas: { "registry.terraform.io/hashicorp/azurerm": {} } };
  assert.deepEqual(JSON.parse(run(schema).stdout), { azurerm: [] });
  schema.provider_schemas["registry.terraform.io/hashicorp/azurerm"].list_resource_schemas = {
    azurerm_storage_account: {},
  };
  assert.deepEqual(JSON.parse(run(schema, {}, []).stdout), { azurerm: ["azurerm_storage_account"] });
  for (const result of [
    run(schema, { SCHEMA_FAIL: "yes" }),
    run({}),
    run(schema, {}, ["missing"]),
    run(schema, { SCHEMA: "not-json" }),
  ]) {
    assert.notEqual(result.status, 0);
    assert.equal(result.stdout, "");
  }
  assert.equal(run(schema, { SCHEMA_FAIL: "yes" }).status, 7);
  schema.provider_schemas["registry.terraform.io/hashicorp/azurerm"].list_resource_schemas = false;
  assert.notEqual(run(schema).status, 0);
});

for (const language of ["bash", "powershell"]) {
  test(`SK-16 ${language} bootstrap preserves policy tags and fails closed`, (context) => {
    const root = scratch(context);
    const calls = path.join(root, "calls.jsonl");
    const tagsFile = path.join(root, "tags.json");
    const tags = { CostCenter: "approved team", environment: "prod" };
    writeFileSync(tagsFile, JSON.stringify(tags));
    const script = path.join(root, language === "bash" ? "bootstrap.sh" : "bootstrap.ps1");
    writeFileSync(
      script,
      blocks(read("apex-terraform-patterns/references/bootstrap-backend-template.md"), language)[0],
    );
    const env = mockExecutable(
      root,
      "az",
      String.raw`
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS, JSON.stringify(args) + "\n");
if (args.slice(0, 3).join(" ").startsWith(process.env.FAIL_AT || "never")) {
  console.error("AuthorizationFailed: fixture denial"); process.exit(9);
}
`,
    );
    const values = [
      "rg-approved",
      "stapproved",
      "tfstate",
      "approved-region",
      "approved-subscription",
      tagsFile,
      "Standard_LRS",
      "Disabled",
    ];
    const args =
      language === "bash"
        ? [script, ...values]
        : [
            "-NoLogo",
            "-NoProfile",
            "-NonInteractive",
            "-File",
            script,
            ...[
              "ResourceGroup",
              "StorageAccount",
              "Container",
              "Location",
              "Subscription",
              "TagsFile",
              "Sku",
              "NetworkMode",
            ].flatMap((name, index) => [`-${name}`, values[index]]),
          ];
    const run = (extra = {}) => {
      writeFileSync(calls, "");
      const result = spawnSync(language === "bash" ? "bash" : "pwsh", args, {
        cwd: root,
        encoding: "utf8",
        env: { ...env, CALLS: calls, APEX_BOOTSTRAP_AUTHORIZED: "true", ...extra },
      });
      return { ...result, calls: readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) };
    };
    const denied = run({ APEX_BOOTSTRAP_AUTHORIZED: "" });
    assert.notEqual(denied.status, 0);
    assert.deepEqual(denied.calls, []);
    for (const [index, command] of ["group create", "storage account create", "storage container create"].entries()) {
      const failed = run({ FAIL_AT: command });
      assert.notEqual(failed.status, 0, failed.stderr);
      assert.equal(failed.calls.length, index + 1);
      assert.match(failed.stderr, /AuthorizationFailed/);
      assert.doesNotMatch(failed.stdout, /bootstrap complete/);
    }
    const success = run();
    assert.equal(success.status, 0, success.stderr);
    assert.equal(success.calls.length, 3);
    for (const call of success.calls) {
      assert.equal(call[call.indexOf("--subscription") + 1], "approved-subscription");
      assert.ok(!call.includes("keys") && !call.includes("role"));
    }
    for (const call of success.calls.slice(0, 2)) {
      assert.ok(call.includes("CostCenter=approved team") && call.includes("environment=prod"));
    }
    const storage = success.calls[1];
    for (const [flag, value] of [
      ["--allow-shared-key-access", "false"],
      ["--allow-blob-public-access", "false"],
      ["--https-only", "true"],
      ["--public-network-access", "Disabled"],
    ]) {
      assert.equal(storage[storage.indexOf(flag) + 1], value);
    }
    assert.equal(success.calls[2][success.calls[2].indexOf("--auth-mode") + 1], "login");
    writeFileSync(tagsFile, "{}");
    const invalidTags = run();
    assert.notEqual(invalidTags.status, 0);
    assert.deepEqual(invalidTags.calls, []);
  });
}

test("SK-31 Terraform CIDR assertion checks complete ranges and every prefix", (context) => {
  const root = scratch(context);
  writeFileSync(
    path.join(root, "main.tf"),
    'variable "subnets" { type = list(object({ address_prefixes = list(string) })) }\n',
  );
  const source = blocks(read("apex-terraform-test/references/test-patterns.md"), "hcl").find((block) =>
    block.includes('run "test_all_subnets_in_vnet_range"'),
  );
  const expression = source
    .match(/condition\s*=([\s\S]*?)error_message/)[1]
    .replaceAll("azurerm_subnet.this", "var.subnets")
    .trim()
    .replaceAll("\n", " ");
  for (const [prefixes, expected] of [
    [["10.1.0.0/16"], true],
    [["10.255.255.255/32"], true],
    [["10.0.0.0/8"], true],
    [["11.0.0.0/16"], false],
    [["10.0.0.0/7"], false],
    [["10.0.1.0/24", "192.168.1.0/24"], false],
    [["10.1.0.0/33"], false],
    [["10.999.0.0/16"], false],
    [["not-a-cidr"], false],
    [["::/0"], false],
    [[], false],
  ]) {
    const result = spawnSync(
      "terraform",
      ["console", `-var=subnets=${JSON.stringify([{ address_prefixes: prefixes }])}`],
      {
        cwd: root,
        encoding: "utf8",
        input: `${expression}\n`,
      },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), String(expected), JSON.stringify(prefixes));
  }
});

test("SK-07 shared sentinel state survives later phase plans and exposes intentional destruction", (context) => {
  const root = scratch(context);
  const source = blocks(read("apex-terraform-patterns/references/project-scaffold.md"), "hcl").find((block) =>
    block.includes('variable "deployment_phase"'),
  );
  const expression = source.match(/count\s*=\s*([^\n]+)/)[1];
  writeFileSync(
    path.join(root, "main.tf"),
    `${source.slice(0, source.indexOf('module "'))}
resource "terraform_data" "sentinel" {
  count = ${expression}
  input = "earlier-resource"
}
`,
  );
  const run = (args) => {
    const result = spawnSync("terraform", args, {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, CHECKPOINT_DISABLE: "1" },
    });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout;
  };
  run(["init", "-backend=false", "-get=false", "-input=false", "-no-color"]);
  run(["validate", "-no-color"]);
  writeFileSync(
    path.join(root, "terraform.tfstate"),
    JSON.stringify({
      version: 4,
      serial: 1,
      lineage: "offline-sentinel",
      outputs: {},
      resources: [
        {
          mode: "managed",
          type: "terraform_data",
          name: "sentinel",
          provider: 'provider["terraform.io/builtin/terraform"]',
          instances: [
            {
              index_key: 0,
              schema_version: 0,
              attributes: {
                id: "earlier-resource-id",
                input: { value: "earlier-resource", type: "string" },
                output: { value: "earlier-resource", type: "string" },
                triggers_replace: null,
              },
              sensitive_attributes: [],
            },
          ],
        },
      ],
    }),
  );
  for (const phase of ["security", "data", "compute", "edge", "all", "foundation"]) {
    run([
      "plan",
      "-refresh=false",
      "-input=false",
      "-lock=false",
      `-var=deployment_phase=${phase}`,
      "-out=plan.bin",
      "-no-color",
    ]);
    const plan = JSON.parse(run(["show", "-json", "plan.bin"]));
    const change = plan.resource_changes.find((resource) => resource.address === "terraform_data.sentinel[0]");
    assert.deepEqual(change.change.actions, phase === "foundation" ? ["delete"] : ["no-op"]);
  }
});

test("SK-07 phase loop stops on destruction, failure or refused approval", (context) => {
  const root = scratch(context);
  const calls = path.join(root, "calls.jsonl");
  const script = path.join(root, "phases.sh");
  writeFileSync(script, blocks(read("apex-terraform-patterns/references/deploy-script-template.md"), "bash").at(-1));
  const env = mockExecutable(
    root,
    "terraform",
    String.raw`
const fs = require("node:fs");
const args = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS, JSON.stringify(args) + "\n");
if (args[0] === process.env.FAIL_AT) process.exit(9);
if (args[0] === "show") console.log(process.env.PLAN);
`,
  );
  const run = (actions, extra = {}, approval = "yes\nyes\nyes\nyes\nyes\n") => {
    writeFileSync(calls, "");
    const result = spawnSync("bash", [script], {
      cwd: root,
      encoding: "utf8",
      input: approval,
      env: { ...env, CALLS: calls, PLAN: JSON.stringify({ resource_changes: [{ change: { actions } }] }), ...extra },
    });
    return { ...result, calls: readFileSync(calls, "utf8").trim().split("\n").filter(Boolean).map(JSON.parse) };
  };
  const healthy = run(["create"]);
  assert.equal(healthy.status, 0, healthy.stderr);
  assert.equal(healthy.calls.filter((call) => call[0] === "apply").length, 5);
  for (const actions of [["delete"], ["delete", "create"], ["create", "delete"]]) {
    const rejected = run(actions);
    assert.notEqual(rejected.status, 0);
    assert.ok(!rejected.calls.some((call) => call[0] === "apply"));
    assert.equal(rejected.calls.filter((call) => call[0] === "plan").length, 1);
  }
  for (const command of ["plan", "show", "apply"]) {
    const failed = run(["create"], { FAIL_AT: command });
    assert.notEqual(failed.status, 0);
    assert.equal(failed.calls.filter((call) => call[0] === "plan").length, 1);
  }
  const declined = run(["create"], {}, "no\n");
  assert.equal(declined.status, 0);
  assert.ok(!declined.calls.some((call) => call[0] === "apply"));
  assert.equal(declined.calls.filter((call) => call[0] === "plan").length, 1);
});

test("SK-30 import plan gate permits imports but rejects managed mutations and schema failures", (context) => {
  const root = scratch(context);
  const script = path.join(root, "import-gate.sh");
  writeFileSync(
    script,
    blocks(read("apex-terraform-search-import/references/manual-import.md"), "bash").find((block) =>
      block.includes("terraform plan -out=import.tfplan"),
    ),
  );
  const env = mockExecutable(
    root,
    "terraform",
    String.raw`
if (!["plan", "show"].includes(process.argv[2])) process.exit(99);
if (process.argv[2] === process.env.FAIL_AT) process.exit(7);
if (process.argv[2] === "show") console.log(process.env.PLAN);
`,
  );
  const imported = { mode: "managed", change: { actions: ["no-op"], importing: { id: "fixture" } } };
  const run = (plan, extra = {}) =>
    spawnSync("bash", [script], {
      cwd: root,
      encoding: "utf8",
      env: { ...env, PLAN: JSON.stringify(plan), ...extra },
    });
  const valid = { resource_changes: [imported, { mode: "data", change: { actions: ["read"] } }] };
  assert.equal(run(valid).status, 0);
  for (const actions of [["create"], ["update"], ["delete"], ["create", "delete"], ["delete", "create"]]) {
    assert.notEqual(run({ resource_changes: [imported, { mode: "managed", change: { actions } }] }).status, 0);
  }
  for (const plan of [
    {},
    { resource_changes: [] },
    { resource_changes: [{ mode: "managed", change: { actions: ["no-op"] } }] },
  ]) {
    assert.notEqual(run(plan).status, 0);
  }
  for (const command of ["plan", "show"]) assert.notEqual(run(valid, { FAIL_AT: command }).status, 0);
  assert.notEqual(run(valid, { PLAN: "bad-json" }).status, 0);
});

test("SK-26 exact known example pins, canonical suffix and optional review contracts", () => {
  const composition = read("apex-terraform-patterns/references/module-composition.md");
  const pins = [...composition.matchAll(/source\s*=\s*"([^"]+)"\s+version\s*=\s*"([^"]+)"/g)].map((match) => [
    match[1],
    match[2],
  ]);
  assert.deepEqual(pins, [
    ["Azure/avm-res-resources-resourcegroup/azurerm", "0.4.0"],
    ["Azure/avm-res-keyvault-vault/azurerm", "0.9.0"],
  ]);
  for (const name of ["project-scaffold", "tf-best-practices-examples"]) {
    const text = read(`apex-terraform-patterns/references/${name}.md`);
    assert.doesNotMatch(text, /md5\(|Environment\s*=|ManagedBy\s*=|Project\s*=|Owner\s*=/);
    const suffix = text.match(/resource "random_string" "suffix" \{([^}]+)\}/)[1];
    assert.match(suffix, /length\s*=\s*4/);
    for (const property of ["upper", "special"]) assert.match(suffix, new RegExp(`${property}\\s*=\\s*false`));
    for (const property of ["lower", "numeric"]) assert.match(suffix, new RegExp(`${property}\\s*=\\s*true`));
  }
  const checklist = read("apex-terraform-patterns/references/codegen-validation-checklist.md");
  assert.match(checklist, /skipped by default/);
  assert.match(checklist, /decisions\.review_depth == "deep"/);
  assert.match(checklist, /explicit user request/);
  assert.match(checklist, /Required Terraform validation passed/);
  assert.match(checklist, /handoff even when optional review is skipped/);
  assert.doesNotMatch(checklist, /PASS \+ APPROVED|pass 2 conditional/);
  assert.match(
    read("apex-terraform-patterns/references/common-patterns.md"),
    /\[module-composition.md\]\(module-composition.md\)/,
  );
  assert.match(
    read("apex-terraform-patterns/references/tf-best-practices-examples.md"),
    /\[canonical composition\]\(module-composition.md\)/,
  );
});

test("SK-26/SK-31 policy tag expressions preserve casing and reject missing or overridden values", (context) => {
  const root = scratch(context);
  writeFileSync(
    path.join(root, "main.tf"),
    `variable "policy_tags" { type = map(string) }
variable "additional_tags" { type = map(string) }
variable "tags" { type = map(string) }
variable "actual_tags" { type = map(string) }
`,
  );
  const policy = { CostCenter: "governed", environment: "prod" };
  const run = (expression, actual = policy) => {
    const result = spawnSync(
      "terraform",
      [
        "console",
        `-var=policy_tags=${JSON.stringify(policy)}`,
        '-var=additional_tags={CostCenter="override",team="optional"}',
        `-var=tags=${JSON.stringify(policy)}`,
        `-var=actual_tags=${JSON.stringify(actual)}`,
      ],
      { cwd: root, encoding: "utf8", input: `${expression}\n` },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  for (const name of ["project-scaffold", "tf-best-practices-examples"]) {
    const expression = read(`apex-terraform-patterns/references/${name}.md`).match(/tags\s*=\s*(merge\([^\n]+\))/)[1];
    assert.deepEqual(JSON.parse(JSON.parse(run(`jsonencode(${expression})`))), { ...policy, team: "optional" });
  }
  const example = blocks(read("apex-terraform-test/references/test-examples.md"), "hcl")[0];
  const expression = example
    .split('run "test_mandatory_tags"')[1]
    .match(/condition\s*=([\s\S]*?)error_message/)[1]
    .replaceAll("azurerm_resource_group.this.tags", "var.actual_tags")
    .trim()
    .replaceAll("\n", " ");
  assert.equal(run(expression), "true");
  assert.equal(run(expression, { ...policy, team: "optional" }), "true");
  for (const invalid of [
    { environment: "prod" },
    { costcenter: "governed", environment: "prod" },
    { ...policy, CostCenter: "override" },
  ]) {
    assert.equal(run(expression, invalid), "false");
  }
});
