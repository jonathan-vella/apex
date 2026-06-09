// Unit tests for tools/scripts/_lib/json.mjs.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

import { readJson, readJsonSafe, writeJson, sha256File } from "../../scripts/_lib/json.mjs";

function tmpFile(contents) {
  const p = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "apex-json-")), "data.json");
  if (contents !== undefined) fs.writeFileSync(p, contents);
  return p;
}

/** Returns the path to a guaranteed-nonexistent file in a unique temp directory. */
function missingFile() {
  return path.join(fs.mkdtempSync(path.join(os.tmpdir(), "apex-json-")), "no-such-file.json");
}

describe("_lib/json", () => {
  it("readJson parses valid JSON", () => {
    const p = tmpFile('{"a":1}');
    assert.deepEqual(readJson(p), { a: 1 });
  });

  it("readJson throws on a missing file", () => {
    assert.throws(() => readJson(missingFile()));
  });

  it("readJson throws on invalid JSON", () => {
    assert.throws(() => readJson(tmpFile("{not json")));
  });

  it("readJsonSafe returns null on a missing file", () => {
    assert.equal(readJsonSafe(missingFile()), null);
  });

  it("readJsonSafe returns the provided fallback on error", () => {
    assert.deepEqual(readJsonSafe(missingFile(), { ok: false }), { ok: false });
  });

  it("writeJson emits 2-space indent with a trailing newline", () => {
    const p = tmpFile();
    writeJson(p, { b: 2 });
    const raw = fs.readFileSync(p, "utf8");
    assert.equal(raw, '{\n  "b": 2\n}\n');
    assert.deepEqual(readJson(p), { b: 2 });
  });

  it("sha256File matches a direct digest of the bytes", () => {
    const p = tmpFile("hello");
    const expected = crypto.createHash("sha256").update(Buffer.from("hello")).digest("hex");
    assert.equal(sha256File(p), expected);
  });
});
