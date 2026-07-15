import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { lstat, mkdir, readFile, readdir, stat, symlink, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";
import test from "node:test";
import { ApexError } from "../errors.js";
import { ApexService } from "../service.js";
import { tempRoot } from "./helpers.js";

async function treeDigest(root: string): Promise<string> {
  const hash = createHash("sha256");
  const visit = async (directory: string): Promise<void> => {
    const entries = (await readdir(directory, { withFileTypes: true })).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    for (const entry of entries) {
      const path = join(directory, entry.name);
      const name = relative(root, path).split(sep).join("/");
      const metadata = await lstat(path);
      hash.update(metadata.isDirectory() ? `d:${name}\0` : `f:${name}\0`);
      if (metadata.isDirectory()) await visit(path);
      else hash.update(await readFile(path));
    }
  };
  await visit(root);
  return hash.digest("hex");
}

test("init installs and update refreshes managed customizations", async () => {
  const root = await tempRoot();
  const source = await tempRoot();
  await mkdir(join(source, ".github"), { recursive: true });
  await writeFile(join(source, ".github", "managed.md"), "v1\n");
  const service = new ApexService(root);
  await service.init({ projectId: "demo", customizationsSource: source });
  assert.equal(await readFile(join(root, ".github", "managed.md"), "utf8"), "v1\n");
  await writeFile(join(source, ".github", "managed.md"), "v2\n");
  await service.update(source);
  assert.equal(await readFile(join(root, ".github", "managed.md"), "utf8"), "v2\n");
});

test("init installs bundled customizations and runtime config by default", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  await service.init({ projectId: "demo" });
  assert.match(await readFile(join(root, ".github", "agents", "apex.agent.md"), "utf8"), /name: APEX/);
  assert.deepEqual(JSON.parse(await readFile(join(root, ".vscode", "mcp.json"), "utf8")), {
    servers: {
      apex: {
        type: "stdio",
        command: "node",
        args: ["${workspaceFolder}/node_modules/@apex/cli/dist/cli.js", "mcp", "serve"],
        cwd: "${workspaceFolder}",
      },
    },
  });
  assert.equal(await readFile(join(root, ".apex", ".gitignore"), "utf8"), "/cache/\n/local/\n/work/\n");
  assert.match(await readFile(join(root, ".apex", "runtime", "workflow.v1.json"), "utf8"), /apex-workflow-v1/);
  const registry = JSON.parse(
    await readFile(join(root, ".apex", "runtime", "capability-packs.registry.json"), "utf8"),
  ) as {
    packs: Array<{
      id: string;
      artifact: { spec: string; digest: string };
      lock: { path?: string; digest: string; directDigest: string; transitiveDigest: string };
      script?: string;
      scriptDigest?: string;
    }>;
  };
  assert.deepEqual(
    registry.packs.map(({ id }) => id),
    ["azure-pricing", "azure-governance-discovery", "drawio"],
  );
  for (const pack of registry.packs) {
    const source = join(root, ".apex", "runtime", pack.artifact.spec);
    assert.equal(await treeDigest(source), pack.artifact.digest);
    assert.ok(
      [pack.artifact.digest, pack.lock.digest, pack.lock.directDigest, pack.lock.transitiveDigest].every((digest) =>
        /^[a-f0-9]{64}$/.test(digest),
      ),
    );
    if (pack.lock.path !== undefined) {
      const lockBytes = await readFile(join(root, ".apex", "runtime", pack.lock.path));
      assert.equal(createHash("sha256").update(lockBytes).digest("hex"), pack.lock.digest);
    }
    if (pack.script !== undefined) {
      const scriptBytes = await readFile(join(source, pack.script));
      assert.equal(createHash("sha256").update(scriptBytes).digest("hex"), pack.scriptDigest);
    }
  }
  const lock = JSON.parse(await readFile(join(root, ".apex", "customizations.lock.json"), "utf8")) as {
    files: Array<{ sourceHash: string }>;
    runtime: Array<{ sourceHash: string }>;
  };
  assert.ok([...lock.files, ...lock.runtime].every(({ sourceHash }) => /^[a-f0-9]{64}$/.test(sourceHash)));
});

test("update refuses local managed-file conflicts", async () => {
  const root = await tempRoot();
  const source = await tempRoot();
  await writeFile(join(source, "managed.txt"), "base\n");
  const service = new ApexService(root);
  await service.init({ projectId: "demo", customizationsSource: source });
  await writeFile(join(root, "managed.txt"), "local\n");
  await writeFile(join(source, "managed.txt"), "upstream\n");
  await assert.rejects(
    service.update(source),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_CONFLICT",
  );
});

test("update rolls back every managed file after an injected apply failure", async () => {
  const root = await tempRoot();
  const source = await tempRoot();
  await writeFile(join(source, "a.txt"), "a1\n");
  await writeFile(join(source, "b.txt"), "b1\n");
  await new ApexService(root).init({ projectId: "demo", customizationsSource: source });
  await writeFile(join(source, "a.txt"), "a2\n");
  await writeFile(join(source, "b.txt"), "b2\n");
  const failing = new ApexService(root, {
    customizationFailureInjector: (index) => {
      if (index === 1) throw new Error("injected-update-failure");
    },
  });
  await assert.rejects(failing.update(source), /injected-update-failure/);
  assert.equal(await readFile(join(root, "a.txt"), "utf8"), "a1\n");
  assert.equal(await readFile(join(root, "b.txt"), "utf8"), "b1\n");
});

test("update merges nonoverlapping text changes and deletes unchanged removed files", async () => {
  const root = await tempRoot();
  const source = await tempRoot();
  await writeFile(join(source, "managed.txt"), "one\ntwo\nthree\n");
  await writeFile(join(source, "removed.txt"), "remove\n");
  const service = new ApexService(root);
  await service.init({ projectId: "demo", customizationsSource: source });
  await writeFile(join(root, "managed.txt"), "ONE\ntwo\nthree\n");
  await writeFile(join(source, "managed.txt"), "one\ntwo\nTHREE\n");
  await import("node:fs/promises").then(({ rm }) => rm(join(source, "removed.txt")));
  await service.update(source);
  assert.equal(await readFile(join(root, "managed.txt"), "utf8"), "ONE\ntwo\nTHREE\n");
  await assert.rejects(stat(join(root, "removed.txt")), /ENOENT/);
});

test("customization install rejects symlinked destination ancestors", async () => {
  const root = await tempRoot();
  const source = await tempRoot();
  const outside = await tempRoot();
  await mkdir(join(source, ".github"), { recursive: true });
  await writeFile(join(source, ".github", "managed.md"), "managed\n");
  await symlink(outside, join(root, ".github"));
  await assert.rejects(
    new ApexService(root).init({ projectId: "demo", customizationsSource: source }),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_VALIDATION",
  );
  await assert.rejects(stat(join(outside, "managed.md")), /ENOENT/);
});

test("rollback restores the prior bundle and uninstall preserves modified files and project history", async () => {
  const root = await tempRoot();
  const source = await tempRoot();
  await writeFile(join(source, "managed.txt"), "v1\n");
  await writeFile(join(source, "modified.txt"), "v1\n");
  const service = new ApexService(root);
  await service.init({ projectId: "demo", customizationsSource: source });
  await writeFile(join(source, "managed.txt"), "v2\n");
  await writeFile(join(source, "modified.txt"), "v2\n");
  await service.update(source);
  assert.deepEqual((await service.rollbackCustomizations()).conflicts, []);
  assert.equal(await readFile(join(root, "managed.txt"), "utf8"), "v1\n");
  await writeFile(join(root, "modified.txt"), "local\n");
  const uninstall = await service.uninstallCustomizations();
  assert(uninstall.removed.includes("managed.txt"));
  assert(uninstall.conflicts.includes("modified.txt"));
  assert.equal(await readFile(join(root, "modified.txt"), "utf8"), "local\n");
  assert.equal((await service.status()).run.projectId, "demo");
  assert.equal(await stat(join(root, ".apex", "runtime")).then(() => true), true);
});

test("init refuses to overwrite an unrelated workspace file", async () => {
  const root = await tempRoot();
  const source = await tempRoot();
  await writeFile(join(source, "managed.txt"), "managed\n");
  await writeFile(join(root, "managed.txt"), "unrelated\n");
  await assert.rejects(
    new ApexService(root).init({ projectId: "demo", customizationsSource: source }),
    (error: unknown) => error instanceof ApexError && error.code === "APEX_CONFLICT",
  );
  assert.equal(await readFile(join(root, "managed.txt"), "utf8"), "unrelated\n");
});

test("promotion invalidates environment-specific gates when target scope changes", async () => {
  const service = new ApexService(await tempRoot());
  await service.init({ projectId: "demo" });
  const state = await service.status();
  const runPath = join(service.root, ".apex", "projects", "demo", "runs", state.run.runId, "run.json");
  const approved = {
    ...state.run,
    gates: state.run.gates.map((gate) => ({
      ...gate,
      state: "approved" as const,
      decidedAt: "2026-01-01T00:00:00.000Z",
    })),
  };
  await writeFile(runPath, JSON.stringify(approved));
  const promoted = await service.promote("prod", "subscription/prod");
  assert.deepEqual(
    promoted.gates.map((gate) => gate.state),
    ["inherited", "closed", "closed", "closed"],
  );
});

test("doctor previews remedies without applying fixes", async () => {
  const result = await new ApexService(await tempRoot()).doctor(true, false);
  assert.equal(result.healthy, false);
  assert.match(result.remedies.join(" "), /Preview: Run apex init/);
});

test("update rejects and doctor repairs a modified local Git boundary", async () => {
  const root = await tempRoot();
  const service = new ApexService(root);
  await service.init({ projectId: "demo" });
  const boundary = join(root, ".apex", ".gitignore");
  await writeFile(boundary, "/local/\n");
  await assert.rejects(service.update(), /local Git boundary was modified/);
  const doctor = await service.doctor();
  const boundaryCheck = doctor.checks.find(({ id }) => id === "local-git-boundary");
  assert.equal(boundaryCheck?.ok, false);
  assert.match(boundaryCheck?.value ?? "", /^[0-9a-f]{64}$/);
  assert.notEqual(boundaryCheck?.value, "/local/\n");
  await service.doctor(true, true);
  assert.equal(await readFile(boundary, "utf8"), "/cache/\n/local/\n/work/\n");
});

test("init writes a real runtime lock and doctor detects managed tampering", async () => {
  const root = await tempRoot();
  const service = new ApexService(root, {
    executableChecker: async () => true,
    azureAuthStatus: async () => ({ authenticated: true, detail: "injected" }),
  });
  const initialized = await service.init({ projectId: "demo" });
  const lockBytes = await readFile(join(root, ".apex", "apex.lock.json"));
  const lock = JSON.parse(lockBytes.toString("utf8")) as {
    workflowHash: string;
    defaultsHash: string;
    validatorHash: string;
    qualityScorecardHash: string;
    requiredCapabilityPacks: string[];
  };
  assert.ok(
    [lock.workflowHash, lock.defaultsHash, lock.validatorHash, lock.qualityScorecardHash].every((hash) =>
      /^[a-f0-9]{64}$/.test(hash),
    ),
  );
  assert.ok(lock.requiredCapabilityPacks.includes("azure-governance-discovery"));
  assert.equal((await service.status()).run.runId, initialized.runId);
  await writeFile(join(root, ".apex", "runtime", "defaults.v1.json"), "{}\n");
  const doctor = await service.doctor();
  assert.equal(doctor.healthy, false);
  assert.equal(doctor.checks.find(({ id }) => id === "runtime-lock:defaults")?.ok, false);
  assert.equal(doctor.nextAction, "Run doctor --fix --yes to reinstall bundled managed files");
  const fixed = await service.doctor(true, true);
  assert.equal(fixed.checks.find(({ id }) => id === "runtime-lock:defaults")?.ok, true);
  await writeFile(join(root, ".apex", "runtime", "quality-scorecard.v1.json"), "{}\n");
  const scorecardDoctor = await service.doctor();
  assert.equal(scorecardDoctor.checks.find(({ id }) => id === "runtime-lock:quality-scorecard")?.ok, false);
});

test("doctor leaves unrelated core routes unaffected and service reports required workflow packs", async () => {
  const root = await tempRoot();
  const service = new ApexService(root, {
    executableChecker: async () => true,
    azureAuthStatus: async () => ({ authenticated: true, detail: "injected" }),
  });
  const { runId } = await service.init({ projectId: "demo" });
  const initial = await service.doctor();
  assert.equal(
    initial.checks.some(({ id }) => id.startsWith("capability-pack:")),
    false,
  );
  assert.equal(runId.length > 0, true);
  const pricing = (await service.capabilityStatus("azure-pricing")) as {
    state: string;
    reason?: string;
    requiredWorkflows: string[];
    action: string;
  };
  assert.equal(pricing.state, "not-installed");
  assert.equal(pricing.reason, undefined);
  assert.deepEqual(pricing.requiredWorkflows, ["architecture"]);
  assert.match(pricing.action, /capability install/);
  const listed = (await service.capabilityList()) as Array<{ id: string; state: string }>;
  assert.deepEqual(
    listed.map(({ id, state }) => ({ id, state })),
    [
      { id: "azure-pricing", state: "not-installed" },
      { id: "azure-governance-discovery", state: "not-installed" },
      { id: "drawio", state: "not-installed" },
    ],
  );
});
