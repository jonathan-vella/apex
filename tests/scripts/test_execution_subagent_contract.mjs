#!/usr/bin/env node
/**
 * test_execution_subagent_contract.mjs — guard the
 * `execution-subagent.prompt.md` template added for issue #425 Wave 3a.
 *
 * The contract targets runtime subagent-invocation prompts (parent → child)
 * and is documentary; the executable invariant is structural — the
 * template file must exist with the three required H2 slots in order.
 *
 * Run via:
 *   node --test tests/scripts/test_execution_subagent_contract.mjs
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../..");
const TEMPLATE = path.join(ROOT, "tools/apex-prompts/utility-prompts/execution-subagent.prompt.md");

const REQUIRED_H2S = ["## Inputs", "## Activities", "## Outputs"];

test("execution-subagent prompt template exists", () => {
  assert.ok(fs.existsSync(TEMPLATE), `missing template: ${TEMPLATE}`);
});

test("template declares the three required H2 slots in order", () => {
  const body = fs.readFileSync(TEMPLATE, "utf8");
  const lines = body.split(/\r?\n/);
  // Collect H2 headings outside code fences.
  let inFence = false;
  const h2s = [];
  for (const line of lines) {
    if (/^```/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (!inFence && /^## /.test(line)) {
      h2s.push(line.trim());
    }
  }
  // Verify required slots appear in the listed order (extras allowed
  // after the last required H2; see azure-artifacts anchor rule).
  let cursor = 0;
  for (const slot of REQUIRED_H2S) {
    const idx = h2s.indexOf(slot, cursor);
    assert.notEqual(idx, -1, `missing required H2: ${slot}`);
    cursor = idx + 1;
  }
});

test("authoring instructions reference the template", () => {
  const auth = path.join(ROOT, ".github/instructions/agent-authoring.instructions.md");
  const body = fs.readFileSync(auth, "utf8");
  assert.match(body, /Execution-subagent invocation contract/, "missing H3 in agent-authoring");
  assert.match(body, /apex-prompts\/utility-prompts\/execution-subagent\.prompt\.md/, "missing link to template");
});
