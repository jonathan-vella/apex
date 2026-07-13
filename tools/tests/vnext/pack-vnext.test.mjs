import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

const root = resolve(import.meta.dirname, "../../..");

function run(command, args, cwd = root) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, { cwd, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8").on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.setEncoding("utf8").on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0
        ? resolvePromise({ stdout, stderr })
        : reject(new Error(`${command} ${args.join(" ")} failed (${code})\n${stderr}${stdout}`)),
    );
  });
}

test("packs and clean-installs the vNext runtime", { timeout: 180_000 }, async () => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "apex-pack-test-"));
  const outputDirectory = join(temporaryRoot, "packages");
  await run(process.execPath, [join(root, "tools", "scripts", "pack-vnext.mjs"), "--output-dir", outputDirectory]);

  const release = JSON.parse(await readFile(join(outputDirectory, "release-manifest.json"), "utf8"));
  assert.deepEqual(
    release.packages.map(({ package: name }) => name),
    ["@apex/contracts", "@apex/kernel", "@apex/capabilities", "@apex/renderers", "@apex/cli"],
  );
  for (const entry of release.packages) {
    const tarball = join(outputDirectory, entry.file);
    const bytes = await readFile(tarball);
    assert.equal(entry.bytes, (await stat(tarball)).size);
    assert.equal(entry.sha256, createHash("sha256").update(bytes).digest("hex"));
  }

  const cliEntry = release.packages.find(({ package: name }) => name === "@apex/cli");
  const cliTarball = join(outputDirectory, cliEntry.file);
  const listing = (await run("tar", ["-tzf", cliTarball])).stdout.split("\n").filter(Boolean);
  assert.ok(listing.includes("package/assets/customizations/.github/agents/apex.agent.md"));
  assert.ok(listing.includes("package/assets/config/workflow.v1.json"));
  assert.ok(
    listing.every((path) => !path.includes("/dist/test/") && !path.endsWith(".map") && !path.endsWith(".tsbuildinfo")),
  );

  const project = join(temporaryRoot, "consumer");
  await mkdir(project, { recursive: true });
  await run("npm", ["init", "--yes"], project);
  const runtimeTarballs = release.packages.map((entry) => join(outputDirectory, entry.file));
  await run("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...runtimeTarballs], project);

  const version = JSON.parse(
    (await run(join(project, "node_modules", ".bin", "apex"), ["version", "--json"], project)).stdout,
  );
  assert.deepEqual(version, { ok: true, result: { version: "0.1.0", bundleVersion: "0.1.0", configVersion: "1.0.0" } });
  await run(join(project, "node_modules", ".bin", "apex"), ["init", "--project", "demo", "--json"], project);
  await readFile(join(project, ".github", "agents", "apex.agent.md"));
  await readFile(join(project, ".vscode", "mcp.json"));
  await readFile(join(project, ".apex", "runtime", "workflow.v1.json"));
  const lock = JSON.parse(await readFile(join(project, ".apex", "customizations.lock.json"), "utf8"));
  for (const file of [...lock.files, ...lock.runtime]) {
    const path = lock.files.includes(file) ? join(project, file.path) : join(project, ".apex", "runtime", file.path);
    const hash = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
    assert.equal(file.sourceHash, hash);
    assert.equal(file.currentHash, hash);
  }
});
