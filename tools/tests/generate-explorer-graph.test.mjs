import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { collectPrompts, selectGeneratedAt } from "../scripts/generate-explorer-graph.mjs";

test("prompt collection preserves cross-root and nested same-basename identities", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "apex-prompt-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  for (const file of [
    ".github/prompts/same.prompt.md",
    "tools/apex-prompts/nested/same.prompt.md",
    "tools/tests/prompts/same.prompt.md",
  ]) {
    fs.mkdirSync(path.dirname(path.join(root, file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), '---\nagent: "01-Orchestrator"\n---\n# Resume\n');
  }
  const nodes = collectPrompts(root);
  assert.equal(nodes.length, 2);
  assert.equal(new Set(nodes.map((node) => node.id)).size, 2);
  assert.ok(nodes.every((node) => node.id.startsWith("prompt:same:")));
  const indexUrl = new URL("../scripts/_lib/workspace-index.mjs", import.meta.url).href;
  const child = spawnSync(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import {getPromptFiles} from ${JSON.stringify(indexUrl)}; console.log(JSON.stringify([...getPromptFiles().keys()]));`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  assert.equal(child.status, 0, child.stderr);
  assert.deepEqual(JSON.parse(child.stdout).sort(), [
    ".github/prompts/same.prompt.md",
    "tools/apex-prompts/nested/same.prompt.md",
  ]);
});

test("explorer includes native and attachable resume prompts with unique identities", () => {
  const prompts = collectPrompts();
  assert.ok(prompts.some((prompt) => prompt.path === ".github/prompts/apex-resume-workflow.prompt.md"));
  assert.ok(
    prompts.some((prompt) => prompt.path === "tools/apex-prompts/workflow-prompts/00-resume-workflow.prompt.md"),
  );
  assert.equal(new Set(prompts.map((prompt) => prompt.id)).size, prompts.length);
});

test("preserves generatedAt when graph content is unchanged", () => {
  const previous = { generatedAt: "2026-01-01T00:00:00.000Z", nodes: [{ id: "a" }], edges: [] };
  const next = { generatedAt: null, nodes: [{ id: "a" }], edges: [] };
  assert.equal(selectGeneratedAt(previous, next, "2026-08-21T00:00:00.000Z"), previous.generatedAt);
});

test("uses a new generatedAt when graph content changes", () => {
  const previous = { generatedAt: "2026-01-01T00:00:00.000Z", nodes: [{ id: "a" }], edges: [] };
  const next = { generatedAt: null, nodes: [{ id: "b" }], edges: [] };
  assert.equal(selectGeneratedAt(previous, next, "2026-08-21T00:00:00.000Z"), "2026-08-21T00:00:00.000Z");
});
