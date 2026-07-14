import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, mkdtemp, readFile, readdir, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, relative, sep } from "node:path";
import test from "node:test";
import { CapabilityPackManager, type CapabilityPackRegistryV1 } from "../pack-manager.js";
import type { ProcessRequest, ProcessResult, ProcessRunnerLike } from "../process-runner.js";

const roots: string[] = [];
const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

class FakeRunner implements ProcessRunnerLike {
  readonly requests: ProcessRequest[] = [];
  fail = false;

  async run(request: ProcessRequest): Promise<ProcessResult> {
    this.requests.push(request);
    if (this.fail) throw new Error("injected process failure");
    if (request.executable === "uv") {
      if (request.cwd === undefined) throw new Error("UV request requires cwd");
      const executable = join(
        request.cwd,
        ".venv",
        process.platform === "win32" ? "Scripts" : "bin",
        process.platform === "win32" ? "azure-pricing-mcp.exe" : "azure-pricing-mcp",
      );
      await mkdir(join(executable, ".."), { recursive: true });
      await writeFile(executable, "installed\n");
    }
    return { exitCode: 0, signal: null, stdout: "", stderr: "", timedOut: false, outputTruncated: false };
  }
}

async function root(): Promise<string> {
  const value = await mkdtemp(join(tmpdir(), "apex-pack-manager-"));
  roots.push(value);
  return value;
}

test.after(async () => await Promise.all(roots.map(async (path) => await rm(path, { recursive: true, force: true }))));

async function fileDigest(path: string): Promise<string> {
  return createHash("sha256")
    .update(await readFile(path))
    .digest("hex");
}

async function treeDigest(rootPath: string): Promise<string> {
  const hash = createHash("sha256");
  const visit = async (directory: string): Promise<void> => {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      compareText(left.name, right.name),
    );
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const name = relative(rootPath, path).split(sep).join("/");
      hash.update(entry.isDirectory() ? `d:${name}\0` : `f:${name}\0`);
      if (entry.isDirectory()) await visit(path);
      else hash.update(await readFile(path));
    }
  };
  await visit(rootPath);
  return hash.digest("hex");
}

async function manager(
  workspace: string,
  registry: CapabilityPackRegistryV1,
  runner = new FakeRunner(),
): Promise<{ manager: CapabilityPackManager; runner: FakeRunner }> {
  const manifestPath = join(workspace, "manifest", "capability-packs.v1.json");
  await mkdir(join(workspace, "manifest"), { recursive: true });
  await writeFile(manifestPath, JSON.stringify(registry));
  return { manager: new CapabilityPackManager({ root: workspace, manifestPath, processRunner: runner }), runner };
}

test("source-only bundled packs are actionable unavailable and do not affect core", async () => {
  const workspace = await root();
  const { manager: packs, runner } = await manager(workspace, {
    schemaVersion: "1.0.0",
    packs: [
      { id: "azure-pricing", implementation: "python", source: "tools/pricing", requiredWorkflows: ["architecture"] },
      { id: "drawio", implementation: "deno", source: "tools/drawio", requiredWorkflows: [] },
    ],
  });
  const statuses = await packs.list();
  assert.deepEqual(
    statuses.map(({ state }) => state),
    ["unavailable", "unavailable"],
  );
  assert.equal((await packs.requiredForWorkflows(["requirements"])).length, 0);
  assert.equal((await packs.requiredForWorkflows(["architecture"]))[0]?.reason, "source-only");
  assert.equal(runner.requests.length, 0);
});

test("Python install blocks without a hash lock and never executes pip", async () => {
  const workspace = await root();
  const source = join(workspace, "manifest", "pricing");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "main.py"), "print('pricing')\n");
  const { manager: packs, runner } = await manager(workspace, {
    schemaVersion: "1.0.0",
    packs: [
      {
        id: "azure-pricing",
        version: "1.0.0",
        runtime: "python",
        artifact: { type: "local-directory", spec: "pricing", digest: await treeDigest(source) },
        executable: { command: ".venv/bin/python", args: ["-m", "pricing"] },
        requiredWorkflows: ["architecture"],
      },
    ],
  });
  const result = await packs.install("azure-pricing");
  assert.equal(result.state, "blocked");
  assert.equal(result.reason, "lock-unavailable");
  assert.equal(runner.requests.length, 0);
});

test("dependency-free governance installs without pip after script verification", async () => {
  const workspace = await root();
  const source = join(workspace, "manifest", "governance");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "discover.py"), "print('governance')\n");
  const scriptDigest = await fileDigest(join(source, "discover.py"));
  const { manager: packs, runner } = await manager(workspace, {
    schemaVersion: "1.0.0",
    packs: [
      {
        id: "azure-governance-discovery",
        version: "1.0.0",
        runtime: "python",
        dependencyFree: true,
        script: "discover.py",
        scriptDigest,
        artifact: { type: "local-directory", spec: "governance", digest: await treeDigest(source) },
        executable: { command: "python", args: ["discover.py"] },
        requiredWorkflows: ["governance-discovery"],
      },
    ],
  });
  const installed = await packs.install("azure-governance-discovery");
  assert.equal(installed.state, "installed");
  assert.equal(runner.requests.length, 0);
  assert.equal((await packs.verify("azure-governance-discovery")).state, "installed");
});

test("Deno lock is verified and cache runs only with the explicit flag", async () => {
  const workspace = await root();
  const source = join(workspace, "manifest", "drawio");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "index.ts"), "console.log('drawio');\n");
  await writeFile(join(source, "deno.lock"), "{}\n");
  const lockDigest = await fileDigest(join(source, "deno.lock"));
  const { manager: packs, runner } = await manager(workspace, {
    schemaVersion: "1.0.0",
    packs: [
      {
        id: "drawio",
        version: "1.0.0",
        runtime: "deno",
        artifact: { type: "local-directory", spec: "drawio", digest: await treeDigest(source) },
        lock: {
          installer: "deno",
          path: "drawio/deno.lock",
          digest: lockDigest,
          directDigest: lockDigest,
          transitiveDigest: lockDigest,
        },
        executable: { command: "deno", args: ["run", "--frozen", "index.ts"] },
        requiredWorkflows: [],
      },
    ],
  });
  assert.equal((await packs.install("drawio")).state, "installed");
  assert.equal(runner.requests.length, 0);
  await rm(join(workspace, ".apex", "capability-packs", "drawio"), { recursive: true });
  assert.equal((await packs.install("drawio", { cacheDeno: true })).state, "installed");
  assert.deepEqual(runner.requests[0]?.args, [
    "cache",
    "--frozen",
    `--lock=${join(runner.requests[0]!.cwd!, "deno.lock")}`,
    "index.ts",
  ]);
});

test("digest mismatch and symlinks fail before promotion", async () => {
  const workspace = await root();
  const source = join(workspace, "manifest", "unsafe");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "main.py"), "print('unsafe')\n");
  await symlink(join(source, "main.py"), join(source, "link.py"));
  await writeFile(join(workspace, "manifest", "lock"), "lock\n");
  const lockDigest = await fileDigest(join(workspace, "manifest", "lock"));
  const { manager: packs } = await manager(workspace, {
    schemaVersion: "1.0.0",
    packs: [
      {
        id: "unsafe",
        version: "1",
        runtime: "python",
        dependencyFree: true,
        script: "main.py",
        scriptDigest: await fileDigest(join(source, "main.py")),
        artifact: { type: "local-directory", spec: "unsafe", digest: "0".repeat(64) },
        lock: {
          installer: "pip-hashes",
          path: "lock",
          digest: lockDigest,
          directDigest: lockDigest,
          transitiveDigest: lockDigest,
        },
        executable: { command: "python", args: ["main.py"] },
      },
    ],
  });
  await assert.rejects(packs.install("unsafe"), /Symlink|artifact digest mismatch/);
  await assert.rejects(lstat(join(workspace, ".apex", "capability-packs", "unsafe")), /ENOENT/);
});

test("failed update preserves the installed pack transactionally", async () => {
  const workspace = await root();
  const source = join(workspace, "manifest", "python-pack");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "main.py"), "print('v1')\n");
  await writeFile(join(workspace, "manifest", "requirements.lock"), "demo==1 --hash=sha256:abc\n");
  const lockDigest = await fileDigest(join(workspace, "manifest", "requirements.lock"));
  const runner = new FakeRunner();
  const registry: CapabilityPackRegistryV1 = {
    schemaVersion: "1.0.0",
    packs: [
      {
        id: "python-pack",
        version: "1.0.0",
        runtime: "python",
        artifact: { type: "local-directory", spec: "python-pack", digest: await treeDigest(source) },
        lock: {
          installer: "pip-hashes",
          path: "requirements.lock",
          digest: lockDigest,
          directDigest: lockDigest,
          transitiveDigest: lockDigest,
        },
        executable: { command: ".venv/bin/python", args: ["main.py"] },
      },
    ],
  };
  const { manager: packs } = await manager(workspace, registry, runner);
  assert.equal((await packs.install("python-pack")).state, "installed");
  runner.fail = true;
  await assert.rejects(packs.update("python-pack"), /injected process failure/);
  assert.equal((await packs.verify("python-pack")).state, "installed");
});

test("rollback restores the previously verified pack", async () => {
  const workspace = await root();
  const source = join(workspace, "manifest", "governance");
  await mkdir(source, { recursive: true });
  const scriptPath = join(source, "discover.py");
  await writeFile(scriptPath, "print('v1')\n");
  const manifestPath = join(workspace, "manifest", "capability-packs.v1.json");
  const registry = async (version: string): Promise<CapabilityPackRegistryV1> => ({
    schemaVersion: "1.0.0",
    packs: [
      {
        id: "governance",
        version,
        runtime: "python",
        dependencyFree: true,
        script: "discover.py",
        scriptDigest: await fileDigest(scriptPath),
        artifact: { type: "local-directory", spec: "governance", digest: await treeDigest(source) },
        executable: { command: "python", args: ["discover.py"] },
      },
    ],
  });
  const { manager: packs } = await manager(workspace, await registry("1.0.0"));
  assert.equal((await packs.install("governance")).installedVersion, "1.0.0");
  await writeFile(scriptPath, "print('v2')\n");
  await writeFile(manifestPath, JSON.stringify(await registry("2.0.0")));
  assert.equal((await packs.update("governance")).installedVersion, "2.0.0");
  const previousScript = join(workspace, ".apex", "capability-packs", "governance.previous", "discover.py");
  await writeFile(previousScript, "print('corrupt')\n");
  await assert.rejects(packs.rollback("governance"), /source artifact digest mismatch/);
  assert.equal((await packs.verify("governance")).installedVersion, "2.0.0");
  assert.equal(
    await readFile(join(workspace, ".apex", "capability-packs", "governance", "discover.py"), "utf8"),
    "print('v2')\n",
  );
  assert.equal(await readFile(previousScript, "utf8"), "print('corrupt')\n");
  await writeFile(previousScript, "print('v1')\n");
  const rolledBack = await packs.rollback("governance");
  assert.equal(rolledBack.installedVersion, "1.0.0");
  assert.equal(
    await readFile(join(workspace, ".apex", "capability-packs", "governance", "discover.py"), "utf8"),
    "print('v1')\n",
  );
  const uninstalled = await packs.uninstall("governance");
  assert.equal(uninstalled.state, "not-installed");
  assert.equal(uninstalled.changed, true);
  assert.equal((await packs.status("governance")).state, "not-installed");
  await assert.rejects(lstat(join(workspace, ".apex", "capability-packs", "governance")), /ENOENT/);
  await assert.rejects(lstat(join(workspace, ".apex", "capability-packs", "governance.previous")), /ENOENT/);
  assert.equal((await packs.uninstall("governance")).changed, false);
});

test("uninstall preserves other packs and fails before removal when the registry is unreadable", async () => {
  const workspace = await root();
  const manifestRoot = join(workspace, "manifest");
  const manifestPath = join(manifestRoot, "capability-packs.v1.json");
  const definitions = [];
  for (const id of ["governance", "drawio"]) {
    const source = join(manifestRoot, id);
    await mkdir(source, { recursive: true });
    const script = `${id}.py`;
    await writeFile(join(source, script), `print('${id}')\n`);
    definitions.push({
      id,
      version: "1.0.0",
      runtime: "python" as const,
      dependencyFree: true,
      script,
      scriptDigest: await fileDigest(join(source, script)),
      artifact: { type: "local-directory" as const, spec: id, digest: await treeDigest(source) },
      executable: { command: "python", args: [script] },
    });
  }
  const registry: CapabilityPackRegistryV1 = { schemaVersion: "1.0.0", packs: definitions };
  const { manager: packs } = await manager(workspace, registry);
  assert.equal((await packs.install("governance")).state, "installed");
  assert.equal((await packs.install("drawio")).state, "installed");

  await rm(manifestPath);
  await assert.rejects(packs.uninstall("governance"), /ENOENT/);
  await readFile(join(workspace, ".apex", "capability-packs", "governance", "pack.lock.json"));
  await writeFile(manifestPath, JSON.stringify(registry));

  assert.equal((await packs.uninstall("governance")).state, "not-installed");
  assert.equal((await packs.verify("drawio")).state, "installed");
  assert.equal(
    await readFile(join(workspace, ".apex", "capability-packs", "drawio", "drawio.py"), "utf8"),
    "print('drawio')\n",
  );
});

test("UV install uses the frozen project lock and ignores generated venv content", async () => {
  const workspace = await root();
  const source = join(workspace, "manifest", "pricing");
  await mkdir(join(source, "src"), { recursive: true });
  await writeFile(join(source, "pyproject.toml"), "[project]\nname='azure-pricing-mcp'\nversion='1.0.0'\n");
  await writeFile(join(source, "uv.lock"), "version = 1\n");
  await writeFile(join(source, "src", "main.py"), "print('pricing')\n");
  const lockDigest = await fileDigest(join(source, "uv.lock"));
  const { manager: packs, runner } = await manager(workspace, {
    schemaVersion: "1.0.0",
    packs: [
      {
        id: "azure-pricing",
        version: "1.0.0",
        runtime: "python",
        artifact: { type: "local-directory", spec: "pricing", digest: await treeDigest(source) },
        lock: {
          installer: "uv",
          path: "pricing/uv.lock",
          digest: lockDigest,
          directDigest: lockDigest,
          transitiveDigest: lockDigest,
        },
        executable: { command: "uv", args: ["run", "--frozen", "--no-dev", "azure-pricing-mcp"] },
      },
    ],
  });

  assert.equal((await packs.install("azure-pricing")).state, "installed");
  assert.deepEqual(runner.requests[0]?.args, ["sync", "--frozen", "--no-dev"]);
  const installed = join(workspace, ".apex", "capability-packs", "azure-pricing");
  await writeFile(join(installed, ".venv", "generated.pyc"), "changed generated content\n");
  assert.equal((await packs.verify("azure-pricing")).state, "installed");
  await writeFile(join(installed, "src", "main.py"), "tampered\n");
  assert.match((await packs.verify("azure-pricing")).reason ?? "", /source artifact digest mismatch/);
  await writeFile(join(installed, "src", "main.py"), "print('pricing')\n");
  await writeFile(join(installed, "uv.lock"), "tampered lock\n");
  assert.match((await packs.verify("azure-pricing")).reason ?? "", /source artifact digest mismatch/);
});

test("UV install reports a missing uv executable actionably", async () => {
  const workspace = await root();
  const source = join(workspace, "manifest", "pricing");
  await mkdir(source, { recursive: true });
  await writeFile(join(source, "pyproject.toml"), "[project]\nname='pricing'\nversion='1'\n");
  await writeFile(join(source, "uv.lock"), "version = 1\n");
  const lockDigest = await fileDigest(join(source, "uv.lock"));
  const runner = new FakeRunner();
  runner.fail = true;
  const { manager: packs } = await manager(
    workspace,
    {
      schemaVersion: "1.0.0",
      packs: [
        {
          id: "pricing",
          version: "1",
          runtime: "python",
          artifact: { type: "local-directory", spec: "pricing", digest: await treeDigest(source) },
          lock: {
            installer: "uv",
            path: "pricing/uv.lock",
            digest: lockDigest,
            directDigest: lockDigest,
            transitiveDigest: lockDigest,
          },
          executable: { command: "uv", args: ["run", "--frozen", "--no-dev", "azure-pricing-mcp"] },
        },
      ],
    },
    runner,
  );
  runner.run = async () => {
    throw new Error("spawn uv ENOENT");
  };

  await assert.rejects(packs.install("pricing"), /uv is required.*PATH/);
});
