import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createAjv } from "../scripts/_lib/ajv-validator.mjs";

import {
  collectAgents,
  collectSubagents,
  collectSkills,
  collectPrompts,
  selectGeneratedAt,
} from "../scripts/generate-explorer-graph.mjs";

test("graph CLI generates and validates an explicit output without a site directory", (context) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "apex-graph-export-"));
  context.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const output = path.join(directory, "nested", "graph.json");
  const generator = new URL("../scripts/generate-explorer-graph.mjs", import.meta.url);
  const validator = new URL("../scripts/validate-explorer-graph.mjs", import.meta.url);
  const generated = spawnSync(process.execPath, [generator.pathname, "--output", output], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(generated.status, 0, generated.stderr);
  const validated = spawnSync(process.execPath, [validator.pathname, "--input", output], {
    cwd: directory,
    encoding: "utf8",
  });
  assert.equal(validated.status, 0, validated.stderr);
  const invalid = spawnSync(process.execPath, [generator.pathname, "--unknown"], { cwd: directory, encoding: "utf8" });
  assert.notEqual(invalid.status, 0);
});

test("agent and skill collectors preserve invocation flags, hints and declared context", (context) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "apex-invocation-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const variants = [
    { name: "defaults", fields: "", invocable: true, disabled: false, hint: null, context: null },
    { name: "hidden", fields: "user-invocable: false\n", invocable: false, disabled: false, hint: null, context: null },
    {
      name: "manual",
      fields: 'user-invocable: true\ndisable-model-invocation: true\nargument-hint: "scope"\ncontext: fork\n',
      invocable: true,
      disabled: true,
      hint: "scope",
      context: "fork",
    },
    {
      name: "disabled",
      fields: "user-invocable: false\ndisable-model-invocation: true\n",
      invocable: false,
      disabled: true,
      hint: null,
      context: null,
    },
  ];
  for (const variant of variants) {
    for (const relative of [
      `.github/agents/${variant.name}.agent.md`,
      `.github/agents/_subagents/${variant.name}.agent.md`,
      `.github/skills/${variant.name}/SKILL.md`,
    ]) {
      const file = path.join(root, relative);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, `---\nname: ${variant.name}\n${variant.fields}---\n# Fixture\n`);
    }
  }
  for (const collect of [collectAgents, collectSubagents, collectSkills]) {
    const nodes = collect(root);
    assert.equal(nodes.length, variants.length);
    for (const variant of variants) {
      const node = nodes.find((entry) => entry.label === variant.name);
      assert.equal(node.meta.invocable, variant.invocable);
      assert.equal(node.meta.disableModelInvocation, variant.disabled);
      assert.equal(node.meta.argumentHint, variant.hint);
      assert.equal(node.meta.context, variant.context);
      assert.ok(fs.existsSync(path.join(root, node.path)));
    }
  }
});

test("explorer schema validates invocation metadata without constraining unrelated metadata", () => {
  const schema = JSON.parse(fs.readFileSync(new URL("../schemas/explorer-graph.schema.json", import.meta.url), "utf8"));
  const validate = createAjv().compile(schema.properties.nodes.items.properties.meta);
  for (const metadata of [
    {},
    { invocable: true, disableModelInvocation: false, argumentHint: null, context: null },
    { invocable: false, disableModelInvocation: true, argumentHint: "scope", context: "fork" },
    { model: "unchanged", skills: [], applyTo: "**/*.md" },
  ]) {
    assert.equal(validate(metadata), true, JSON.stringify(validate.errors));
  }
  for (const metadata of [
    { invocable: "false" },
    { disableModelInvocation: "true" },
    { argumentHint: false },
    { context: {} },
  ]) {
    assert.equal(validate(metadata), false, JSON.stringify(metadata));
  }
});

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
