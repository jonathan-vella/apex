import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";
import test from "node:test";

import { readGovernanceBaseline, resetGovernanceBaselineCache } from "../../scripts/_lib/governance-baseline.mjs";
import { runValidator } from "../../scripts/validate-governance-baseline.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SHARED_BASELINE = ".github/data/alz-corp-policy-baseline.json.gz";
const PRIVATE_BASELINE = ".github/data/governance-policy-baseline.json.gz";
const FIXTURE_BASELINE = ".github/data/governance-policy-baseline.fixture.json";

function fixture(context) {
  const root = fs.mkdtempSync(path.join(ROOT, ".governance-baseline-tests-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function writeBaseline(root, file, document) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  const bytes = Buffer.from(JSON.stringify(document));
  fs.writeFileSync(target, file.endsWith(".gz") ? gzipSync(bytes, { mtime: 0 }) : bytes);
  return target;
}

function sharedBaseline() {
  return structuredClone(readGovernanceBaseline(path.join(ROOT, SHARED_BASELINE)));
}

test("loads plain and compressed governance JSON with caching", (context) => {
  const dir = fixture(context);
  const plain = path.join(dir, "baseline.json");
  const compressed = `${plain}.gz`;
  const baseline = { schema_version: "governance-baseline-v1", subscriptions: {} };
  const raw = Buffer.from(JSON.stringify(baseline));
  fs.writeFileSync(plain, raw);
  fs.writeFileSync(compressed, gzipSync(raw, { mtime: 0 }));

  assert.deepEqual(readGovernanceBaseline(plain), baseline);
  const first = readGovernanceBaseline(compressed);
  assert.deepEqual(first, baseline);
  assert.strictEqual(readGovernanceBaseline(compressed), first);
  resetGovernanceBaselineCache(compressed);
  assert.notStrictEqual(readGovernanceBaseline(compressed), first);
});

test("production validation requires the shared baseline even when a fixture exists", (context) => {
  const root = fixture(context);
  writeBaseline(root, FIXTURE_BASELINE, JSON.parse(fs.readFileSync(path.join(ROOT, FIXTURE_BASELINE), "utf8")));
  assert.equal(runValidator({ root }), 1);
});

test("production validation cannot substitute a private snapshot for the missing shared baseline", (context) => {
  const root = fixture(context);
  const tenant = JSON.parse(fs.readFileSync(path.join(ROOT, FIXTURE_BASELINE), "utf8"));
  writeBaseline(root, PRIVATE_BASELINE, tenant);
  assert.equal(runValidator({ root }), 1);
});

test("fixtures are accepted only through an explicit validator path", () => {
  assert.equal(runValidator({ baselinePath: path.join(ROOT, FIXTURE_BASELINE) }), 0);
});

test("production validation accepts the shared baseline without a private snapshot", (context) => {
  const root = fixture(context);
  const file = writeBaseline(root, SHARED_BASELINE, sharedBaseline());
  assert.equal(runValidator({ root }), 0);
  fs.unlinkSync(file);
  assert.equal(runValidator({ root }), 1);
});

test("production validation checks private snapshots when present and rejects generic data there", (context) => {
  const root = fixture(context);
  writeBaseline(root, SHARED_BASELINE, sharedBaseline());
  const privateFile = writeBaseline(
    root,
    PRIVATE_BASELINE,
    JSON.parse(fs.readFileSync(path.join(ROOT, FIXTURE_BASELINE), "utf8")),
  );
  assert.equal(runValidator({ root }), 0);
  fs.writeFileSync(privateFile, "invalid gzip");
  assert.equal(runValidator({ root }), 1);
  writeBaseline(root, PRIVATE_BASELINE, sharedBaseline());
  assert.equal(runValidator({ root }), 1);
});

test("shared baseline validation rejects incomplete Defender coverage and tenant provenance", (context) => {
  const root = fixture(context);
  for (const mutate of [
    (doc) => {
      doc.baseline_kind = undefined;
    },
    (doc) => {
      doc.coverage_status = "PARTIAL";
    },
    (doc) => {
      doc.subscriptions_processed = 0;
    },
    (doc) => {
      doc.subscriptions_skipped = ["skipped"];
    },
    (doc) => {
      doc.subscriptions = {};
    },
    (doc) => {
      const entry = Object.values(doc.subscriptions)[0];
      entry.subscription_id = "tenant";
      doc.subscriptions = { tenant: entry };
    },
    (doc) => {
      Object.values(doc.subscriptions)[0].source = "tenant";
    },
    (doc) => {
      Object.values(doc.subscriptions)[0].provenance.verified_against_tenant = true;
    },
    (doc) => {
      Object.values(doc.subscriptions)[0].provenance.azure_policy_ref = "different";
    },
    (doc) => {
      Object.values(doc.subscriptions)[0].discovery_status = "PARTIAL";
    },
    (doc) => {
      Object.values(doc.subscriptions)[0].discovery_options.include_defender_auto = false;
    },
    (doc) => {
      Object.values(doc.subscriptions)[0].discovery_summary.defender_auto_filtered = 1;
    },
  ]) {
    const document = sharedBaseline();
    mutate(document);
    writeBaseline(root, SHARED_BASELINE, document);
    assert.equal(runValidator({ root }), 1);
  }
});

test("explicit missing and malformed baseline paths fail", (context) => {
  const root = fixture(context);
  const file = path.join(root, "missing.json.gz");
  assert.equal(runValidator({ baselinePath: file }), 1);
  assert.equal(runValidator({ baselinePath: "" }), 1);
  fs.writeFileSync(file, "invalid gzip");
  assert.equal(runValidator({ baselinePath: file }), 1);
  writeBaseline(root, "missing.json.gz", {});
  assert.equal(runValidator({ baselinePath: file }), 1);
});
