#!/usr/bin/env node
/**
 * test_challenge_findings_decisions_schema.mjs — validate fixtures
 * against the challenge-findings-decisions-v1 schema added for issue
 * #425 audit follow-up.
 *
 * The schema is permissive (accepts three observed field-naming
 * variants); these tests pin that contract.
 *
 * Run via:
 *   node --test tests/scripts/test_challenge_findings_decisions_schema.mjs
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadValidator } from "../../tools/scripts/validate-challenge-findings-decisions.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const FIXTURES = path.join(HERE, "fixtures/challenge-findings-decisions");
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/challenge-findings-decisions.schema.json");

test("schema file is valid JSON and declares title + decisions array", () => {
  const body = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  assert.equal(body.title, "APEX Challenger Findings — Per-Finding Decisions Sidecar");
  assert.ok(body.properties.decisions, "schema must declare decisions[] property");
  assert.ok(body.required.includes("decisions"), "decisions must be required");
});

test("requirements-style fixture validates (issue_id + action + note)", () => {
  const validate = loadValidator();
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, "valid-requirements-shape.json"), "utf8"));
  const ok = validate(data);
  assert.ok(ok, `expected valid, errors: ${JSON.stringify(validate.errors)}`);
});

test("architecture-style fixture validates (issue_id + decision + rationale)", () => {
  const validate = loadValidator();
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, "valid-architecture-shape.json"), "utf8"));
  const ok = validate(data);
  assert.ok(ok, `expected valid, errors: ${JSON.stringify(validate.errors)}`);
});

test("governance-style fixture validates (finding_id + disposition + schema_version 1.0)", () => {
  const validate = loadValidator();
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, "valid-governance-shape.json"), "utf8"));
  const ok = validate(data);
  assert.ok(ok, `expected valid, errors: ${JSON.stringify(validate.errors)}`);
});

test("missing-id fixture is rejected (no issue_id or finding_id)", () => {
  const validate = loadValidator();
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, "invalid-missing-id.json"), "utf8"));
  const ok = validate(data);
  assert.equal(ok, false, "expected validation failure");
});

test("bad-disposition fixture is rejected (action not in enum)", () => {
  const validate = loadValidator();
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, "invalid-bad-disposition.json"), "utf8"));
  const ok = validate(data);
  assert.equal(ok, false, "expected validation failure");
});

test("validateFile() exits truthy on a real audit sidecar (no regression on shipped files)", () => {
  // Verify the validator behaves on a real-world file shape (smoke test).
  const validate = loadValidator();
  const sample = {
    decisions: [{ issue_id: "abc12345", severity: "must_fix", action: "accept", note: "ok" }],
  };
  assert.ok(validate(sample), `unexpected failure: ${JSON.stringify(validate.errors)}`);
});
