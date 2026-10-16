import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  chmodSync,
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const containerDir = new URL("../../../.devcontainer/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("download-checksums.json", containerDir), "utf8"));

function fixture(context, { tamper = false } = {}) {
  const root = mkdtempSync(path.join(tmpdir(), "apex-azqr-test-"));
  context.after(() => rmSync(root, { recursive: true, force: true }));
  for (const dir of ["bin", "source/bin/linux_amd64", "install"]) mkdirSync(path.join(root, dir), { recursive: true });
  copyFileSync(new URL("install-azqr.sh", containerDir), path.join(root, "install-azqr.sh"));

  writeFileSync(path.join(root, "source/bin/linux_amd64/azqr"), "#!/bin/sh\necho 'azqr version v.4.2.0'\n");
  const archive = path.join(root, "azqr.zip");
  const zipped = spawnSync("python3", ["-m", "zipfile", "-c", archive, "bin"], { cwd: path.join(root, "source") });
  assert.equal(zipped.status, 0, zipped.stderr?.toString());

  const local = structuredClone(manifest);
  const digest = createHash("sha256").update(readFileSync(archive)).digest("hex");
  local.azqr.artifacts.amd64.sha256 = tamper ? "0".repeat(64) : digest;
  writeFileSync(path.join(root, "download-checksums.json"), JSON.stringify(local));

  const stub = (name, body) => {
    const file = path.join(root, "bin", name);
    writeFileSync(file, `#!/bin/sh\n${body}\n`);
    chmodSync(file, 0o755);
  };
  stub("dpkg", "echo amd64");
  // Shadows any azqr installed on the host so the pinned-version skip never fires by accident.
  stub("azqr", "echo 'azqr version v.0.0.0'");
  stub(
    "curl",
    `out=""; while [ "$#" -gt 0 ]; do [ "$1" = "--output" ] && out="$2"; shift; done; cp "${archive}" "$out"`,
  );

  return {
    root,
    run(extraPath = "") {
      return spawnSync("bash", [path.join(root, "install-azqr.sh")], {
        encoding: "utf8",
        env: {
          ...process.env,
          PATH: `${extraPath}${extraPath ? ":" : ""}${path.join(root, "bin")}:${process.env.PATH}`,
          AZQR_INSTALL_DIR: path.join(root, "install"),
          TMPDIR: tmpdir(),
        },
      });
    },
  };
}

test("manifest pins azqr 3.0.0 or later for both architectures with sha256 and github urls", () => {
  assert.ok(Number(manifest.azqr.version.split(".")[0]) >= 3);
  for (const arch of ["amd64", "arm64"]) {
    const artifact = manifest.azqr.artifacts[arch];
    assert.match(artifact.sha256, /^[0-9a-f]{64}$/);
    assert.match(artifact.url, /^https:\/\/github\.com\/Azure\/azqr\//);
  }
});

test("installs the verified binary from the nested archive path", (context) => {
  const setup = fixture(context);
  const result = setup.run();
  assert.equal(result.status, 0, result.stderr);
  assert.ok(existsSync(path.join(setup.root, "install", "azqr")));
});

test("rejects an archive whose checksum does not match the manifest", (context) => {
  const setup = fixture(context, { tamper: true });
  const result = setup.run();
  assert.notEqual(result.status, 0);
  assert.ok(!existsSync(path.join(setup.root, "install", "azqr")));
});

test("skips the download when the pinned version is already on PATH", (context) => {
  const setup = fixture(context);
  const present = path.join(setup.root, "present");
  mkdirSync(present);
  writeFileSync(path.join(present, "azqr"), "#!/bin/sh\necho 'azqr version v.4.2.0'\n", { mode: 0o755 });
  const result = setup.run(present);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /already installed/);
  assert.ok(!existsSync(path.join(setup.root, "install", "azqr")));
});
