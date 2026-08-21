import assert from "node:assert/strict";
import test from "node:test";

import { selectGeneratedAt } from "../scripts/generate-explorer-graph.mjs";

test("preserves generatedAt when graph content is unchanged", () => {
  const previous = { generatedAt: "2026-01-01T00:00:00.000Z", nodes: [{ id: "a" }], edges: [] };
  const next = { generatedAt: null, nodes: [{ id: "a" }], edges: [] };
  assert.equal(selectGeneratedAt(previous, next, "2026-08-21T00:00:00.000Z"), previous.generatedAt);
});

test("uses a new generatedAt when graph content changes", () => {
  const previous = { generatedAt: "2026-01-01T00:00:00.000Z", nodes: [{ id: "a" }], edges: [] };
  const next = { generatedAt: null, nodes: [{ id: "b" }], edges: [] };
  assert.equal(selectGeneratedAt(previous, next, "2026-08-21T00:00:00.000Z"), "2026-08-21T00:00:00.000Z");
});
