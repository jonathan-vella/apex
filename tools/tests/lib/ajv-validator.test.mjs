// Unit tests for tools/scripts/_lib/ajv-validator.mjs.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { createAjv, loadValidator } from "../../scripts/_lib/ajv-validator.mjs";

function tmpSchema(schema) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "apex-ajv-")), "schema.json");
  fs.writeFileSync(p, JSON.stringify(schema));
  return p;
}

describe("_lib/ajv-validator", () => {
  it("createAjv returns an instance that compiles schemas", () => {
    const ajv = createAjv();
    const validate = ajv.compile({ type: "object", required: ["a"], properties: { a: { type: "number" } } });
    assert.equal(validate({ a: 1 }), true);
    assert.equal(validate({}), false);
  });

  it("createAjv collects all errors (allErrors)", () => {
    const ajv = createAjv();
    const validate = ajv.compile({
      type: "object",
      required: ["a", "b"],
      properties: { a: { type: "number" }, b: { type: "number" } },
    });
    validate({});
    assert.ok((validate.errors ?? []).length >= 2, "expected allErrors to report both missing props");
  });

  it("createAjv registers ajv-formats (date-time format is recognized)", () => {
    const ajv = createAjv();
    const validate = ajv.compile({ type: "string", format: "date-time" });
    assert.equal(validate("2026-01-01T00:00:00Z"), true);
    assert.equal(validate("not-a-date"), false);
  });

  it("loadValidator reads a schema file and returns a compiled validator", () => {
    const p = tmpSchema({ type: "object", required: ["x"], properties: { x: { type: "string" } } });
    const validate = loadValidator(p);
    assert.equal(validate({ x: "ok" }), true);
    assert.equal(validate({ x: 5 }), false);
  });

  it("loadValidator throws on a missing schema file", () => {
    const missing = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "apex-ajv-")), "nope.json");
    assert.throws(() => loadValidator(missing));
  });
});
