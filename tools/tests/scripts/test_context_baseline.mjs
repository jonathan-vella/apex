import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const TARGETS = [".github/agents", ".github/instructions", ".github/prompts", "tools/apex-prompts", ".github/skills"];
const FILE_TARGETS = [
  ".github/model-catalog.json",
  "tools/registry/agent-registry.json",
  "infra/bicep/AGENTS.md",
  "infra/terraform/AGENTS.md",
];

function fixture(context) {
  const root = mkdtempSync(path.join(tmpdir(), "apex baseline-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(path.join(root, "tools/scripts"), { recursive: true });
  for (const name of ["snapshot-agent-context.sh", "diff-context-baseline.sh"]) {
    cpSync(path.join(ROOT, "tools/scripts", name), path.join(root, "tools/scripts", name));
  }
  for (const target of TARGETS) {
    mkdirSync(path.join(root, target), { recursive: true });
    writeFileSync(path.join(root, target, "sample.md"), "original\n");
  }
  writeFileSync(path.join(root, "AGENTS.md"), "repository rules\n");
  writeFileSync(path.join(root, ".github/copilot-instructions.md"), "runtime rules\n");
  for (const target of FILE_TARGETS) {
    mkdirSync(path.dirname(path.join(root, target)), { recursive: true });
    writeFileSync(path.join(root, target), target.endsWith(".json") ? "{}\n" : "folder rules\n");
  }
  for (const args of [
    ["init", "--quiet"],
    ["add", "."],
    [
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.com",
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "-m",
      "fixture",
    ],
  ]) {
    const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
  }
  return root;
}

function run(root, script, args = []) {
  return spawnSync("bash", [path.join(root, "tools/scripts", script), ...args], {
    cwd: tmpdir(),
    encoding: "utf8",
  });
}

test("snapshot and diff use the repository root and include Copilot instructions", (context) => {
  const root = fixture(context);
  const snapshot = run(root, "snapshot-agent-context.sh", ["before"]);
  assert.equal(snapshot.status, 0, snapshot.stderr);
  const baseline = path.join(root, "agent-output/_baselines/before");
  const manifest = JSON.parse(readFileSync(path.join(baseline, "manifest.json"), "utf8"));
  assert.equal(manifest.file_count, TARGETS.length + FILE_TARGETS.length + 2);
  assert.match(manifest.git_sha, /^[a-f0-9]{40}$/);
  assert.ok(existsSync(path.join(baseline, "SHA256SUMS")));
  assert.ok(manifest.backed_up_targets.includes(".github/copilot-instructions.md"));
  assert.ok(manifest.backed_up_targets.includes(".github/prompts"));
  assert.equal(existsSync(path.join(root, "tools/agent-output")), false);
  const unchanged = run(root, "diff-context-baseline.sh", ["--baseline", "before"]);
  assert.equal(unchanged.status, 0, unchanged.stderr);
  assert.match(readFileSync(path.join(baseline, "diff-report.md"), "utf8"), /No changes detected/);
  writeFileSync(path.join(root, ".github/copilot-instructions.md"), "updated runtime rules\n");
  const changed = run(root, "diff-context-baseline.sh", ["--baseline", "before"]);
  assert.equal(changed.status, 0, changed.stderr);
  assert.match(
    readFileSync(path.join(baseline, "diff-report.md"), "utf8"),
    /Modified: `.github\/copilot-instructions.md`/,
  );
});

test("snapshot refuses missing required inputs and does not leave a baseline", (context) => {
  const root = fixture(context);
  rmSync(path.join(root, ".github/copilot-instructions.md"));
  const result = run(root, "snapshot-agent-context.sh", ["missing"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /required snapshot target missing/);
  assert.equal(existsSync(path.join(root, "agent-output/_baselines/missing")), false);
});

test("snapshot rejects path traversal, extra labels and overwriting an existing baseline", (context) => {
  const root = fixture(context);
  for (const args of [["../escape"], ["valid", "extra"]]) {
    assert.notEqual(run(root, "snapshot-agent-context.sh", args).status, 0);
  }
  assert.equal(run(root, "snapshot-agent-context.sh", ["before"]).status, 0);
  assert.notEqual(run(root, "snapshot-agent-context.sh", ["before"]).status, 0);
  assert.notEqual(run(root, "diff-context-baseline.sh", ["--baseline", "../escape"]).status, 0);
});

test("snapshot records working changes and diff refuses tampered baseline content", (context) => {
  const root = fixture(context);
  writeFileSync(path.join(root, "AGENTS.md"), "changed repository rules\n");
  assert.equal(run(root, "snapshot-agent-context.sh", ["dirty"]).status, 0);
  const baseline = path.join(root, "agent-output/_baselines/dirty");
  assert.match(readFileSync(path.join(baseline, "worktree.patch"), "utf8"), /changed repository rules/);
  writeFileSync(path.join(baseline, "AGENTS.md"), "tampered\n");
  const result = run(root, "diff-context-baseline.sh", ["--baseline", "dirty"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /baseline hashes missing or invalid/);
});

test("snapshot refuses empty required directories", (context) => {
  const root = fixture(context);
  rmSync(path.join(root, ".github/agents/sample.md"));
  const result = run(root, "snapshot-agent-context.sh", ["empty"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /required snapshot target empty/);
});

test("diff rejects verified historical snapshots that did not capture native prompts", (context) => {
  const root = fixture(context);
  const snapshotPath = path.join(root, "tools/scripts/snapshot-agent-context.sh");
  writeFileSync(snapshotPath, readFileSync(snapshotPath, "utf8").replace('  ".github/prompts"\n', ""));
  assert.equal(run(root, "snapshot-agent-context.sh", ["legacy"]).status, 0);
  const diff = run(root, "diff-context-baseline.sh", ["--baseline", "legacy"]);
  assert.notEqual(diff.status, 0);
  assert.match(diff.stderr, /\.github\/prompts was not captured by this baseline/);
});
