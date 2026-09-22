import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const command = fileURLToPath(new URL("../../scripts/check-publication-scope.mjs", import.meta.url));
function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "apex-hook-test-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const git = (...args) => execFileSync("git", args, { cwd: root, encoding: "utf8" });
  const write = (name, content) => {
    const target = path.join(root, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  };
  git("init", "-q");
  write("node_modules/markdownlint-cli2/package.json", JSON.stringify({ bin: { "markdownlint-cli2": "cli.cjs" } }));
  write(
    "node_modules/markdownlint-cli2/cli.cjs",
    'const fs=require("fs");const paths=process.argv.slice(2).filter(arg=>arg!=="--no-globs");process.exit(paths.some(file=>fs.readFileSync(file,"utf8").includes("BAD"))?7:0);',
  );
  write(
    "tools/scripts/validate-artifacts.mjs",
    'import fs from "node:fs";if(fs.existsSync("agent-output/private/06-deployment-summary.md"))process.exit(8);if(fs.readFileSync("agent-output/tracked/06-deployment-summary.md","utf8").includes("BAD"))process.exit(9);',
  );
  write(
    "tools/scripts/validate-challenger-presence.mjs",
    'import fs from "node:fs";if(!fs.existsSync("agent-output/tracked/findings.json"))process.exit(10);',
  );
  write("agent-output/tracked/06-deployment-summary.md", "GOOD\n");
  write("agent-output/tracked/findings.json", "{}\n");
  write(".github/skills/apex-azure-artifacts/templates/example.md", "template\n");
  git("add", "tools", "agent-output", ".github");
  return {
    root,
    git,
    write,
    run: (mode) => spawnSync(process.execPath, [command, mode], { cwd: root, encoding: "utf8" }),
  };
}

test("publication hooks validate index bytes and ignore unrelated untracked artifacts", (context) => {
  const { git, write, run } = fixture(context);
  write("agent-output/private/06-deployment-summary.md", "BAD\n");
  write("agent-output/tracked/06-deployment-summary.md", "BAD unstaged\n");
  const before = git("write-tree");
  assert.equal(run("artifacts").status, 0);
  write("a file with spaces.md", "GOOD\n");
  git("add", "a file with spaces.md");
  write("a file with spaces.md", "BAD unstaged\n");
  assert.equal(run("markdown").status, 0);
  git("add", "a file with spaces.md");
  assert.equal(run("markdown").status, 7);
  assert.notEqual(git("write-tree"), before);
  const staged = git("write-tree");
  run("artifacts");
  assert.equal(git("write-tree"), staged);
});

test("template triggers retain tracked artifact checks and propagate each validator failure", (context) => {
  const { git, write, run } = fixture(context);
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-qm",
    "fixture",
  );
  write(".github/skills/apex-azure-artifacts/templates/example.md", "changed\n");
  git("add", ".github");
  assert.equal(run("artifacts").status, 0);
  write("agent-output/tracked/06-deployment-summary.md", "BAD\n");
  git("add", "agent-output/tracked/06-deployment-summary.md");
  assert.equal(run("artifacts").status, 9);
  write("agent-output/tracked/06-deployment-summary.md", "GOOD\n");
  git("add", "agent-output/tracked/06-deployment-summary.md");
  git("rm", "-q", "agent-output/tracked/findings.json");
  assert.equal(run("artifacts").status, 10);
});

test("template-only changes check unchanged tracked artifacts and missing local tools fail closed", (context) => {
  const { root, git, write, run } = fixture(context);
  write("agent-output/tracked/06-deployment-summary.md", "BAD committed fixture\n");
  git("add", "agent-output");
  git(
    "-c",
    "user.name=Fixture",
    "-c",
    "user.email=fixture@example.invalid",
    "-c",
    "core.hooksPath=/dev/null",
    "commit",
    "-qm",
    "fixture",
  );
  write(".github/skills/apex-azure-artifacts/templates/example.md", "changed template only\n");
  git("add", ".github");
  write("agent-output/tracked/06-deployment-summary.md", "GOOD unstaged cannot hide bad tracked bytes\n");
  assert.equal(run("artifacts").status, 9);
  fs.rmSync(path.join(root, "node_modules/markdownlint-cli2/cli.cjs"));
  assert.equal(run("markdown").status, 1);
  fs.rmSync(path.join(root, "node_modules"), { recursive: true });
  assert.equal(run("artifacts").status, 1);
});
