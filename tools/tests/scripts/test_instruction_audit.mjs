import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { loadValidator } from "../../scripts/_lib/ajv-validator.mjs";
import { splitApplyTo, walkFiles } from "../../scripts/_lib/glob-helpers.mjs";
import { parseFrontmatter } from "../../scripts/_lib/parse-frontmatter.mjs";
import { parseJsonc } from "../../scripts/_lib/parse-jsonc.mjs";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const instruction = (name) => read(`.github/instructions/${name}.instructions.md`);

function applies(name, file) {
  return splitApplyTo(parseFrontmatter(instruction(name)).applyto).some((pattern) => {
    // Node globs exclude dot directories through **; test the explicit hidden-root equivalent too.
    const candidates = pattern.startsWith("**/")
      ? [pattern, pattern.slice(3), `.github/**/${pattern.slice(3)}`]
      : [pattern];
    return candidates.some((candidate) => path.matchesGlob(file, candidate));
  });
}

test("scope parsing preserves brace alternatives", () => {
  assert.deepEqual(splitApplyTo("tools/**/*.{mjs,sh}, .github/**/*.md"), ["tools/**/*.{mjs,sh}", ".github/**/*.md"]);
});

test("documentation triggers cover owned changes without becoming universal", () => {
  for (const file of [
    ".github/instructions/example.instructions.md",
    ".github/agents/main.agent.md",
    ".github/skills/example/SKILL.md",
    "infra/bicep/example/main.bicep",
    "infra/terraform/example/main.tf",
    ".devcontainer/devcontainer.json",
    ".vscode/settings.json",
    ".github/copilot/settings.json",
    ".github/workflows/ci.yml",
    "tools/scripts/example.psm1",
    "tools/powershell/requirements.psd1",
    "package.json",
    "requirements.txt",
    "lefthook.yml",
  ]) {
    assert.equal(applies("docs-trigger", file), true, file);
  }
  for (const file of ["node_modules/example/index.js", "agent-output/history/01-requirements.md", "notes.txt"]) {
    assert.equal(applies("docs-trigger", file), false, file);
  }
});

test("main-only frame, shared PowerShell coverage and Copilot skill authoring remain intentional", () => {
  assert.equal(applies("agent-operating-frame", ".github/agents/main.agent.md"), true);
  assert.equal(applies("agent-operating-frame", ".github/agents/_subagents/leaf.agent.md"), false);
  assert.equal(applies("code-quality", "tools/scripts/example.ps1"), true);
  assert.equal(applies("code-quality", "tools/scripts/example.psm1"), true);
  assert.equal(applies("agent-skills", ".github/skills/example/SKILL.md"), true);
  assert.equal(applies("agent-skills", ".claude/skills/example/SKILL.md"), false);
});

test("active guidance does not reintroduce the blind-confirmation heuristic or wrong governance key", () => {
  const files = [
    "AGENTS.md",
    ".github/copilot-instructions.md",
    ...[".github/instructions", ".github/agents", ".github/skills"].flatMap((dir) => walkFiles(dir, ".md")),
  ];
  const blindConfirmation = /assume.{0,100}interactive prompt.{0,100}send\s+[`'"]?y\b/i;
  assert.equal(blindConfirmation.test("assume an interactive prompt is waiting and send `y`"), true);
  for (const file of files) {
    const body = read(file);
    assert.doesNotMatch(body.replace(/\s+/g, " "), blindConfirmation, file);
    assert.doesNotMatch(body, /\brequiredValue\b/, file);
  }
  const shell = instruction("no-interactive-shell");
  assert.match(shell, /silence or elapsed\s+time alone never authorizes confirmation/);
  assert.match(shell, /visible, expected prompt/);
  assert.match(shell, /Noninteractive flags do not grant permission/);
});

test("governance schema accepts conditional mapping aids and the documented snake_case value", () => {
  const schemaPath = path.join(root, "tools/schemas/governance-constraints.schema.json");
  const schema = JSON.parse(fs.readFileSync(schemaPath, "utf8"));
  const properties = schema.properties.findings.items.properties;
  assert.ok(Object.hasOwn(properties, "required_value"));
  assert.equal(Object.hasOwn(properties, "requiredValue"), false);
  const validate = loadValidator(schemaPath);
  const finding = { policy_id: "test-policy", display_name: "Test policy", effect: "deny" };
  const envelope = {
    schema_version: "governance-constraints-v1",
    subscription_id: "00000000-0000-0000-0000-000000000000",
    discovered_at: "2026-10-18T00:00:00Z",
    findings: [finding],
  };
  assert.equal(validate(envelope), true, JSON.stringify(validate.errors));
  finding.required_value = false;
  finding.azurePropertyPath = "storageAccount.properties.allowBlobPublicAccess";
  assert.equal(validate(envelope), true, JSON.stringify(validate.errors));
  finding.azurePropertyPath = 123;
  assert.equal(validate(envelope), false);
  assert.match(instruction("governance-discovery"), /not\s+universally required schema fields/);
});

test("model-policy link resolves to the canonical model-neutral production contract", () => {
  const content = instruction("vendor-prompting");
  const href = content.match(/\[model policy\]\(([^)]+)\)/)?.[1];
  assert.ok(href);
  const target = path.resolve(root, ".github/instructions", href);
  assert.equal(fs.existsSync(target), true);
  assert.match(fs.readFileSync(target, "utf8"), /independently of runtime model selection/);
  assert.match(content, /Family-specific advice/);
  assert.match(content, /Cross-vendor structural/);
});

test("Markdown guidance reflects ignored artifacts, template H1 and lint exceptions", () => {
  const config = parseJsonc(read(".markdownlint-cli2.jsonc"));
  assert.ok(config.ignores.includes("agent-output/**"));
  assert.ok(config.ignores.includes(".github/skills/**"));
  assert.equal(config.config.MD013.line_length, 120);
  assert.equal(config.config.MD013.code_blocks, false);
  assert.equal(config.config.MD013.tables, false);
  assert.match(instruction("markdown"), /Markdownlint excludes those artifacts and skill content/);
  assert.doesNotMatch(instruction("markdown"), /no H1 in content/);
  assert.match(read(".github/skills/apex-azure-artifacts/templates/PROJECT-README.template.md"), /^# .+/m);
  assert.match(read("tools/scripts/check-publication-scope.mjs"), /"--no-globs"/);
});

test("lockfile-provisioned YAML parser supports structured values and rejects malformed input", () => {
  const manifest = JSON.parse(read("package.json"));
  assert.ok(manifest.devDependencies["js-yaml"]);
  assert.equal(load("infra:\n  provider: terraform\n  path: .\n").infra.provider, "terraform");
  assert.throws(() => load("infra: [unterminated"));
  assert.match(instruction("shell"), /yq` is not provisioned or required/);
});

test(
  "CI documents independent checks and inventories the current workflows",
  {
    skip: !fs.existsSync(path.join(root, ".github/workflows/ci.yml")) && "upstream ci.yml not present in consumer repo",
  },
  () => {
    const workflow = load(read(".github/workflows/ci.yml"));
    for (const job of ["ci", "external-tests", "secret-scan"]) assert.ok(workflow.jobs[job]);
    assert.doesNotMatch(read(".github/workflows/ci.yml"), /Single required status check/);
    assert.match(instruction("github-actions"), /Local YAML inspection does not verify those live settings/);
    for (const file of fs.readdirSync(path.join(root, ".github/workflows"))) {
      if (/\.ya?ml$/.test(file)) assert.ok(instruction("github-actions").includes(file), file);
    }
  },
);

test("canonical artifact fix command previews before applying to an owned fixture", (t) => {
  const manifest = JSON.parse(read("package.json"));
  assert.equal(manifest.scripts["fix:artifact-h2"], undefined);
  assert.match(manifest.scripts["fix:artifacts"], /validate-artifacts\.mjs --fix$/);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "artifact-fix-contract-"));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const file = path.join(dir, "06-deployment-summary.md");
  const original = "# Fixture\n\n## Outputs\n\nFixture output.\n";
  const canonicalHeading = read(
    ".github/skills/apex-azure-artifacts/templates/06-deployment-summary.template.md",
  ).match(/^## .*Outputs \(Expected\)$/m)?.[0];
  assert.ok(canonicalHeading);
  fs.writeFileSync(file, original);
  const run = (...args) =>
    spawnSync(process.execPath, [path.join(root, "tools/scripts/validate-artifacts.mjs"), "--fix", file, ...args], {
      cwd: root,
      encoding: "utf8",
    });
  const preview = run();
  assert.equal(preview.status, 0, preview.stdout + preview.stderr);
  assert.equal(fs.readFileSync(file, "utf8"), original);
  const apply = run("--apply");
  assert.equal(apply.status, 0, apply.stdout + apply.stderr);
  assert.notEqual(fs.readFileSync(file, "utf8"), original);
  assert.match(fs.readFileSync(file, "utf8"), /Outputs \(Expected\)/);
  const repeat = run("--apply");
  assert.equal(repeat.status, 0, repeat.stdout + repeat.stderr);
  assert.equal(fs.readFileSync(file, "utf8"), original.replace("## Outputs", canonicalHeading));
});
