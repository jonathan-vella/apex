#!/usr/bin/env node
/**
 * test_safe_shell.mjs — fixture-based regression test for the
 * `grep-no-fallback-in-set-e` rule added to safe-shell.mjs (Phase 1
 * of plan-optimiseGovernanceAgent).
 *
 * Run via:
 *   node --test tools/tests/scripts/test_safe_shell.mjs
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";

import { collectFiles, lintFile, RULES } from "../../scripts/safe-shell.mjs";

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

test("grep rule follows explicit errexit enable/disable transitions and resets between fences", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safe-shell-errexit-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const file = path.join(root, "fixture.md");
  fs.writeFileSync(
    file,
    [
      "```bash",
      "set +e",
      "grep -n optional missing.md",
      "set -euo pipefail",
      "grep -n required missing.md",
      "set +e",
      "grep -n optional-again missing.md",
      "```",
      "```sh",
      "grep -n separate missing.md",
      "```",
    ].join("\n"),
  );
  const findings = lintFile(file).filter((finding) => finding.rule === "grep-no-fallback-in-set-e");
  assert.equal(findings.length, 1, JSON.stringify(findings));
  assert.match(findings[0].snippet, /required/);
});

// ---------------------------------------------------------------------------
// command-portability rule (issue #425, Wave 2a)
// ---------------------------------------------------------------------------

test("compliant rg/fd/bat (guarded or absent) produces no portability findings", () => {
  const findings = lintFile(path.join(FIXTURES, "compliant-command-portability.md"));
  const portability = findings.filter((f) => f.rule === "command-portability");
  assert.deepEqual(portability, [], `expected no portability findings, got: ${JSON.stringify(portability)}`);
});

test("non-compliant bare rg/fd/bat are each flagged", () => {
  const findings = lintFile(path.join(FIXTURES, "non-compliant-command-portability.md"));
  const portability = findings.filter((f) => f.rule === "command-portability");
  const tools = portability.map((f) => f.why.split(" ")[0]).sort();
  assert.deepEqual(tools, ["bat", "fd", "rg"], `expected one finding per tool, got: ${JSON.stringify(portability)}`);
});

// ---------------------------------------------------------------------------
// agent-output-no-heredoc rule (issue #425, Wave 2b)
// ---------------------------------------------------------------------------

test("compliant snippets (no agent-output writes) produce no heredoc findings", () => {
  const findings = lintFile(path.join(FIXTURES, "compliant-agent-output-heredoc.md"));
  const hd = findings.filter((f) => f.rule === "agent-output-no-heredoc");
  assert.deepEqual(hd, [], `expected no heredoc findings, got: ${JSON.stringify(hd)}`);
});

test("non-compliant heredoc/tee/append writes to agent-output are each flagged", () => {
  const findings = lintFile(path.join(FIXTURES, "non-compliant-agent-output-heredoc.md"));
  const hd = findings.filter((f) => f.rule === "agent-output-no-heredoc");
  // 4 distinct violations: quoted heredoc, indented heredoc, tee, append redirect.
  assert.equal(hd.length, 4, `expected 4 heredoc findings, got: ${JSON.stringify(hd)}`);
  const snippets = hd.map((f) => f.snippet).join("\n");
  assert.match(snippets, /<<'EOF'/);
  assert.match(snippets, /<<-EOF/);
  assert.match(snippets, /\| tee /);
  assert.match(snippets, />> /);
});

test("node-e-double-quoted-bang flags double-quoted !identifier in node -e but allows single-quoted or script calls", () => {
  const rule = RULES.find((r) => r.id === "node-e-double-quoted-bang");
  assert.ok(rule, "node-e-double-quoted-bang rule must be registered");
  assert.equal(
    rule.pattern.test("node -e \"const fs = require('fs'); if (!fs.existsSync('a')) process.exit(1);\""),
    true,
  );
  assert.equal(rule.pattern.test('node --input-type=module --eval "if (!ok) throw new Error();"'), true);
  assert.equal(
    rule.pattern.test('node -e \'const fs = require("fs"); if (!fs.existsSync("a")) process.exit(1);\''),
    false,
  );
  assert.equal(rule.pattern.test("node tools/scripts/cost-estimate.mjs publish --draft a.tmp --output a.json"), false);
});

test("scan includes active authoring files but excludes references, archives and executed scripts", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "safe-shell-scope-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const included = [
    ".github/agents/main.agent.md",
    ".github/agents/_subagents/leaf.agent.md",
    ".github/instructions/shell.instructions.md",
    ".github/skills/example/SKILL.md",
    ".github/copilot-instructions.md",
    "AGENTS.md",
    "README.md",
  ];
  const excluded = [
    ".github/instructions/references/example.md",
    ".github/agents/README.md",
    ".github/skills/example/references/example.md",
    ".github/skills/example/templates/example.md",
    ".archive/old.agent.md",
    "tools/scripts/example.sh",
  ];
  for (const file of [...included, ...excluded]) {
    const target = path.join(root, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, "```bash\nrm -i example\n```\n");
  }
  assert.deepEqual(
    collectFiles(root)
      .map((file) => path.relative(root, file))
      .sort(),
    included.sort(),
  );
  assert.equal(lintFile(path.join(root, included[0]))[0].rule, "rm-interactive");
});
