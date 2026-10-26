import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const sources = {
  APEX_NPM_REGISTRY_HOST_PATH: "packagefeedproxy.microsoft.io/npm/",
  APEX_PIP_INDEX_HOST_PATH: "packagefeedproxy.microsoft.io/pypi/simple/",
  APEX_POWERSHELL_REPOSITORY_URL: "https://packagefeedproxy.microsoft.io/powershell/v2",
};
const flags = ["-NoLogo", "-NoProfile", "-NonInteractive"];
const quote = (value) => `'${value.replaceAll("'", "''")}'`;

function fixture(context) {
  const directory = mkdtempSync(path.join(tmpdir(), "apex-microsoft-host-"));
  context.after(() => rmSync(directory, { recursive: true, force: true }));
  mkdirSync(path.join(directory, "bin"));
  const emptyPath = path.join(directory, "empty-bin");
  mkdirSync(emptyPath);
  const log = path.join(directory, "launch.json");
  const runner = `const { writeFileSync } = require("node:fs");
writeFileSync(process.env.LAUNCH_LOG, JSON.stringify({args: process.argv.slice(2), env: process.env}));
process.exit(Number(process.env.CODE_EXIT || 0));
`;
  if (process.platform === "win32") {
    writeFileSync(path.join(directory, "bin", "code-runner.cjs"), runner);
    writeFileSync(path.join(directory, "bin", "code.cmd"), '@echo off\r\n"%NODE_EXE%" "%~dp0\\code-runner.cjs" %*\r\n');
  } else {
    writeFileSync(
      path.join(directory, "bin", "code"),
      `#!${process.execPath}
import { writeFileSync } from "node:fs";
writeFileSync(process.env.LAUNCH_LOG, JSON.stringify({args: process.argv.slice(2), env: process.env}));
process.exit(Number(process.env.CODE_EXIT ?? 0));
`,
      { mode: 0o755 },
    );
  }
  return {
    log,
    emptyPath,
    env: {
      ...process.env,
      PATH: `${path.join(directory, "bin")}${path.delimiter}${process.env.PATH}`,
      NODE_EXE: process.execPath,
      LAUNCH_LOG: log,
      APEX_NPM_REGISTRY_HOST_PATH: "original.example/npm/",
      APEX_PIP_INDEX_HOST_PATH: "original.example/python/",
      APEX_POWERSHELL_REPOSITORY_URL: "https://original.example/powershell",
    },
  };
}

for (const shell of process.platform === "win32" ? ["pwsh"] : ["bash", "pwsh"]) {
  for (const failure of [false, true]) {
    test(`${shell} Microsoft launcher ${failure ? "reports editor failure" : "passes all feed opt-ins to the editor"}`, (context) => {
      const setup = fixture(context);
      const launcher = path.join(root, ".devcontainer", `open-microsoft.${shell === "bash" ? "sh" : "ps1"}`);
      const result = spawnSync(shell, [...(shell === "pwsh" ? [...flags, "-File"] : []), launcher], {
        cwd: tmpdir(),
        env: { ...setup.env, CODE_EXIT: failure ? "23" : "0" },
        encoding: "utf8",
      });
      assert.equal(result.error, undefined, result.error?.message);
      assert.equal(result.status, failure ? (shell === "bash" ? 23 : 1) : 0, result.stdout + result.stderr);
      const launch = JSON.parse(readFileSync(setup.log, "utf8"));
      assert.equal(launch.args.length, 1);
      assert.equal(path.resolve(launch.args[0]), path.resolve(root));
      for (const [name, expected] of Object.entries(sources)) assert.equal(launch.env[name], expected);
      if (failure && shell === "pwsh") assert.match(result.stderr, /VS Code exited with code 23/);
    });
  }
}

if (process.platform !== "win32") {
  test("WSL launcher preserves unrelated forwarding entries and replaces conflicting opt-in flags", (context) => {
    const setup = fixture(context);
    const result = spawnSync("bash", [path.join(root, ".devcontainer/open-microsoft.sh")], {
      env: {
        ...setup.env,
        WSL_DISTRO_NAME: "Ubuntu",
        WSLENV: "EXISTING/p:APEX_PIP_INDEX_HOST_PATH/u:OTHER/w",
      },
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const { env } = JSON.parse(readFileSync(setup.log, "utf8"));
    assert.deepEqual(env.WSLENV.split(":"), ["EXISTING/p", "OTHER/w", ...Object.keys(sources)]);
  });
}

test("PowerShell launcher restores the caller's existing package-source environment", (context) => {
  const setup = fixture(context);
  const result = spawnSync(
    "pwsh",
    [
      ...flags,
      "-Command",
      `& ${quote(path.join(root, ".devcontainer/open-microsoft.ps1"))}; Write-Output ('RESTORED:' + $env:APEX_PIP_INDEX_HOST_PATH)`,
    ],
    { env: setup.env, encoding: "utf8" },
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /RESTORED:original\.example\/python\//);
});

if (process.platform !== "win32") {
  test("Bash launcher fails explicitly when the host VS Code CLI is missing", (context) => {
    const setup = fixture(context);
    const result = spawnSync("/bin/bash", [path.join(root, ".devcontainer/open-microsoft.sh")], {
      env: { ...setup.env, PATH: setup.emptyPath },
      encoding: "utf8",
    });
    assert.equal(result.status, 127, result.stdout + result.stderr);
    assert.match(result.stderr, /VS Code CLI is required/);
    assert.doesNotMatch(result.stdout, /Opening VS Code/);
  });
}

test("PowerShell launcher fails explicitly when the host VS Code CLI is missing", (context) => {
  const setup = fixture(context);
  const resolved = spawnSync("pwsh", [...flags, "-Command", "(Get-Process -Id $PID).Path"], {
    encoding: "utf8",
  });
  assert.equal(resolved.status, 0, resolved.stdout + resolved.stderr);
  const result = spawnSync(
    resolved.stdout.trim(),
    [...flags, "-File", path.join(root, ".devcontainer/open-microsoft.ps1")],
    { env: { ...setup.env, PATH: setup.emptyPath }, encoding: "utf8" },
  );
  assert.equal(result.status, 1, result.stdout + result.stderr);
  assert.match(result.stderr, /Microsoft host launcher failed:.*code/);
  assert.doesNotMatch(result.stdout, /Opening VS Code/);
});

const installer = path.join(root, "tools/scripts/install-powershell-analysis.ps1");
const mocks = `
function Get-Module { param([switch]$ListAvailable, $Name) }
function Register-PSRepository {
    [CmdletBinding()] param($Name, $SourceLocation, $InstallationPolicy)
    Write-Output "REGISTER:$SourceLocation POLICY:$InstallationPolicy"
}
function Unregister-PSRepository {
    [CmdletBinding()] param($Name)
    Write-Output "UNREGISTER:$Name"
}
function Install-Module {
    [CmdletBinding()] param($Name, $RequiredVersion, $Repository, $Scope, [switch]$Force)
    Write-Output "INSTALL:$Repository MODULE:$Name VERSION:$RequiredVersion SCOPE:$Scope"
    if ($env:INSTALL_FAILURE) { throw 'fixture package-feed failure' }
}
function Import-Module {
    [CmdletBinding()] param($Name, $RequiredVersion, [switch]$Force)
    Write-Output "IMPORT:$Name"
}
`;

for (const [name, feed, failure, expected] of [
  ["default gallery", "", "", 0],
  ["approved feed", sources.APEX_POWERSHELL_REPOSITORY_URL, "", 0],
  ["failed approved feed", sources.APEX_POWERSHELL_REPOSITORY_URL, "1", 1],
  ["non-HTTPS feed", "http://feed.example/v2", "", 1],
  ["credential-bearing feed", "https://user:test-only-credential@feed.example/v2", "", 1],
  ["relative feed", "feed.example/v2", "", 1],
  ["query-bearing feed", "https://feed.example/v2?private=example", "", 1],
  ["malformed feed", "https://[", "", 1],
]) {
  test(`PowerShell analyzer provisioning handles ${name} without a public fallback`, () => {
    const result = spawnSync("pwsh", [...flags, "-Command", `${mocks}\n& ${quote(installer)}`], {
      env: { ...process.env, APEX_POWERSHELL_REPOSITORY_URL: feed, INSTALL_FAILURE: failure },
      encoding: "utf8",
    });
    assert.equal(result.error, undefined, result.error?.message);
    assert.equal(result.status, expected, result.stdout + result.stderr);
    if (!feed) {
      assert.match(result.stdout, /INSTALL:PSGallery/);
      assert.doesNotMatch(result.stdout, /REGISTER:/);
    } else if (feed === sources.APEX_POWERSHELL_REPOSITORY_URL) {
      assert.match(
        result.stdout,
        /REGISTER:https:\/\/packagefeedproxy\.microsoft\.io\/powershell\/v2 POLICY:Untrusted/,
      );
      assert.match(result.stdout, /INSTALL:APEX-[a-f0-9]+ MODULE:PSScriptAnalyzer VERSION:1\.25\.0 SCOPE:CurrentUser/);
      assert.match(result.stdout, /UNREGISTER:APEX-/);
      assert.doesNotMatch(result.stdout, /INSTALL:PSGallery/);
      if (failure) {
        assert.match(result.stderr, /fixture package-feed failure/);
        assert.doesNotMatch(result.stdout, /is ready/);
      }
    } else {
      assert.match(result.stderr, /must be an HTTPS feed URL/);
      assert.doesNotMatch(result.stdout, /REGISTER:|INSTALL:|is ready/);
      assert.doesNotMatch(result.stdout + result.stderr, /private|test-only-credential/);
    }
  });
}
