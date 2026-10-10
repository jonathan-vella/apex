import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { spawnSync } from "node:child_process";

const script = path.resolve(import.meta.dirname, "../../scripts/init-from-template.mjs");
// Built from parts so init does not rewrite this file when run in the real repository.
const templateSlug = ["jonathan-vella", "apex-accelerator"].join("/");
const guard = `if: github.repository != '${templateSlug}' && github.event.repository.is_template != true`;

function run(root, ...args) {
  return spawnSync(process.execPath, [script, "--no-format", ...args], { cwd: root, encoding: "utf8" });
}

function write(root, file, content) {
  const target = path.join(root, file);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content);
}

function withRepo(fn) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "init-template-"));
  try {
    spawnSync("git", ["init", "-q"], { cwd: root });
    spawnSync("git", ["remote", "add", "origin", "https://github.com/example/consumer"], { cwd: root });
    fn(root);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("init rewrites documentation references but leaves template guards unchanged", () => {
  withRepo((root) => {
    const workflow = `jobs:\n  a:\n    ${guard}\n`;
    const guardTest = `assert("${templateSlug}")\n`;
    write(root, ".github/workflows/ci.yml", workflow);
    write(root, ".github/consumer-workflows/ci.yml", workflow);
    write(root, "tools/tests/scripts/test_consumer_workflows.mjs", guardTest);
    write(root, "README.md", `See https://github.com/${templateSlug}\n`);
    write(root, ".github/workflows/mixed.yml", `# https://github.com/${templateSlug}\njobs:\n  a:\n    ${guard}\n`);

    const result = run(root);
    assert.equal(result.status, 0, result.stderr);

    assert.equal(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"), workflow);
    assert.equal(fs.readFileSync(path.join(root, ".github/consumer-workflows/ci.yml"), "utf8"), workflow);
    assert.equal(
      fs.readFileSync(path.join(root, "tools/tests/scripts/test_consumer_workflows.mjs"), "utf8"),
      guardTest,
    );
    assert.equal(fs.readFileSync(path.join(root, "README.md"), "utf8"), "See https://github.com/example/consumer\n");
    assert.equal(
      fs.readFileSync(path.join(root, ".github/workflows/mixed.yml"), "utf8"),
      `# https://github.com/example/consumer\njobs:\n  a:\n    ${guard}\n`,
    );
  });
});

test("init reports initialized when only guards reference the template", () => {
  withRepo((root) => {
    write(root, ".github/workflows/ci.yml", `jobs:\n  a:\n    ${guard}\n`);
    const result = run(root);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /already initialized/);
  });
});
