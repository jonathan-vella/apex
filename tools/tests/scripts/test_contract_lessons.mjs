import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const contractScript = path.join(repo, "tools/scripts/validate-iac-contract.mjs");
const consistencyScript = path.join(repo, "tools/scripts/validate-iac-contract-consistency.mjs");
const sha = (text) => crypto.createHash("sha256").update(text).digest("hex");

function fixture(context, { params = [], capabilities, plan = "# Plan\n", resources } = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "iac-contract-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  fs.writeFileSync(path.join(directory, "04-implementation-plan.md"), plan);
  const contract = {
    schema_version: "iac-contract-v1",
    project: "synthetic",
    iac_tool: "Bicep",
    generated_at: "2026-10-15T00:00:00Z",
    plan_ref: { path: "04-implementation-plan.md", sha256: sha(plan) },
    resources: resources ?? [{ logical_name: "vault-main", type: "Microsoft.KeyVault/vaults", sku: "standard" }],
    modules: { bicep: [] },
    params: [{ name: "workspaceId", type: "string" }, ...params],
    diagnostics: { mode: "avm", workspace_id_param: "workspaceId", log_categories: [], metric_categories: [] },
    identity: { type: "none" },
    l1m_ref: { path: "04-policy-property-map.json" },
    ...(capabilities ? { capability_checks: capabilities } : {}),
  };
  const file = path.join(directory, "04-iac-contract.json");
  fs.writeFileSync(file, JSON.stringify(contract, null, 2));
  return file;
}

const run = (script, args) => spawnSync(process.execPath, [script, ...args], { cwd: repo, encoding: "utf8" });
const output = (result) => result.stdout + result.stderr;

const capability = (blocks) => ({
  id: "devops-access",
  owner: "platform",
  required_now: true,
  security_obligation: false,
  status: "unresolved",
  consumers: ["operators"],
  dependencies: [],
  evidence: [],
  runtime_status: "unverified",
  ...(blocks ? { blocks } : {}),
});

test("a phase parameter with a default is rejected", (context) => {
  const bad = run(contractScript, [fixture(context, { params: [{ name: "phase", type: "int", default: 5 }] })]);
  assert.notEqual(bad.status, 0);
  assert.match(output(bad), /must be required with no default/);
  const good = run(contractScript, [fixture(context, { params: [{ name: "phase", type: "int" }] })]);
  assert.equal(good.status, 0, output(good));
});

test("an unresolved capability blocks only the stages it declares", (context) => {
  const file = fixture(context, { capabilities: [capability(["go-live"])] });
  const deploy = run(contractScript, [file, "--readiness"]);
  assert.equal(deploy.status, 0, output(deploy));
  assert.match(output(deploy), /not blocking stage deploy/);
  const goLive = run(contractScript, [file, "--readiness", "--stage", "go-live"]);
  assert.notEqual(goLive.status, 0);
  assert.match(output(goLive), /Required design path unresolved/);
});

test("an unresolved capability without blocks still blocks every stage", (context) => {
  const result = run(contractScript, [fixture(context, { capabilities: [capability()] }), "--readiness"]);
  assert.notEqual(result.status, 0);
  assert.match(output(result), /Required design path unresolved/);
});

test("an unknown stage is rejected", (context) => {
  const result = run(contractScript, [fixture(context), "--stage", "someday"]);
  assert.notEqual(result.status, 0);
  assert.match(output(result), /must be one of deploy, post-deploy, go-live/);
});

test("a raw resource needs a row in the Raw Resource Exceptions section", (context) => {
  const raw = [{ logical_name: "budget-rg", type: "Microsoft.Consumption/budgets", sku: null }];
  const without = run(consistencyScript, [
    fixture(context, { resources: raw, plan: "# Plan\n\n### Raw Resource Exceptions\n\n_None._\n\n## Next\n" }),
  ]);
  assert.notEqual(without.status, 0);
  assert.match(output(without), /has no row in "### Raw Resource Exceptions"/);
  const withRow = run(consistencyScript, [
    fixture(context, {
      resources: raw,
      plan: "# Plan\n\n### Raw Resource Exceptions\n\n| `Microsoft.Consumption/budgets` | bicep |\n\n## Next\n",
    }),
  ]);
  assert.equal(withRow.status, 0, output(withRow));
});

test("a plan without the exceptions section only warns", (context) => {
  const raw = [{ logical_name: "budget-rg", type: "Microsoft.Consumption/budgets", sku: null }];
  const result = run(consistencyScript, [fixture(context, { resources: raw })]);
  assert.equal(result.status, 0, output(result));
  assert.match(output(result), /no "### Raw Resource Exceptions" section/);
});

const resource = (logical_name, type, extra = {}) => ({ logical_name, type, sku: null, ...extra });
const privatePath = (api, endpoint) => [
  resource("sql-main", "Microsoft.Sql/servers", { phase: 2 }),
  resource("pe-sql", "Microsoft.Network/privateEndpoints", { phase: 2, target: "sql-main", ...endpoint }),
  resource("app-api", "Microsoft.Web/sites", { phase: 3, consumes: ["sql-main"], ...api }),
];

test("a consumer must depend on the private endpoint of what it consumes", (context) => {
  const missing = run(contractScript, [fixture(context, { resources: privatePath({}) })]);
  assert.notEqual(missing.status, 0);
  assert.match(output(missing), /does not depends_on its private endpoint \(pe-sql\)/);
  const wired = run(contractScript, [fixture(context, { resources: privatePath({ depends_on: ["pe-sql"] }) })]);
  assert.equal(wired.status, 0, output(wired));
});

test("a resource may not depend on one in a later phase", (context) => {
  const late = run(contractScript, [
    fixture(context, { resources: privatePath({ depends_on: ["pe-sql"] }, { phase: 4 }) }),
  ]);
  assert.notEqual(late.status, 0);
  assert.match(output(late), /depends_on "pe-sql" in later phase 4/);
});

test("target belongs to private endpoints and consumes names another resource", (context) => {
  const wrongType = run(contractScript, [
    fixture(context, { resources: [resource("vault-main", "Microsoft.KeyVault/vaults", { target: "vault-main" })] }),
  ]);
  assert.match(output(wrongType), /only valid on Microsoft\.Network\/privateEndpoints/);
  const unknown = run(contractScript, [
    fixture(context, { resources: [resource("app-api", "Microsoft.Web/sites", { consumes: ["missing"] })] }),
  ]);
  assert.match(output(unknown), /must name another resource/);
});

test("a contract without phase, consumes or target is unchanged", (context) => {
  const result = run(contractScript, [
    fixture(context, { resources: privatePath({}).map(({ phase: _phase, ...rest }) => rest) }),
  ]);
  assert.notEqual(result.status, 0);
  assert.match(output(result), /does not depends_on its private endpoint/);
  const plain = run(contractScript, [fixture(context)]);
  assert.equal(plain.status, 0, output(plain));
});
