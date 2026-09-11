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

  it("rejects unknown, inherited, empty and nested aggregate members", () => {
    for (const member of ["missing", "toString", "empty", "invalid", "missing:*"]) {
      const scripts = { suite: `run-p first ${member}`, first: "node first.mjs", empty: "", invalid: null };
      assert.throws(() => expandScript(scripts, "suite"), /not found|Unknown or empty|Unknown npm aggregate/);
      scripts.outer = "run-p suite";
      assert.throws(() => expandScript(scripts, "outer"), /not found|Unknown or empty|Unknown npm aggregate/);
    }
    for (const suite of ["run-p", "run-p --silent"]) {
      assert.throws(() => expandScript({ suite }, "suite"), /Empty npm aggregate/);
    }
  });

  it("preserves quoted tasks and matching patterns", () => {
    const scripts = { suite: 'run-p "check:*"', "check:first": "echo first", "check:second": "echo second" };
    assert.deepEqual(expandScript(scripts, "suite"), ["check:first", "check:second"]);
  });

  it("deduplicates overlapping patterns while preserving repeated pattern tasks", () => {
    for (const [patterns, expected] of [
      ["check:* check:one", ["check:one", "check:two"]],
      ["check:one check:*", ["check:one", "check:two"]],
      ["check:one check:one", ["check:one", "check:one"]],
      ["check:* check:*", ["check:one", "check:two", "check:one", "check:two"]],
    ]) {
      const scripts = { suite: `run-p ${patterns}`, "check:one": "echo one", "check:two": "echo two" };
      assert.deepEqual(expandScript(scripts, "suite"), expected, patterns);
    }
    assert.throws(
      () => expandScript({ suite: "run-p check:* missing:*", "check:one": "echo one" }, "suite"),
      /Unknown npm aggregate member: missing:\*/,
    );
  });

  it("keeps descriptor redirections native without treating numeric tasks as descriptors", () => {
    for (const redirection of ["2>/dev/null", "2>>/dev/null", "0</dev/null", "2>&1", "0<&0"]) {
      const scripts = { suite: `run-p first ${redirection}`, first: "echo first" };
      assert.deepEqual(expandScript(scripts, "suite"), ["suite"], redirection);
      delete scripts.first;
      assert.throws(() => expandScript(scripts, "suite"), /Task not found.*first/);
    }
    for (const suffix of ['"2">/dev/null', "2 >/dev/null"]) {
      const scripts = { suite: `run-p first ${suffix}`, first: "echo first" };
      assert.throws(() => expandScript(scripts, "suite"), /Task not found.*2/);
      scripts["2"] = "echo two";
      assert.deepEqual(expandScript(scripts, "suite"), ["suite"]);
    }
  });

  it("keeps runner options, task arguments and shell suffixes on the native execution path", () => {
    for (const command of [
      "run-p --continue-on-error first second && echo 'all passed'",
      'run-p --max-parallel 2 --npm-path "npm" first second',
      'run-p "first --flag value" second',
      "run-p -cl first second",
      "run-p first second -- value",
    ]) {
      const scripts = { suite: command, first: "echo first", second: "echo second" };
      assert.deepEqual(expandScript(scripts, "suite"), ["suite"]);
      delete scripts.second;
      assert.throws(() => expandScript(scripts, "suite"), /Task not found/);
    }
  });
});
