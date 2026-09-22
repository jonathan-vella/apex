import assert from "node:assert/strict";
import test from "node:test";
import { renderHandoff, writeHandoff } from "../../scripts/render-session-handoff.mjs";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ARTIFACT_HEADINGS } from "../../scripts/_lib/artifact-headings.mjs";

const view = () => ({
  project: "synthetic",
  session: {
    steps: { 4: { status: "complete" }, 5: { status: "pending" } },
    decisions: { iac_tool: "Bicep" },
    open_findings: [],
    review_selections: {},
    effective_reviews: {},
  },
  artifacts: [],
});
const options = { owner: "06b-Bicep CodeGen", operation: "code-generation only" };

test("handoff refuses dangling symlinks and competing writers", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "handoff-write-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const destination = path.join(directory, "handoff.md");
  const outside = path.join(directory, "unexpected.md");
  fs.symlinkSync(outside, destination);
  assert.throws(() => writeHandoff(destination, "new\n"), /symlink/);
  assert.ok(!fs.existsSync(outside));
  fs.unlinkSync(destination);
  fs.writeFileSync(`${destination}.write-lock`, "other writer");
  assert.throws(() => writeHandoff(destination, "new\n"));
  assert.ok(!fs.existsSync(destination));
});

test("handoff derives exact headings and preserves operation limits", () => {
  const text = renderHandoff(view(), options);
  assert.deepEqual(
    text.split("\n").filter((line) => line.startsWith("## ")),
    ARTIFACT_HEADINGS["00-handoff.md"],
  );
  assert.ok(text.split("\n").length < 60);
  assert.match(text, /grants no new approval/);
  assert.match(text, /Step 5: pending/);
});
test("handoff refuses evidence failure and overflow instead of dropping blockers", () => {
  const missingPath = view();
  missingPath.session.open_findings = ["Operator VPN route missing"];
  assert.match(renderHandoff(missingPath, options), /Operator VPN route missing/);
  const invalid = view();
  invalid.session.effective_reviews[4] = { status: "invalid" };
  assert.throws(() => renderHandoff(invalid, options), /invalid/);
  const overflow = view();
  overflow.session.open_findings = Array.from({ length: 60 }, (_, index) => `must_fix: ${index}`);
  assert.throws(() => renderHandoff(overflow, options), /exceeds limit/);
});
