import assert from "node:assert/strict";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { loadValidator } from "../../scripts/_lib/ajv-validator.mjs";

const root = new URL("../../../", import.meta.url);
const skillsDir = new URL(".github/skills/", root);
const manifest = JSON.parse(readFileSync(new URL("tools/registry/upstream-skill-pins.json", root), "utf8"));

const frontmatter = (name) => readFileSync(new URL(`${name}/SKILL.md`, skillsDir), "utf8").split(/^---$/m)[1] ?? "";

test("upstream skill pins match their schema", () => {
  const validate = loadValidator(fileURLToPath(new URL("tools/schemas/upstream-skill-pins.schema.json", root)));
  assert.ok(validate(manifest), JSON.stringify(validate.errors, null, 2));
});

test("every Microsoft-derived skill is pinned exactly once", () => {
  const derived = readdirSync(skillsDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(new URL(`${entry.name}/SKILL.md`, skillsDir)))
    .map((entry) => entry.name)
    .filter((name) => /^\s+author: Microsoft\s*$/m.test(frontmatter(name)))
    .sort();
  const pinned = manifest.skills.map((skill) => skill.apex);
  assert.equal(new Set(pinned).size, pinned.length, "duplicate APEX skill entries");
  assert.deepEqual([...pinned].sort(), derived);
});

test("imports come from the skill's upstream sources and exist locally", () => {
  const plugins = manifest.upstream.plugins;
  for (const skill of manifest.skills) {
    assert.ok(!skill.plugin || plugins.includes(skill.plugin), `${skill.apex}: unknown plugin ${skill.plugin}`);
    const targets = skill.imports.map(({ to }) => to);
    assert.equal(new Set(targets).size, targets.length, `${skill.apex}: duplicate import targets`);
    for (const { from, to } of skill.imports) {
      assert.ok(skill.upstream.includes(from.split("/")[0]), `${skill.apex}: ${from} is outside its upstream skills`);
      assert.ok(existsSync(new URL(`${skill.apex}/${to}`, skillsDir)), `${skill.apex}: missing ${to}`);
    }
  }
});

test("defect probes target pinned upstream skills and compile", () => {
  const primary = manifest.upstream.primary_plugin;
  const upstreamSkills = new Set(
    manifest.skills.flatMap((skill) => skill.upstream.map((name) => `${skill.plugin ?? primary}/${name}`)),
  );
  const seen = new Set();
  for (const probe of manifest.defect_probes) {
    const skill = `${probe.plugin ?? primary}/${probe.path.split("/")[0]}`;
    assert.ok(upstreamSkills.has(skill), `${probe.id}: ${skill} is not a pinned skill`);
    assert.doesNotThrow(() => new RegExp(probe.pattern, probe.flags ?? ""), probe.id);
    const key = `${probe.id}:${skill}:${probe.path}`;
    assert.ok(!seen.has(key), `duplicate probe ${key}`);
    seen.add(key);
  }
});
