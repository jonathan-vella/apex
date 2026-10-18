import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { load } from "js-yaml";

const root = fileURLToPath(new URL("../../", import.meta.url));
const checker = path.join(root, "tools/scripts/check-powershell.ps1");
const fixtures = path.join(root, "tools/tests/fixtures/powershell");
const flags = ["-NoLogo", "-NoProfile", "-NonInteractive"];

function analyze(args = [], options = {}) {
  const result = spawnSync("pwsh", [...flags, "-File", checker, ...args], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
    ...options,
  });
  assert.equal(result.error, undefined, `PowerShell must be installed: ${result.error?.message}`);
  return { ...result, output: result.stdout + result.stderr };
}

function runCommand(command, options = {}) {
  const result = spawnSync("pwsh", [...flags, "-Command", command], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
    ...options,
  });
  assert.equal(result.error, undefined, result.error?.message);
  return { ...result, output: result.stdout + result.stderr };
}

const quote = (value) => `'${value.replaceAll("'", "''")}'`;

test("maintained PowerShell scripts and analyzer data files pass without executing cloud commands", () => {
  const result = analyze();
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /Analyzed .*tools\/scripts\/collect-governance-baseline\.ps1/);
  assert.match(result.stdout, /Analyzed .*\.github\/skills\/apex-azure-diagnostics\/scripts\/run-ig\.ps1/);
  assert.match(result.stdout, /Analyzed .*tools\/powershell\/PSScriptAnalyzerSettings\.psd1/);
  assert.doesNotMatch(result.stdout, /Analyzed .*\/(?:agent-output|infra|fixtures)\//);
});

test("a valid fixture passes without executing its throw statement", () => {
  const result = analyze(["-Path", path.join(fixtures, "valid.ps1")]);
  assert.equal(result.status, 0, result.output);
  assert.match(result.stdout, /PowerShell parsing and selected analyzer rules passed/);
});

for (const [fixture, diagnostic] of [
  ["invalid-syntax.ps1", /ParseError.*MissingEndCurlyBrace/],
  ["invalid-alias.ps1", /PSAvoidUsingCmdletAliases/],
  ["invalid-automatic-variable.ps1", /PSAvoidAssignmentToAutomaticVariable/],
  ["invalid-empty-catch.ps1", /PSAvoidUsingEmptyCatchBlock/],
  ["invalid-expression.ps1", /PSAvoidUsingInvokeExpression/],
  ["invalid-plaintext.ps1", /PSAvoidUsingConvertToSecureStringWithPlainText/],
  ["invalid-suppressed.ps1", /PSAvoidUsingInvokeExpression/],
]) {
  test(`${fixture} fails with an actionable diagnostic, including warning-level and suppressed findings`, () => {
    const result = analyze(["-Path", path.join(fixtures, fixture)]);
    assert.equal(result.status, 1, result.output);
    assert.match(result.stdout, diagnostic);
    assert.match(result.stdout, new RegExp(`${fixture.replaceAll(".", "\\.")}:\\d+:\\d+:`));
    assert.doesNotMatch(result.stdout, /rules passed/);
  });
}

test("an explicit nonexistent file fails rather than producing an empty pass", () => {
  const result = analyze(["-Path", path.join(fixtures, "missing.ps1")]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.stdout, /File does not exist/);
});

test("non-PowerShell explicit inputs fail", () => {
  const result = analyze(["-Path", path.join(root, "package.json")]);
  assert.equal(result.status, 1, result.output);
  assert.match(result.stdout, /Not a PowerShell source file/);
});

test("missing pinned module fails with provisioning guidance", () => {
  const result = runCommand(
    `Import-Module Microsoft.PowerShell.Utility,Microsoft.PowerShell.Management; $env:PSModulePath = ${quote(fixtures)}; & ${quote(checker)} -Path ${quote(path.join(fixtures, "valid.ps1"))}`,
  );
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /PSScriptAnalyzer \d+\.\d+\.\d+ is required.*npm run setup:powershell/);
});

for (const [exitCode, diagnostic] of [
  [0, /No maintained PowerShell scripts found/],
  [1, /git ls-files failed/],
]) {
  test(`discovery with no native output and exit ${exitCode} fails closed`, () => {
    const result = runCommand(`function global:git { $global:LASTEXITCODE = ${exitCode} }; & ${quote(checker)}`);
    assert.equal(result.status, 1, result.output);
    assert.match(result.output, diagnostic);
  });
}

test("all explicit inputs are checked after a parser error", () => {
  const result = runCommand(
    `& ${quote(checker)} -Path @(${quote(path.join(fixtures, "invalid-syntax.ps1"))}, ${quote(path.join(fixtures, "invalid-expression.ps1"))})`,
  );
  assert.equal(result.status, 1, result.output);
  assert.match(result.output, /ParseError/);
  assert.match(result.output, /PSAvoidUsingInvokeExpression/);
});

test("analyzer exceptions and unknown configured rules fail closed", (context) => {
  const workspace = fs.mkdtempSync(path.join(root, "tools/tests/.powershell-analysis-"));
  context.after(() => fs.rmSync(workspace, { recursive: true, force: true }));
  fs.mkdirSync(path.join(workspace, "tools/scripts"), { recursive: true });
  fs.cpSync(checker, path.join(workspace, "tools/scripts/check-powershell.ps1"));
  fs.cpSync(path.join(root, "tools/powershell"), path.join(workspace, "tools/powershell"), { recursive: true });
  const settingsPath = path.join(workspace, "tools/powershell/PSScriptAnalyzerSettings.psd1");
  fs.writeFileSync(settingsPath, "@{ IncludeRules = @('NotAnAnalyzerRule') }\n");
  const copiedChecker = quote(path.join(workspace, "tools/scripts/check-powershell.ps1"));
  const fixture = quote(path.join(fixtures, "valid.ps1"));
  const invalidRule = runCommand(`& ${copiedChecker} -Path ${fixture}`, { cwd: workspace });
  assert.equal(invalidRule.status, 1, invalidRule.output);
  assert.match(invalidRule.stderr, /Unknown analyzer rule: NotAnAnalyzerRule/);
  fs.writeFileSync(settingsPath, "@{ IncludeRules = @('PSAvoidUsingInvokeExpression') }\n");
  const failedAnalyzer = runCommand(
    `function global:Invoke-ScriptAnalyzer { [CmdletBinding()] param($Path, $Settings, [switch]$IncludeSuppressed) Write-Error 'synthetic analyzer failure' }; & ${copiedChecker} -Path ${fixture}`,
    { cwd: workspace },
  );
  assert.equal(failedAnalyzer.status, 1, failedAnalyzer.output);
  assert.match(failedAnalyzer.stdout, /Analysis failed: synthetic analyzer failure/);
});

test("npm, CI, provisioning and Git hooks route to the PowerShell checks", () => {
  const scripts = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).scripts;
  assert.match(scripts["validate:_external"], /\blint:powershell\b/);
  assert.match(scripts["validate:_external"], /\btest:powershell\b/);
  const ci = load(fs.readFileSync(path.join(root, ".github/workflows/ci.yml"), "utf8"));
  const commands = ci.jobs.ci.steps.map((step) => step.run).filter(Boolean);
  for (const name of ["setup:powershell", "lint:powershell", "test:powershell"]) {
    assert.ok(commands.includes(`npm run ${name}`), `${name} must run in required CI`);
  }
  assert.ok(commands.indexOf("npm run setup:powershell") < commands.indexOf("npm run lint:powershell"));
  const hooks = load(fs.readFileSync(path.join(root, "lefthook.yml"), "utf8"));
  assert.deepEqual(hooks["pre-commit"].commands.powershell.glob, [
    "tools/scripts/*.{ps1,psm1,psd1}",
    "tools/scripts/**/*.{ps1,psm1,psd1}",
    "tools/powershell/**",
    ".devcontainer/*.{ps1,psm1,psd1}",
    ".github/skills/*/scripts/*.{ps1,psm1,psd1}",
    ".github/skills/*/scripts/**/*.{ps1,psm1,psd1}",
    "tools/tests/powershell-analysis.test.mjs",
    "tools/tests/fixtures/powershell/**",
  ]);
  assert.equal(hooks["pre-commit"].commands.powershell.run, "npm run lint:powershell && npm run test:powershell");
  const push = fs.readFileSync(path.join(root, "tools/scripts/diff-based-push-check.sh"), "utf8");
  assert.match(push, /run_check "PowerShell analysis and tests" "\$POWERSHELL_COUNT"/);
  assert.match(push, /TOTAL=.*POWERSHELL_COUNT/);
  const provisioning = fs.readFileSync(path.join(root, ".devcontainer/post-create.sh"), "utf8");
  assert.match(provisioning, /npm run setup:powershell/);
});
