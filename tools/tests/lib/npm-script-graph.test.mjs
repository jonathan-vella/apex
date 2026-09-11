import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readFileSync } from "node:fs";

import { expandScript } from "../../scripts/_lib/npm-script-graph.mjs";

describe("_lib/npm-script-graph", () => {
  it("aggregate suites run full agent validation without its handoff subset twice", () => {
    const { scripts } = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
    for (const suite of ["validate:_node", "validate:_node-ci"]) {
      const leaves = expandScript(scripts, suite);
      assert.equal(leaves.filter((name) => name === "validate:agents").length, 1);
      assert.ok(!leaves.includes("lint:workflow-handoffs"));
      assert.ok(leaves.includes("validate:orchestrator-handoff"));
    }
    assert.equal(scripts["validate:agents"], "node tools/scripts/validate-agents.mjs");
    assert.equal(scripts["lint:workflow-handoffs"], "node tools/scripts/validate-agents.mjs --only=workflow-handoffs");
    const dispatcher = readFileSync(new URL("../../scripts/validate-agents.mjs", import.meta.url), "utf8");
    assert.match(dispatcher, /"workflow-handoffs": runWorkflowHandoffs/);
    assert.match(dispatcher, /Object\.keys\(PARTS\)/);
  });
  it("expands run-p aggregates to leaf scripts", () => {
    const scripts = {
      aggregate: "run-p first nested",
      nested: "run-p second third",
      first: "node first.mjs",
      second: "node second.mjs",
      third: "node third.mjs",
    };
    assert.deepEqual(expandScript(scripts, "aggregate"), ["first", "second", "third"]);
  });

  it("follows validate-all suite delegation", () => {
    const scripts = {
      current: "node tools/scripts/validate-all.mjs --suite=legacy --concurrency=4",
      legacy: "run-p first second",
      first: "node first.mjs",
      second: "node second.mjs",
    };
    assert.deepEqual(expandScript(scripts, "current"), ["first", "second"]);
  });

  it("rejects script cycles", () => {
    const scripts = { first: "run-p second", second: "run-p first" };
    assert.throws(() => expandScript(scripts, "first"), /cycle detected/);
  });

  it("rejects missing, inherited, empty and invalid root scripts", () => {
    for (const name of ["missing", "toString", "empty", "whitespace", "invalid"]) {
      assert.throws(
        () => expandScript({ empty: "", whitespace: "   ", invalid: null }, name),
        /Unknown or empty npm script/,
      );
    }
  });

  it("rejects a missing delegated suite", () => {
    assert.throws(
      () => expandScript({ current: "node tools/scripts/validate-all.mjs --suite=missing" }, "current"),
      /Unknown or empty npm script: missing/,
    );
  });
});
