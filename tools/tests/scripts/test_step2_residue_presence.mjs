import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("../../scripts/validate-challenger-presence.mjs", import.meta.url));

test("CI flags scratch and failed cost files only once Step 2 is complete", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "apex-step2-residue-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const project = path.join(root, "agent-output/demo");
  mkdirSync(project, { recursive: true });
  writeFileSync(path.join(project, "02-waf-research.tmp.md"), "scratch");
  writeFileSync(path.join(project, "02-cost-estimate-rev2.json"), '{"status":"FAILED"}');
  const state = (status) =>
    writeFileSync(path.join(project, "00-session-state.json"), JSON.stringify({ steps: { 2: { status } } }));
  const run = () => spawnSync(process.execPath, [script], { cwd: root, encoding: "utf8" });

  state("in_progress");
  assert.equal(run().status, 0);

  state("complete");
  const flagged = run();
  assert.equal(flagged.status, 1);
  assert.match(flagged.stdout + flagged.stderr, /02-waf-research\.tmp\.md: scratch file/);
  assert.match(flagged.stdout + flagged.stderr, /02-cost-estimate-rev2\.json: cost estimate with status FAILED/);

  rmSync(path.join(project, "02-waf-research.tmp.md"));
  mkdirSync(path.join(project, "_meta"));
  renameSync(path.join(project, "02-cost-estimate-rev2.json"), path.join(project, "_meta/02-cost-estimate-rev2.json"));
  assert.equal(run().status, 0);
});
