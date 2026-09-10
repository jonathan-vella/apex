import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { aggregate, gather, renderMd } from "../../scripts/measure-workflow-baseline.mjs";

test("partial telemetry uses independent denominators and preserves measured zero", () => {
  const common = { tier: "standard", iac_tool: "bicep", step: "2", status: "measured" };
  const summary = aggregate([
    { ...common, input_tokens: 120, elapsed_ms: null, cache_hits: 0 },
    { ...common, input_tokens: null, elapsed_ms: 40, cache_hits: 2 },
    { ...common, input_tokens: 0, elapsed_ms: 0, output_tokens: -1 },
    { ...common, input_tokens: "50", elapsed_ms: NaN, output_tokens: Infinity },
  ]);
  assert.equal(summary[0].avg_input_tokens, 60);
  assert.equal(summary[0].avg_elapsed_ms, 20);
  assert.equal(summary[0].avg_cache_hits, 1);
  assert.equal(summary[0].avg_output_tokens, null);
  assert.equal(summary[0].metric_samples.input_tokens, 2);
  assert.equal(summary[0].metric_samples.output_tokens, 0);
  assert.match(renderMd([], summary), /unknown \(0\)/);
});

test("gather includes early, governance and final steps without inventing telemetry", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "apex-measure-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, "agent-output/example");
  mkdirSync(project, { recursive: true });
  writeFileSync(
    path.join(project, "00-session-state.json"),
    JSON.stringify({
      decisions: { iac_tool: "terraform", complexity: "standard" },
      steps: {
        1: { telemetry: { input_tokens: 10 } },
        2: { telemetry: { elapsed_ms: 50 } },
        "3_5": { telemetry: {} },
        "step-4": { telemetry: { input_tokens: 20 } },
        7: { telemetry: { input_tokens: 30 } },
        post: { telemetry: { cache_hits: 0 } },
      },
    }),
  );
  const records = gather(undefined, root);
  assert.deepEqual(
    records.map((record) => record.step),
    ["1", "2", "7", "3_5", "4", "post"],
  );
  assert.equal(records.find((record) => record.step === "3_5").status, "no-telemetry");
  assert.equal(records.find((record) => record.step === "2").input_tokens, null);
  assert.equal(records.find((record) => record.step === "post").status, "measured");
  assert.deepEqual(gather("complex", root), []);
});

test("aggregation does not pool different IaC tracks", () => {
  const common = { tier: "simple", step: "5", status: "measured" };
  const summary = aggregate([
    { ...common, iac_tool: "bicep", input_tokens: 100 },
    { ...common, iac_tool: "terraform", input_tokens: 300 },
  ]);
  assert.equal(summary.length, 2);
  assert.deepEqual(
    summary.map((row) => row.avg_input_tokens),
    [100, 300],
  );
});
