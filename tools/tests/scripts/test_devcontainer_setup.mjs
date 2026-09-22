import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { configureMcp, azureMcpReleaseStatus, checkAzureMcpRelease } from "../../../.devcontainer/configure-mcp.mjs";
import { parseJsonc } from "../../scripts/_lib/parse-jsonc.mjs";

const setup = fs.readFileSync(new URL("../../../.devcontainer/post-create.sh", import.meta.url), "utf8");
const startup = new URL("../../../.devcontainer/post-start.sh", import.meta.url).pathname;
function fixture(context) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "apex-setup-"));
  context.after(() => fs.rmSync(root, { recursive: true, force: true }));
  return root;
}

test("extension policy requires exclusions and rejects direct or pinned duplicate providers", (context) => {
  const root = fixture(context);
  fs.mkdirSync(path.join(root, "tools/scripts"), { recursive: true });
  fs.mkdirSync(path.join(root, ".devcontainer"));
  fs.cpSync(new URL("../../scripts/_lib", import.meta.url), path.join(root, "tools/scripts/_lib"), { recursive: true });
  const validator = path.join(root, "tools/scripts/validate-extension-bloat.mjs");
  fs.copyFileSync(new URL("../../scripts/validate-extension-bloat.mjs", import.meta.url), validator);
  fs.symlinkSync(new URL("../../../node_modules", import.meta.url), path.join(root, "node_modules"), "dir");
  const config = parseJsonc(
    fs.readFileSync(new URL("../../../.devcontainer/devcontainer.json", import.meta.url), "utf8"),
  );
  const extensions = config.customizations.vscode.extensions;
  const check = (entries) => {
    fs.writeFileSync(
      path.join(root, ".devcontainer/devcontainer.json"),
      JSON.stringify({ customizations: { vscode: { extensions: entries } } }),
    );
    return spawnSync(process.execPath, [validator], { encoding: "utf8" });
  };
  const valid = check(extensions);
  assert.equal(valid.status, 0, valid.stdout + valid.stderr);
  assert.equal(check(extensions.map((entry) => entry.toUpperCase())).status, 0);
  for (const id of [
    "ms-vscode.vscode-node-azure-pack",
    "ms-azuretools.vscode-azure-github-copilot",
    "ms-azuretools.vscode-azure-mcp-server",
    "ms-windows-ai-studio.windows-ai-studio",
    "teamsdevapp.vscode-ai-foundry",
  ]) {
    const missing = check(extensions.filter((entry) => entry !== `-${id}`));
    assert.equal(missing.status, 1, missing.stdout + missing.stderr);
    assert.match(missing.stdout, /Missing extension install exclusion/);
    for (const entry of [id, `${id}@2.0.46`, `${id.toUpperCase()}@prerelease`]) {
      const duplicate = check([...extensions, entry]);
      assert.equal(duplicate.status, 1, duplicate.stdout + duplicate.stderr);
      assert.match(duplicate.stdout, /Bloat extension declared/);
    }
  }
});

for (const scenario of ["current", "outdated", "offline", "timeout", "missing-npm"]) {
  test(`startup release check is advisory and read-only: ${scenario}`, (context) => {
    const root = fixture(context);
    const bin = path.join(root, "bin");
    fs.mkdirSync(bin);
    const calls = path.join(root, "calls");
    fs.writeFileSync(calls, "");
    if (scenario !== "missing-npm") {
      fs.writeFileSync(
        path.join(bin, "npm"),
        '#!/bin/bash\nprintf "%s\\n" "$*" >> "$CALL_LOG"\nprintf "%s\\n" "$RELEASE_RESULT"\nexit "$RELEASE_EXIT"\n',
        { mode: 0o755 },
      );
    }
    fs.writeFileSync(path.join(bin, "azd"), '#!/bin/bash\nprintf "azd %s\\n" "$*" >> "$CALL_LOG"\nexit 0\n', {
      mode: 0o755,
    });
    fs.mkdirSync(path.join(root, ".vscode"));
    const config = path.join(root, ".vscode", "mcp.json");
    fs.writeFileSync(config, '{"servers":{"azure-mcp":{"command":"custom"}}}\n');
    const original = fs.readFileSync(config, "utf8");
    const result = spawnSync("/bin/bash", [startup], {
      cwd: root,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: bin,
        CALL_LOG: calls,
        RELEASE_RESULT: scenario === "current" ? '{"status":"CURRENT"}' : `fixture ${scenario}`,
        RELEASE_EXIT: scenario === "current" ? "0" : "1",
      },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /Container ready/);
    assert.match(result.stdout, /azd auth\s+authenticated/);
    if (scenario === "current") {
      assert.match(result.stdout, /Azure MCP release\s+current/);
      assert.doesNotMatch(result.stdout, /WARNING/);
    } else {
      assert.match(result.stdout, /WARNING/);
      assert.match(result.stdout, /npm run check:mcp-release/);
    }
    assert.deepEqual(fs.readFileSync(calls, "utf8").trim().split("\n"), [
      ...(scenario === "missing-npm" ? [] : ["run --silent check:mcp-release"]),
      "azd auth token --output json",
    ]);
    assert.equal(fs.readFileSync(config, "utf8"), original);
  });
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

test("Azure MCP release checks reject outdated, prerelease, malformed and unavailable metadata without writes", (context) => {
  const file = path.join(fixture(context), "mcp.json");
  configureMcp(file);
  const original = fs.readFileSync(file, "utf8");
  const config = parseJsonc(original);
  const server = config.servers["azure-mcp"];
  const pinned = server.args[1].slice("@azure/mcp@".length);
  assert.deepEqual(server.env, { NPM_CONFIG_ALLOW_REMOTE: "all" });
  const workspace = parseJsonc(fs.readFileSync(new URL("../../../.vscode/mcp.json", import.meta.url), "utf8"));
  assert.deepEqual(workspace.servers["azure-mcp"], server);
  assert.equal(checkAzureMcpRelease(file, () => JSON.stringify(["0.1.0", "999.0.0-beta.1", pinned])).status, "CURRENT");
  const newer = `${Number(pinned.split(".")[0]) + 1}.0.0`;
  assert.equal(azureMcpReleaseStatus(config, [pinned, newer]).status, "UPDATE_REQUIRED");
  assert.equal(azureMcpReleaseStatus(config, ["2.9.0", "2.10.0"]).latestStable, "2.10.0");
  for (const value of [[], [null], {}, ["3.0.0-beta.1"]]) {
    assert.throws(() => azureMcpReleaseStatus(config, value));
  }
  for (const version of ["latest", "next", "3.0.0-beta.1", "^2.0.0"]) {
    const changed = structuredClone(config);
    changed.servers["azure-mcp"].args[1] = `@azure/mcp@${version}`;
    assert.throws(() => azureMcpReleaseStatus(changed, [pinned]));
  }
  const drift = structuredClone(config);
  drift.servers["azure-mcp"].args[1] = `@azure/mcp@${newer}`;
  assert.equal(azureMcpReleaseStatus(drift, [newer]).status, "UPDATE_REQUIRED");
  assert.throws(() => checkAzureMcpRelease(file, () => "invalid JSON"));
  assert.throws(() =>
    checkAzureMcpRelease(file, () => {
      throw new Error("network unavailable");
    }),
  );
  assert.equal(fs.readFileSync(file, "utf8"), original);
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
