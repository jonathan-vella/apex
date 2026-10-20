import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { load } from "js-yaml";
import { parseJsonc } from "../scripts/_lib/parse-jsonc.mjs";

import {
  REQUIRED_CHECKS,
  compareVerdicts,
  loadVerdicts,
  matchesRuntimeVersion,
  readRuntimeContract,
  renderMarkdown,
  verifyToolVersionLogs,
} from "../scripts/compare-devcontainer-verdicts.mjs";

const repoRoot = fileURLToPath(new URL("../../", import.meta.url));
const runner = path.join(repoRoot, "tools/scripts/validate-devcontainer.sh");
const runnerSource = fs.readFileSync(runner, "utf8");
const boundary = "# Environment metadata and invariants.";
assert.ok(runnerSource.includes(boundary));
const consumer = runnerSource.slice(0, runnerSource.indexOf(boundary));

function fixture(context) {
  const root = fs.mkdtempSync(path.join(repoRoot, ".devcontainer-verdict-test-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

function write(root, file, content, options) {
  const destination = path.join(root, file);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, content, options);
}

function tree(root, label = "baseline") {
  write(root, "package.json", JSON.stringify({ name: label, engines: { node: ">=22" }, scripts: { test: label } }));
  write(root, "package-lock.json", `${label} dependencies`);
  write(
    root,
    ".devcontainer/devcontainer.json",
    '{/* original runtime selections */"image":"ubuntu:24.04","features":{"ghcr.io/devcontainers/features/python:1":{"version":"3.14"},"ghcr.io/devcontainers/features/node:2":{"version":"lts"}},}',
  );
  write(root, ".devcontainer/devcontainer-lock.json", `${label} feature locks`);
  write(root, ".devcontainer/post-create.sh", `${label} install commands`);
  write(
    root,
    "tools/scripts/_lib/parse-jsonc.mjs",
    fs.readFileSync(new URL("../scripts/_lib/parse-jsonc.mjs", import.meta.url)),
  );
  fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(root, "node_modules"), "dir");
}

function runConsumer(root, command, { args = [], env = {}, cwd = root } = {}) {
  return spawnSync(
    "bash",
    [
      "-s",
      "--",
      "--variant",
      "candidate",
      "--expected-distro-id",
      "azurelinux",
      "--expected-os",
      "4.0",
      "--expected-arch",
      "arm64",
      "--workspace-root",
      root,
      "--output-dir",
      path.join(root, "output"),
      ...args,
    ],
    {
      cwd,
      input: `${consumer}\n${command}\n`,
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, HOME: root, ...env },
    },
  );
}

function verdict(variant, arch, overrides = {}) {
  return {
    schema_version: 1,
    variant,
    expected_arch: arch,
    observed_arch: arch,
    expected_distro_id: variant === "baseline" ? "ubuntu" : "azurelinux",
    observed_distro_id: variant === "baseline" ? "ubuntu" : "azurelinux",
    expected_os: variant === "baseline" ? "24.04" : "4.0",
    observed_os: variant === "baseline" ? "24.04" : "4.0",
    status: "PASS",
    warnings: ["known warning"],
    checks: REQUIRED_CHECKS.map((name) => ({ name, status: "PASS", category: "compatibility" })),
    ...overrides,
  };
}

function passingVerdicts() {
  return [
    verdict("baseline", "amd64"),
    verdict("candidate", "amd64"),
    verdict("baseline", "arm64"),
    verdict("candidate", "arm64"),
  ];
}

describe("compareDevcontainerVerdicts", () => {
  it("passes when every required check on every native leg passes without new warnings", () => {
    const summary = compareVerdicts(passingVerdicts());
    assert.equal(summary.status, "PASS");
    assert.deepEqual(summary.blockers, []);
    assert.deepEqual(summary.new_warnings, { amd64: [], arm64: [] });
  });

  for (const [name, mutate, expected] of [
    ["candidate-only warning", (v) => v[1].warnings.push("new optional warning"), /new setup warning/],
    ["candidate command failure", (v) => (v[3].status = "FAIL"), /candidate-arm64: validation status is FAIL/],
    ["baseline failure", (v) => (v[0].status = "FAIL"), /baseline-amd64: validation status is FAIL/],
    ["missing leg", (v) => v.pop(), /missing verdict for candidate-arm64/],
    ["duplicate leg", (v) => v.push(v[0]), /duplicate verdict for baseline-amd64/],
    ["wrong architecture", (v) => (v[1].observed_arch = "arm64"), /expected architecture amd64, observed arm64/],
    ["wrong distro", (v) => (v[1].observed_distro_id = "ubuntu"), /expected distro azurelinux, observed ubuntu/],
    ["wrong OS version", (v) => (v[1].observed_os = "26.04"), /expected OS version 4.0, observed 26.04/],
    [
      "conflicting per-architecture expectations",
      (v) => {
        v[1].expected_os = "5.0";
        v[1].observed_os = "5.0";
      },
      /legs disagree/,
    ],
    ["missing distro identity", (v) => delete v[0].observed_distro_id, /observed_distro_id/],
    ["empty checks", (v) => (v[1].checks = []), /missing required check/],
    ["omitted functional check", (v) => v[1].checks.pop(), /missing required check 'diagram-render'/],
    ["duplicate check", (v) => v[1].checks.push(v[1].checks[0]), /duplicate check/],
    ["invalid check status", (v) => (v[1].checks[0].status = "SKIP"), /invalid status/],
    ["false overall PASS", (v) => (v[1].checks[0].status = "FAIL"), /failed check/],
    ["null check", (v) => v[1].checks.push(null), /invalid check name/],
    ["invalid warnings", (v) => (v[1].warnings = "warning"), /warnings.*array/],
    ["unknown variant", (v) => (v[1].variant = "local"), /variant must be/],
  ]) {
    it(`blocks ${name}`, () => {
      const input = passingVerdicts();
      mutate(input);
      const summary = compareVerdicts(input);
      assert.equal(summary.status, "BLOCKED");
      assert.match(summary.blockers.join("\n"), expected);
    });
  }

  it("requires every check individually, not merely a nonempty check list", () => {
    for (const name of REQUIRED_CHECKS) {
      const input = passingVerdicts();
      input[1].checks = input[1].checks.filter((check) => check.name !== name);
      const summary = compareVerdicts(input);
      assert.equal(summary.status, "BLOCKED", name);
      assert.ok(summary.blockers.some((blocker) => blocker.includes(`missing required check '${name}'`)));
    }
  });

  it("keeps optional azqr warnings visible, and blocks a candidate-only availability regression", () => {
    const input = passingVerdicts();
    for (const leg of input) {
      leg.checks.find((check) => check.name === "azqr").status = "WARN";
      leg.checks.find((check) => check.name === "azqr").message = "optional azqr unavailable";
      leg.warnings.push("optional azqr unavailable");
    }
    assert.equal(compareVerdicts(input).status, "PASS");
    input[0].warnings.pop();
    input[0].checks.find((check) => check.name === "azqr").status = "PASS";
    assert.equal(compareVerdicts(input).status, "BLOCKED");
    input[1].warnings.pop();
    assert.match(compareVerdicts(input).blockers.join("\n"), /warning is missing from warnings/);
  });

  it("reports malformed and structurally invalid verdict files", (context) => {
    const root = fixture(context);
    write(root, "malformed/verdict.json", "{not-json");
    write(root, "invalid/verdict.json", JSON.stringify(verdict("candidate", "amd64", { checks: [] })));
    const loaded = loadVerdicts(root);
    assert.equal(loaded.verdicts.length, 0);
    const summary = compareVerdicts(loaded.verdicts, loaded.errors);
    assert.equal(summary.status, "BLOCKED");
    assert.match(summary.blockers.join("\n"), /malformed JSON/);
    assert.match(summary.blockers.join("\n"), /missing required check/);
  });

  it("a single local verdict never substitutes for the full matrix", () => {
    const summary = compareVerdicts([verdict("candidate", "arm64")]);
    assert.equal(summary.status, "BLOCKED");
    assert.equal(summary.blockers.filter((blocker) => blocker.startsWith("missing verdict")).length, 3);
  });

  it("renders distro identity separately from its release version", () => {
    const markdown = renderMarkdown(
      compareVerdicts(passingVerdicts(), [], { candidateImage: "example/base:4.0", candidateDigest: "sha256:abc" }),
    );
    assert.match(markdown, /Overall verdict:\*\* PASS/);
    assert.match(markdown, /example\/base:4\.0/);
    assert.match(markdown, /candidate \| arm64 \| azurelinux \/ 4\.0 \| azurelinux \/ 4\.0 \| PASS/);
  });
});

describe("runtime selections belong to the tested tree", () => {
  it("uses baseline Feature selections and its own Node minimum, not candidate pins", async (context) => {
    const root = fixture(context);
    tree(root);
    const selected = await readRuntimeContract(root, { variant: "baseline" });
    assert.deepEqual(selected, {
      python: { version: "3.14", mode: "minimum" },
      node: { version: "22", mode: "minimum" },
    });
    assert.equal(matchesRuntimeVersion("3.15.0", selected.python.version, selected.python.mode), true);
    assert.equal(matchesRuntimeVersion("3.13.9", selected.python.version, selected.python.mode), false);
  });

  it("reads selected candidate versions without requiring Python 3.14 or guessing lts", async (context) => {
    const root = fixture(context);
    tree(root, "candidate");
    write(
      root,
      ".devcontainer/install/versions.json",
      '{/* selected installer contract */"python":{"version":"3.15.0"},"node":{"version":"26.1.0"},}',
    );
    const selected = await readRuntimeContract(root, { variant: "candidate" });
    assert.deepEqual(selected, {
      python: { version: "3.15.0", mode: "exact" },
      node: { version: "26.1.0", mode: "exact" },
    });
    assert.equal(matchesRuntimeVersion("26.1.0", selected.node.version), true);
    assert.equal(matchesRuntimeVersion("24.1.0", selected.node.version), false);
  });

  it("prefers local Feature selections while retaining historical upstream selections as fallbacks", async (context) => {
    const root = fixture(context);
    tree(root, "candidate");
    const configPath = path.join(root, ".devcontainer/devcontainer.json");
    const config = parseJsonc(fs.readFileSync(configPath, "utf8"));
    Object.assign(config.features, {
      "./features/python": { version: "3.15.0" },
      "./features/node": { version: "26.12.0" },
    });
    write(root, ".devcontainer/devcontainer.json", JSON.stringify(config));
    const selected = await readRuntimeContract(root, { variant: "candidate" });
    assert.deepEqual(selected, {
      python: { version: "3.15.0", mode: "exact" },
      node: { version: "26.12.0", mode: "exact" },
    });
    delete config.features["./features/python"];
    write(root, ".devcontainer/devcontainer.json", JSON.stringify(config));
    assert.equal((await readRuntimeContract(root, { variant: "candidate" })).python.version, "3.14");
  });

  it("accepts explicit selected interpreters, and rejects unresolvable candidate selections", async (context) => {
    const root = fixture(context);
    tree(root);
    await assert.rejects(readRuntimeContract(root, { variant: "candidate" }), /selected numeric Node version/);
    const selected = await readRuntimeContract(root, {
      variant: "candidate",
      expectedPython: "3.15",
      expectedNode: "26",
    });
    assert.equal(matchesRuntimeVersion("3.15.2", selected.python.version), true);
    assert.equal(matchesRuntimeVersion("3.14.9", selected.python.version), false);
    assert.equal(matchesRuntimeVersion("26.2.0", selected.node.version), true);
  });

  it("fails malformed selected configuration and invalid explicit versions closed", async (context) => {
    const root = fixture(context);
    tree(root);
    await assert.rejects(
      readRuntimeContract(root, { variant: "candidate", expectedPython: "latest" }),
      /Python version/,
    );
    write(root, ".devcontainer/install/versions.json", '{"python":');
    await assert.rejects(readRuntimeContract(root, { variant: "candidate" }), /Invalid JSONC/);
  });

  it("checks exact installed tool versions against the tested tree's download, Feature and npm selections", (context) => {
    const root = fixture(context);
    tree(root);
    const downloads = {
      uv: { version: "0.13.3" },
      gitleaks: { version: "8.30.1" },
      terraform: { version: "1.16.6" },
      gh: { version: "2.102.0" },
      bicep: { version: "0.48.1" },
      azqr: { version: "4.2.2" },
    };
    write(root, ".devcontainer/download-checksums.json", JSON.stringify(downloads));
    const config = parseJsonc(fs.readFileSync(path.join(root, ".devcontainer/devcontainer.json"), "utf8"));
    Object.assign(config.features, {
      "./features/azure-cli": { version: "2.91.0" },
      "ghcr.io/devcontainers/features/powershell:2": { version: "7.6.7" },
      "ghcr.io/azure/azure-dev/azd:latest": { version: "1.36.0" },
    });
    write(root, ".devcontainer/devcontainer.json", JSON.stringify(config));
    write(root, "package.json", '{"packageManager":"npm@12.2.0"}');
    const logs = {
      uv: "uv 0.13.3",
      gitleaks: "8.30.1",
      terraform: "Terraform v1.16.6\non linux_arm64",
      "github-cli": "gh version 2.102.0 (2026-10-01)",
      "bicep-cli": "Bicep CLI version 0.48.1 (commit)",
      "azure-cli": '{"azure-cli":"2.91.0","azure-cli-core":"2.91.0"}',
      powershell: "PowerShell 7.6.7",
      azd: "azd version 1.36.0",
      azqr: "azqr version v.4.2.2",
      "npm-version": "12.2.0",
    };
    for (const [tool, version] of Object.entries(logs)) write(root, `checks/${tool}.log`, version);
    const verify = () => verifyToolVersionLogs(root, path.join(root, "checks"));
    assert.equal(verify().status, "PASS");
    assert.deepEqual(verify().unpinned, []);
    downloads.azd = { version: "1.36.0" };
    write(root, ".devcontainer/download-checksums.json", JSON.stringify(downloads));
    config.features["ghcr.io/azure/azure-dev/azd:latest"].version = "1.0.0";
    write(root, ".devcontainer/devcontainer.json", JSON.stringify(config));
    assert.equal(verify().status, "PASS", "standalone azd must take precedence over historical Feature pins");
    delete config.features["ghcr.io/azure/azure-dev/azd:latest"];
    write(root, ".devcontainer/devcontainer.json", JSON.stringify(config));
    assert.equal(verify().status, "PASS", "standalone azd must remain pinned without an upstream Feature");
    for (const [tool, version] of Object.entries(logs)) {
      write(root, `checks/${tool}.log`, tool === "azure-cli" ? '{"azure-cli":"1.0.0"}' : "version 1.0.0");
      const result = verify();
      assert.equal(result.status, "FAIL", tool);
      assert.equal(result.checks.filter((check) => check.status === "FAIL").length, 1, tool);
      write(root, `checks/${tool}.log`, version);
    }
    write(root, "checks/azqr.log", "optional azqr unavailable\n");
    assert.equal(verify().status, "PASS");
    assert.equal(verify().checks.find((check) => check.tool === "azqr").status, "WARN");
  });

  it("reports historical missing or floating selections as unpinned without inventing latest-version evidence", (context) => {
    const root = fixture(context);
    tree(root);
    const result = verifyToolVersionLogs(root, path.join(root, "checks"));
    assert.deepEqual(result.checks, []);
    assert.ok(result.unpinned.includes("terraform"));
    assert.ok(result.unpinned.includes("npm"));
  });
});

describe("devcontainer setup log contract", () => {
  for (const [name, log, expected] of [
    ["new success sentinel", "Setup complete.\n", 0],
    ["legacy success", "Setup complete!\n", 0],
    ["legacy warnings", "  ⚠️ optional tool (2s)\nSetup complete with warnings: 1\n", 0],
    ["warnings without details", "Setup complete with warnings: 1\n", 0],
    ["legacy errors", "Setup complete with errors: 1\n", 1],
    ["later errors", "Setup complete.\nSetup complete with errors: 1\n", 1],
    ["missing log", null, 1],
    ["unfinished setup", "Installing dependencies\n", 1],
    ["embedded sentinel", "echo Setup complete.\n", 1],
    ["sentinel suffix", "Setup complete. failed\n", 1],
  ]) {
    it(name, (context) => {
      const root = fixture(context);
      tree(root);
      if (log !== null) write(root, ".devcontainer-install.log", log);
      const result = runConsumer(root, "check_post_create_log");
      assert.equal(result.status, expected, result.stdout + result.stderr);
      if (log !== null) assert.equal(fs.readFileSync(path.join(root, "output/post-create.log"), "utf8"), log);
      if (name === "legacy warnings") {
        assert.equal(fs.readFileSync(path.join(root, "output/warnings.txt"), "utf8"), "optional tool\n");
      }
      if (name === "warnings without details") {
        assert.match(fs.readFileSync(path.join(root, "output/warnings.txt"), "utf8"), /reported warnings/);
      }
    });
  }
});

describe("manual evaluator contracts", () => {
  it("keeps the validation variant separate from os-release VARIANT metadata", (context) => {
    const root = fixture(context);
    tree(root);
    write(root, "os-release", 'ID=azurelinux\nVERSION_ID=4.0\nVARIANT="Container Image"\n');
    const result = runConsumer(
      root,
      'source ./os-release\nprintf "%s\\n" "$VALIDATION_VARIANT" "$VARIANT" "$ID" "$VERSION_ID"',
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(result.stdout, "candidate\nContainer Image\nazurelinux\n4.0\n");
  });

  for (const [analyzerFailure, extensionFailure, relativePath] of [
    [false, false, false],
    [true, false, false],
    [false, false, true],
    [false, true, true],
  ]) {
    it(`runs the separately delivered evaluator: analyzerFailure=${analyzerFailure}, extensionFailure=${extensionFailure}, relativePath=${relativePath}`, (context) => {
      const root = fixture(context);
      const workspace = path.join(root, "historical");
      tree(workspace, "historical");
      write(
        workspace,
        ".devcontainer/install/versions.json",
        JSON.stringify({
          python: { version: "3.15.0" },
          node: { version: process.versions.node },
        }),
      );
      write(workspace, ".devcontainer/post-start.sh", "exit 0\n");
      write(root, ".devcontainer-install.log", "Setup complete.\n");
      for (const file of ["validate-devcontainer.sh", "compare-devcontainer-verdicts.mjs"]) {
        write(root, `evaluator/${file}`, fs.readFileSync(path.join(repoRoot, "tools/scripts", file)));
      }
      write(
        root,
        "evaluator/_lib/parse-jsonc.mjs",
        fs.readFileSync(new URL("../scripts/_lib/parse-jsonc.mjs", import.meta.url)),
      );
      fs.symlinkSync(path.join(repoRoot, "node_modules"), path.join(root, "evaluator/node_modules"), "dir");
      write(
        root,
        "tool.mjs",
        `
import fs from "node:fs";
const [command, ...args] = process.argv.slice(2);
fs.appendFileSync(process.env.CALLS, JSON.stringify({ command, args, cwd: process.cwd() }) + "\\n");
if (command === "uname") console.log("aarch64");
else if (command === "id") console.log("1000");
else if (command === "bicep" && args[0] === "build") fs.writeFileSync(args[args.indexOf("--outfile") + 1], "{}");
else if (command === "pwsh" && args.includes("-Command") && process.env.ANALYZER_FAILURE === "true") process.exit(1);
else if (command === "az" && args[0] === "extension" && args[1] === "add" && process.env.EXTENSION_FAILURE === "true") process.exit(1);
else if (command === "az" && args[0] === "extension" && args[1] === "show") console.log("0.0.0");
else console.log("mock tool success");
`,
      );
      for (const command of [
        "uname",
        "id",
        "sudo",
        "npm",
        "npx",
        "uv",
        "az",
        "bicep",
        "pwsh",
        "python3",
        "gh",
        "dot",
        "gitleaks",
        "terraform",
        "azd",
        "azqr",
        "ruff",
        "apex-recall",
      ]) {
        write(
          root,
          `bin/${command}`,
          `#!/bin/sh\nexec "${process.execPath}" "${path.join(root, "tool.mjs")}" "${command}" "$@"\n`,
          { mode: 0o755 },
        );
      }
      const osRelease = fs.readFileSync("/etc/os-release", "utf8");
      const osValue = (key) => new RegExp(`^${key}="?([^"\\n]+)"?$`, "m").exec(osRelease)[1];
      const result = spawnSync(
        "bash",
        [
          relativePath ? "evaluator/validate-devcontainer.sh" : path.join(root, "evaluator/validate-devcontainer.sh"),
          "--variant",
          "candidate",
          "--expected-distro-id",
          osValue("ID"),
          "--expected-os",
          osValue("VERSION_ID"),
          "--expected-arch",
          "arm64",
          "--workspace-root",
          workspace,
          "--output-dir",
          "evidence",
        ],
        {
          cwd: root,
          encoding: "utf8",
          timeout: 30_000,
          env: {
            ...process.env,
            HOME: root,
            PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
            CALLS: path.join(root, "calls.jsonl"),
            ANALYZER_FAILURE: String(analyzerFailure),
            EXTENSION_FAILURE: String(extensionFailure),
          },
        },
      );
      const failed = analyzerFailure || extensionFailure;
      assert.equal(result.status, failed ? 1 : 0, result.stdout + result.stderr);
      const output = JSON.parse(fs.readFileSync(path.join(workspace, "evidence/verdict.json"), "utf8"));
      assert.deepEqual(output.checks.map((check) => check.name).sort(), [...REQUIRED_CHECKS].sort());
      assert.equal(output.observed_arch, "arm64");
      assert.equal(output.status, failed ? "FAIL" : "PASS");
      assert.equal(
        output.checks.find((check) => check.name === "powershell-analyzer").status,
        analyzerFailure ? "FAIL" : "PASS",
      );
      assert.equal(
        output.checks.find((check) => check.name === "azure-cli-extensions").status,
        extensionFailure ? "FAIL" : "PASS",
      );
      const calls = fs.readFileSync(path.join(root, "calls.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
      assert.ok(calls.filter(({ command }) => command === "npm").every(({ cwd }) => cwd === workspace));
      assert.deepEqual(
        calls.filter(({ command, args }) => command === "npm" && args[0] === "run").map(({ args }) => args[1]),
        ["format:check", "test:git-hooks", "validate:all"],
      );
      assert.ok(
        calls.some(
          ({ command, args }) => command === "pwsh" && args.join(" ").includes("Import-Module PSScriptAnalyzer"),
        ),
      );
      assert.ok(calls.some(({ command, args }) => command === "sudo" && args.join(" ") === "-n true"));
      assert.equal(fs.existsSync(path.join(workspace, "evidence/.work")), false);
    });
  }

  it(
    "installs an Azure CLI extension from a local wheel without any package index",
    {
      skip: process.env.APEX_TEST_REAL_AZURE_CLI !== "1",
    },
    (context) => {
      const root = fixture(context);
      tree(root);
      const result = runConsumer(root, "check_azure_cli_extension");
      assert.equal(result.status, 0, result.stdout + result.stderr);
    },
  );

  it("rejects reused output directories without deleting existing evidence", (context) => {
    const root = fixture(context);
    tree(root);
    write(root, "output/keep.log", "prior evidence");
    const result = runConsumer(root, "exit 99");
    assert.equal(result.status, 2, result.stderr);
    assert.equal(fs.readFileSync(path.join(root, "output/keep.log"), "utf8"), "prior evidence");
  });

  it("rejects missing arguments rather than looping or running an implicit check", (context) => {
    const root = fixture(context);
    for (const args of [["--expected-os"], ["--variant", "--expected-os"], ["--expected-distro-id", ""]]) {
      const result = spawnSync("bash", [runner, ...args], { cwd: root, encoding: "utf8", timeout: 5000 });
      assert.equal(result.status, 2, result.stdout + result.stderr);
      assert.match(result.stderr, /Missing value/);
    }
  });

  for (const [uname, expected] of [
    ["x86_64", "amd64"],
    ["aarch64", "arm64"],
    ["amd64", "amd64"],
    ["arm64", "arm64"],
  ]) {
    it(`normalizes uname ${uname} without a distro-specific package manager`, (context) => {
      const root = fixture(context);
      tree(root);
      const result = runConsumer(root, `normalize_arch ${uname}`);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, expected);
    });
  }

  it("reports unsupported architectures without mapping them to an accepted native leg", (context) => {
    const root = fixture(context);
    tree(root);
    const result = runConsumer(root, "normalize_arch riscv64");
    assert.equal(result.status, 1, result.stderr);
    assert.equal(result.stdout, "riscv64");
  });

  it("keeps missing optional azqr as WARN and command failures as FAIL", (context) => {
    const root = fixture(context);
    tree(root);
    const result = runConsumer(
      root,
      "command() { return 1; }\ncheck_optional_azqr\nrun_check powershell-analyzer compatibility false",
    );
    assert.equal(result.status, 0, result.stderr);
    const checks = fs.readFileSync(path.join(root, "output/checks.tsv"), "utf8");
    assert.match(checks, /azqr\tWARN\tcompatibility\toptional azqr unavailable/);
    assert.match(checks, /powershell-analyzer\tFAIL/);
    assert.match(fs.readFileSync(path.join(root, "output/warnings.txt"), "utf8"), /optional azqr unavailable/);
  });

  it("uses an explicit workspace when the evaluator is delivered elsewhere, and installs that tree's dependencies", (context) => {
    const root = fixture(context);
    const workspace = path.join(root, "historical");
    tree(workspace, "historical dependencies");
    write(workspace, "site/package.json", "{}");
    write(
      workspace,
      "bin/npm",
      '#!/bin/sh\nprintf "%s:%s\\n" "$PWD" "$*" >> "$HOME/npm-calls"\ngrep -q "historical dependencies" package.json\n',
      { mode: 0o755 },
    );
    write(workspace, "bin/uv", '#!/bin/sh\nprintf "%s:%s\\n" "$PWD" "$*" >> "$HOME/uv-calls"\n', { mode: 0o755 });
    write(workspace, "bin/python3", "#!/bin/sh\nexit 99\n", { mode: 0o755 });
    const result = runConsumer(workspace, "prepare_test_dependencies", {
      cwd: root,
      env: { PATH: `${path.join(workspace, "bin")}:${process.env.PATH}` },
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.equal(
      fs.readFileSync(path.join(workspace, "npm-calls"), "utf8"),
      `${workspace}:ci\n${workspace}:ci --prefix site\n`,
    );
    assert.equal(
      fs.readFileSync(path.join(workspace, "uv-calls"), "utf8"),
      `${workspace}:pip install --python ${path.join(workspace, "bin/python3")} --quiet -e ${workspace}/tools/apex-recall\n`,
    );
  });
});

const workflowUrl = new URL("../../.github/workflows/validate-devcontainer-base.yml", import.meta.url);
describe("isolated workflow tree consumers", { skip: !fs.existsSync(workflowUrl) }, () => {
  const workflow = load(fs.readFileSync(workflowUrl, "utf8"));
  const resolve = workflow.jobs.preflight.steps.find((step) => step.id === "images").run;
  const prepare = workflow.jobs.validate.steps.find(
    (step) => step.name === "Prepare credential-free evaluator mount",
  ).run;
  const candidateImage = `mcr.microsoft.com/azurelinux-beta/base/core:4.0@${workflow.env.CANDIDATE_DIGEST}`;
  const buildConfig = '{"build":{"dockerfile":"layers/Base.Dockerfile","context":"."},"features":{"example":{}}}';

  function setup(
    context,
    baseline = '{"image":"ubuntu:24.04"}',
    candidate = buildConfig,
    docker = `FROM ${candidateImage}\nRUN true\n`,
  ) {
    const root = fixture(context);
    tree(root, "candidate");
    tree(path.join(root, "validation-source"), "historical");
    write(root, "baseline-config", baseline);
    write(root, "candidate-config", candidate);
    if (docker !== null) write(root, "candidate-docker", docker);
    write(root, "baseline-docker", "FROM ubuntu:24.04\nRUN baseline-only-installer\n");
    for (const file of ["validate-devcontainer.sh", "compare-devcontainer-verdicts.mjs"]) {
      write(root, `tools/scripts/${file}`, fs.readFileSync(path.join(repoRoot, "tools/scripts", file)));
    }
    write(
      root,
      "git-fixture.mjs",
      `
import fs from "node:fs";
const args = process.argv.slice(2);
fs.appendFileSync("git-calls.jsonl", JSON.stringify(args) + "\\n");
if (args.join(" ") === "rev-parse HEAD") process.stdout.write("candidate-fixture");
else if (args[0] === "rev-parse") process.stdout.write("baseline-fixture");
else {
  const files = {
    "baseline-fixture:.devcontainer/devcontainer.json": "baseline-config",
    "baseline-fixture:.devcontainer/layers/Base.Dockerfile": "baseline-docker",
    "candidate-fixture:.devcontainer/devcontainer.json": "candidate-config",
    "candidate-fixture:.devcontainer/layers/Base.Dockerfile": "candidate-docker",
  };
  if (args[0] !== "show" || !files[args[1]]) process.exit(99);
  process.stdout.write(fs.readFileSync(files[args[1]], "utf8"));
}
`,
    );
    write(root, "bin/git", `#!/bin/sh\nexec "${process.execPath}" "${path.join(root, "git-fixture.mjs")}" "$@"\n`, {
      mode: 0o755,
    });
    return {
      root,
      read: (file) => fs.readFileSync(path.join(root, file), "utf8"),
      run: (script, env = {}) =>
        spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", script], {
          cwd: root,
          encoding: "utf8",
          env: {
            ...process.env,
            ...workflow.env,
            PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
            GITHUB_OUTPUT: path.join(root, "outputs"),
            EVENT_NAME: "pull_request",
            BASE_SHA: "baseline-fixture",
            INPUT_BASELINE_REF: "origin/main",
            INPUT_BASELINE_DISTRO_ID: "ubuntu",
            INPUT_BASELINE_OS: "24.04",
            INPUT_CANDIDATE_DISTRO_ID: "azurelinux",
            INPUT_CANDIDATE_OS: "4.0",
            ...env,
          },
        }),
    };
  }

  it("extracts both immutable revisions rather than reading candidate files for the baseline", (context) => {
    const test = setup(context);
    const result = test.run(resolve);
    assert.equal(result.status, 0, result.stderr);
    assert.match(test.read("outputs"), /baseline_image=ubuntu:24\.04/);
    assert.ok(test.read("outputs").includes(`candidate_image=${candidateImage}`));
    assert.match(test.read("outputs"), /candidate_distro_id=azurelinux\ncandidate_os=4\.0/);
    const calls = test.read("git-calls.jsonl").trim().split("\n").map(JSON.parse);
    assert.ok(calls.some((args) => args[1] === "baseline-fixture:.devcontainer/devcontainer.json"));
    assert.ok(calls.some((args) => args[1] === "candidate-fixture:.devcontainer/layers/Base.Dockerfile"));
  });

  it("reads baseline Dockerfile layers from the baseline revision", (context) => {
    const test = setup(context, buildConfig);
    const result = test.run(resolve);
    assert.equal(result.status, 0, result.stderr);
    assert.match(test.read("outputs"), /baseline_image=ubuntu:24\.04/);
    assert.match(test.read("git-calls.jsonl"), /baseline-fixture:\.devcontainer\/layers\/Base\.Dockerfile/);
  });

  it("extracts the candidate image and retains local Python Feature pins in the independent validation config", (context) => {
    const candidate = JSON.parse(buildConfig);
    candidate.features = { "./features/python": { version: "3.15.0" } };
    const test = setup(context, '{"image":"ubuntu:24.04"}', JSON.stringify(candidate));
    const configPath = "validation-source/.devcontainer/devcontainer.json";
    write(test.root, configPath, JSON.stringify(candidate));
    assert.equal(test.run(resolve).status, 0);
    assert.ok(test.read("outputs").includes(`candidate_image=${candidateImage}`));
    const prepared = test.run(prepare);
    assert.equal(prepared.status, 0, prepared.stderr);
    const derived = parseJsonc(test.read("validation-source/.devcontainer/devcontainer.json"));
    assert.deepEqual(derived.features, candidate.features);
    assert.equal(parseJsonc(test.read(configPath)).features["./features/python"].version, "3.15.0");
  });

  it("uses the historical baseline's official image release rather than a hardcoded Ubuntu minimum", (context) => {
    const test = setup(context, '{"image":"mcr.microsoft.com/devcontainers/base:ubuntu26.04"}');
    const result = test.run(resolve, { INPUT_BASELINE_OS: "" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(test.read("outputs"), /baseline_os=26\.04/);
  });

  for (const registry of ["azurelinux", "azurelinux-beta"]) {
    it(`infers an Azure-Linux-to-Azure-Linux PR baseline from ${registry} without dispatch inputs`, (context) => {
      const test = setup(context, buildConfig);
      write(test.root, "baseline-docker", `FROM mcr.microsoft.com/${registry}/base/core:4.0@sha256:baseline\n`);
      const result = test.run(resolve, { INPUT_BASELINE_DISTRO_ID: "", INPUT_BASELINE_OS: "" });
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(test.read("outputs"), /baseline_distro_id=azurelinux\nbaseline_os=4\.0/);
      assert.ok(test.read("outputs").includes(`candidate_image=${candidateImage}`));
    });
  }

  it("preserves explicitly supplied manual baseline expectations instead of re-deriving them", (context) => {
    const test = setup(context, buildConfig);
    write(test.root, "baseline-docker", "FROM custom.example/base:fixed\n");
    const result = test.run(resolve, {
      EVENT_NAME: "workflow_dispatch",
      INPUT_BASELINE_DISTRO_ID: "custom",
      INPUT_BASELINE_OS: "9.1",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(test.read("outputs"), /baseline_distro_id=custom\nbaseline_os=9\.1/);
  });

  it("manual dispatch selects an explicit complete baseline revision, not a replacement FROM", (context) => {
    const test = setup(context);
    const result = test.run(resolve, { EVENT_NAME: "workflow_dispatch", INPUT_BASELINE_REF: "origin/previous" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(test.read("git-calls.jsonl"), /--end-of-options","origin\/previous\^\{commit\}"/);
    assert.match(test.read("outputs"), /baseline_sha=baseline-fixture\ncandidate_sha=candidate-fixture/);
  });

  it("preserves the tested tree's installers, lockfiles and config while separately delivering the candidate evaluator", (context) => {
    const test = setup(context);
    const configPath = "validation-source/.devcontainer/devcontainer.json";
    const config = parseJsonc(test.read(configPath));
    config.mounts = [{ type: "bind", source: "/private/credentials", target: "/home/vscode/.azure" }];
    config.remoteEnv = { GH_TOKEN: "${localEnv:GH_TOKEN}", PRESERVED: "baseline" };
    write(test.root, configPath, JSON.stringify(config));
    const original = test.read(configPath);
    const result = test.run(prepare);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(test.read("devcontainer-evaluator/source-devcontainer.json"), original);
    assert.equal(test.read("validation-source/package-lock.json"), "historical dependencies");
    assert.equal(test.read("validation-source/.devcontainer/post-create.sh"), "historical install commands");
    assert.equal(test.read("validation-source/.devcontainer/devcontainer-lock.json"), "historical feature locks");
    assert.equal(test.read("devcontainer-evaluator/validate-devcontainer.sh"), runnerSource);
    const derived = JSON.parse(test.read("validation-source/.devcontainer/devcontainer.json"));
    assert.equal(derived.image, config.image);
    assert.deepEqual(derived.features, config.features);
    assert.deepEqual(derived.mounts, [
      `type=bind,source=${path.join(test.root, "devcontainer-evaluator")},target=/opt/apex-evaluator,readonly`,
    ]);
    assert.deepEqual(derived.remoteEnv, { GH_TOKEN: "", GITHUB_TOKEN: "", PRESERVED: "baseline" });
    assert.notEqual(test.run(prepare).status, 0, "must not overwrite an existing evaluator/config");
  });

  it("restores the byte-identical source config before running repository validation", (context) => {
    const test = setup(context);
    const configPath = "validation-source/.devcontainer/devcontainer.json";
    const original = test.read(configPath);
    assert.equal(test.run(prepare).status, 0);
    assert.notEqual(test.read(configPath), original);
    const build = workflow.jobs.validate.steps.find((step) => step.uses === "devcontainers/ci@v0.3");
    write(
      test.root,
      "devcontainer-evaluator/validate-devcontainer.sh",
      '#!/bin/bash\nset -euo pipefail\ncmp .devcontainer/devcontainer.json ../devcontainer-evaluator/source-devcontainer.json\nprintf "original config validated\\n"\n',
    );
    const command = build.with.runCmd.replaceAll(
      "/opt/apex-evaluator/",
      `${path.join(test.root, "devcontainer-evaluator")}/`,
    );
    const result = test.run(`cd validation-source\n${command}`, {
      SELECTED_VARIANT: "candidate",
      SELECTED_DISTRO_ID: "azurelinux",
      SELECTED_OS: "4.0",
      SELECTED_ARCH: "amd64",
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /original config validated/);
    assert.equal(test.read(configPath), original);
    assert.equal(test.read("validation-source/.devcontainer/devcontainer-lock.json"), "historical feature locks");
    assert.equal(
      fs.existsSync(path.join(test.root, "validation-source/.devcontainer/devcontainer.source.json")),
      false,
    );
    fs.rmSync(path.join(test.root, "devcontainer-evaluator/source-devcontainer.json"));
    const missing = test.run(`cd validation-source\n${command}`);
    assert.notEqual(missing.status, 0, "missing original config must block validation");
    assert.doesNotMatch(missing.stdout, /original config validated/);
  });

  it("disables both explicit and automatic caching for candidate-controlled Node setup", () => {
    for (const job of Object.values(workflow.jobs)) {
      const setupNode = job.steps.find((step) => step.uses === "actions/setup-node@v7");
      assert.ok(setupNode, "candidate-controlled jobs need explicit cache-free Node setup");
      assert.equal(setupNode.with.cache, undefined);
      assert.equal(setupNode.with["package-manager-cache"], false);
      assert.ok(job.steps.some((step) => step.run === "npm ci"));
    }
    const action = load(fs.readFileSync(path.join(repoRoot, ".github/actions/setup-node-repo/action.yml"), "utf8"));
    assert.equal(action.runs.steps.find((step) => step.uses === "actions/setup-node@v7").with.cache, "npm");
  });

  for (const [name, config, docker] of [
    ["missing base", "{}", `FROM ${candidateImage}\n`],
    ["conflicting sources", '{"image":"ubuntu:24.04","build":{"dockerfile":"Dockerfile"}}', ""],
    ["malformed JSONC", '{"build":', ""],
    ["missing Dockerfile", buildConfig, null],
    ["ARG base", buildConfig, "ARG BASE=ubuntu:24.04\nFROM ${BASE}\n"],
    ["multiple stages", buildConfig, "FROM ubuntu:24.04 AS base\nFROM base\n"],
    ["no FROM", buildConfig, "RUN true\n"],
    ["outside repository", '{"build":{"dockerfile":"../../external"}}', ""],
    ["unapproved candidate digest", buildConfig, "FROM ubuntu:26.04\n"],
  ]) {
    it(`fails closed for ${name}`, (context) => {
      const test = setup(context, '{"image":"ubuntu:24.04"}', config, docker);
      assert.notEqual(test.run(resolve).status, 0);
      assert.equal(fs.existsSync(path.join(test.root, "outputs")), false);
    });
  }

  it("uses only verified action inputs and retains native independent checkouts and fail-closed aggregation", () => {
    const legs = workflow.jobs.validate.strategy.matrix.include;
    assert.deepEqual(legs.map(({ variant, arch }) => `${variant}-${arch}`).sort(), [
      "baseline-amd64",
      "baseline-arm64",
      "candidate-amd64",
      "candidate-arm64",
    ]);
    assert.ok(legs.filter(({ arch }) => arch === "arm64").every(({ runner }) => runner.endsWith("-arm")));
    assert.match(workflow.jobs.preflight.if, /head\.repo\.full_name == github\.repository/);
    const checkout = workflow.jobs.validate.steps.find((step) => step.name === "Checkout complete validation tree");
    const evaluatorCheckout = workflow.jobs.validate.steps.find((step) => step.name === "Checkout candidate evaluator");
    const preflightCheckout = workflow.jobs.preflight.steps.find(
      (step) => step.name === "Checkout candidate evaluator",
    );
    assert.equal(evaluatorCheckout.with.ref, preflightCheckout.with.ref);
    assert.match(evaluatorCheckout.with.ref, /github\.event\.pull_request\.head\.sha \|\| github\.sha/);
    assert.equal(checkout.with.path, "validation-source");
    assert.match(checkout.with.ref, /baseline_sha.*candidate_sha/);
    assert.equal(checkout.with["persist-credentials"], false);
    const build = workflow.jobs.validate.steps.find((step) => step.uses === "devcontainers/ci@v0.3");
    // Official v0.3/action.yml contract; mounts is not an input in that release.
    assert.deepEqual(Object.keys(build.with).sort(), [
      "checkoutPath",
      "configFile",
      "env",
      "inheritEnv",
      "platform",
      "push",
      "runCmd",
      "useNativeRunner",
    ]);
    assert.equal(build.with.checkoutPath, checkout.with.path);
    assert.equal(build.with.push, "never");
    assert.equal(build.with.inheritEnv, false);
    assert.equal(build.with.useNativeRunner, true);
    assert.match(build.with.runCmd, /bash \/opt\/apex-evaluator\/validate-devcontainer\.sh/);
    const gate = workflow.jobs.compare.steps.find((step) => step.name === "Enforce fail-closed verdict");
    for (const condition of ["needs.preflight.result", "needs.validate.result", "steps.comparison.outcome"]) {
      assert.ok(gate.if.includes(`${condition} != 'success'`));
    }
    assert.equal(gate.run, "exit 1");
  });

  for (const problem of [
    "none",
    "missing-architecture",
    "duplicate-architecture",
    "wrong-platform-digest",
    "wrong-index-digest",
  ]) {
    it(`validates native manifest membership and exact digests: ${problem}`, (context) => {
      const test = setup(context);
      const manifests = [
        { platform: { os: "linux", architecture: "amd64" }, digest: workflow.env.CANDIDATE_AMD64_DIGEST },
        { platform: { os: "linux", architecture: "arm64" }, digest: workflow.env.CANDIDATE_ARM64_DIGEST },
      ];
      if (problem === "missing-architecture") manifests.pop();
      if (problem === "duplicate-architecture") manifests.push(manifests[0]);
      if (problem === "wrong-platform-digest") manifests[1].digest = `sha256:${"0".repeat(64)}`;
      const raw = JSON.stringify({ schemaVersion: 2, manifests });
      write(test.root, "manifest-input.json", raw);
      write(test.root, "bin/docker", `#!/bin/sh\ncat "${path.join(test.root, "manifest-input.json")}"\n`, {
        mode: 0o755,
      });
      fs.mkdirSync(path.join(test.root, "runner"));
      const script = workflow.jobs.preflight.steps.find((step) => step.id === "manifest").run;
      const result = test.run(script, {
        CANDIDATE_IMAGE: candidateImage,
        CANDIDATE_DIGEST:
          problem === "wrong-index-digest"
            ? workflow.env.CANDIDATE_DIGEST
            : `sha256:${createHash("sha256").update(raw).digest("hex")}`,
        RUNNER_TEMP: path.join(test.root, "runner"),
      });
      assert.equal(result.status === 0, problem === "none", result.stdout + result.stderr);
      assert.equal(fs.existsSync(path.join(test.root, "outputs")), problem === "none");
    });
  }
});
