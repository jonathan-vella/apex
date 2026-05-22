#!/usr/bin/env node
/**
 * test_post_write_validation.mjs — guard the post-write validation
 * contract added for issue #425.
 *
 * The actual validation runs inside agent execution (one-liner shape
 * checks after each artifact write), so the executable invariant is
 * documentary: the table must exist in azure-artifacts SKILL.md with
 * rows for every artifact type, and the shared operating frame must
 * link to it so all main step agents inherit the rule.
 *
 * Run via:
 *   node --test tests/scripts/test_post_write_validation.mjs
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");

const SKILL = path.join(ROOT, ".github/skills/azure-artifacts/SKILL.md");
const OPFRAME = path.join(ROOT, ".github/instructions/agent-operating-frame.instructions.md");

test("azure-artifacts SKILL.md declares the Post-write validation section", () => {
  const body = fs.readFileSync(SKILL, "utf8");
  assert.match(body, /^## Post-write validation$/m, "missing H2");
});

test("Post-write validation table covers every artifact type", () => {
  const body = fs.readFileSync(SKILL, "utf8");
  // The required artifact-type rows. Each row references the verifier
  // command for that file type. Markdown delegates to lefthook.
  const required = [
    { type: "*.json", verifier: "python -m json.tool" },
    { type: "*.bicep", verifier: "bicep build --stdout" },
    { type: "*.tf", verifier: "terraform fmt -check" },
    { type: "challenge-findings-*.json", verifier: "validate-challenger-findings.mjs" },
    { type: "challenge-findings-*-decisions.json", verifier: "validate-challenge-findings-decisions.mjs" },
    { type: "*.md", verifier: "lefthook" },
  ];
  for (const { type, verifier } of required) {
    const escapedType = type.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    // Allow optional qualifier text (e.g. "(sidecar JSON)") between the
    // backticked type and the closing pipe — the table is human-readable
    // and may carry an annotation for non-obvious rows.
    const row = new RegExp(`\\|\\s*\`${escapedType}\`[^|]*\\|.*${verifier}`);
    assert.match(body, row, `Post-write validation table missing row for ${type} (verifier: ${verifier})`);
  }
});

test("Operating frame links to the Post-write validation section", () => {
  const body = fs.readFileSync(OPFRAME, "utf8");
  assert.match(body, /## Validate every artifact after writing/, "missing H2 in operating frame");
  // Anchor-bearing link to the SKILL section so every step agent
  // inherits the rule via the shared frame.
  assert.match(
    body,
    /azure-artifacts\/SKILL\.md#post-write-validation/,
    "missing anchored link to azure-artifacts post-write-validation",
  );
});
