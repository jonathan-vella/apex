import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeCostCollection } from "../../scripts/assessment-cost.mjs";
import { createAjv } from "../../scripts/_lib/ajv-validator.mjs";
import { normalizeCostRequest, publishEstimate } from "../../scripts/cost-estimate.mjs";
import {
  ACTION_REGISTER_OUTPUTS,
  calculateAssessmentActionRegister,
  digest,
  displayCost,
  projectPath,
  renderAssessmentActionRegister,
  safeEvidenceUrl,
  validateAssessmentActionRegisterExport,
} from "../../scripts/assessment-action-register.mjs";
import {
  ACTUAL_RESOURCE,
  AS_OF,
  RETAIL_RESOURCE,
  exampleFixture,
  fixture,
} from "./fixtures/action-register/fixture.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const SCRIPT = path.join(ROOT, "tools/scripts/assessment-action-register.mjs");
function setup(t, example = false) {
  const root = path.join(ROOT, "tools/tests/scripts/fixtures/action-register", `.run-${randomUUID()}`);
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return { root, f: (example ? exampleFixture : fixture)(root) };
}
function calculate(f, root) {
  return calculateAssessmentActionRegister(f.data, { root, asOf: AS_OF });
}
function fails(f, root, pattern) {
  const result = calculate(f, root);
  assert.equal(result.valid, false, JSON.stringify(result));
  assert.match(result.errors.join("; "), pattern);
}
function options(root, f) {
  return { root, input: f.save(), asOf: AS_OF };
}

test("exact contributions sum only the action ledger, actual and retail remain separate", (t) => {
  const { root, f } = setup(t, true);
  const result = calculate(f, root);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.deepEqual(
    result.derived.actions.map((a) => a.monthly_contribution),
    ["1000", "200", "-150", "-50"],
  );
  const groups = result.derived.scenarios[0].summaries;
  assert.deepEqual(
    groups.map((g) => [g.additions, g.savings, g.net]),
    [
      ["1200", "50", "1150"],
      ["0", "150", "-150"],
    ],
  );
  assert.equal(
    groups.reduce((total, g) => total + Number(g.net), 0),
    1000,
  );
  assert.equal(result.derived.scenarios[0].ledger.length, 4);
});

test("negative upgrades and positive validated savings are never inverted twice", (t) => {
  const { root, f } = setup(t);
  f.addRetail("upgrade", "25", "100");
  const saving = f.addRetail("saving", "0", "50");
  saving.finance.kind = "savings";
  const result = calculate(f, root);
  assert.equal(result.valid, true);
  assert.deepEqual(
    result.derived.actions.map((a) => a.monthly_contribution),
    ["-75", "-50"],
  );
  assert.equal(result.derived.scenarios[0].summaries[0].savings, "125");
  saving.finance.kind = "new_service_gross";
  fails(f, root, /no baseline/);
});

test("zero has supporting rationale, null never turns into zero, all unknown has null totals", (t) => {
  const { root, f } = setup(t);
  f.action("unknown", { kind: "unquantified", missing_inputs: ["New service usage and verified prices absent."] });
  let result = calculate(f, root);
  assert.equal(result.valid, true);
  assert.equal(result.derived.actions[0].monthly_contribution, null);
  assert.equal(result.derived.scenarios[0].summaries[0].net, null);
  assert.equal(result.derived.scenarios[0].summaries[0].coverage, "Not quantified");
  f.retain("zero-source", {
    no_recurring_changes: [{ action_id: "zero", rationale: "Evidence supports configuration-only recurring zero." }],
  });
  const zero = f.action("zero", {
    kind: "no_recurring_change",
    rationale: "Evidence supports configuration-only recurring zero.",
    evidence_ids: ["zero-source"],
  });
  result = calculate(f, root);
  assert.equal(result.valid, true);
  assert.equal(result.derived.actions[1].monthly_contribution, "0");
  assert.equal(result.derived.scenarios[0].summaries[0].unquantified_count, 1);
  zero.finance.evidence_ids = [];
  fails(f, root, /zero requires supported/);
});

test("exact decimal display rounding explicitly reconciles rounded lines and bounded numeric magnitudes", (t) => {
  const { root, f } = setup(t);
  f.addRetail("tiny-a", "0.005");
  f.addRetail("tiny-b", "0.005");
  const result = calculate(f, root);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.deepEqual(
    result.derived.actions.map((a) => a.display_contribution),
    ["0.01", "0.01"],
  );
  assert.equal(result.derived.scenarios[0].summaries[0].display_net, "0.01");
  assert.equal(result.derived.scenarios[0].summaries[0].display_reconciliation, "-0.01");
  assert.equal(result.derived.scenarios[0].summaries[0].display_additions_reconciliation, "-0.01");
  assert.equal(displayCost("-0.005"), "-0.01");
  assert.equal(displayCost("-0.004"), "0.00");
  assert.throws(() => displayCost("10000000000000"), /magnitude/);
  assert.equal(displayCost("9999999999999.99"), "9999999999999.99");
});

test("annual-to-month normalization needs original units and exact source-evidenced conversion", (t) => {
  const { root, f } = setup(t);
  f.data.bases[0].normalization = "annual / 12 (source-evidenced)";
  f.addRetail("annual", "100");
  const leaf = f.sources.get("annual-proposed");
  leaf.assessment_basis.source_unit = "year";
  leaf.assessment_basis.original_total = "1200";
  f.retain("annual-proposed", leaf, "retail");
  assert.equal(calculate(f, root).valid, true);
  leaf.assessment_basis.original_total = "1201";
  f.retain("annual-proposed", leaf, "retail");
  fails(f, root, /Annual normalization/);
});

test("duplicate actual imports and same-charge replacement benefits cannot bypass the ledger", (t) => {
  const { root, f } = setup(t);
  f.addActual();
  f.action(
    "duplicate",
    { kind: "savings", basis_id: "actual", opportunity: { evidence_id: "cost", opportunity_id: "OP1" } },
    { resource_ids: [ACTUAL_RESOURCE], overlap_group: "not-an-override" },
  );
  fails(f, root, /Duplicate imported/);
  f.data.scenarios[0].selections[1].included = false;
  assert.equal(calculate(f, root).valid, true);
  const replacement = f.addRetail("replacement", "800", "1000");
  for (const id of ["replacement-current", "replacement-proposed"]) {
    const leaf = f.sources.get(id);
    leaf.resources[0].resource_id = ACTUAL_RESOURCE;
    f.retain(id, leaf, "retail");
  }
  replacement.resource_ids = [ACTUAL_RESOURCE];
  replacement.finance.ledger[0].resource_id = ACTUAL_RESOURCE;
  fails(f, root, /overlapping benefits/);
});

test("same resource independent charges are supported; fabricated slices and overlap groups are not", (t) => {
  const { root, f } = setup(t);
  f.addRetail("compute", "80", "100", { charge: "compute" });
  f.addRetail("storage", "40", "50", { charge: "storage" });
  assert.equal(calculate(f, root).valid, true);
  const line = f.sources.get("storage-current");
  line.resources[0].charge_id = "compute";
  f.retain("storage-current", line, "retail");
  const proposed = f.sources.get("storage-proposed");
  proposed.resources[0].charge_id = "compute";
  f.retain("storage-proposed", proposed, "retail");
  f.data.actions[1].finance.ledger[0].charge_id = "compute";
  f.data.actions[1].overlap_group = "claimed-combined";
  fails(f, root, /overlapping/);
});

test("actual baseline provenance is mandatory; retail-only savings do not certify actual opportunities", (t) => {
  const { root, f } = setup(t);
  f.addActual();
  const report = f.sources.get("cost");
  report.opportunities[0].amount = "151";
  f.retain("cost", report, "cost");
  fails(f, root, /exact baseline arithmetic/);
  report.opportunities[0].amount = "150";
  report.evidence[0].status = "partial";
  f.retain("cost", report, "cost");
  fails(f, root, /original saved source|complete closed-month/);
});

test("gross additions use verified retail evidence and refuse missing, failed and mixed-basis prices", (t) => {
  const { root, f } = setup(t);
  const action = f.addRetail("gross", "100");
  assert.equal(calculate(f, root).valid, true);
  const source = f.sources.get("gross-proposed");
  source.status = "FAILED";
  f.retain("gross-proposed", source, "retail");
  fails(f, root, /retail/);
  source.status = "COMPLETE";
  source.assessment_basis.licensing = "Negotiated actual discounts";
  f.retain("gross-proposed", source, "retail");
  fails(f, root, /basis mismatch/);
  action.finance.proposed_ref = "not-retained";
  fails(f, root, /Missing\/wrong retail/);
});

test("retail upgrade quantities and assumptions must be like-for-like, not mixed actual usage", (t) => {
  const { root, f } = setup(t);
  f.addRetail("migration", "50", "100");
  const leaf = f.sources.get("migration-proposed");
  leaf.resources[0].quantity = 2;
  f.retain("migration-proposed", leaf, "retail");
  fails(f, root, /usage quantities/);
  leaf.resources[0].quantity = 1;
  leaf.assumptions = ["Different projected usage than current reference."];
  f.retain("migration-proposed", leaf, "retail");
  fails(f, root, /assumptions differ/);
});

test("ARM prefixes and authorized scopes are case-insensitive, including out-of-scope inventory", (t) => {
  const { root, f } = setup(t);
  const inventory = f.sources.get("inventory");
  const resource = inventory.resources[0];
  resource.id = resource.id.toUpperCase();
  f.data.resources[0].id = resource.id;
  f.retain("inventory", inventory, "inventory");
  assert.equal(calculate(f, root).valid, true);
  resource.id = resource.id.replace("000000000001", "000000000002");
  f.data.resources[0].id = resource.id;
  f.retain("inventory", inventory, "inventory");
  fails(f, root, /outside captured scope/);
});

for (const driver of [
  "usage",
  "usage_amount",
  "unit",
  "hours",
  "region",
  "component_usage",
  "component_region",
  "calculation_basis",
]) {
  test(`like-for-like retail comparison rejects changed ${driver}`, (t) => {
    const { root, f } = setup(t);
    f.addRetail("upgrade", "50", "100");
    const current = f.sources.get("upgrade-current");
    const proposed = f.sources.get("upgrade-proposed");
    for (const leaf of [current, proposed]) {
      Object.assign(leaf.resources[0], {
        usage: { amount: 1000, unit: "GB", scope: "aggregate" },
        usage_amount: 1000,
        unit_of_measure: "1 GB",
        hours_per_month: 730,
        components: [{ region: leaf.region, unit_of_measure: "1 GB", usage_amount: 1000 }],
        calculation_basis: { region: leaf.region, quantity: 1, unit_of_measure: "1 GB", usage_amount: 1000 },
      });
    }
    const line = proposed.resources[0];
    if (driver === "usage") line.usage.amount = 100;
    if (driver === "usage_amount") line.usage_amount = 100;
    if (driver === "unit") line.unit_of_measure = "1 TB";
    if (driver === "hours") line.hours_per_month = 100;
    if (driver === "region") line.region = "another-region";
    if (driver === "component_usage") line.components[0].usage_amount = 100;
    if (driver === "component_region") line.components[0].region = "another-region";
    if (driver === "calculation_basis") line.calculation_basis.usage_amount = 100;
    f.retain("upgrade-current", current, "retail");
    f.retain("upgrade-proposed", proposed, "retail");
    fails(f, root, /usage quantities, regions/);
    current.resources[0] = { ...structuredClone(line), sku: "Current SKU", hourly_rate: 2, monthly_cost: "100" };
    line.sku = "Proposed SKU";
    line.hourly_rate = 1;
    f.retain("upgrade-current", current, "retail");
    f.retain("upgrade-proposed", proposed, "retail");
    assert.equal(calculate(f, root).valid, true);
  });
}

test("consumption normalization preserves exact decimal distinctions", (t) => {
  const { root, f } = setup(t);
  f.addRetail("usage", "50", "100");
  const current = f.sources.get("usage-current");
  const proposed = f.sources.get("usage-proposed");
  current.resources[0].usage = { amount: "1000.000", unit: "GB", scope: "aggregate" };
  proposed.resources[0].usage = { amount: 1000, unit: "GB", scope: "aggregate" };
  f.retain("usage-current", current, "retail");
  f.retain("usage-proposed", proposed, "retail");
  assert.equal(calculate(f, root).valid, true);
  current.resources[0].usage.amount = "9007199254740993";
  proposed.resources[0].usage.amount = "9007199254740992";
  f.retain("usage-current", current, "retail");
  f.retain("usage-proposed", proposed, "retail");
  fails(f, root, /usage quantities/);
});

test("the normalized producer context and standard published pricing output quantify a register action", (t) => {
  const { root, f } = setup(t);
  const action = f.addRetail("standard", "10");
  const retained = f.sources.get("standard-proposed");
  const original = retained.resources[0];
  const request = normalizeCostRequest({
    project_name: "synthetic",
    region: retained.region,
    output_path: path.join(root, "evidence/published.json"),
    assessment_basis: retained.assessment_basis,
    assumptions: retained.assumptions,
    resource_list: [
      {
        ...original,
        usage: { amount: 1000, unit: "GB", scope: "aggregate" },
      },
    ],
  });
  assert.equal(request.lines[0].charge_id, original.charge_id);
  const draft = {
    ...retained,
    assessment_basis: request.assessment_basis,
    assumptions: request.assumptions,
    savings_status: "NOT_APPLICABLE",
    resources: [
      {
        ...original,
        usage: request.lines[0].usage,
        unit_of_measure: "1 GB",
        retail_price: 0.01,
      },
    ],
  };
  const draftPath = path.join(root, "evidence/draft.json");
  fs.writeFileSync(draftPath, JSON.stringify(draft));
  const leaf = publishEstimate({ draftPath, outputPath: request.output_path }).estimate;
  const schema = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/schemas/cost-estimate.schema.json")));
  const valid = createAjv().compile(schema);
  assert.equal(valid(leaf), true, JSON.stringify(valid.errors));
  f.retain("standard-proposed", leaf, "retail");
  const result = calculate(f, root);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.equal(result.derived.actions[0].id, action.id);
  assert.equal(result.derived.actions[0].monthly_contribution, "10");
  assert.throws(
    () =>
      normalizeCostRequest({
        project_name: request.project_name,
        region: request.region,
        output_path: request.output_path,
        assessment_basis: request.assessment_basis,
        assumptions: request.assumptions,
        resource_list: [{ ...original, charge_id: undefined }],
      }),
    /Assessment pricing requires/,
  );
});

for (const kind of ["project", "absolute", "workspace"]) {
  test(`retail fallback ${kind} paths remain confined and normalized in the export receipt`, (t) => {
    const { root, f } = setup(t);
    f.addRetail("fallback", "10");
    const raw = JSON.stringify({ Items: [{ meterId: "synthetic-meter" }] });
    const catalog = f.retain("catalog", {
      schema_version: "retail-price-evidence-v1",
      pages: [{ raw_response: raw, response_sha256: digest(raw) }],
    });
    f.data.evidence_refs = f.data.evidence_refs.filter((ref) => ref.id !== "catalog");
    const absolute = path.join(root, catalog.path);
    const leaf = f.sources.get("fallback-proposed");
    const suppliedPath =
      kind === "absolute" ? absolute : kind === "workspace" ? path.relative(ROOT, absolute) : catalog.path;
    leaf.retail_api_evidence = [
      {
        evidence_path: suppliedPath,
        resource_names: [leaf.resources[0].name],
        selected_meters: [{ meterId: "synthetic-meter" }],
        calculation: "Synthetic evidence only.",
      },
    ];
    leaf.data_source = "Azure MCP pricing_get + Azure Retail Prices API (direct fallback)";
    leaf.direct_api_calls_used = 1;
    const ref = f.retain("fallback-proposed", leaf, "retail");
    const before = fs.readFileSync(path.join(root, ref.path));
    const opts = options(root, f);
    const result = renderAssessmentActionRegister(opts);
    assert.equal(result.valid, true);
    assert.equal(result.receipt.evidence_hashes[catalog.path], digest(fs.readFileSync(absolute)));
    assert.ok(Object.keys(result.receipt.evidence_hashes).every((file) => !path.isAbsolute(file)));
    assert.deepEqual(fs.readFileSync(path.join(root, ref.path)), before);
    fs.symlinkSync("catalog.json", path.join(root, "evidence/catalog-link.json"));
    leaf.retail_api_evidence[0].evidence_path = path.join(root, "evidence/catalog-link.json");
    f.retain("fallback-proposed", leaf, "retail");
    fails(f, root, /Symlink forbidden/);
    leaf.retail_api_evidence[0].evidence_path = path.join(root, "../outside.json");
    f.retain("fallback-proposed", leaf, "retail");
    fails(f, root, /project-relative/);
  });
}

test("negative billing corrections remain actual charges, never a second remediation benefit", (t) => {
  const { root, f } = setup(t);
  f.addActual();
  const collection = f.sources.get("actual-collection");
  collection.pages[0].body.properties.rows.push(["-100", "USD", "Billing correction", ACTUAL_RESOURCE]);
  const ref = f.retain("actual-collection", collection);
  const report = f.sources.get("cost");
  report.evidence[0] = normalizeCostCollection(collection, {
    approvedScopes: f.data.scopes,
    asOf: AS_OF,
    provenance: { path: ref.path, sha256: ref.sha256, collected_at: AS_OF, source: "azure-cost-management" },
  });
  report.opportunities[0].amount = "135";
  f.retain("cost", report, "cost");
  const result = calculate(f, root);
  assert.equal(result.valid, true, result.errors.join("; "));
  assert.equal(result.derived.actions[0].monthly_contribution, "-135");
  assert.equal(result.derived.scenarios[0].summaries[0].savings, "135");
});

test("unknown fields, derived owner amounts, duplicate identities and incomplete selections fail closed", (t) => {
  const { root, f } = setup(t);
  const action = f.addRetail("a", "10");
  action.finance.monthly_contribution = "999";
  fails(f, root, /additional properties/);
  delete action.finance.monthly_contribution;
  f.data.actions.push(structuredClone(action));
  fails(f, root, /Duplicate action/);
  f.data.actions.pop();
  f.data.scenarios[0].selections = [];
  fails(f, root, /every action/);
});

test("multiple currencies and comparable bases cannot become one fabricated headline", (t) => {
  const { root, f } = setup(t);
  f.addRetail("usd", "100");
  const otherBasis = { ...f.data.bases[0], id: "eur", currency: "EUR" };
  f.data.bases.push(otherBasis);
  f.retail("eur-proposed", "200", "proposed:eur", "eur-charge", otherBasis);
  f.action("eur", {
    kind: "new_service_gross",
    basis_id: "eur",
    proposed_ref: "eur-proposed",
    ledger: [
      { resource_id: "proposed:eur", charge_id: "eur-charge", evidence_id: "eur-proposed", locator: "/resources/0" },
    ],
  });
  const result = calculate(f, root);
  assert.equal(result.valid, true);
  assert.deepEqual(
    result.derived.scenarios[0].summaries.map((g) => [g.currency, g.net]),
    [
      ["USD", "100"],
      ["EUR", "200"],
    ],
  );
});

test("conditional, alternative and dependency selection is explicit and acyclic", (t) => {
  const { root, f } = setup(t);
  f.addRetail("parent", "10");
  const child = f.addRetail("child", "20", null, {
    applicability: "conditional",
    condition: "Captured additional usage is needed.",
    dependencies: ["parent"],
  });
  fails(f, root, /Conditional action/);
  f.data.scenarios[0].conditions = [child.condition];
  assert.equal(calculate(f, root).valid, true);
  f.data.scenarios[0].selections[0].included = false;
  fails(f, root, /dependencies/);
  f.data.scenarios[0].selections[0].included = true;
  f.data.actions[0].dependencies = ["child"];
  fails(f, root, /cycle/);
  f.data.actions[0].dependencies = [];
  for (const action of f.data.actions) action.alternative_group = "exclusive";
  fails(f, root, /exclusive alternatives/);
});

test("identity, counts, WAF source linkage and critical urgency require evidence", (t) => {
  const { root, f } = setup(t);
  const action = f.addRetail("a", "10", "20");
  action.priority = "Critical";
  fails(f, root, /Missing\/wrong/);
  f.retain("critical", { critical_risks: [{ finding_id: "F1", rationale: action.priority_rationale }] });
  action.critical_evidence_id = "critical";
  assert.equal(calculate(f, root).valid, true);
  f.data.resources[1].count = 10;
  fails(f, root, /Unsupported resource/);
  f.data.resources[1].count = null;
  assert.equal(calculate(f, root).valid, true);
  f.data.findings[0].id = "invented";
  fails(f, root, /Finding differs/);
});

test("lifecycle dates require deployed service/version and safe authoritative documentation", (t) => {
  const { root, f } = setup(t);
  const action = f.action(
    "lifecycle",
    { kind: "unquantified", missing_inputs: ["Replacement cost unpriced."] },
    { category: "Retirements and lifecycle", resource_ids: [RETAIL_RESOURCE] },
  );
  fails(f, root, /Lifecycle actions/);
  const inventory = f.sources.get("inventory");
  Object.assign(inventory.resources[1], { service: "Synthetic", version: "v1" });
  f.retain("inventory", inventory, "inventory");
  f.retain(
    "lifecycle",
    {
      claims: [
        { service: "Synthetic", version: "v1", date: "2026-11-01", url: "https://learn.microsoft.com/azure/synthetic" },
      ],
    },
    "lifecycle",
  );
  action.lifecycle = {
    resource_id: RETAIL_RESOURCE,
    service: "Synthetic",
    version: "v1",
    date: "2026-11-01",
    evidence_id: "lifecycle",
    locator: "/claims/0",
  };
  assert.equal(calculate(f, root).valid, true);
  action.lifecycle.version = "v2";
  fails(f, root, /deployed service\/version/);
});

test("stale, missing and tampered evidence or out-of-scope resources fail before calculation", (t) => {
  const { root, f } = setup(t);
  f.addRetail("a", "100");
  f.data.evidence_refs[0].collected_at = "2026-10-01T10:00:00.000Z";
  fails(f, root, /Stale/);
  f.data.evidence_refs[0].collected_at = AS_OF;
  fs.appendFileSync(path.join(root, "evidence/waf.json"), " ");
  fails(f, root, /SHA-256/);
  f.retain("waf", f.sources.get("waf"), "waf");
  f.data.scopes = [];
  fails(f, root, /outside captured scope/);
});

test("safe project paths refuse traversal, symlink escapes, broken symlinks and unsafe URLs", (t) => {
  const { root, f } = setup(t);
  for (const value of ["../secret", "/absolute", "evidence\\a", "file:secret", "a//b"])
    assert.throws(() => projectPath(root, value, { missing: true }), /safe/);
  fs.symlinkSync("waf.json", path.join(root, "evidence/link.json"));
  assert.throws(() => projectPath(root, "evidence/link.json"), /Symlink/);
  fs.symlinkSync("missing.json", path.join(root, "evidence/broken.json"));
  assert.throws(() => projectPath(root, "evidence/broken.json", { missing: true }), /Symlink/);
  for (const url of [
    "javascript:alert(1)",
    "https://user:password@learn.microsoft.com/x",
    "https://evil.example/x",
    "https://learn.microsoft.com/x?sig=secret",
  ])
    assert.throws(() => safeEvidenceUrl(url));
  const action = f.addRetail("private-url", "10");
  action.comments = "https://user:password@learn.microsoft.com/private";
  fails(f, root, /Credential-bearing/);
});

test("no actions is distinct from inaccessible evidence; IaC-only needs no Azure or billing input", (t) => {
  const { root, f } = setup(t);
  f.data.source = "iac";
  f.data.scopes = [];
  f.data.resources = [];
  f.data.bases[0].source_type = "unpriced";
  f.data.bases[0].currency = null;
  f.data.bases[0].cost_view = null;
  assert.equal(calculate(f, root).valid, true);
  f.data.coverage = { status: "unavailable", reason: "Read category not granted." };
  assert.equal(calculate(f, root).valid, true);
  assert.equal(calculate(f, root).derived.scenarios[0].summaries[0].net, null);
  assert.equal(calculate(f, root).derived.scenarios[0].summaries[0].currency, null);
});

test("real CLI export is repeatable, verified, source-bound and refuses existing conflicting output", (t) => {
  const { root, f } = setup(t, true);
  const opts = options(root, f);
  assert.equal(renderAssessmentActionRegister(opts).valid, true);
  const workbook = fs.readFileSync(path.join(root, ACTION_REGISTER_OUTPUTS.workbook));
  const receipt = fs.readFileSync(path.join(root, ACTION_REGISTER_OUTPUTS.receipt));
  assert.equal(renderAssessmentActionRegister(opts).valid, true);
  assert.deepEqual(fs.readFileSync(path.join(root, ACTION_REGISTER_OUTPUTS.workbook)), workbook);
  assert.deepEqual(fs.readFileSync(path.join(root, ACTION_REGISTER_OUTPUTS.receipt)), receipt);
  const cli = spawnSync(
    process.execPath,
    [SCRIPT, "validate-export", "--root", root, "--input", opts.input, "--as-of", AS_OF],
    { encoding: "utf8" },
  );
  assert.equal(cli.status, 0, cli.stdout + cli.stderr);
  assert.equal(JSON.parse(cli.stdout).valid, true);
  const md = path.join(root, ACTION_REGISTER_OUTPUTS.markdown);
  fs.appendFileSync(md, "tampered");
  assert.equal(validateAssessmentActionRegisterExport(opts).valid, false);
  assert.throws(() => renderAssessmentActionRegister(opts), /conflicting/);
  assert.equal(renderAssessmentActionRegister({ ...opts, overwrite: true }).valid, true);
  assert.deepEqual(fs.readFileSync(path.join(root, ACTION_REGISTER_OUTPUTS.workbook)), workbook);
});

test("corrupt workbook fails the lifecycle CLI even when its receipt hash is replaced", (t) => {
  const { root, f } = setup(t, true);
  const opts = options(root, f);
  renderAssessmentActionRegister(opts);
  const bytes = Buffer.from("not a ZIP");
  fs.writeFileSync(path.join(root, ACTION_REGISTER_OUTPUTS.workbook), bytes);
  const receiptPath = path.join(root, ACTION_REGISTER_OUTPUTS.receipt);
  const receipt = JSON.parse(fs.readFileSync(receiptPath));
  receipt.output_hashes.workbook = digest(bytes);
  fs.writeFileSync(receiptPath, JSON.stringify(receipt));
  const result = validateAssessmentActionRegisterExport(opts);
  assert.equal(result.valid, false);
  assert.match(result.errors.join("; "), /Workbook validate failed/);
});

test("interrupted owned publication recovers, unowned files and active locks do not", (t) => {
  const { root, f } = setup(t);
  f.addRetail("a", "10");
  const opts = options(root, f);
  const receipt = renderAssessmentActionRegister(opts).receipt;
  const pending = {
    ...receipt,
    previous_output_hashes: {
      ...receipt.output_hashes,
      receipt: digest(fs.readFileSync(path.join(root, ACTION_REGISTER_OUTPUTS.receipt))),
    },
  };
  fs.writeFileSync(path.join(root, "_meta/action-register-export.pending.json"), JSON.stringify(pending));
  fs.unlinkSync(path.join(root, ACTION_REGISTER_OUTPUTS.receipt));
  assert.equal(renderAssessmentActionRegister(opts).valid, true);
  assert.equal(fs.existsSync(path.join(root, "_meta/action-register-export.pending.json")), false);
  fs.writeFileSync(path.join(root, "_meta/action-register-export.pending.json"), JSON.stringify(pending));
  fs.unlinkSync(path.join(root, ACTION_REGISTER_OUTPUTS.receipt));
  fs.appendFileSync(path.join(root, ACTION_REGISTER_OUTPUTS.markdown), "unowned");
  assert.throws(() => renderAssessmentActionRegister(opts), /unowned/);
});

test("explicit overwrite reclaims a dead lease after changed inputs but never a live lease", (t) => {
  const { root, f } = setup(t);
  f.addRetail("recovery", "10");
  const opts = options(root, f);
  const receipt = renderAssessmentActionRegister(opts).receipt;
  const child = spawnSync(process.execPath, ["-e", "process.exit(0)"]);
  assert.equal(child.status, 0);
  assert.throws(() => process.kill(child.pid, 0), { code: "ESRCH" });
  const lock = path.join(root, "_meta/action-register-export.lock");
  const pending = path.join(root, "_meta/action-register-export.pending.json");
  fs.writeFileSync(pending, JSON.stringify(receipt));
  fs.writeFileSync(lock, JSON.stringify({ pid: child.pid, source_sha256: receipt.source_sha256 }));
  f.data.actions[0].comments = "Explicitly revised source after interrupted export.";
  f.save();
  assert.throws(() => renderAssessmentActionRegister(opts), /--overwrite/);
  assert.equal(renderAssessmentActionRegister({ ...opts, overwrite: true }).valid, true);
  assert.equal(fs.existsSync(lock), false);
  assert.equal(fs.existsSync(pending), false);
  f.data.actions[0].comments = "Another owned revision.";
  f.save();
  fs.writeFileSync(lock, JSON.stringify({ pid: process.pid, source_sha256: receipt.source_sha256 }));
  assert.throws(() => renderAssessmentActionRegister({ ...opts, overwrite: true }), /locked by another process/);
});
test("CLI argument failures are explicit nonzero JSON, never silent defaults", (t) => {
  const { root, f } = setup(t);
  for (const args of [
    ["calculate"],
    ["calculate", "--root", root, "--input", f.save(), "--as-of", "invalid"],
    ["calculate", "--root", root, "--input", f.save(), "--as-of", AS_OF, "--overwrite"],
    ["calculate", "--root", root, "--input", "missing.json", "--as-of", AS_OF],
    ["validate", "--unknown"],
    ["execute", "--root", root, "--input", f.save(), "--as-of", AS_OF],
  ]) {
    const result = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" });
    assert.equal(result.status, 1, result.stdout + result.stderr);
    assert.equal(JSON.parse(result.stdout).valid, false);
  }
});
