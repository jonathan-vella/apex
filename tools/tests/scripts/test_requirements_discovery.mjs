import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { buildDiscoveryForm, DISCOVERY_STAGES, answersFromRecall } from "../../scripts/requirements-discovery.mjs";

const fields = (stage, answers) => buildDiscoveryForm(stage, answers).form?.requestedSchema.properties ?? {};
const observed = (input_id, value, extra = {}) => ({
  input_id,
  value,
  provenance: "iac",
  confidence: "observed",
  ...extra,
});

test("practical discovery consumes actual scoped recall answers without asking them again", () => {
  const view = {
    session: {
      material_inputs: {
        industry: { value: "Nonprofit", environments: ["dev"] },
        company_size: { value: "Small team", environments: ["dev", "prod"] },
      },
    },
  };
  const answers = answersFromRecall(view, "dev");
  const form = buildDiscoveryForm("business", answers);
  assert.ok(!("industry" in form.form.requestedSchema.properties));
  assert.ok(!("company_size" in form.form.requestedSchema.properties));
  assert.deepEqual(answersFromRecall(view, "prod"), { company_size: "Small team" });
  assert.throws(() => answersFromRecall({}, "dev"), /Actual scoped/);
});

test("business discovery restores guided menus instead of bare text and duplicate other fields", () => {
  const questions = fields("business");
  for (const name of ["industry", "company_size", "system_description", "business_objective", "scenario", "timeline"]) {
    assert.ok(questions[name].enum.length >= 3, name);
    assert.match(questions[name].description, /custom answer.*same field/i);
  }
  assert.deepEqual(questions.company_size.enum.slice(0, 3), ["Startup / small business", "Mid-market", "Enterprise"]);
  assert.ok(questions.business_objective.enum.includes("Build and test applications faster"));
  assert.ok(questions.scenario.enum.includes("Assessment — evaluate an existing workload"));
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
    "Existing workload",
    "Brownfield",
  ]) {
    assert.deepEqual(Object.keys(fields("migration", { scenario })), [
      "current_platform",
      "pain_points",
      "preservation_requirements",
    ]);
  }
});

test("assessment discovery asks only for scope and objective, then skips implementation questionnaires", () => {
  const business = buildDiscoveryForm("business", { scenario: "Assessment — evaluate an existing workload" });
  assert.deepEqual(Object.keys(business.form.requestedSchema.properties), [
    "system_description",
    "business_objective",
    "target_environments",
  ]);
  assert.ok(!("industry" in business.form.requestedSchema.properties));
  assert.ok(!("company_size" in business.form.requestedSchema.properties));
  assert.ok(!("timeline" in business.form.requestedSchema.properties));

  const completedBusiness = buildDiscoveryForm("business", {
    scenario: "Assessment — evaluate an existing workload",
    system_description: "Existing web application and SQL database",
    business_objective: "Understand current Well-Architected posture and evidence gaps",
    target_environments: ["prod"],
  });
  assert.equal(completedBusiness.complete, true);

  for (const stage of ["migration", "workload", "access"]) {
    const result = buildDiscoveryForm(stage, { scenario: "Assessment — evaluate an existing workload" });
    assert.equal(result.complete, true, stage);
    assert.equal(result.form, null, stage);
  }

  assert.ok(
    "monthly_budget" in fields("workload", { scenario: "Not an assessment or brownfield project" }),
    "a negated assessment must not suppress implementation discovery",
  );
});

for (const [scenario, needsMigration] of [
  ["Modernization — improve an existing workload, not a greenfield build", true],
  ["Not greenfield: migrating an on-premises workload", true],
  ["No migration or modernization, just extend the existing platform", false],
  ["This is not a migration or modernization", false],
  ["Extension without migration and modernization", false],
  ["No lift-and-shift or modernization; extend the platform", false],
  ["Not greenfield and not migration, but modernizing an existing service", true],
  ["No assessment or migration; extend the existing platform", false],
  ["Not an assessment or brownfield project", false],
  ["Not greenfield: assess an existing workload", false],
  ["Greenfield — not an assessment", false],
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

test("discovery emits separate applicability context without changing the native payload", () => {
  const answers = { company_size: "Small charity", scenario: "greenfield" };
  const result = buildDiscoveryForm("business", answers);
  assert.deepEqual(result.context.answers, answers);
  assert.notEqual(result.context.answers, answers);
  assert.deepEqual(Object.keys(result.context.fields), Object.keys(result.form.requestedSchema.properties));
  for (const [key, field] of Object.entries(result.context.fields)) {
    assert.deepEqual(field, { input_id: key, kind: "input" });
  }
  assert.deepEqual(Object.keys(result.form).sort(), ["message", "requestedSchema"]);
});

test("pending forms receive unique local correlation IDs without requiring native tool IDs", () => {
  const ids = new Set();
  for (const stage of DISCOVERY_STAGES) {
    for (let attempt = 0; attempt < 2; attempt++) {
      const request = buildDiscoveryForm(stage, { scenario: "Migration — move an existing workload" });
      assert.match(request.request_id, /^requirements-[0-9a-f-]{36}$/);
      assert.equal(request.request_id_source, "apex-local");
      assert.ok(!ids.has(request.request_id));
      ids.add(request.request_id);
      assert.deepEqual(Object.keys(request.form).sort(), ["message", "requestedSchema"]);
      assert.deepEqual(Object.keys(request.context).sort(), ["answers", "fields"]);
      assert.ok(!("request_id" in request.form.requestedSchema.properties));
      assert.ok(!("native_request_id" in request));
    }
  }
  const complete = buildDiscoveryForm("migration", { scenario: "Greenfield" });
  assert.equal(complete.form, null);
  assert.ok(!("request_id" in complete));
});

test("local capture IDs record actual answers in recall without adopting defaults or granting approval", (t) => {
  const root = fs.mkdtempSync(path.join(process.cwd(), ".apex-discovery-test-"));
  t.after(() => fs.rmSync(root, { recursive: true }));
  fs.mkdirSync(path.join(root, "agent-output"));
  const repo = fileURLToPath(new URL("../../../", import.meta.url));
  const invoke = (...args) =>
    spawnSync("python3", ["-m", "apex_recall", ...args], {
      cwd: root,
      encoding: "utf8",
      env: { ...process.env, APEX_ROOT: root, PYTHONPATH: path.join(repo, "tools/apex-recall/src") },
    });
  const recall = (...args) => {
    const result = invoke(...args);
    assert.equal(result.status, 0, result.stdout + result.stderr);
    return JSON.parse(result.stdout);
  };
  const initialized = recall("init", "example", "--json");
  assert.ok(initialized.file.startsWith(root + path.sep), "recall must write only inside the isolated fixture");
  const request = buildDiscoveryForm("business", {}, { items: [observed("industry", "Technology / software")] });
  const requestPath = path.join(root, "request.json");
  fs.writeFileSync(requestPath, JSON.stringify(request));
  const saved = JSON.parse(fs.readFileSync(requestPath, "utf8"));
  const formPath = path.join(root, "form.json");
  const contextPath = path.join(root, "context.json");
  fs.writeFileSync(formPath, JSON.stringify(saved.form));
  fs.writeFileSync(contextPath, JSON.stringify(saved.context));
  const preflight = spawnSync(
    "python3",
    [
      path.join(repo, "tools/scripts/validate_question_batching.py"),
      "--form",
      formPath,
      "--context",
      contextPath,
      "--require-context",
    ],
    { encoding: "utf8" },
  );
  assert.equal(preflight.status, 0, preflight.stdout + preflight.stderr);
  assert.deepEqual(recall("show", "example", "--json").session.material_inputs, {});

  const response = { industry: "Owner-provided custom sector" };
  const record = {
    input_id: "industry",
    value: response.industry,
    environments: ["prod"],
    owner: "synthetic-respondent",
    request_id: saved.request_id,
  };
  const recordPath = path.join(root, "input.json");
  fs.writeFileSync(
    path.join(root, "receipt.json"),
    JSON.stringify({
      request_id: saved.request_id,
      request_id_source: saved.request_id_source,
      respondent: record.owner,
      environments: record.environments,
      captured_at: new Date().toISOString(),
      response,
    }),
  );
  fs.writeFileSync(recordPath, JSON.stringify(record));
  const result = recall("decide", "example", "--input-record", recordPath, "--json");
  assert.equal(result.permission_granted, false);
  const session = recall("show", "example", "--json").session;
  assert.deepEqual(Object.keys(session.material_inputs), ["industry"]);
  const { recorded_at, ...stored } = session.material_inputs.industry;
  assert.ok(recorded_at);
  assert.deepEqual(stored, record);
  assert.equal(session.steps["1"].status, "pending");
  assert.deepEqual(session.decisions.phase_scopes ?? {}, {});

  recall("decide", "example", "--input-record", recordPath, "--json");
  assert.equal(recall("show", "example", "--json").session.decision_log.length, session.decision_log.length);
  fs.writeFileSync(recordPath, JSON.stringify({ ...record, value: "Changed after capture" }));
  const changed = invoke("decide", "example", "--input-record", recordPath, "--json");
  assert.notEqual(changed.status, 0);
  assert.match(changed.stdout + changed.stderr, /new actual owner-response provenance/);
  fs.writeFileSync(recordPath, JSON.stringify({ ...record, request_id: "" }));
  const missing = invoke("decide", "example", "--input-record", recordPath, "--json");
  assert.notEqual(missing.status, 0);
  assert.equal(recall("show", "example", "--json").session.material_inputs.industry.value, response.industry);

  const earlierAnswers = { availability_target: "99.95% availability" };
  fs.writeFileSync(path.join(root, "earlier-answers.json"), JSON.stringify(earlierAnswers));
  const recovery = {
    request_id: `recovered-input-${randomUUID()}`,
    request_id_source: "apex-local",
    capture_mode: "recovered",
    source: "earlier-answers.json",
    respondent: record.owner,
    environments: record.environments,
    recovered_at: new Date().toISOString(),
    response: JSON.parse(fs.readFileSync(path.join(root, "earlier-answers.json"), "utf8")),
  };
  fs.writeFileSync(path.join(root, "recovery-receipt.json"), JSON.stringify(recovery));
  fs.writeFileSync(
    recordPath,
    JSON.stringify({
      ...record,
      input_id: "availability_target",
      value: recovery.response.availability_target,
      request_id: recovery.request_id,
    }),
  );
  assert.equal(recall("decide", "example", "--input-record", recordPath, "--json").permission_granted, false);
  const recovered = recall("show", "example", "--json").session;
  assert.equal(recovered.material_inputs.availability_target.value, earlierAnswers.availability_target);
  assert.equal(recovered.material_inputs.availability_target.request_id, recovery.request_id);
  assert.deepEqual(recovered.decisions.phase_scopes ?? {}, {});
});

test("existing-workload entrypoint and owners share the local provenance and recovery contract", () => {
  for (const relative of [
    ".github/prompts/waf-assess-existing.prompt.md",
    ".github/agents/02-requirements.agent.md",
    ".github/agents/01-orchestrator.agent.md",
    ".github/skills/apex-azure-defaults/references/existing-workload-intake.md",
  ]) {
    const contents = fs.readFileSync(new URL(`../../../${relative}`, import.meta.url), "utf8");
    assert.match(contents, /#input-request-provenance/, relative);
    assert.match(contents, /recover/i, relative);
    assert.match(contents, /local|correlation/i, relative);
  }
  const contract = fs.readFileSync(
    new URL("../../../.github/skills/apex-workflow-engine/references/practical-workflow.md", import.meta.url),
    "utf8",
  );
  assert.match(contract, /capture_mode: "recovered"/);
  assert.match(contract, /Missing\/conflicting answers or unknown owner\/scope still block/);
  assert.match(contract, /Autopilot output still does not establish independent human authority/);
});

test("existing-workload assessments preserve unknowns instead of requiring implementation answers", () => {
  const contracts = [
    [".github/prompts/waf-assess-existing.prompt.md", /assessment-only, not implementation planning/],
    [
      ".github/skills/apex-azure-defaults/references/existing-workload-intake.md",
      /missing targets, controls, configuration, cost inputs and dependencies as `Not supplied`/,
    ],
    [".github/agents/02-requirements.agent.md", /Assessment scenarios do not/],
    [".github/agents/03-architect.agent.md", /Skip the implementation-only SKU confirmation/],
    [
      ".github/agents/_subagents/challenger-review-subagent.agent.md",
      /not itself a\s+requirements defect when accurately identified as unknown\/not assessed/,
    ],
    [
      ".github/skills/apex-azure-defaults/references/service-class-menu.md",
      /For an existing-workload Assessment, skip\s+future service, tier\/NFR-profile, SKU and commitment elicitation/,
    ],
    [
      ".github/instructions/sku-manifest.instructions.md",
      /Assessment scenarios skip future SKU\/commitment elicitation/,
    ],
    [
      ".github/skills/apex-azure-defaults/references/workflow-gates.md",
      /For existing-workload Assessment, do not propose or require a budget cap/,
    ],
  ];

  for (const [relative, expected] of contracts) {
    const contents = fs.readFileSync(new URL(`../../../${relative}`, import.meta.url), "utf8");
    assert.match(contents, expected, relative);
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

test("evidence only suggests defaults and never adopts answers or completes a discovery stage", () => {
  const evidence = {
    items: [
      observed("industry", "Technology / software"),
      observed("scenario", "Assessment — evaluate an existing workload"),
      observed("target_environments", ["prod"]),
    ],
    subscriptions: [{ subscription_id: "sub-a" }],
  };
  const original = structuredClone(evidence);
  const result = buildDiscoveryForm("business", {}, evidence);
  assert.equal(result.complete, false);
  assert.deepEqual(result.context.answers, {});
  const properties = result.form.requestedSchema.properties;
  assert.equal(properties.scenario.default, "Assessment — evaluate an existing workload");
  assert.deepEqual(properties.target_environments.default, ["prod"]);
  assert.deepEqual(Object.keys(properties), [
    "system_description",
    "business_objective",
    "scenario",
    "target_environments",
  ]);
  assert.match(properties.scenario.description, /explicitly confirm or correct/i);
  assert.throws(() => buildDiscoveryForm("migration", {}, evidence), /captured scenario/);
  assert.deepEqual(evidence, original);
  properties.target_environments.default.push("dev");
  assert.deepEqual(evidence, original);
});

test("confirmed answers override evidence and only confirmed facts trigger dependent questions", () => {
  const evidence = {
    items: [observed("scenario", "Assessment"), observed("system_description", "Private API and SQL database")],
  };
  const result = buildDiscoveryForm("business", { scenario: "greenfield" }, evidence);
  assert.ok(!("scenario" in result.form.requestedSchema.properties));
  assert.equal(result.context.answers.scenario, "greenfield");
  assert.equal(buildDiscoveryForm("migration", { scenario: "greenfield" }, evidence).complete, true);
  const access = buildDiscoveryForm("access", {}, evidence);
  assert.ok(!("private_client_access" in access.form.requestedSchema.properties));
  const defaults = buildDiscoveryForm("workload", {}, { items: [observed("daily_users", "50–500")] });
  assert.equal(defaults.form.requestedSchema.properties.daily_users.default, "50–500");
});

test("malformed or ambiguous evidence fails rather than silently adopting inferred answers", () => {
  for (const evidence of [
    null,
    [],
    {},
    { items: {} },
    { items: [null] },
    { items: [observed("industry", undefined)] },
    { items: [observed("industry", "Tech", { provenance: "unknown" })] },
    { items: [observed("industry", "Tech", { confidence: "certain" })] },
    { items: [observed("industry", "Tech"), observed("industry", "Finance")] },
    { items: [observed("industry", ["Tech"])] },
    { items: [observed("target_environments", "prod")] },
    { items: [observed("target_environments", [1])] },
  ]) {
    assert.throws(() => buildDiscoveryForm("business", {}, evidence), /Evidence|evidence/);
  }
});

test("CLI reads a captured ledger and reports malformed or missing inputs as failures", (t) => {
  const directory = fs.mkdtempSync(path.join(process.cwd(), ".apex-discovery-test-"));
  t.after(() => fs.rmSync(directory, { recursive: true }));
  const answersPath = path.join(directory, "answers.json");
  fs.writeFileSync(answersPath, JSON.stringify({ scenario: "Greenfield — new workload" }));
  const script = new URL("../../scripts/requirements-discovery.mjs", import.meta.url);
  const invoke = (...args) => spawnSync(process.execPath, [script.pathname, ...args], { encoding: "utf8" });
  const success = invoke("--stage", "migration", "--answers", answersPath);
  assert.equal(success.status, 0, success.stderr);
  assert.deepEqual(JSON.parse(success.stdout), { stage: "migration", complete: true, form: null });
  const evidencePath = path.join(directory, "evidence.json");
  fs.writeFileSync(evidencePath, JSON.stringify({ items: [observed("industry", "Technology / software")] }));
  const suggested = invoke("--stage", "business", "--answers", answersPath, "--evidence", evidencePath);
  assert.equal(suggested.status, 0, suggested.stderr);
  const result = JSON.parse(suggested.stdout);
  assert.equal(result.form.requestedSchema.properties.industry.default, "Technology / software");
  assert.match(result.request_id, /^requirements-/);
  assert.equal(result.request_id_source, "apex-local");
  const help = invoke("--help");
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /Persist the envelope/);
  assert.match(help.stdout, /No SDK-issued request ID is required/);
  assert.deepEqual(result.context.answers, { scenario: "Greenfield — new workload" });
  assert.deepEqual(JSON.parse(fs.readFileSync(answersPath, "utf8")), result.context.answers);
  const recallPath = path.join(directory, "recall.json");
  fs.writeFileSync(
    recallPath,
    JSON.stringify({
      session: { material_inputs: { industry: { value: "Healthcare", environments: ["prod"] } } },
    }),
  );
  const recall = invoke(
    "--stage",
    "business",
    "--recall-view",
    recallPath,
    "--environment",
    "prod",
    "--evidence",
    evidencePath,
  );
  assert.equal(recall.status, 0, recall.stderr);
  assert.ok(!("industry" in JSON.parse(recall.stdout).form.requestedSchema.properties));
  for (const args of [
    ["--stage"],
    ["--unknown", "business"],
    ["--stage", "migration"],
    ["--stage", "business", "--answers", path.join(directory, "missing.json")],
    ["--stage", "business", "--evidence", path.join(directory, "missing.json")],
  ]) {
    const failure = invoke(...args);
    assert.equal(failure.status, 1);
    assert.match(failure.stderr, /Requirements discovery failed:/);
    assert.equal(failure.stdout, "");
  }
  fs.writeFileSync(answersPath, "{broken");
  assert.equal(invoke("--stage", "business", "--answers", answersPath).status, 1);
  fs.writeFileSync(evidencePath, "{broken");
  assert.equal(invoke("--stage", "business", "--evidence", evidencePath).status, 1);
});
