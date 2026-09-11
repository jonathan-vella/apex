import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const readAgent = (file) => readFileSync(new URL(`../../../.github/agents/${file}`, import.meta.url), "utf8");

test("A02 permits only the Phase 3 runbook before artifact guidance", () => {
  const source = readAgent("02-requirements.agent.md");
  assert.match(source, /only early file-read exception/);
  assert.match(source, /except for the required Phase 3 service-class runbook at that phase/);
  assert.doesNotMatch(source, /Phases 1-4 each collect answers before any file/);
  assert.match(source, /Phase 3j batch/);
  assert.match(source, /Phase 5 \(artifact generation\), not earlier/);
  assert.match(source, /Fresh-capture read restrictions do not prohibit this bounded recovery path/);
});

test("A03 Design skip preserves governance freshness, review and approval", () => {
  const source = readAgent("04-design.agent.md");
  assert.match(source, /Skipping design does not skip Governance prerequisites/);
  assert.match(
    source,
    /`04g-Governance` when governance\s+evidence or its required review is missing, stale, or blocked/,
  );
  assert.match(
    source,
    /`05-IaC Planner` only when the current governance prerequisites and approval\s+gates are satisfied/,
  );
  assert.doesNotMatch(source, /Users may skip to governance discovery or IaC planning/);
});

test("A04 Bicep Deploy returns missing generated scripts to CodeGen", () => {
  const source = readAgent("07b-bicep-deploy.agent.md");
  assert.match(
    source,
    /required generated deployment script is missing or needs changes,\s+STOP and return to `06b-Bicep CodeGen`/,
  );
  assert.match(source, /Use `-SkipValidation` only if the approved\s+> existing legacy script supports it/);
  assert.doesNotMatch(source, /Generate `deploy\.ps1`|Generated `deploy\.ps1` should expose/);
  assert.match(source, /Do not introduce `deploy\.ps1`/);
});

test("A05 Terraform validation refreshes dependencies without taking plan authority", () => {
  const worker = readAgent("_subagents/terraform-validate-subagent.agent.md");
  assert.match(worker, /isolated temporary `TF_DATA_DIR`/);
  assert.match(worker, /terraform init -backend=false -input=false -lockfile=readonly/);
  assert.doesNotMatch(worker, /\[ -d \.terraform \]|terraform plan -refresh=false/);
  assert.match(worker, /Do not run a plan or invent a `validate_gate` block/);
  assert.match(worker, /Lint\/review APPROVED is not proof that the plan gate passed/);
  const codegen = readAgent("06t-terraform-codegen.agent.md");
  assert.match(codegen, /CodeGen runs and records this gate/);
  assert.match(codegen, /backend-disabled init is not plan readiness/);
  const deploy = readAgent("07t-terraform-deploy.agent.md");
  assert.match(
    deploy,
    /provider\s+requirements, lockfile selections, module sources\/versions, backend configuration,\s+and target workspace/,
  );
  assert.match(deploy, /select and verify the approved workspace before planning/);
  assert.match(deploy, /invalidates prior plan and approval evidence/);
});

test("A06 Bicep build snippet retains current compiled ARM without changing source", (context) => {
  const source = readAgent("_subagents/bicep-validate-subagent.agent.md");
  assert.doesNotMatch(source, /bicep build .*--stdout > \/dev\/null/);
  assert.match(source, /Retain `\$compiled_dir\/main.json` through Phase 2/);
  const available = spawnSync("bicep", ["--version"], { encoding: "utf8" });
  assert.equal(available.status, 0, "Bicep CLI required for compiled-evidence regression");
  const root = mkdtempSync(path.join(tmpdir(), "apex-arm-evidence-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  const temporary = path.join(root, "scratch");
  mkdirSync(temporary);
  const template = path.join(root, "main.bicep");
  const body = "output evidence object = {\n  supportsHttpsTrafficOnly: true\n  minimumTlsVersion: 'TLS1_2'\n}\n";
  writeFileSync(template, body);
  const snippet = source.split("### Phase 1 — Lint and build")[1].match(/```bash\n([\s\S]*?)```/)[1];
  const result = spawnSync(
    "bash",
    [
      "-c",
      `${snippet.trim().replaceAll("{template_path}", JSON.stringify(template))} && cat "$compiled_dir/main.json"`,
    ],
    {
      env: { ...process.env, TMPDIR: temporary },
      encoding: "utf8",
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const compiled = JSON.parse(result.stdout);
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
  const snippet = source.split("### Phase 1 — Lint and validate")[1].match(/```bash\n([\s\S]*?)```/)[1];
  for (const moduleName of ["first", "changed"]) {
    mkdirSync(path.join(root, moduleName));
    writeFileSync(path.join(root, moduleName, "main.tf"), `output "name" { value = "${moduleName}" }\n`);
    writeFileSync(path.join(root, "main.tf"), `module "child" { source = "./${moduleName}" }\n`);
    const result = spawnSync("bash", ["-c", snippet.replaceAll("{module_path}", JSON.stringify(root))], {
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
  assert.match(source, /\.github\/agents\/\*\*\/\*\.agent\.md/);
  assert.match(source, /absence of handoffs are intentional/);
  assert.match(
    source,
    /no snapshots,\s+report files, temporary exports, diff-report writes, or `apex-recall` mutations/,
  );
  assert.match(source, /Read-only mode: return findings in chat; do not write artifacts or session state/);
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
  const logDirectory = path.join(root, "session", "exthost1", "GitHub.copilot-chat");
  mkdirSync(logDirectory, { recursive: true });
  const log = path.join(logDirectory, "GitHub Copilot Chat.log");
  const body =
    "2026-02-27 08:03:29.492 [info] ccreq:c5f11ccd.copilotmd | success | claude-opus-4.7 -> claude-opus-4-7 | 6353ms | [panel/editAgent]\n";
  writeFileSync(log, body);
  const before = readdirSync(root, { recursive: true }).sort();
  const source = readAgent("11-context-optimizer.agent.md");
  const snippet = source.split("### Phase 1: Discovery & Log Collection")[1].match(/```bash\n([\s\S]*?)```/)[1];
  const result = spawnSync("bash", ["-c", snippet.replace("~/.vscode-server/data/logs/", JSON.stringify(root))], {
    cwd: new URL("../../../", import.meta.url),
    env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" },
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).sessions_analyzed, 1);
  assert.deepEqual(readdirSync(root, { recursive: true }).sort(), before);
  assert.equal(readFileSync(log, "utf8"), body);
});
