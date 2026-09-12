// Smoke test for the consolidated tools/scripts/validate-models.mjs.
//
// Guards the --only dispatcher (catalog | consistency | deprecated) and the
// merge of the three former model validators: each mode must exit 0 against
// the current repository, an unknown mode must exit 2, and the npm aliases
// must remain wired to the consolidated script.

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, copyFileSync, rmSync } from "node:fs";
import os from "node:os";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadValidator } from "../scripts/_lib/ajv-validator.mjs";
import { normalizeModel, normalizeModels, modelLabels, catalogModelLabel } from "../scripts/_lib/model-helpers.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..", "..");
const script = path.join(repoRoot, "tools", "scripts", "validate-models.mjs");

const fixtureRoot = mkdtempSync(path.join(os.tmpdir(), "apex-foundation-models-"));
const fixtureCatalog = {
  $schema: "../tools/schemas/model-catalog.schema.json",
  description: "Isolated model contract fixture",
  models: {
    "gpt-5.6-sol": {
      vendor: "OpenAI",
      tier: null,
      released: null,
      deprecated: false,
      provenance: { label_source: "user-confirmed", metadata_status: "unknown" },
    },
    "GPT-5.6-Luna": { vendor: "OpenAI", tier: "standard", released: "2026-07", deprecated: false },
    "GPT-5.4 mini": { vendor: "OpenAI", tier: "mini", released: "2026-03", deprecated: false },
    "GPT-5.4": { vendor: "OpenAI", tier: "standard", released: "2026-03", deprecated: true },
  },
  governance: { source_of_truth: "frontmatter", rules: [] },
  assignments: { generated: true, agents: {}, subagents: {} },
};

function setupFixture({ models = ["gpt-5.6-sol"], registryModels = models, prompt, handoff } = {}) {
  for (const dir of [".github/agents", ".github/prompts", "tools/registry", "tools/schemas"])
    mkdirSync(path.join(fixtureRoot, dir), { recursive: true });
  copyFileSync(
    path.join(repoRoot, "tools/schemas/model-catalog.schema.json"),
    path.join(fixtureRoot, "tools/schemas/model-catalog.schema.json"),
  );
  writeFileSync(path.join(fixtureRoot, ".github/model-catalog.json"), JSON.stringify(fixtureCatalog));
  const frontmatter = { name: "Fixture", model: models, tools: ["read"], agents: [], "user-invocable": true };
  if (handoff !== undefined) frontmatter.handoffs = [{ agent: "Fixture", model: handoff }];
  writeFileSync(
    path.join(fixtureRoot, ".github/agents/fixture.agent.md"),
    `---\n${JSON.stringify(frontmatter)}\n---\n# Fixture`,
  );
  writeFileSync(
    path.join(fixtureRoot, "tools/registry/agent-registry.json"),
    JSON.stringify({ agents: { fixture: { agent: ".github/agents/fixture.agent.md", model: registryModels } } }),
  );
  const promptPath = path.join(fixtureRoot, ".github/prompts/fixture.prompt.md");
  rmSync(promptPath, { force: true });
  if (prompt !== undefined) writeFileSync(promptPath, `---\n${JSON.stringify(prompt)}\n---\nUse inputs.`);
  execFileSync(process.execPath, [path.join(repoRoot, "tools/scripts/generate-model-catalog.mjs")], {
    cwd: fixtureRoot,
    stdio: "pipe",
  });
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

describe("model catalog metadata", () => {
  const catalog = fixtureCatalog;
  const validate = loadValidator(path.join(repoRoot, "tools/schemas/model-catalog.schema.json"));

  it("accepts exact Sol label with explicit unknown metadata and existing mini tier", () => {
    assert.equal(validate(catalog), true, JSON.stringify(validate.errors));
    assert.equal(catalog.models["gpt-5.6-sol"].released, null);
    assert.equal(catalog.models["gpt-5.6-sol"].tier, null);
    assert.equal(catalog.models["GPT-5.6-Sol"], undefined);
    assert.equal(catalog.models["GPT-5.4 mini"].tier, "mini");
  });

  it("requires provenance for unknown metadata without accepting invented tiers", () => {
    const copy = structuredClone(catalog);
    delete copy.models["gpt-5.6-sol"].provenance;
    assert.equal(validate(copy), false);
    copy.models["gpt-5.6-sol"].provenance = catalog.models["gpt-5.6-sol"].provenance;
    copy.models["gpt-5.6-sol"].tier = "expensive";
    assert.equal(validate(copy), false);
  });
});

describe("ordered model normalization", () => {
  it("strict label validation preserves exact names while handoff qualification is contextual", () => {
    assert.deepEqual(modelLabels(["gpt-5.6-sol", "GPT-5.6-Luna (copilot)"]), ["gpt-5.6-sol", "GPT-5.6-Luna (copilot)"]);
    assert.equal(catalogModelLabel("GPT-5.6-Luna (copilot)"), "GPT-5.6-Luna (copilot)");
    assert.equal(catalogModelLabel("GPT-5.6-Luna (copilot)", { handoff: true }), "GPT-5.6-Luna");
    assert.throws(() => modelLabels(null), /non-empty/);
  });
  it("preserves every fallback and priority while retaining the scalar helper API", () => {
    const models = ["gpt-5.6-sol", "GPT-5.6-Luna (copilot)", "GPT-5.6-Terra"];
    assert.deepEqual(normalizeModels(models), ["gpt-5.6-sol", "GPT-5.6-Luna", "GPT-5.6-Terra"]);
    assert.equal(normalizeModel(models), "gpt-5.6-sol");
    assert.equal(models[1], "GPT-5.6-Luna (copilot)");
    assert.deepEqual(normalizeModels(undefined), []);
  });

  it("rejects empty or malformed fallbacks instead of silently dropping them", () => {
    for (const value of [[], ["gpt-5.6-sol", false], ["gpt-5.6-sol", ""], ["gpt-5.6-sol", null]]) {
      assert.throws(() => normalizeModels(value), /non-empty/);
    }
  });
});

describe("validate-models dispatcher", () => {
  for (const mode of ["catalog", "consistency", "deprecated"]) {
    it(`--only=${mode} exits 0 against an isolated valid workspace`, () => {
      setupFixture();
      const { code, stdout } = run([`--only=${mode}`]);
      assert.equal(code, 0, `mode ${mode} exited ${code}:\n${stdout}`);
    });
  }

  it("no flag runs all three and exits 0", () => {
    setupFixture();
    const { code } = run([]);
    assert.equal(code, 0);
  });

  it("an unknown --only value exits 2", () => {
    const { code } = run(["--only=bogus"]);
    assert.equal(code, 2);
  });
});

describe("model CLI negatives", () => {
  it("validates later fallback catalog labels and deprecations", () => {
    for (const fallback of ["unknown", "GPT-5.4", "GPT-5.6-Sol", "GPT-5.6-Luna (copilot)", false]) {
      setupFixture({ models: ["gpt-5.6-sol", fallback] });
      const result = run(["--only=catalog"]);
      assert.equal(result.code, 1, result.stdout);
    }
  });

  it("rejects fallback order and secondary-model registry drift", () => {
    setupFixture({ models: ["gpt-5.6-sol", "GPT-5.6-Luna"], registryModels: ["gpt-5.6-sol"] });
    assert.equal(run(["--only=consistency"]).code, 1);
    setupFixture({ models: ["gpt-5.6-sol", "GPT-5.6-Luna"], registryModels: ["GPT-5.6-Luna", "gpt-5.6-sol"] });
    assert.equal(run(["--only=consistency"]).code, 1);
  });

  it("allows inherited prompts and qualified handoffs but rejects unknown overrides", () => {
    setupFixture({ prompt: { agent: "Fixture" }, handoff: "GPT-5.6-Luna (copilot)" });
    assert.equal(run(["--only=catalog"]).code, 0);
    setupFixture({ prompt: { model: "unlisted" } });
    assert.equal(run(["--only=catalog"]).code, 1);
    setupFixture({ handoff: "unlisted (copilot)" });
    assert.equal(run(["--only=catalog"]).code, 1);
  });

  it("rejects missing provenance through the real catalog CLI", () => {
    setupFixture();
    const filename = path.join(fixtureRoot, ".github/model-catalog.json");
    const catalog = JSON.parse(readFileSync(filename, "utf8"));
    delete catalog.models["gpt-5.6-sol"].provenance;
    writeFileSync(filename, JSON.stringify(catalog));
    assert.equal(run(["--only=catalog"]).code, 1);
  });
});

describe("validate-models npm aliases", () => {
  const expected = {
    "validate:model-catalog": "--only=catalog",
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
