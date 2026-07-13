import assert from "node:assert/strict";
import test from "node:test";
import { canonicalJson, sha256Json, sha256Text } from "../canonical.js";

test("canonical JSON sorts keys recursively and is deterministic", () => {
  const first = { z: 1, a: { y: true, x: "value" }, list: [3, null, false] };
  const second = { list: [3, null, false], a: { x: "value", y: true }, z: 1 };

  assert.equal(canonicalJson(first), '{"a":{"x":"value","y":true},"list":[3,null,false],"z":1}');
  assert.equal(sha256Json(first), sha256Json(second));
  assert.equal(sha256Text("abc"), "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
});

test("canonical JSON rejects unsupported and cyclic values", () => {
  assert.throws(() => canonicalJson({ value: undefined } as never), /undefined/);
  assert.throws(() => canonicalJson({ value: Number.POSITIVE_INFINITY }), /non-finite/);

  const cyclic: Record<string, unknown> = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalJson(cyclic as never), /cyclic/);
});
