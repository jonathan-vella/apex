#!/usr/bin/env node
/**
 * test_safe_shell.mjs — fixture-based regression test for the
 * `grep-no-fallback-in-set-e` rule added to safe-shell.mjs (Phase 1
 * of plan-optimiseGovernanceAgent).
 *
 * Run via:
 *   node --test tests/scripts/test_safe_shell.mjs
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { lintFile, RULES } from "../../tools/scripts/safe-shell.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, "fixtures/safe-shell");

test("RULES exposes the grep-no-fallback-in-set-e rule", () => {
  const rule = RULES.find((r) => r.id === "grep-no-fallback-in-set-e");
  assert.ok(rule, "rule must be registered");
  assert.equal(rule.context, "set-e");
});

test("compliant grep (|| echo / || true / piped) inside set -e does not fire", () => {
  const findings = lintFile(path.join(FIXTURES, "compliant-grep-set-e.md"));
  const greps = findings.filter((f) => f.rule === "grep-no-fallback-in-set-e");
  assert.deepEqual(greps, [], `expected no grep findings, got: ${JSON.stringify(greps)}`);
});

test("non-compliant bare grep inside set -e is flagged exactly once", () => {
  const findings = lintFile(path.join(FIXTURES, "non-compliant-grep-set-e.md"));
  const greps = findings.filter((f) => f.rule === "grep-no-fallback-in-set-e");
  assert.equal(greps.length, 1, `expected exactly 1 grep finding, got: ${JSON.stringify(greps)}`);
  assert.match(greps[0].snippet, /grep -n 'pattern' file\.md/);
});
