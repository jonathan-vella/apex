import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { expandScript } from "../../scripts/_lib/npm-script-graph.mjs";

describe("_lib/npm-script-graph", () => {
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
});
