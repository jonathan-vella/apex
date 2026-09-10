import assert from "node:assert/strict";
import { test } from "node:test";
import { analyzeReadRedundancy } from "../../scripts/check-context-redundancy.mjs";

const chat = { name: "chat:test", traceId: "trace", spanId: "parent", startTimeUnixNano: "1", endTimeUnixNano: "2" };
function read(id, start = 1, end = 10, overrides = {}) {
  return {
    name: "tool",
    traceId: "trace",
    spanId: id,
    parentSpanId: "parent",
    startTimeUnixNano: String(Number(id) * 10),
    endTimeUnixNano: String(Number(id) * 10 + 1),
    attributes: [
      { key: "gen_ai.tool.name", value: { stringValue: "functions.read_file" } },
      {
        key: "gen_ai.tool.call.arguments",
        value: {
          stringValue: JSON.stringify({
            filePath: "/repo/.github/skills/demo/SKILL.md",
            startLine: start,
            endLine: end,
          }),
        },
      },
      { key: "gen_ai.tool.call.result", value: { stringValue: "original content" } },
    ],
    ...overrides,
  };
}
function log(...groups) {
  return { resourceSpans: groups.map((spans) => ({ scopeSpans: [{ spans }] })) };
}

test("scans all resource/scope groups and recognizes qualified tool names", () => {
  const report = analyzeReadRedundancy(log([chat, read("1")], [read("2")]));
  assert.equal(report.reads, 2);
  assert.equal(report.violations, 1);
});

test("disjoint ranges and other traces are not duplicates", () => {
  const report = analyzeReadRedundancy(
    log([chat, read("1"), read("2", 11, 20), read("3", 1, 10, { traceId: "other" })]),
  );
  assert.equal(report.repeats.length, 0);
});

test("partial overlaps, changed results and another chat request are advisory", () => {
  for (const second of [
    read("2", 5, 15),
    read("2", 1, 10, { parentSpanId: "other" }),
    read("2", 1, 10, { attributes: read("2").attributes.slice(0, 2) }),
  ]) {
    const report = analyzeReadRedundancy(log([chat, read("1"), second]));
    assert.equal(report.violations, 0);
    assert.equal(report.repeats[0].classification, "advisory-overlap");
  }
});

test("compaction, session boundaries and writes invalidate prior read evidence", () => {
  for (const name of ["compaction", "SessionStart", "Stop", "apply_patch", "run_in_terminal"]) {
    const boundary = { name, startTimeUnixNano: "15", endTimeUnixNano: "16" };
    assert.equal(analyzeReadRedundancy(log([chat, read("1"), boundary, read("2")])).repeats.length, 0);
  }
});

test("failed reads, duplicate exported spans and incomplete timing never inflate violations", () => {
  assert.equal(analyzeReadRedundancy(log([chat, read("1"), read("1")])).duplicateSpans, 1);
  assert.equal(analyzeReadRedundancy(log([chat, read("1", 1, 10, { status: { code: 2 } }), read("2")])).violations, 0);
  const report = analyzeReadRedundancy(log([chat, read("1"), read("2", 1, 10, { startTimeUnixNano: undefined })]));
  assert.equal(report.violations, 0);
});

test("file URLs normalize without conflating Linux filename case", () => {
  const second = read("2");
  second.attributes[1].value.stringValue = JSON.stringify({
    uri: "file:///repo/.github/skills/demo/SKILL.md",
    startLine: 1,
    endLine: 10,
  });
  assert.equal(analyzeReadRedundancy(log([chat, read("1"), second])).violations, 1);
  second.attributes[1].value.stringValue = JSON.stringify({
    filePath: "/repo/.github/skills/demo/skill.md",
    startLine: 1,
    endLine: 10,
  });
  assert.equal(analyzeReadRedundancy(log([chat, read("1"), second])).repeats.length, 0);
});

test("missing range/context stays advisory and malformed logs fail clearly", () => {
  assert.equal(analyzeReadRedundancy(log([read("1", undefined, null), read("2", undefined, null)])).violations, 0);
  assert.throws(() => analyzeReadRedundancy({}), /missing resourceSpans/);
  assert.throws(() => analyzeReadRedundancy(log([])), /no spans/);
});
