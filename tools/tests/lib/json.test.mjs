// Unit tests for tools/scripts/_lib/json.mjs.

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { parseJsonc } from "../../scripts/_lib/parse-jsonc.mjs";

import {
  readJson,
  readJsonCached,
  readJsonSafe,
  resetJsonCache,
  writeJson,
  sha256File,
} from "../../scripts/_lib/json.mjs";

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
  it("JSONC preserves prototype-like keys as own data properties", () => {
    const text =
      '{"__proto__":{"servers":{"github":{}}},"nested":{"__proto__":{"admin":true}},"constructor":"literal"}';
    const parsed = parseJsonc(text);
    assert.deepEqual(parsed, JSON.parse(text));
    assert.ok(Object.hasOwn(parsed, "__proto__"));
    assert.equal(Object.getPrototypeOf(parsed), Object.prototype);
    assert.equal(parsed.servers, undefined);
    assert.equal(parsed.nested.admin, undefined);
    assert.equal(JSON.stringify(parsed), text);
  });
  it("JSONC preserves string contents that resemble comments or trailing commas", () => {
    const value = {
      block: "/*literal*/",
      close: ",}",
      array: ",]",
      url: "https://example.test/a//b",
      escaped: '\\"/*not a comment*/',
    };
    assert.deepEqual(parseJsonc(JSON.stringify(value)), value);
  });

  it("JSONC supports comments, trailing commas and scalar JSON values", () => {
    assert.deepEqual(parseJsonc('/* before */ {"values": [1,2,], // line\n}'), { values: [1, 2] });
    for (const value of [null, true, 2, "string"]) assert.deepEqual(parseJsonc(JSON.stringify(value)), value);
  });

  it("JSONC rejects malformed input rather than returning recovered partial data", () => {
    for (const text of ["", "/* only */", '{"x":}', '{"x":1} garbage', '{"x":"unterminated}', "/* never closed"]) {
      assert.throws(() => parseJsonc(text), SyntaxError, text);
    }
    assert.throws(() => readJson(tmpFile('{"value":1,}')));
  });
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

  it("readJsonCached returns the same parsed object until reset", () => {
    const p = tmpFile('{"a":1}');
    const first = readJsonCached(p);
    const second = readJsonCached(p);
    assert.strictEqual(first, second);
    resetJsonCache(p);
    assert.notStrictEqual(readJsonCached(p), first);
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

  it("writeJson invalidates the cached value", () => {
    const p = tmpFile('{"a":1}');
    const before = readJsonCached(p);
    writeJson(p, { a: 2 });
    assert.notStrictEqual(readJsonCached(p), before);
    assert.deepEqual(readJsonCached(p), { a: 2 });
  });

  it("sha256File matches a direct digest of the bytes", () => {
    const p = tmpFile("hello");
    const expected = crypto.createHash("sha256").update(Buffer.from("hello")).digest("hex");
    assert.equal(sha256File(p), expected);
  });
});
