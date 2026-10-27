// Smoke test for the consolidated tools/scripts/validate-models.mjs.
//
// Guards the --only dispatcher (consistency | deprecated): each mode must exit 0
// against a valid workspace, an unknown mode must exit 2, and the npm aliases
// must remain wired to the consolidated script.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  DEFAULT_MODEL_CATALOG,
  normalizeModel,
  normalizeModels,
  modelLabels,
  catalogModelLabel,
} from "../scripts/_lib/model-helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const script = path.join(repoRoot, "tools", "scripts", "validate-models.mjs");

const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "apex-foundation-models-"));

function setupFixture({ models = ["gpt-5.6-sol"], registryModels = models, prompt, handoff } = {}) {
  for (const dir of [".github/agents", ".github/prompts", "tools/registry"])
    mkdirSync(path.join(fixtureRoot, dir), { recursive: true });
  const frontmatter = { name: "Fixture", tools: ["read"], agents: [], "user-invocable": true };
  if (models !== null) frontmatter.model = models;
  if (handoff !== undefined) frontmatter.handoffs = [{ agent: "Fixture", model: handoff }];
  writeFileSync(
    path.join(fixtureRoot, ".github/agents/fixture.agent.md"),
    `---\n${JSON.stringify(frontmatter)}\n---\n# Fixture`,
  );
  writeFileSync(
    path.join(fixtureRoot, "tools/registry/agent-registry.json"),
    JSON.stringify({
      agents: {
        fixture: {
          agent: ".github/agents/fixture.agent.md",
          ...(registryModels !== null ? { model: registryModels } : {}),
        },
      },
    }),
  );
  const promptPath = path.join(fixtureRoot, ".github/prompts/fixture.prompt.md");
  rmSync(promptPath, { force: true });
  if (prompt !== undefined) writeFileSync(promptPath, `---\n${JSON.stringify(prompt)}\n---\nUse inputs.`);
}

function run(args) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      cwd: fixtureRoot,
      encoding: "utf8",
      stdio: "pipe",
    });
    return { code: 0, stdout };
  } catch (err) {
    return { code: err.status ?? 1, stdout: `${err.stdout ?? ""}${err.stderr ?? ""}` };
  }
}

let pkg;
before(() => {
  pkg = JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8"));
  setupFixture();
});
after(() => rmSync(fixtureRoot, { recursive: true, force: true }));

describe("default model catalog metadata", () => {
  it("retains authorized family labels for legacy fixture validation", () => {
    assert.ok(Object.hasOwn(DEFAULT_MODEL_CATALOG.models, "GPT-5.6 Terra (copilot)"));
    assert.ok(Object.hasOwn(DEFAULT_MODEL_CATALOG.models, "Claude Sonnet 5.5 (copilot)"));
    assert.ok(Object.hasOwn(DEFAULT_MODEL_CATALOG.models, "GPT-6 Luna (copilot)"));
    assert.equal(Object.hasOwn(DEFAULT_MODEL_CATALOG.models, "GPT-5.6-Terra"), false);
  });
});

describe("ordered model normalization", () => {
  it("strict label validation preserves exact names while handoff qualification is contextual", () => {
    assert.deepEqual(modelLabels(["gpt-5.6-sol", "gpt-5.6-luna (copilot)"]), ["gpt-5.6-sol", "gpt-5.6-luna (copilot)"]);
    assert.equal(catalogModelLabel("gpt-5.6-luna (copilot)"), "gpt-5.6-luna (copilot)");
    assert.equal(catalogModelLabel("gpt-5.6-luna (copilot)", { handoff: true }), "gpt-5.6-luna");
    assert.throws(() => modelLabels(null), /non-empty/);
  });
  it("preserves every fallback and priority while retaining the scalar helper API", () => {
    const models = ["gpt-5.6-sol", "gpt-5.6-luna (copilot)", "gpt-5.6-terra"];
    assert.deepEqual(normalizeModels(models), ["gpt-5.6-sol", "gpt-5.6-luna", "gpt-5.6-terra"]);
    assert.equal(normalizeModel(models), "gpt-5.6-sol");
    assert.equal(models[1], "gpt-5.6-luna (copilot)");
    assert.deepEqual(normalizeModels(undefined), []);
  });
  it("rejects empty or malformed fallbacks instead of silently dropping them", () => {
    for (const value of [[], ["gpt-5.6-sol", false], ["gpt-5.6-sol", ""], ["gpt-5.6-sol", null]]) {
      assert.throws(() => normalizeModels(value), /non-empty/);
    }
  });
});

describe("validate-models dispatcher", () => {
  for (const mode of ["consistency", "deprecated"]) {
    it(`--only=${mode} exits 0 against an isolated valid workspace`, () => {
      setupFixture();
      const { code, stdout } = run([`--only=${mode}`]);
      assert.equal(code, 0, `mode ${mode} exited ${code}:\n${stdout}`);
    });
  }

  it("no flag runs all modes and exits 0", () => {
    setupFixture();
    const { code } = run([]);
    assert.equal(code, 0);
  });

  it("accepts unpinned active definitions", () => {
    setupFixture({ models: null, registryModels: null });
    assert.equal(run(["--only=consistency"]).code, 0);
  });

  it("rejects a legacy model pin present in only one source", () => {
    setupFixture({ models: ["gpt-5.6-sol"], registryModels: null });
    assert.equal(run(["--only=consistency"]).code, 1);
    setupFixture({ models: null, registryModels: ["gpt-5.6-sol"] });
    assert.equal(run(["--only=consistency"]).code, 1);
  });

  it("an unknown --only value exits 2", () => {
    const { code } = run(["--only=bogus"]);
    assert.equal(code, 2);
  });
});

describe("model CLI negatives", () => {
  it("rejects fallback order and secondary-model registry drift", () => {
    setupFixture({ models: ["gpt-5.6-sol", "gpt-5.6-luna"], registryModels: ["gpt-5.6-sol"] });
    assert.equal(run(["--only=consistency"]).code, 1);
    setupFixture({ models: ["gpt-5.6-sol", "gpt-5.6-luna"], registryModels: ["gpt-5.6-luna", "gpt-5.6-sol"] });
    assert.equal(run(["--only=consistency"]).code, 1);
  });
});

describe("validate-models npm aliases", () => {
  const expected = {
    "validate:model-consistency": "--only=consistency",
    "validate:deprecated-models": "--only=deprecated",
  };
  for (const [alias, flag] of Object.entries(expected)) {
    it(`${alias} points at validate-models.mjs ${flag}`, () => {
      const cmd = pkg.scripts[alias] ?? "";
      assert.match(cmd, /validate-models\.mjs/, `${alias} not repointed: ${cmd}`);
      assert.ok(cmd.includes(flag), `${alias} missing ${flag}: ${cmd}`);
    });
  }
});
