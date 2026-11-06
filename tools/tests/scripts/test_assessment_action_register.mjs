import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { normalizeCostCollection } from "../../scripts/assessment-cost.mjs";
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
