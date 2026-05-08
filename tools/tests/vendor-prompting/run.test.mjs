/**
 * Vendor-prompting fixture driver.
 *
 * Loads each fixture in fixtures/agents/ and fixtures/prompts/, parses it,
 * and asserts that the vendor-prompting checks fire the expected rule IDs.
 * The expected map is declared inline below — each fixture's filename maps
 * to the rule IDs we expect to see (or to an empty array for "good" fixtures).
 *
 * Run: node --test tools/tests/vendor-prompting/run.test.mjs
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(__dirname, "fixtures", "agents");
const PROMPT_FIXTURES = path.join(__dirname, "fixtures", "prompts");

/**
 * Expected rule IDs per fixture. Order does not matter; superset is allowed
 * because future rules may legitimately fire on bad fixtures.
 */
const EXPECTATIONS = {
  "fixture-good-claude.agent.md": {
    mustHave: [],
    mustNotHave: ["claude-no-prefill-001", "handoff-enrichment-001", "frontmatter-model-style-001"],
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
    mustHave: ["gpt55-skeleton-001", "gpt-no-claude-xml-001", "personality-scoping-001", "handoff-enrichment-001"],
    mustNotHave: [],
  },
};

/**
 * Expected rule IDs per prompt fixture. Mirrors EXPECTATIONS but for
 * `.prompt.md` files staged into `.github/prompts/`.
 */
const PROMPT_EXPECTATIONS = {
  "fixture-good-custom-agent.prompt.md": {
    mustHave: [],
    mustNotHave: ["prompt-model-source-001", "frontmatter-model-style-001"],
  },
  "fixture-bad-custom-agent-with-model.prompt.md": {
    mustHave: ["prompt-model-source-001"],
    mustNotHave: [],
  },
  "fixture-good-generic-agent.prompt.md": {
    mustHave: [],
    mustNotHave: ["prompt-model-source-001"],
  },
  "fixture-bad-generic-agent-no-model.prompt.md": {
    mustHave: ["prompt-model-source-001"],
    mustNotHave: [],
  },
};

/**
 * Re-implement the per-agent dispatch loop from runVendorPrompting() but
 * scoped to a single file. This avoids forking the validator process and
 * lets us assert structured findings directly.
 */
async function lintFixture(filePath) {
  // The check functions are not exported; instead we run the validator
  // module's internal logic by simulating a single-file invocation.
  // For audit-grade fidelity we shell out to the CLI in JSON mode.
  // Use spawnSync (not execFileSync) so a non-zero exit code (which is
  // expected when bad fixtures fire error-severity rules like
  // prompt-model-source-001) does not throw — we still need stdout.
  const { spawnSync } = await import("node:child_process");
  const result = spawnSync("node", ["tools/scripts/validate-agents.mjs", "--only=vendor-prompting", "--format=json"], {
    encoding: "utf-8",
    cwd: process.cwd(),
  });
  if (!result.stdout) {
    throw new Error(`validate-agents.mjs produced no stdout (exit ${result.status}, stderr: ${result.stderr})`);
  }
  const parsed = JSON.parse(result.stdout);
  return parsed.findings.filter((f) => f.file.endsWith(path.basename(filePath)));
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
      assert.ok(ruleIds.has(must), `${fixture}: expected rule "${must}" to fire. Got: [${[...ruleIds].join(", ")}]`);
    }
    for (const mustNot of exp.mustNotHave) {
      assert.ok(
        !ruleIds.has(mustNot),
        `${fixture}: expected rule "${mustNot}" NOT to fire. Got: [${[...ruleIds].join(", ")}]`,
      );
    }
  });
}

for (const [fixture, exp] of Object.entries(PROMPT_EXPECTATIONS)) {
  test(`prompt fixture ${fixture}`, async () => {
    const filePath = path.join(PROMPT_FIXTURES, fixture);
    assert.ok(fs.existsSync(filePath), `Missing fixture: ${filePath}`);

    // Stage into .github/prompts/ so the live validator picks it up via
    // getPromptFiles(); clean up regardless of test outcome.
    const stagedPath = path.join(".github/prompts", fixture);
    fs.copyFileSync(filePath, stagedPath);
    let findings;
    try {
      findings = await lintFixture(stagedPath);
    } finally {
      fs.unlinkSync(stagedPath);
    }

    const ruleIds = new Set(findings.map((f) => f.ruleId));
    for (const must of exp.mustHave) {
      assert.ok(ruleIds.has(must), `${fixture}: expected rule "${must}" to fire. Got: [${[...ruleIds].join(", ")}]`);
    }
    for (const mustNot of exp.mustNotHave) {
      assert.ok(
        !ruleIds.has(mustNot),
        `${fixture}: expected rule "${mustNot}" NOT to fire. Got: [${[...ruleIds].join(", ")}]`,
      );
    }
  });
}
