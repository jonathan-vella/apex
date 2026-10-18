import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const readAgent = (file) => readFileSync(new URL(`../../../.github/agents/${file}`, import.meta.url), "utf8");

test("A02 permits early canonical security and service guidance without repeating supplied answers", () => {
  const source = readAgent("02-requirements.agent.md");
  assert.ok(source.includes("iac-security-baseline.md"));
  assert.match(source, /defer artifact templates and broad skill loads/);
  assert.doesNotMatch(source, /Phases 1-4 each collect answers before any file/);
  assert.ok(source.includes("Phase 3j"));
  assert.match(source, /Reuse explicit brief answers/);
  assert.ok(source.includes("## Phase 5"));
  assert.match(source, /Recover an existing project/);
});

test("A03 Design skip preserves governance freshness, review and approval", () => {
  const source = readAgent("04-design.agent.md");
  assert.match(source, /Skipping design does not skip Governance/);
  assert.match(source, /missing\/stale `04g-Governance` evidence and approvals before planning/);
  assert.doesNotMatch(source, /Users may skip to governance discovery or IaC planning/);
});

test("A04 Bicep Deploy returns missing generated scripts to CodeGen", () => {
  const source = readAgent("07b-bicep-deploy.agent.md");
  assert.ok(source.includes("06b-Bicep CodeGen"));
  assert.match(source, /(?:missing|absent)[\s\S]{0,120}(?:script|CodeGen)|script[\s\S]{0,120}missing/i);
  assert.match(source, /legacy/i);
  assert.doesNotMatch(source, /Generate `deploy\.ps1`|Generated `deploy\.ps1` should expose/);
  assert.match(source, /never introduce\/patch it here/i);
});

test("A05 Terraform validation refreshes dependencies without taking plan authority", () => {
  const worker = readAgent("_subagents/terraform-validate-subagent.agent.md");
  assert.match(worker, /workspace-local `TF_DATA_DIR`/);
  assert.match(worker, /terraform init -backend=false -input=false -lockfile=readonly/);
  assert.doesNotMatch(worker, /\[ -d \.terraform \]|terraform plan -refresh=false/);
  assert.match(worker, /Do not run a plan\s+or invent a `validate_gate` block/);
  assert.match(worker, /not plan success/);
  const codegen = readAgent("06t-terraform-codegen.agent.md");
  assert.ok(codegen.includes("terraform plan -refresh=false"));
  assert.match(codegen, /CodeGen parent runs and records/);
  const deploy = readAgent("07t-terraform-deploy.agent.md");
  for (const field of ["lock", "backend", "workspace", "approval"]) assert.ok(deploy.includes(field), field);
});

test("A06 Bicep build snippet retains current compiled ARM without changing source", (context) => {
  const source = readAgent("_subagents/bicep-validate-subagent.agent.md");
  assert.doesNotMatch(source, /bicep build .*--stdout > \/dev\/null/);
  assert.match(source, /(?:retain|inspect)[\s\S]{0,100}(?:ARM|build|compiled)/i);
  const available = spawnSync("bicep", ["--version"], { encoding: "utf8" });
  assert.equal(available.status, 0, "Bicep CLI required for compiled-evidence regression");
  const root = mkdtempSync(path.join(tmpdir(), "apex-arm-evidence-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const temporary = path.join(root, "scratch");
  mkdirSync(temporary);
  const template = path.join(root, "main.bicep");
  const body = "output evidence object = {\n  supportsHttpsTrafficOnly: true\n  minimumTlsVersion: 'TLS1_2'\n}\n";
  writeFileSync(template, body);
  const snippet = [...source.matchAll(/```bash\n([\s\S]*?)```/g)].find((match) => match[1].includes("bicep build"))[1];
  const compiledDirectory = path.join(root, "compiled");
  mkdirSync(compiledDirectory);
  const command = snippet
    .trim()
    .replaceAll("{template_path}", JSON.stringify(template))
    .replaceAll("{scratch_dir}", JSON.stringify(compiledDirectory));
  const result = spawnSync("bash", ["-c", `set -e\n${command}`], {
    env: { ...process.env, TMPDIR: temporary },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  const compiled = JSON.parse(readFileSync(path.join(compiledDirectory, "main.json"), "utf8"));
  assert.equal(compiled.outputs.evidence.value.supportsHttpsTrafficOnly, true);
  assert.equal(compiled.outputs.evidence.value.minimumTlsVersion, "TLS1_2");
  assert.equal(readFileSync(template, "utf8"), body);
});

test("A05 worker init refreshes changed local modules despite an existing deployment cache", (context) => {
  const available = spawnSync("terraform", ["version"], { encoding: "utf8" });
  assert.equal(available.status, 0, "Terraform CLI required for initialization regression");
  const root = mkdtempSync(path.join(tmpdir(), "apex-init-freshness-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const scratch = path.join(root, "scratch");
  mkdirSync(scratch);
  mkdirSync(path.join(root, ".terraform"));
  const sentinel = path.join(root, ".terraform", "terraform.tfstate");
  writeFileSync(sentinel, "deployment metadata must remain untouched");
  const source = readAgent("_subagents/terraform-validate-subagent.agent.md");
  const snippet = [...source.matchAll(/```bash\n([\s\S]*?)```/g)].find((match) =>
    match[1].includes("terraform init"),
  )[1];
  for (const moduleName of ["first", "changed"]) {
    mkdirSync(path.join(root, moduleName));
    writeFileSync(path.join(root, moduleName, "main.tf"), `output "name" { value = "${moduleName}" }\n`);
    writeFileSync(path.join(root, "main.tf"), `module "child" { source = "./${moduleName}" }\n`);
    const validationDirectory = path.join(scratch, moduleName);
    mkdirSync(validationDirectory);
    const command = snippet
      .replaceAll("{module_path}", JSON.stringify(root))
      .replaceAll("{validation_data_dir}", JSON.stringify(validationDirectory));
    const result = spawnSync("bash", ["-c", `set -e\n${command}`], {
      env: { ...process.env, TMPDIR: scratch, TF_IN_AUTOMATION: "1" },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const manifests = readdirSync(scratch).map((directory) =>
      JSON.parse(readFileSync(path.join(scratch, directory, "modules/modules.json"), "utf8")),
    );
    assert.ok(
      manifests.some((manifest) =>
        manifest.Modules.some((entry) => entry.Key === "child" && entry.Source === `./${moduleName}`),
      ),
    );
    assert.equal(readFileSync(sentinel, "utf8"), "deployment metadata must remain untouched");
  }
});

test("A10 audits leaf workers and preserves read-only requests across output phases", () => {
  const source = readAgent("11-context-optimizer.agent.md");
  for (const field of ["main/leaf definitions", "read-only", "snapshots", "recall mutations", "chat"])
    assert.ok(source.includes(field), field);
  assert.match(source, /Absence of UI handoffs[\s\S]{0,100}does not itself indicate inefficiency/);
  assert.doesNotMatch(
    source,
    /automatically create a baseline|mandatory whenever recommendations are applied|or after this agent\s+applies them/,
  );
  assert.doesNotMatch(source, /--output \/tmp\/context-audit.json|> \/tmp\/profile.json/);
  const methodology = readFileSync(
    new URL("../../../.github/skills/apex-context-management/references/analysis-methodology.md", import.meta.url),
    "utf8",
  );
  assert.match(methodology, /Snapshots and persisted diffs are optional/);
  assert.match(methodology, /Read-only audits do not write/);
  assert.doesNotMatch(methodology, /\(auto\)|before any analysis/);
});

test("A10 audit parser emits stdout without modifying its input tree", (context) => {
  const root = mkdtempSync(path.join(tmpdir(), "apex-readonly-audit-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const logDirectory = path.join(root, "session");
  mkdirSync(logDirectory, { recursive: true });
  const log = path.join(logDirectory, "events.jsonl");
  const repository = path.resolve(new URL("../../../", import.meta.url).pathname);
  const body = `${JSON.stringify({
    id: "start",
    type: "session.start",
    timestamp: "2026-10-16T08:00:00Z",
    data: { sessionId: "session", context: { cwd: repository, gitRoot: repository } },
  })}\n`;
  writeFileSync(log, body);
  const before = readdirSync(root, { recursive: true }).sort();
  const source = readAgent("11-context-optimizer.agent.md");
  assert.ok(source.includes("profile:debug-log"));
  const result = spawnSync("python3", ["tools/scripts/profile_debug_log.py", log, "--json"], {
    cwd: new URL("../../../", import.meta.url),
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).native_evidence.session_id, "session");
  assert.deepEqual(readdirSync(root, { recursive: true }).sort(), before);
  assert.equal(readFileSync(log, "utf8"), body);
});
