import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { configureMcp } from "../../../.devcontainer/configure-mcp.mjs";
import { parseJsonc } from "../../scripts/_lib/parse-jsonc.mjs";

const setup = fs.readFileSync(new URL("../../../.devcontainer/post-create.sh", import.meta.url), "utf8");
function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "apex-setup-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("MCP updates preserve comments, custom values, unrelated servers and repeat-run bytes", (context) => {
  const file = path.join(fixture(context), "mcp.json");
  fs.writeFileSync(
    file,
    '{\n// keep this\n"inputs":[],"servers":{"azure-mcp":{"command":"custom","args":["pinned"]},"private":{"url":"https://example.test"},},\n}\n',
  );
  configureMcp(file);
  const once = fs.readFileSync(file, "utf8");
  assert.match(once, /\/\/ keep this/);
  const data = parseJsonc(once);
  assert.deepEqual(data.servers["azure-mcp"], { command: "custom", args: ["pinned"] });
  assert.deepEqual(data.servers.private, { url: "https://example.test" });
  assert.deepEqual(data.inputs, []);
  assert.ok(data.servers.github);
  assert.ok(data.servers["azure-resource-manager-mcp"]);
  configureMcp(file);
  assert.equal(fs.readFileSync(file, "utf8"), once);
});

test("MCP rejects malformed and invalid configuration without altering it", (context) => {
  const file = path.join(fixture(context), "mcp.json");
  for (const content of ["{broken", "[]", '{"servers":null}', '{"servers":[]}']) {
    fs.writeFileSync(file, content);
    assert.throws(() => configureMcp(file));
    assert.equal(fs.readFileSync(file, "utf8"), content);
  }
});

test("MCP initializes missing configuration without touching credentials", (context) => {
  const file = path.join(fixture(context), ".vscode/mcp.json");
  configureMcp(file);
  assert.equal(Object.keys(parseJsonc(fs.readFileSync(file, "utf8")).servers).length, 3);
});

test("MCP validator accepts preserved commands but rejects malformed and retired entries", (context) => {
  const root = fixture(context);
  fs.mkdirSync(path.join(root, "tools/scripts"), { recursive: true });
  fs.cpSync(new URL("../../scripts/_lib", import.meta.url), path.join(root, "tools/scripts/_lib"), { recursive: true });
  fs.copyFileSync(
    new URL("../../scripts/validate-mcp-config.mjs", import.meta.url),
    path.join(root, "tools/scripts/validate-mcp-config.mjs"),
  );
  fs.symlinkSync(new URL("../../../node_modules", import.meta.url), path.join(root, "node_modules"), "dir");
  const file = path.join(root, ".vscode/mcp.json");
  configureMcp(file);
  const defaults = parseJsonc(fs.readFileSync(file, "utf8"));
  const check = (config) => {
    fs.writeFileSync(file, JSON.stringify(config));
    return spawnSync(process.execPath, [path.join(root, "tools/scripts/validate-mcp-config.mjs")], { encoding: "utf8" })
      .status;
  };
  for (const server of [
    { type: "stdio", command: "npx", args: ["-y", "@azure/mcp@2.0.0", "server", "start", "--read-only"] },
    { type: "stdio", command: "/opt/custom/azure-mcp" },
  ])
    assert.equal(check({ servers: { ...defaults.servers, "azure-mcp": server } }), 0);
  for (const server of [
    { type: "stdio", command: "" },
    { type: "stdio", command: "npx", args: [null] },
    { type: "http", command: "npx" },
  ])
    assert.notEqual(check({ servers: { ...defaults.servers, "azure-mcp": server } }), 0);
  for (const retired of ["azure-pricing", "drawio", "astro-docs", "terraform"]) {
    assert.notEqual(check({ servers: { ...defaults.servers, [retired]: null } }), 0);
  }
  assert.notEqual(check({ servers: [] }), 0);
});

test("tool version gate supports Azure CLI Bicep fallback without waiving minimums", (context) => {
  const root = fixture(context);
  fs.mkdirSync(path.join(root, "bin"));
  fs.mkdirSync(path.join(root, "tools/scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, "tools/registry"), { recursive: true });
  fs.cpSync(new URL("../../scripts/_lib", import.meta.url), path.join(root, "tools/scripts/_lib"), { recursive: true });
  fs.copyFileSync(
    new URL("../../scripts/validate-tool-versions.mjs", import.meta.url),
    path.join(root, "tools/scripts/validate-tool-versions.mjs"),
  );
  fs.writeFileSync(
    path.join(root, "tools/registry/tool-version-pins.json"),
    JSON.stringify({ pins: { bicep: { min: "0.21.0", check_cmd: "bicep --version", parser: "bicep" } } }),
  );
  fs.writeFileSync(path.join(root, "bin/bicep"), "#!/bin/sh\nexit 127\n", { mode: 0o755 });
  fs.writeFileSync(
    path.join(root, "bin/az"),
    '#!/bin/sh\n[ "$1 $2" = "bicep version" ] || exit 9\nprintf "Bicep CLI version %s\\n" "$BICEP_VERSION"\nexit "$BICEP_EXIT"\n',
    { mode: 0o755 },
  );
  for (const [version, exit, expected] of [
    ["0.46.1", "0", 0],
    ["0.20.0", "0", 1],
    ["invalid", "0", 1],
    ["0.46.1", "1", 1],
  ]) {
    const result = spawnSync(process.execPath, [path.join(root, "tools/scripts/validate-tool-versions.mjs")], {
      encoding: "utf8",
      env: { ...process.env, PATH: `${root}/bin:${process.env.PATH}`, BICEP_VERSION: version, BICEP_EXIT: exit },
    });
    assert.equal(result.status, expected, result.stdout + result.stderr);
  }
});

for (const failure of [
  "",
  "npm",
  "uv",
  "python3",
  "apex-recall",
  "pwsh",
  "gitleaks",
  "terraform",
  "az",
  "bicep",
  "node",
]) {
  test(`setup ${failure ? `stops on ${failure} failure` : "succeeds with one dependency install"}`, (context) => {
    const root = fixture(context);
    for (const directory of ["bin", ".cache/uv", ".config/gh", ".terraform.d/plugin-cache"]) {
      fs.mkdirSync(path.join(root, directory), { recursive: true });
    }
    const calls = path.join(root, "calls");
    fs.writeFileSync(calls, "");
    for (const command of [
      "npm",
      "uv",
      "python3",
      "apex-recall",
      "pwsh",
      "gitleaks",
      "terraform",
      "az",
      "bicep",
      "node",
      "sudo",
      "git",
      "curl",
      "pip",
      "pip3",
    ]) {
      fs.writeFileSync(
        path.join(root, "bin", command),
        `#!/bin/sh\nprintf '%s\\n' '${command}' >> "$CALL_LOG"\nif [ '${command}' = npm ] && [ "$1" = --version ]; then echo 12.0.2; exit 0; fi\nif [ '${command}' = "$FAIL_COMMAND" ]; then exit 17; fi\nexit 0\n`,
        { mode: 0o755 },
      );
    }
    const result = spawnSync("bash", ["-c", setup], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: root,
        PATH: `${root}/bin:${process.env.PATH}`,
        TF_PLUGIN_CACHE_DIR: `${root}/.terraform.d/plugin-cache`,
        CALL_LOG: calls,
        FAIL_COMMAND: failure,
      },
    });
    const commands = fs.readFileSync(calls, "utf8").trim().split("\n");
    const log = fs.readFileSync(path.join(root, ".devcontainer-install.log"), "utf8");
    const validator = fs.readFileSync(new URL("../../scripts/validate-devcontainer.sh", import.meta.url), "utf8");
    const consumer = validator.slice(0, validator.indexOf("# Environment metadata and invariants."));
    const summary = spawnSync(
      "bash",
      [
        "-s",
        "--",
        "--variant",
        "candidate",
        "--expected-os",
        "26.04",
        "--expected-arch",
        "amd64",
        "--output-dir",
        path.join(root, "verdict"),
      ],
      {
        input: `${consumer}\ncheck_post_create_log\n`,
        encoding: "utf8",
        env: { ...process.env, HOME: root },
      },
    );
    assert.equal(summary.status, failure ? 1 : 0, summary.stdout + summary.stderr);
    assert.equal(/^Setup complete\.$/m.test(log), !failure);
    assert.equal(result.status, failure ? 17 : 0, result.stdout + result.stderr);
    assert.ok(!commands.some((command) => ["sudo", "git", "curl", "pip", "pip3"].includes(command)));
    if (!failure) {
      assert.equal(commands.filter((command) => command === "uv").length, 2);
      assert.match(result.stdout, /Setup complete/);
    } else assert.doesNotMatch(result.stdout, /Setup complete/);
  });
}

test("PowerShell module installation surfaces actual installation and verification failures", () => {
  const command = setup.match(/pwsh -NoProfile -NonInteractive -Command '([\s\S]*?)'\n/)[1];
  for (const behavior of ["throw", "missing", "present"]) {
    const mocks = `function Get-Module { param($Name, [switch]$ListAvailable) ${behavior === "present" ? "return @{ Name = $Name }" : ""} }\nfunction Install-Module { ${behavior === "throw" ? 'throw "fixture failure"' : ""} }\n`;
    const result = spawnSync("pwsh", ["-NoProfile", "-NonInteractive", "-Command", mocks + command], {
      encoding: "utf8",
    });
    assert.equal(result.status, behavior === "present" ? 0 : 1, result.stdout + result.stderr);
  }
});
