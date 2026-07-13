import assert from "node:assert/strict";
import test from "node:test";
import { renderSemanticDiff, semanticDiff } from "../index.js";

test("semantic diff returns sorted JSON Pointer leaf paths", () => {
  const result = semanticDiff(
    { retained: 1, removed: { "a/b": true }, changed: "old", array: [1] },
    { retained: 1, added: { "x~y": true }, changed: "new", array: [1, 2] },
  );

  assert.deepEqual(result.added, ["/added/x~0y", "/array/1"]);
  assert.deepEqual(result.removed, ["/removed/a~1b"]);
  assert.deepEqual(result.changed, [{ path: "/changed", before: "old", after: "new" }]);
});

test("semantic diff Markdown is stable and escapes table content", () => {
  const diff = semanticDiff({ value: "left|\u0001" }, { value: "right\nline" });
  const first = renderSemanticDiff(diff);
  const second = renderSemanticDiff(diff);

  assert.equal(first, second);
  assert.match(first, /left\\\|\\\\u0001/);
  assert.match(first, /right\\\\nline/);
  assert.doesNotMatch(first, /\u0001/);
});
