import assert from "node:assert/strict";
import { test } from "node:test";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadProjectControls, validateProjectControls } from "../../scripts/validate-vnext-project-controls.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const baseline = loadProjectControls(root);
const mutate = (change) => {
  const model = structuredClone(baseline);
  change(model);
  return validateProjectControls(model);
};
const hasRule = (findings, ruleId) => findings.some((finding) => finding.ruleId === ruleId);

test("project-control model satisfies the offline contract", () => {
  assert.deepEqual(validateProjectControls(baseline), []);
});

test("rejects a duplicate requirement ID", () => {
  const findings = mutate((model) => {
    model.documents["PRD.md"] += "\n### REQ-DIST-001: Duplicate\n";
  });
  assert.ok(hasRule(findings, "requirement.unique"));
});

test("rejects an unknown requirement reference", () => {
  const findings = mutate((model) => {
    model.documents["ROADMAP.md"] += "\n`REQ-UNKNOWN-999`\n";
  });
  assert.ok(hasRule(findings, "requirement.reference"));
});

test("rejects a broken local link", () => {
  const findings = mutate((model) => {
    model.localLinks.push({ source: "docs/vnext/README.md", target: "missing.md", exists: false });
  });
  assert.ok(hasRule(findings, "link.local"));
});

test("rejects a changed Phase 0A tree", () => {
  const findings = mutate((model) => {
    model.phase0aDigest = "changed";
  });
  assert.ok(hasRule(findings, "phase-0a.frozen"));
});

test("rejects a missing required work-item field", () => {
  const findings = mutate((model) => {
    model.workItemForm.body = model.workItemForm.body.filter((field) => field.id !== "evidence");
  });
  assert.ok(hasRule(findings, "work-item.required-field"));
});

test("rejects missing bug regression provenance", () => {
  const findings = mutate((model) => {
    model.bugForm.body = model.bugForm.body.filter((field) => field.id !== "integration-head");
  });
  assert.ok(hasRule(findings, "bug.required-field"));
});
