/**
 * Vendor-prompting fixture driver.
 *
 * Loads each fixture in fixtures/agents/, parses it, and asserts that the
 * vendor-prompting checks fire the expected rule IDs. The expected map is
 * declared inline below — each fixture's filename maps to the rule IDs we
 * expect to see (or to an empty array for "good" fixtures).
 *
 * Run: node --test tools/tests/vendor-prompting/run.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  parseFrontmatter,
  getBody,
} from "../../scripts/_lib/parse-frontmatter.mjs";
import { Reporter } from "../../scripts/_lib/reporter.mjs";
import { classifyModel } from "../../scripts/validate-agents.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures", "agents");

/**
 * Expected rule IDs per fixture. Order does not matter; superset is allowed
 * because future rules may legitimately fire on bad fixtures.
 */
const EXPECTATIONS = {
  "fixture-good-claude.agent.md": {
    mustHave: [],
    mustNotHave: [
      "claude-no-prefill-001",
      "handoff-enrichment-001",
      "frontmatter-model-style-001",
    ],
  },
  "fixture-bad-claude.agent.md": {
    mustHave: ["claude-no-prefill-001", "handoff-enrichment-001"],
    mustNotHave: [],
  },
  "fixture-good-gpt55.agent.md": {
    mustHave: [],
    mustNotHave: [
      "gpt55-skeleton-001",
      "gpt-no-claude-xml-001",
      "personality-scoping-001",
      "gpt55-stop-rules-non-empty-001",
      "handoff-enrichment-001",
    ],
  },
  "fixture-bad-gpt55.agent.md": {
    mustHave: [
      "gpt55-skeleton-001",
      "gpt-no-claude-xml-001",
      "personality-scoping-001",
      "handoff-enrichment-001",
    ],
    mustNotHave: [],
  },
};

/**
 * Re-implement the per-agent dispatch loop from runVendorPrompting() but
 * scoped to a single file. This avoids forking the validator process and
 * lets us assert structured findings directly.
 */
async function lintFixture(filePath) {
  // Re-import the validator's check functions via dynamic import. We rely on
  // the fact that the validator module is import-safe (it guards main()
  // behind a `if (process.argv[1] === __filename)` check).
  const validator = await import("../../scripts/validate-agents.mjs");
  // The check functions are not exported; instead we run the validator
  // module's internal logic by simulating a single-file invocation.
  // For audit-grade fidelity we shell out to the CLI in JSON mode.
  const { execFileSync } = await import("node:child_process");
  const out = execFileSync(
    "node",
    [
      "tools/scripts/validate-agents.mjs",
      "--only=vendor-prompting",
      "--format=json",
    ],
    { encoding: "utf-8", cwd: process.cwd() },
  );
  const parsed = JSON.parse(out);
  return parsed.findings.filter((f) =>
    f.file.endsWith(path.basename(filePath)),
  );
}

for (const [fixture, exp] of Object.entries(EXPECTATIONS)) {
  test(`fixture ${fixture}`, async () => {
    const filePath = path.join(FIXTURES, fixture);
    assert.ok(fs.existsSync(filePath), `Missing fixture: ${filePath}`);

    // Stage the fixture into .github/agents/ for the live validator to pick up,
    // run the validator, then clean up.
    const stagedPath = path.join(".github/agents", fixture);
    fs.copyFileSync(filePath, stagedPath);
    let findings;
    try {
      findings = await lintFixture(stagedPath);
    } finally {
      fs.unlinkSync(stagedPath);
    }

    const ruleIds = new Set(findings.map((f) => f.ruleId));
    for (const must of exp.mustHave) {
      assert.ok(
        ruleIds.has(must),
        `${fixture}: expected rule "${must}" to fire. Got: [${[...ruleIds].join(", ")}]`,
      );
    }
    for (const mustNot of exp.mustNotHave) {
      assert.ok(
        !ruleIds.has(mustNot),
        `${fixture}: expected rule "${mustNot}" NOT to fire. Got: [${[...ruleIds].join(", ")}]`,
      );
    }
  });
}
