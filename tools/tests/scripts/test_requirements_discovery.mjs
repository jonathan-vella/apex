import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { buildDiscoveryForm, DISCOVERY_STAGES } from "../../scripts/requirements-discovery.mjs";

const fields = (stage, answers) => buildDiscoveryForm(stage, answers).form?.requestedSchema.properties ?? {};

test("business discovery restores guided menus instead of bare text and duplicate other fields", () => {
  const questions = fields("business");
  for (const name of ["industry", "company_size", "system_description", "business_objective", "scenario", "timeline"]) {
    assert.ok(questions[name].enum.length >= 3, name);
    assert.match(questions[name].description, /custom answer.*same field/i);
  }
  assert.deepEqual(questions.company_size.enum.slice(0, 3), ["Startup / small business", "Mid-market", "Enterprise"]);
  assert.ok(questions.business_objective.enum.includes("Build and test applications faster"));
  assert.ok(!("employee_count" in questions));
  assert.ok(!Object.keys(questions).some((key) => key.endsWith("_other")));
  assert.ok(!("current_platform" in questions));
});

test("greenfield never receives migration questions even if migration details are missing", () => {
  for (const scenario of [
    "greenfield",
    "Greenfield — new workload",
    "extension",
    "Not sure — guide me",
    "New greenfield workload, not migration",
    "No migration; extend the current platform",
  ]) {
    assert.deepEqual(fields("migration", { scenario }), {}, scenario);
  }
});

test("migration and modernization receive only relevant guided follow-ups", () => {
  for (const scenario of [
    "migration",
    "Modernization — improve an existing workload",
    "We are migrating our on-prem SQL Server to Azure",
    "Migrating from AWS",
    "This is a lift-and-shift migration",
    "We want to modernise our existing application",
    "No migration, but modernizing the existing platform",
  ]) {
    assert.deepEqual(Object.keys(fields("migration", { scenario })), [
      "current_platform",
      "pain_points",
      "preservation_requirements",
    ]);
  }
});

for (const [scenario, needsMigration] of [
  ["Modernization — improve an existing workload, not a greenfield build", true],
  ["Not greenfield: migrating an on-premises workload", true],
  ["No migration or modernization, just extend the existing platform", false],
  ["This is not a migration or modernization", false],
  ["Extension without migration and modernization", false],
  ["No lift-and-shift or modernization; extend the platform", false],
  ["Not greenfield and not migration, but modernizing an existing service", true],
]) {
  test(`scenario negation preserves the intended branch: ${scenario}`, () => {
    const answers = { scenario };
    const original = structuredClone(answers);
    const result = buildDiscoveryForm("migration", answers);
    assert.equal(result.complete, !needsMigration);
    assert.deepEqual(
      Object.keys(result.form?.requestedSchema.properties ?? {}),
      needsMigration ? ["current_platform", "pain_points", "preservation_requirements"] : [],
    );
    assert.deepEqual(answers, original);
  });
}

test("captured custom answers and unknowns are retained without redundant confirmation", () => {
  const answers = {
    industry: "Professional services",
    company_size: "30 employees",
    system_description: "Internal application testing",
    business_objective: "Not sure — help me define it",
    scenario: "greenfield",
    target_environments: ["dev"],
    timeline: "No fixed date / exploratory",
  };
  assert.equal(buildDiscoveryForm("business", answers).complete, true);
  assert.equal(buildDiscoveryForm("business", answers).form, null);
  assert.ok(!("company_size" in fields("business", { employee_count: 30 })));
});

test("dependent sizing questions depend on captured workload rather than asking everyone", () => {
  assert.ok("peak_concurrent_users" in fields("workload", { workload_pattern: "Web application with a database" }));
  assert.ok(!("throughput" in fields("workload", { workload_pattern: "Web application with a database" })));
  assert.ok("throughput" in fields("workload", { workload_pattern: "Data / analytics platform" }));
  assert.ok(!("peak_concurrent_users" in fields("workload", { workload_pattern: "Data / analytics platform" })));
});

test("a selected workload is not asked again and a custom description is carried into guidance", () => {
  assert.ok(!("workload_pattern" in fields("workload", { system_description: "Web application with a database" })));
  const custom = "A portal for equipment maintenance";
  assert.ok(fields("workload", { system_description: custom }).workload_pattern.description.includes(custom));
});

test("workload discovery provides understandable options and accepts unknowns", () => {
  const questions = fields("workload", { workload_pattern: "Web application with a database" });
  for (const key of [
    "daily_users",
    "peak_concurrent_users",
    "monthly_budget",
    "availability_target",
    "recovery_profile",
    "iac_tool",
    "target_region",
  ]) {
    assert.ok(questions[key].enum.length >= 3, key);
  }
  assert.ok(!("monthly_budget" in fields("workload", { monthly_budget_amount: 200, budget_currency: "EUR" })));
  assert.ok("budget_currency" in fields("workload", { monthly_budget_amount: 200 }));
});

test("access discovery guides non-experts and never requests administrative contact trivia", () => {
  const questions = fields("access", { relational_db: "Azure SQL Database", system_description: "Private API" });
  assert.ok(questions.private_client_access.enum.includes("Not sure — design a suitable secure path"));
  assert.ok(questions.database_identity_requirement.enum.includes("Not sure — guide me"));
  for (const key of Object.keys(questions)) {
    assert.doesNotMatch(key, /contact|accountable|principal|runtime|tag_values/);
  }
  assert.ok(!("database_identity_requirement" in fields("access", { system_description: "Static website" })));
  assert.ok(!("private_client_access" in fields("access", { system_description: "Static website" })));
});

test("unknown monitoring ownership is accepted once instead of generating a contact follow-up", () => {
  const questions = fields("access", {
    monitoring_access_scope: "An existing platform/team handles monitoring access",
    private_client_access: "Not sure — design a suitable secure path",
  });
  assert.ok(!("monitoring_access_scope" in questions));
  assert.ok(!("private_client_access" in questions));
  assert.ok(!Object.keys(questions).some((key) => /owner|contact|principal/.test(key)));
});

test("all generated forms match the actual native question surface and have no implied approval defaults", () => {
  for (const stage of DISCOVERY_STAGES) {
    const form = buildDiscoveryForm(stage, { scenario: "migration", system_description: "API and SQL" }).form;
    assert.deepEqual(Object.keys(form.requestedSchema), ["properties"]);
    for (const field of Object.values(form.requestedSchema.properties)) {
      assert.ok(["string", "array"].includes(field.type));
      assert.ok(field.title && field.description);
      assert.ok(!("default" in field));
      assert.ok(!("required" in field));
    }
  }
});

test("invalid stages and answer snapshots fail explicitly", () => {
  assert.throws(() => buildDiscoveryForm("unknown"), /Unknown discovery stage/);
  assert.throws(() => buildDiscoveryForm("migration"), /requires the captured scenario/);
  assert.throws(() => buildDiscoveryForm("migration", { scenario: "" }), /restore the business answer ledger/);
  for (const answers of [null, [], "lost context"]) {
    assert.throws(() => buildDiscoveryForm("business", answers), /Answers must be an object/);
  }
});

test("CLI reads a captured ledger and reports malformed or missing inputs as failures", (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "apex-discovery-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const answersPath = path.join(directory, "answers.json");
  fs.writeFileSync(answersPath, JSON.stringify({ scenario: "Greenfield — new workload" }));
  const script = new URL("../../scripts/requirements-discovery.mjs", import.meta.url);
  const invoke = (...args) => spawnSync(process.execPath, [script.pathname, ...args], { encoding: "utf8" });
  const success = invoke("--stage", "migration", "--answers", answersPath);
  assert.equal(success.status, 0, success.stderr);
  assert.deepEqual(JSON.parse(success.stdout), { stage: "migration", complete: true, form: null });
  for (const args of [
    ["--stage"],
    ["--unknown", "business"],
    ["--stage", "migration"],
    ["--stage", "business", "--answers", path.join(directory, "missing.json")],
  ]) {
    const failure = invoke(...args);
    assert.equal(failure.status, 1);
    assert.match(failure.stderr, /Requirements discovery failed:/);
    assert.equal(failure.stdout, "");
  }
  fs.writeFileSync(answersPath, "{broken");
  assert.equal(invoke("--stage", "business", "--answers", answersPath).status, 1);
});
