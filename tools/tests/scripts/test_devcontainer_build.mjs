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
  writeFileSync(path.join(root, "source", "other"), "fixture missing member");
  for (const tool of ["uv", "gitleaks"]) {
    const archive = path.join(root, "downloads", `${tool}.tar.gz`);
    const member = tool === "uv" ? `uv-${target}` : missingMember ? "other" : "gitleaks";
    const packed = spawnSync("tar", ["-czf", archive, "-C", path.join(root, "source"), member], { encoding: "utf8" });
    assert.equal(packed.status, 0, packed.stderr);
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
if (command === "dpkg") {
  process.stdout.write(process.env.TEST_ARCH + "\n");
} else if (command === "curl") {
  const url = args.at(-1);
  const tool = url.includes("/gitleaks/") ? "gitleaks" : "uv";
  if (process.env.TEST_FAILURE === "download-" + tool) process.exit(22);
  const output = args[args.indexOf("--output") + 1];
  if (!output.startsWith(root + path.sep)) process.exit(98);
  if (process.env.TEST_FAILURE === "corrupt-" + tool) writeFileSync(output, "corrupt archive");
  else copyFileSync(path.join(root, "downloads", tool + ".tar.gz"), output);
} else if (command === "install") {
  const source = args.at(-2);
  const destination = args.at(-1);
  if (!source.startsWith(root + path.sep) || !/^\/usr\/local\/bin\/(uv|uvx|gitleaks)$/.test(destination)) process.exit(98);
  if (process.env.TEST_FAILURE === "install") process.exit(1);
  copyFileSync(source, path.join(root, "installed", path.basename(destination)));
} else if (command === "tar" || command === "sha256sum") {
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
  for (const command of ["dpkg", "curl", "install", "tar", "sha256sum", "apt-get", "sudo"]) {
    writeFileSync(
      path.join(root, "bin", command),
      `#!/bin/sh\nexec "${process.execPath}" "${path.join(root, "mock.mjs")}" "${command}" "$@"\n`,
      { mode: 0o755 },
    );
  }
  return {
    root,
    run(failure = "", arch = architecture) {
      const result = spawnSync("bash", [path.join(root, "install-build-tools.sh")], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${path.join(root, "bin")}:${process.env.PATH}`,
          TMPDIR: path.join(root, "temp"),
          FIXTURE_ROOT: root,
          TEST_ARCH: arch,
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

test("build retains Ubuntu, feature locks, host paths and host-process token forwarding", () => {
  const config = parseJsonc(readFileSync(new URL("devcontainer.json", containerDir), "utf8"));
  const lock = JSON.parse(readFileSync(new URL("devcontainer-lock.json", containerDir), "utf8"));
  const dockerfile = readFileSync(new URL("Dockerfile", containerDir), "utf8");
  assert.deepEqual(config.build, { dockerfile: "Dockerfile", context: "." });
  assert.equal(config.image, undefined);
  const expectedImage = process.env.APEX_EXPECTED_BASE_IMAGE ?? "mcr.microsoft.com/devcontainers/base:ubuntu26.04";
  assert.equal(dockerfile.split("\n")[0], `FROM ${expectedImage}`);
  assert.match(dockerfile, /DEBIAN_FRONTEND=noninteractive/);
  assert.match(dockerfile, /apt-get install -y --no-install-recommends/);
  assert.match(dockerfile, /graphviz dos2unix bats/);
  assert.match(dockerfile, /rm -rf \/var\/lib\/apt\/lists\/\*/);
  assert.match(dockerfile, /COPY install-build-tools\.sh download-checksums\.json \/tmp\/apex-build-tools\//);
  assert.match(dockerfile, /bash \/tmp\/apex-build-tools\/install-build-tools\.sh/);
  assert.match(dockerfile, /install -d -m 0755 -o vscode -g vscode/);
  assert.match(dockerfile, /\/home\/vscode\/\.terraform\.d\/plugin-cache/);
  assert.equal(config.onCreateCommand, "az version --output none");
  assert.equal(config.postCreateCommand, "bash .devcontainer/post-create.sh");
  assert.equal(config.remoteUser, "vscode");
  assert.equal(config.remoteEnv.GH_TOKEN, "${localEnv:GH_TOKEN}");
  assert.ok(config.features["ghcr.io/devcontainers/features/node:2"]);
  for (const feature of Object.keys(config.features).filter((name) => name.startsWith("ghcr.io/"))) {
    assert.ok(lock.features[feature], `Missing feature lock: ${feature}`);
  }
  assert.ok(
    config.mounts.some(({ target, type }) => target === config.containerEnv.TF_PLUGIN_CACHE_DIR && type === "volume"),
  );
  assert.ok(config.mounts.some(({ source }) => source === "${localEnv:USERPROFILE}${localEnv:HOME}/.azure"));
});

test("release manifest pins both architectures to versioned upstream assets and checksum sources", () => {
  assert.equal(manifest.uv.version, "0.8.22");
  assert.equal(manifest.gitleaks.version, "8.28.0");
  for (const [tool, release] of Object.entries(manifest)) {
    assert.deepEqual(Object.keys(release.artifacts).sort(), ["amd64", "arm64"]);
    for (const artifact of Object.values(release.artifacts)) {
      assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
      const prefix = tool === "uv" ? "https://github.com/astral-sh/uv" : "https://github.com/gitleaks/gitleaks";
      const tag = tool === "uv" ? release.version : `v${release.version}`;
      for (const url of [artifact.url, artifact.checksumUrl]) {
        assert.ok(url.startsWith(`${prefix}/releases/download/${tag}/`));
        assert.ok(!url.includes("latest"));
      }
    }
  }
});

for (const architecture of ["amd64", "arm64"]) {
  test(`installs only verified ${architecture} archives with executable permissions`, (context) => {
    const result = fixture(context, architecture).run();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(result.installed.sort(), ["gitleaks", "uv", "uvx"]);
    const operations = result.calls.map(({ command }) => command);
    assert.deepEqual(operations, [
      "dpkg",
      "curl",
      "sha256sum",
      "tar",
      "install",
      "install",
      "curl",
      "sha256sum",
      "tar",
      "install",
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

for (const failure of ["download-uv", "corrupt-uv", "download-gitleaks", "corrupt-gitleaks", "install"]) {
  test(`fails closed and cleans up on ${failure}`, (context) => {
    const result = fixture(context).run(failure);
    assert.notEqual(result.status, 0);
    assert.deepEqual(result.installed.sort(), failure.endsWith("gitleaks") ? ["uv", "uvx"] : []);
    const extractions = result.calls.filter(({ command }) => command === "tar");
    assert.equal(extractions.length, failure.endsWith("gitleaks") || failure === "install" ? 1 : 0);
  });
}

test("rejects unsupported architecture before downloading", (context) => {
  const result = fixture(context).run("", "s390x");
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Unsupported build architecture/);
  assert.deepEqual(
    result.calls.map(({ command }) => command),
    ["dpkg"],
  );
});

test("fails when a verified archive lacks the required binary", (context) => {
  const result = fixture(context, "arm64", true).run();
  assert.notEqual(result.status, 0);
  assert.deepEqual(result.installed.sort(), ["uv", "uvx"]);
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
    ["dpkg"],
  );
});
