#!/usr/bin/env node
/**
 * test_deployment_preview_schema.mjs — validate fixtures against the
 * deployment-preview-v1 schema (issue #425, Wave 3b).
 *
 * Run via:
 *   node --test tests/scripts/test_deployment_preview_schema.mjs
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const SCHEMA_PATH = path.join(ROOT, "tools/schemas/deployment-preview.schema.json");
const FIXTURES = path.join(HERE, "fixtures/deployment-preview");

function makeValidator() {
  const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  const ajv = new Ajv({ allErrors: true, strict: false });
  addFormats(ajv);
  return ajv.compile(schema);
}

test("schema file is valid JSON", () => {
  const body = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
  assert.equal(body.$schema, "https://json-schema.org/draft/2020-12/schema");
  assert.equal(body.title, "APEX Deployment Preview");
});

test("valid bicep-whatif fixture conforms to schema", () => {
  const validate = makeValidator();
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, "valid-bicep-whatif.json"), "utf8"));
  const ok = validate(data);
  assert.ok(ok, `expected valid, errors: ${JSON.stringify(validate.errors)}`);
});

test("valid policy-precheck (BLOCK) fixture conforms to schema", () => {
  const validate = makeValidator();
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, "valid-policy-precheck-block.json"), "utf8"));
  const ok = validate(data);
  assert.ok(ok, `expected valid, errors: ${JSON.stringify(validate.errors)}`);
});

test("invalid fixture (bad enum, negative count) is rejected", () => {
  const validate = makeValidator();
  const data = JSON.parse(fs.readFileSync(path.join(FIXTURES, "invalid-bad-enum.json"), "utf8"));
  const ok = validate(data);
  assert.equal(ok, false, "expected validation failure");
  const errorPaths = (validate.errors || []).map((e) => e.instancePath);
  // schema_version const, deploy_gate enum, creates minimum 0.
  assert.ok(
    errorPaths.includes("/schema_version") || errorPaths.includes("/deploy_gate") || errorPaths.includes("/creates"),
    `expected schema_version/deploy_gate/creates errors, got: ${JSON.stringify(validate.errors)}`,
  );
});
