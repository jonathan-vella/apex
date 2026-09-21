import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  computeTreeHash,
  assertRepositoryPath,
  validationEvidenceErrors,
} from "../../scripts/validate-iac-handoff.mjs";
import { resolveDeploymentInputs } from "../../scripts/resolve-deployment-inputs.mjs";
import { summarizePreview } from "../../scripts/summarize-deployment-preview.mjs";
import { validateProviderPayload } from "../../scripts/validate-provider-payload.mjs";

test("ST-04: known provider defects fail and valid neighbouring payloads pass without inventing topology", () => {
  const plan = {
    type: "Microsoft.Web/serverfarms",
    properties: { isCustomMode: false },
    identity: { type: "UserAssigned", userAssignedIdentities: { "/approved/identity": {} } },
  };
  const sql = {
    type: "Microsoft.Sql/servers/databases",
    sku: { name: "S2", tier: "Standard" },
    properties: { maxSizeBytes: 268435456000 },
  };
  const options = { s2MaxSizeBytes: 268435456000 };
  assert.equal(validateProviderPayload([plan, sql], options).passed, true);
  const before = structuredClone(plan);
  const brokenPlan = { ...plan, properties: { ...plan.properties, network: { virtualNetworkSubnetId: "/subnet" } } };
  assert.equal(validateProviderPayload([brokenPlan]).passed, false);
  assert.deepEqual(plan, before);
  assert.equal(validateProviderPayload([{ ...sql, properties: { maxSizeBytes: 34359738368 } }], options).passed, false);
  assert.equal(
    validateProviderPayload([{ ...sql, properties: { maxSizeBytes: "[parameters('size')]" } }], options).passed,
    false,
  );
  assert.equal(validateProviderPayload([sql]).passed, false);
  assert.equal(
    validateProviderPayload([{ ...sql, sku: { name: "OtherSku" }, properties: { maxSizeBytes: 34359738368 } }]).passed,
    true,
  );
  assert.equal(validateProviderPayload([{ type: "Microsoft.Network/virtualNetworks" }]).passed, false);
  assert.throws(() => validateProviderPayload([plan, {}]));
});

test("ST-03: structured previews preserve coverage, identities and unknown actions without granting apply", () => {
  const id = "/subscriptions/fixture/resourceGroups/example";
  const input = { status: "Succeeded", changes: [{ resourceId: id, changeType: "Create" }] };
  const result = summarizePreview(input, "bicep", [id]);
  assert.equal(result.counts.creates, 1);
  assert.equal(result.verdict, "PASS");
  assert.equal(result.deployment_authorized, false);
  assert.equal(
    summarizePreview({ status: "Succeeded", properties: { changes: input.changes } }, "bicep", [id]).verdict,
    "PASS",
  );
  assert.equal(summarizePreview({ properties: input }, "bicep", [id]).verdict, "PASS");
  assert.equal(summarizePreview(input).verdict, "REVIEW");
  assert.equal(summarizePreview(input, "bicep", [`${id}-other`]).coverage.verified, false);
  assert.equal(
    summarizePreview({ ...input, diagnostics: [{ level: "Error", code: "PolicyViolation" }] }).verdict,
    "BLOCKED",
  );
  assert.equal(summarizePreview({ ...input, potentialChanges: [{}] }, "bicep", [id]).verdict, "REVIEW");
  for (const changeType of ["Deploy", "Ignore", "FutureAction"]) {
    const summary = summarizePreview({ ...input, changes: [{ resourceId: id, changeType }] }, "bicep", [id]);
    assert.equal(summary.counts.unknown, 1);
    assert.equal(summary.counts.replaces, 0);
    assert.equal(summary.verdict, "REVIEW");
  }
  assert.throws(() => summarizePreview("Resource changes: 42 to create"));
  assert.throws(() => summarizePreview({ status: "Succeeded" }));
  assert.throws(() => summarizePreview({ status: "Failed", properties: input }));
  assert.throws(() => summarizePreview({ ...input, changes: [input.changes[0], input.changes[0]] }));
  const terraform = {
    format_version: "1.2",
    resource_changes: [{ address: "azurerm_example.test", change: { actions: ["delete", "create"] } }],
  };
  assert.equal(summarizePreview(terraform, "terraform", ["azurerm_example.test"]).counts.replaces, 1);
  terraform.resource_changes[0].change.actions = ["create"];
  assert.equal(summarizePreview(terraform, "terraform", ["azurerm_example.test"]).verdict, "PASS");
  terraform.complete = false;
  assert.equal(summarizePreview(terraform, "terraform", ["azurerm_example.test"]).verdict, "REVIEW");
  terraform.complete = "true";
  assert.throws(() => summarizePreview(terraform, "terraform"));
});

test("ST-03: public precheck CLI checks the requested file, retained policy records and actual preview", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "apex-precheck-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const target = path.join(directory, "precheck.json");
  const raw = path.join(directory, "preview.json");
  const expectedIds = path.join(directory, "expected.json");
  writeFileSync(expectedIds, JSON.stringify(["/subscriptions/fixture/resourceGroups/test"]));
  const preview = {
    status: "Succeeded",
    changes: [{ resourceId: "/subscriptions/fixture/resourceGroups/test", changeType: "Create" }],
  };
  const payload = {
    schema_version: "policy-precheck-v2",
    status: "INFORMATIONAL",
    deploy_gate: "PROCEED",
    drift_signal: { severity: "INFORMATIONAL", missing_from_constraints_count: 1, newer_than_envelope_count: 0 },
    live_policies_newer_than_envelope: [],
    live_policies_missing_from_constraints: [{ policy_definition_id: "fixture", effect: "audit" }],
    policies_that_will_block_deploy: [],
    attestation: { envelope_status: "FRESH" },
    what_if_summary: { creates: 1, updates: 0, destroys: 0, replaces: 0, policy_violations_in_what_if: 0 },
  };
  const command = fileURLToPath(new URL("../../scripts/validate-policy-precheck.mjs", import.meta.url));
  const run = () => {
    writeFileSync(target, JSON.stringify(payload));
    writeFileSync(raw, JSON.stringify(preview));
    return spawnSync(process.execPath, [command, target, "--preview", raw, "--expected-ids", expectedIds], {
      encoding: "utf8",
    });
  };
  const result = run();
  assert.equal(result.status, 0, result.stdout + result.stderr);
  payload.live_policies_missing_from_constraints = [];
  assert.equal(run().status, 1);
  payload.drift_signal.missing_from_constraints_count = 0;
  payload.what_if_summary.creates = 42;
  assert.equal(run().status, 1);
  payload.what_if_summary.creates = 1;
  preview.potentialChanges = [{}];
  assert.equal(run().status, 1);
  assert.equal(spawnSync(process.execPath, [command, path.join(directory, "absent.json")]).status, 1);
});

const subscription = "11111111-1111-4111-8111-111111111111";
test("ST-05: parameter-build success cannot stand in for provider-validation evidence", () => {
  const data = {
    iac_tool: "Bicep",
    validation_summary: {
      validate_gate: { command: "az deployment sub validate --template-file main.bicep", exit_code: 0 },
    },
  };
  assert.deepEqual(validationEvidenceErrors(data), []);
  data.validation_summary.validate_gate.command = "bicep build-params main.dev.bicepparam";
  assert.equal(validationEvidenceErrors(data).length, 1);
  data.validation_summary.validate_gate.command = "az deployment sub validate";
  data.validation_summary.validate_gate.exit_code = 1;
  assert.equal(validationEvidenceErrors(data).length, 1);
  data.iac_tool = "Terraform";
  data.validation_summary.validate_gate = { command: "terraform -chdir=infra/test plan -refresh=false", exit_code: 0 };
  assert.deepEqual(validationEvidenceErrors(data), []);
});
const tenant = "22222222-2222-4222-8222-222222222222";
const user = "33333333-3333-4333-8333-333333333333";
const group = "44444444-4444-4444-8444-444444444444";
const inputs = () => ({
  environment: "dev",
  required: [
    "project",
    "subscription_id",
    "tenant_id",
    "deployer_object_id",
    "sql_admin_object_id",
    "sql_admin_login",
    "sql_admin_principal_type",
    "tags",
    "alert_emails",
    "budget_monthly_usd",
  ],
  manifest: {
    project: "fixture",
    environments: {
      dev: {
        deployer_object_id: "00000000-0000-0000-0000-000000000000",
        alert_emails: ["owner@example.invalid"],
        budget_monthly_usd: 100,
      },
    },
  },
  approved: { sql_admin_object_id: group, tags: { owner: "fixture" } },
  expected_context: { subscription_id: subscription, tenant_id: tenant },
  discovery: {
    account: { subscription_id: subscription, tenant_id: tenant },
    principal: { type: "User", object_id: user, tenant_id: tenant },
    sql_group: { id: group, displayName: "fixture-admins", securityEnabled: true, tenant_id: tenant },
  },
  required_tag_keys: ["owner"],
});

test("ST-02: approved/discovered inputs resolve identically for Bicep and Terraform without questions or mutation", () => {
  for (const type of ["User", "ServicePrincipal", "ManagedIdentity"]) {
    const input = inputs();
    input.discovery.principal.type = type;
    const before = structuredClone(input);
    const result = resolveDeploymentInputs(input);
    assert.equal(result.status, "RESOLVED");
    assert.deepEqual(result.questions, []);
    assert.equal(result.values.deployer_object_id, user);
    assert.equal(result.values.sql_admin_principal_type, "Group");
    assert.deepEqual(input, before);
  }
});

test("ST-02: scope conflicts, unavailable directory data and malformed recipients never resolve", () => {
  for (const change of [
    (input) => {
      input.discovery.account.tenant_id = user;
    },
    (input) => {
      delete input.discovery.principal;
    },
    (input) => {
      input.discovery.principal.object_id = undefined;
      input.discovery.principal.client_id = user;
    },
    (input) => {
      input.discovery.sql_group.id = user;
    },
    (input) => {
      input.discovery.sql_group.securityEnabled = false;
    },
    (input) => {
      input.approved.sql_admin_object_id = "<redacted>";
    },
    (input) => {
      input.approved.tags = {};
    },
    (input) => {
      input.approved.tags.SecurityControl = "Ignore";
    },
    (input) => {
      input.approved.alert_emails = ["[owner@example.invalid](mailto:owner@example.invalid)"];
    },
  ]) {
    const input = inputs();
    change(input);
    const result = resolveDeploymentInputs(input);
    assert.equal(result.status, "BLOCKED");
    assert.ok(result.questions.length);
  }
  const input = inputs();
  delete input.approved.sql_admin_object_id;
  assert.ok(resolveDeploymentInputs(input).missing.includes("sql_admin_object_id"));
});

test("ST-05: canonical hash CLI preserves NUL encoding, logs and generated-source exclusions", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "apex-stabilization-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  writeFileSync(path.join(directory, "main.bicep"), "targetScope = 'subscription'\n");
  writeFileSync(path.join(directory, "main.json"), "generated");
  const sha = createHash("sha256").update("targetScope = 'subscription'\n").digest("hex");
  const expected = createHash("sha256").update(`main.bicep\0${sha}\0`).digest("hex");
  assert.deepEqual(computeTreeHash(directory), { value: expected, file_count: 1 });
  const command = fileURLToPath(new URL("../../scripts/validate-iac-handoff.mjs", import.meta.url));
  const invoke = (...args) => spawnSync(process.execPath, [command, ...args], { encoding: "utf8" });
  assert.deepEqual(JSON.parse(invoke("--tree-hash", directory).stdout), computeTreeHash(directory));
  writeFileSync(path.join(directory, "user-log.json"), "{}");
  assert.equal(computeTreeHash(directory).file_count, 2);
  assert.notEqual(computeTreeHash(directory).value, expected);
  assert.equal(invoke(path.join(directory, "missing.json")).status, 1);
  assert.equal(invoke("--project", "fixture").status, 1);
  assert.equal(invoke("--tree-hash", path.join(directory, "missing")).status, 1);
  assert.doesNotThrow(() => assertRepositoryPath(path.join(directory, "main.bicep"), directory));
  assert.throws(() => assertRepositoryPath(path.dirname(directory), directory));
  symlinkSync(path.join(directory, "main.bicep"), path.join(directory, "linked.bicep"));
  assert.equal(invoke("--tree-hash", directory).status, 1);
});

test("ST-03: preview CLI uses a distinct nonzero result for human-review cases", (context) => {
  const directory = mkdtempSync(path.join(tmpdir(), "apex-preview-cli-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  const input = path.join(directory, "preview.json");
  const expected = path.join(directory, "expected.json");
  const id = "/subscriptions/fixture/resourceGroups/example";
  writeFileSync(input, JSON.stringify({ status: "Succeeded", changes: [{ resourceId: id, changeType: "Create" }] }));
  writeFileSync(expected, JSON.stringify([id]));
  const command = fileURLToPath(new URL("../../scripts/summarize-deployment-preview.mjs", import.meta.url));
  const run = (...args) => spawnSync(process.execPath, [command, "--input", input, ...args], { encoding: "utf8" });
  assert.equal(run().status, 2);
  assert.equal(run("--expected-ids", expected).status, 0);
  writeFileSync(input, "Resource changes: 42 to create");
  assert.equal(run().status, 1);
});
