import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { runValidator } from "../scripts/validate-region-canonical.mjs";

function fixture(canonical, skill) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "apex-defaults-owner-"));
  const canonicalPath = path.join(dir, "copilot-instructions.md");
  const skillPath = path.join(dir, "SKILL.md");
  fs.writeFileSync(canonicalPath, canonical);
  fs.writeFileSync(skillPath, skill);
  return { canonicalPath, skillPath };
}

const CANONICAL = [
  "## Azure Defaults (canonical)",
  "### Default Regions",
  "### Required Tags (Azure Policy Enforced)",
  "### Security baseline + AVM mandate",
].join("\n");

test("passes when the skill links to canonical defaults without restating them", () => {
  const paths = fixture(CANONICAL, "See ../../copilot-instructions.md#azure-defaults-canonical\n## IaC Workflow");
  assert.equal(runValidator(paths), 0);
});

test("fails when the skill reintroduces canonical headings or region literals", () => {
  const skill = [
    "See ../../copilot-instructions.md#azure-defaults-canonical",
    "### Default Regions",
    "swedencentral",
    "technical-contact",
    "'TLS1_2'",
  ].join("\n");
  assert.equal(runValidator(fixture(CANONICAL, skill)), 1);
});
