import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parseJsonc } from "../../scripts/_lib/parse-jsonc.mjs";

const containerDir = new URL("../../../.devcontainer/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("download-checksums.json", containerDir), "utf8"));

function fixture(context, architecture = "amd64", missingMember = false) {
  const root = mkdtempSync(path.join(tmpdir(), "apex-build-test-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const directory of ["bin", "downloads", "installed", "temp", "source"]) {
    mkdirSync(path.join(root, directory));
  }
  copyFileSync(new URL("install-build-tools.sh", containerDir), path.join(root, "install-build-tools.sh"));
  const localManifest = structuredClone(manifest);
  const target = architecture === "arm64" ? "aarch64-unknown-linux-gnu" : "x86_64-unknown-linux-gnu";
  mkdirSync(path.join(root, "source", `uv-${target}`));
  writeFileSync(path.join(root, "source", `uv-${target}`, "uv"), "fixture uv");
  writeFileSync(path.join(root, "source", `uv-${target}`, "uvx"), "fixture uvx");
  writeFileSync(path.join(root, "source", "gitleaks"), "fixture gitleaks");
  writeFileSync(path.join(root, "source", "terraform"), "fixture terraform");
  writeFileSync(path.join(root, "source", "bicep"), "fixture bicep");
  writeFileSync(path.join(root, "source", `azd-linux-${architecture}`), "fixture azd");
  const ghDirectory = `gh_${manifest.gh.version}_linux_${architecture}/bin`;
  mkdirSync(path.join(root, "source", ghDirectory), { recursive: true });
  writeFileSync(path.join(root, "source", ghDirectory, "gh"), "fixture gh");
  writeFileSync(path.join(root, "source", "other"), "fixture missing member");
  for (const tool of ["uv", "gitleaks", "terraform", "gh", "bicep", "azd"]) {
    const archive = path.join(root, "downloads", `${tool}.download`);
    if (tool === "bicep") {
      copyFileSync(path.join(root, "source", tool), archive);
    } else {
      const member =
        tool === "uv"
          ? `uv-${target}`
          : tool === "gh"
            ? `${ghDirectory}/gh`
            : missingMember === true || missingMember === tool
              ? "other"
              : tool === "azd"
                ? `azd-linux-${architecture}`
                : tool;
      const packed =
        tool === "terraform"
          ? spawnSync("python3", ["-m", "zipfile", "-c", archive, member], { cwd: path.join(root, "source") })
          : spawnSync("tar", ["-czf", archive, "-C", path.join(root, "source"), member], { encoding: "utf8" });
      assert.equal(packed.status, 0, packed.stderr?.toString());
    }
    localManifest[tool].artifacts[architecture].sha256 = createHash("sha256")
      .update(readFileSync(archive))
      .digest("hex");
  }
  writeFileSync(path.join(root, "download-checksums.json"), JSON.stringify(localManifest));
  writeFileSync(
    path.join(root, "mock.mjs"),
    String.raw`import {appendFileSync, copyFileSync, writeFileSync} from "node:fs";
import path from "node:path";
import {spawnSync} from "node:child_process";
const [command, ...args] = process.argv.slice(2);
const root = process.env.FIXTURE_ROOT;
appendFileSync(path.join(root, "commands.jsonl"), JSON.stringify({command, args}) + "\n");
if (command === "uname") {
  process.stdout.write(process.env.TEST_ARCH + "\n");
} else if (command === "curl") {
  const url = args.at(-1);
  const tool = url.includes("/gitleaks/") ? "gitleaks" : url.includes("/terraform/") ? "terraform" : url.includes("/cli/cli/") ? "gh" : url.includes("/Azure/bicep/") ? "bicep" : url.includes("/Azure/azure-dev/") ? "azd" : "uv";
  if (process.env.TEST_FAILURE === "download-" + tool) process.exit(22);
  const output = args[args.indexOf("--output") + 1];
  if (!output.startsWith(root + path.sep)) process.exit(98);
  if (process.env.TEST_FAILURE === "corrupt-" + tool) writeFileSync(output, "corrupt archive");
  else copyFileSync(path.join(root, "downloads", tool + ".download"), output);
} else if (command === "install") {
  const source = args.at(-2);
  const destination = args.at(-1);
  if (!source.startsWith(root + path.sep) || !/^\/usr\/local\/bin\/(uv|uvx|gitleaks|terraform|gh|bicep|azd)$/.test(destination)) process.exit(98);
  if (process.env.TEST_FAILURE === "install") process.exit(1);
  copyFileSync(source, path.join(root, "installed", path.basename(destination)));
} else if (command === "tar" || command === "sha256sum" || command === "unzip") {
  const result = spawnSync("/usr/bin/" + command, args, {stdio: "inherit"});
  process.exit(result.status ?? 1);
} else {
  process.stderr.write("Unexpected package or privilege command: " + command);
  process.exit(99);
}
`,
  );
  const syntax = spawnSync(process.execPath, ["--check", path.join(root, "mock.mjs")], { encoding: "utf8" });
  assert.equal(syntax.status, 0, syntax.stderr);
  for (const command of ["uname", "curl", "install", "tar", "unzip", "sha256sum", "apt-get", "sudo"]) {
    writeFileSync(
      path.join(root, "bin", command),
      `#!/bin/sh\nexec "${process.execPath}" "${path.join(root, "mock.mjs")}" "${command}" "$@"\n`,
      { mode: 0o755 },
    );
  }
  return {
    root,
    run(failure = "", arch = architecture, tools = []) {
      const result = spawnSync("bash", [path.join(root, "install-build-tools.sh"), ...tools], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
          TMPDIR: path.join(root, "temp"),
          FIXTURE_ROOT: root,
          TEST_ARCH: arch === "amd64" ? "x86_64" : arch === "arm64" ? "aarch64" : arch,
          TEST_FAILURE: failure,
        },
      });
      const calls = readFileSync(path.join(root, "commands.jsonl"), "utf8").trim().split("\n").map(JSON.parse);
      assert.deepEqual(readdirSync(path.join(root, "temp")), [], "temporary downloads must be cleaned up");
      assert.ok(!calls.some(({ command }) => command === "apt-get" || command === "sudo"));
      return { ...result, calls, installed: readdirSync(path.join(root, "installed")) };
    },
  };
}

test("build uses Azure Linux 4 with explicit user prerequisites and preserves host interfaces", () => {
  const config = parseJsonc(readFileSync(new URL("devcontainer.json", containerDir), "utf8"));
  const lock = JSON.parse(readFileSync(new URL("devcontainer-lock.json", containerDir), "utf8"));
  const dockerfile = readFileSync(new URL("Dockerfile", containerDir), "utf8");
  assert.deepEqual(config.build, { dockerfile: "Dockerfile", context: "." });
  assert.equal(config.image, undefined);
  const expectedImage =
    process.env.APEX_EXPECTED_BASE_IMAGE ??
    "mcr.microsoft.com/azurelinux-beta/base/core:4.0@sha256:63ef5dda2fb5681ae3aa5c9597a8c4b24364da91ec459b419fa3c38160595fae";
  assert.equal(dockerfile.split("\n")[0], `FROM ${expectedImage}`);
  assert.match(dockerfile, /dnf install -y/);
  assert.match(dockerfile, /graphviz bats/);
  assert.match(dockerfile, /findutils coreutils-single\b/);
  assert.match(dockerfile, /\bdiffutils\b/);
  assert.match(dockerfile, /krb5-libs libatomic openssl-libs/);
  assert.match(dockerfile, /\bunzip\b/);
  assert.doesNotMatch(dockerfile, /apt-get|dos2unix|DEBIAN_FRONTEND/);
  assert.match(dockerfile, /useradd --uid 1000 --gid vscode/);
  assert.match(dockerfile, /NOPASSWD:ALL/);
  assert.match(dockerfile, /visudo --check/);
  assert.match(dockerfile, /COPY install-build-tools\.sh download-checksums\.json \/tmp\/apex-build-tools\//);
  assert.match(dockerfile, /bash \/tmp\/apex-build-tools\/install-build-tools\.sh/);
  assert.match(dockerfile, /install -d -m 0755 -o vscode -g vscode/);
  assert.match(
    readFileSync(new URL("post-create.sh", containerDir), "utf8"),
    /sudo -n chown -R .*\/usr\/local\/python\/current/,
  );
  assert.match(dockerfile, /\/home\/vscode\/\.terraform\.d\/plugin-cache/);
  for (const [name, value] of Object.entries({
    NPM_CONFIG_REGISTRY: "https://${localEnv:APEX_NPM_REGISTRY_HOST_PATH:registry.npmjs.org/}",
    PIP_INDEX_URL: "https://${localEnv:APEX_PIP_INDEX_HOST_PATH:pypi.org/simple/}",
    UV_INDEX_URL: "https://${localEnv:APEX_PIP_INDEX_HOST_PATH:pypi.org/simple/}",
  })) {
    assert.equal(config.containerEnv[name], value, `${name} must be set for the running container`);
    // The Microsoft CFS proxy is opt-in for Microsoft maintainers; it must never be the default.
    assert.doesNotMatch(config.containerEnv[name], /microsoft\.io/, `${name} must default to a public registry`);
    // The CLI cuts a localEnv default at its first colon, so keep the scheme outside the expression.
    assert.doesNotMatch(
      config.containerEnv[name],
      /\$\{localEnv:[^}]*:[^}]*:/,
      `${name} default must not contain a colon`,
    );
    assert.ok(!dockerfile.includes(`${name}=`), `${name} must not change image or Feature builds`);
  }
  assert.equal(config.onCreateCommand, "az version --output none");
  assert.equal(config.postCreateCommand, "bash .devcontainer/post-create.sh");
  assert.equal(config.remoteUser, "vscode");
  assert.equal(config.remoteEnv.GH_TOKEN, "${localEnv:GH_TOKEN}");
  assert.ok(config.features["ghcr.io/devcontainers/features/node:2"]);
  assert.equal(config.features["ghcr.io/azure/azure-dev/azd:latest"], undefined);
  assert.equal(lock.features["ghcr.io/azure/azure-dev/azd:latest"], undefined);
  assert.deepEqual(config.overrideFeatureInstallOrder, ["./features/python", "./features/azure-cli"]);
  for (const [name, options] of Object.entries(config.features)) {
    assert.ok(name.startsWith("./") || name.startsWith("ghcr.io/"), `Invalid Feature reference: ${name}`);
    assert.ok(options && typeof options === "object" && !Array.isArray(options), name);
  }
  for (const feature of Object.keys(config.features).filter((name) => name.startsWith("ghcr.io/"))) {
    assert.ok(lock.features[feature], `Missing feature lock: ${feature}`);
  }
  assert.ok(
    config.mounts.some(({ target, type }) => target === config.containerEnv.TF_PLUGIN_CACHE_DIR && type === "volume"),
  );
  assert.ok(config.mounts.some(({ source }) => source === "${localEnv:USERPROFILE}${localEnv:HOME}/.azure"));
});

test("Python Feature prepends its interpreter to the inherited Dockerfile PATH", () => {
  const feature = JSON.parse(readFileSync(new URL("features/python/devcontainer-feature.json", containerDir), "utf8"));
  assert.equal(feature.containerEnv.PATH, "/usr/local/python/current/bin:${PATH}");
});

test("release manifest pins both architectures to versioned upstream assets and checksum sources", () => {
  const upstream = {
    uv: { prefix: "https://github.com/astral-sh/uv", tag: (version) => version },
    gitleaks: { prefix: "https://github.com/gitleaks/gitleaks", tag: (version) => `v${version}` },
    // The upstream azqr release tags carry a literal "v." prefix.
    azqr: { prefix: "https://github.com/Azure/azqr", tag: (version) => `v.${version}` },
    gh: { prefix: "https://github.com/cli/cli", tag: (version) => `v${version}` },
    bicep: { prefix: "https://github.com/Azure/bicep", tag: (version) => `v${version}` },
    azd: { prefix: "https://github.com/Azure/azure-dev", tag: (version) => `azure-dev-cli_${version}` },
  };
  for (const [tool, release] of Object.entries(manifest)) {
    assert.match(release.version, /^\d+\.\d+\.\d+$/);
    assert.deepEqual(Object.keys(release.artifacts).sort(), ["amd64", "arm64"]);
    for (const artifact of Object.values(release.artifacts)) {
      assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
      const prefix =
        tool === "terraform"
          ? `https://releases.hashicorp.com/terraform/${release.version}/`
          : `${upstream[tool].prefix}/releases/download/${upstream[tool].tag(release.version)}/`;
      for (const url of [artifact.url, artifact.checksumUrl]) {
        assert.ok(
          url.startsWith(prefix) ||
            (["bicep", "azd"].includes(tool) &&
              url ===
                `${upstream[tool].prefix.replace("https://github.com/", "https://api.github.com/repos/")}/releases/tags/${upstream[tool].tag(release.version)}`),
        );
        assert.ok(!url.includes("latest"));
      }
    }
  }
});

for (const architecture of ["amd64", "arm64"]) {
  test(`installs only verified ${architecture} archives with executable permissions`, (context) => {
    const result = fixture(context, architecture).run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(result.installed.sort(), ["azd", "bicep", "gh", "gitleaks", "terraform", "uv", "uvx"]);
    const operations = result.calls.map(({ command }) => command);
    assert.deepEqual(operations, [
      "uname",
      ...["curl", "sha256sum", "tar", "install", "install"],
      ...["curl", "sha256sum", "tar", "install"],
      ...["curl", "sha256sum", "unzip", "install"],
      ...["curl", "sha256sum", "tar", "install"],
      ...["curl", "sha256sum", "install"],
      ...["curl", "sha256sum", "tar", "install"],
    ]);
    for (const call of result.calls.filter(({ command }) => command === "curl")) {
      assert.ok(call.args.includes("--fail"));
      assert.equal(call.args[call.args.indexOf("--proto") + 1], "=https");
      assert.equal(call.args[call.args.indexOf("--proto-redir") + 1], "=https");
    }
    for (const call of result.calls.filter(({ command }) => command === "install")) {
      assert.deepEqual(call.args.slice(0, 2), ["-m", "0755"]);
    }
  });
}

const buildOrder = ["uv", "gitleaks", "terraform", "gh", "bicep", "azd"];
for (const failure of [...buildOrder.flatMap((tool) => [`download-${tool}`, `corrupt-${tool}`]), "install"]) {
  test(`fails closed and cleans up on ${failure}`, (context) => {
    const result = fixture(context).run(failure);
    assert.notEqual(result.status, 0);
    const completed = failure === "install" ? [] : buildOrder.slice(0, buildOrder.indexOf(failure.split("-")[1]));
    assert.deepEqual(
      result.installed.sort(),
      completed.flatMap((tool) => (tool === "uv" ? ["uv", "uvx"] : [tool])).sort(),
    );
    const extractions = result.calls.filter(({ command }) => command === "tar");
    assert.equal(
      extractions.length,
      failure === "install" ? 1 : completed.filter((tool) => ["uv", "gitleaks", "gh", "azd"].includes(tool)).length,
    );
  });
}

test("CI can install only uv and gitleaks without installing unrelated CLIs", (context) => {
  const result = fixture(context).run("", "amd64", ["uv", "gitleaks"]);
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.installed.sort(), ["gitleaks", "uv", "uvx"]);
  assert.equal(result.calls.filter(({ command }) => command === "curl").length, 2);
});

test("rejects an unknown tool selection before download", (context) => {
  const result = fixture(context).run("", "amd64", ["unknown"]);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported build tool/);
  assert.ok(!result.calls.some(({ command }) => command === "curl"));
});

test("rejects unsupported architecture before downloading", (context) => {
  const result = fixture(context).run("", "s390x");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported build architecture/);
  assert.deepEqual(
    result.calls.map(({ command }) => command),
    ["uname"],
  );
});

test("fails when a verified archive lacks the required binary", (context) => {
  const result = fixture(context, "arm64", true).run();
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.installed.sort(), ["uv", "uvx"]);
});

test("fails when a verified Terraform archive lacks the standalone binary", (context) => {
  const result = fixture(context, "arm64", "terraform").run();
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.installed.sort(), ["gitleaks", "uv", "uvx"]);
});

test("fails when a verified azd archive lacks the standalone binary", (context) => {
  const result = fixture(context, "arm64", "azd").run();
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.installed.sort(), ["bicep", "gh", "gitleaks", "terraform", "uv", "uvx"]);
});

test("rejects malformed checksum before downloading", (context) => {
  const setup = fixture(context);
  const invalid = structuredClone(manifest);
  invalid.uv.artifacts.amd64.sha256 = "not-a-checksum";
  writeFileSync(path.join(setup.root, "download-checksums.json"), JSON.stringify(invalid));
  const result = setup.run();
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Invalid download manifest entry/);
  assert.deepEqual(
    result.calls.map(({ command }) => command),
    ["uname"],
  );
});

for (const failure of ["", "invalid-version", "invalid-pip-version", "uv", "pip", "az"]) {
  test(`local Azure CLI Feature ${failure ? `rejects ${failure}` : "uses isolated Python after the runtime Feature"}`, (context) => {
    const root = mkdtempSync(path.join(tmpdir(), "apex-azure-cli-test-"));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    mkdirSync(path.join(root, "bin"));
    const log = path.join(root, "commands");
    writeFileSync(log, "");
    for (const command of ["uv", "ln", "az"]) {
      writeFileSync(
        path.join(root, "bin", command),
        `#!/bin/sh\nprintf '%s %s\\n' '${command}' "$*" >> "$CALL_LOG"\nif [ '${command}' = "$FAIL_COMMAND" ] || { [ "$FAIL_COMMAND" = pip ] && [ '${command}' = uv ] && [ "$1" = pip ]; }; then echo 'fixture install failure' >&2; exit 17; fi\n`,
        { mode: 0o755 },
      );
    }
    const feature = JSON.parse(
      readFileSync(new URL("features/azure-cli/devcontainer-feature.json", containerDir), "utf8"),
    );
    assert.ok(feature.installsAfter.includes("./features/python"));
    const result = spawnSync("bash", [new URL("features/azure-cli/install.sh", containerDir).pathname], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
        VERSION: failure === "invalid-version" ? "latest" : feature.options.version.default,
        PIPVERSION: failure === "invalid-pip-version" ? "latest" : feature.options.pipVersion.default,
        CALL_LOG: log,
        FAIL_COMMAND: failure,
      },
    });
    const invalid = failure === "invalid-version" || failure === "invalid-pip-version";
    assert.equal(result.status, invalid ? 1 : failure ? 17 : 0, result.stdout + result.stderr);
    const calls = readFileSync(log, "utf8");
    if (invalid) assert.equal(calls, "");
    if (!failure) {
      assert.match(calls, /uv venv --python \/usr\/local\/python\/current\/bin\/python3 \/opt\/azure-cli/);
      assert.ok(calls.includes(`azure-cli==${feature.options.version.default}`));
      assert.ok(calls.includes(`pip==${feature.options.pipVersion.default}`));
      assert.match(calls, /ln -s \/opt\/azure-cli\/bin\/az \/usr\/local\/bin\/az/);
      assert.match(calls, /az version --output none/);
    }
    if (failure === "pip") assert.doesNotMatch(calls, /ln -s|az version/);

    for (const failure of ["", "invalid-version", "uv"]) {
      test(`local Python Feature ${failure ? `rejects ${failure}` : "keeps the managed base separate from project dependencies"}`, (context) => {
        const root = mkdtempSync(path.join(tmpdir(), "apex-python-feature-test-"));
        context.after(() => rmSync(root, { recursive: true, force: true }));
        mkdirSync(path.join(root, "bin"));
        const log = path.join(root, "commands");
        writeFileSync(log, "");
        for (const command of ["uv", "install", "ln", "chown"]) {
          writeFileSync(
            path.join(root, "bin", command),
            `#!/bin/sh\nprintf '%s %s\\n' '${command}' "$*" >> "$CALL_LOG"\nif [ '${command}' = "$FAIL_COMMAND" ]; then echo 'fixture failure' >&2; exit 17; fi\nif [ '${command}' = uv ] && [ "$1 $2" = 'python find' ]; then echo /usr/local/share/apex-python/fixture/bin/python3; fi\n`,
            { mode: 0o755 },
          );
        }
        const feature = JSON.parse(
          readFileSync(new URL("features/python/devcontainer-feature.json", containerDir), "utf8"),
        );
        const result = spawnSync("bash", [new URL("features/python/install.sh", containerDir).pathname], {
          encoding: "utf8",
          env: {
            ...process.env,
            PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
            VERSION: failure === "invalid-version" ? "latest" : feature.options.version.default,
            PIPVERSION: feature.options.pipVersion.default,
            CALL_LOG: log,
            FAIL_COMMAND: failure,
          },
        });
        assert.equal(
          result.status,
          failure === "invalid-version" ? 1 : failure ? 17 : 0,
          result.stdout + result.stderr,
        );
        const calls = readFileSync(log, "utf8");
        if (failure === "invalid-version") assert.equal(calls, "");
        if (!failure) {
          assert.ok(calls.includes(`uv python install ${feature.options.version.default}`));
          assert.match(calls, /uv venv --python .* \/usr\/local\/python\/current/);
          assert.ok(calls.includes(`pip==${feature.options.pipVersion.default}`));
          assert.match(calls, /chown -R vscode:vscode \/usr\/local\/python\/current/);
          assert.doesNotMatch(calls, /--system|apt-get|dnf/);
        }
      });
    }
  });
}
