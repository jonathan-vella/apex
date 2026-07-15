import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "../../..");
const resistantProcessTree = join(import.meta.dirname, "fixtures", "resistant-process-tree.mjs");
const defaultRunTimeoutMs = 120_000;
const defaultTerminationGraceMs = 1_000;
const defaultMaxOutputBytes = 1_048_576;

const delay = (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));

function processExists(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    throw error;
  }
}

async function recordedPids(pidFile) {
  try {
    return (await readFile(pidFile, "utf8")).trim().split("\n").filter(Boolean).map(Number);
  } catch (error) {
    if (error.code === "ENOENT") return [];
    throw error;
  }
}

async function waitForRecordedPids(pidFile, count, timeoutMs = 1_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const pids = await recordedPids(pidFile);
    if (pids.length >= count) return pids;
    await delay(10);
  }
  throw new Error(`Process fixture did not record ${count} PIDs within ${timeoutMs}ms`);
}

async function emergencyCleanup(pidFile) {
  const pids = await recordedPids(pidFile);
  for (const pid of pids.reverse()) {
    try {
      process.kill(pid, "SIGKILL");
    } catch (error) {
      if (error.code !== "ESRCH") throw error;
    }
  }
}

function processGroupExists(pid) {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if (error.code === "ESRCH") return false;
    if (error.code === "EPERM") return true;
    throw error;
  }
}

function signalProcessGroup(pid, signal) {
  try {
    process.kill(-pid, signal);
  } catch (error) {
    if (error.code !== "ESRCH") throw error;
  }
}

async function terminateWindowsTree(pid) {
  await new Promise((resolvePromise, reject) => {
    const killer = spawn("taskkill", ["/PID", String(pid), "/T", "/F"], {
      shell: false,
      stdio: "ignore",
      windowsHide: true,
    });
    killer.on("error", reject);
    killer.on("close", (code) => {
      if (code === 0 || code === 128) resolvePromise();
      else reject(new Error(`taskkill failed with exit code ${code}`));
    });
  });
}

async function terminateProcessTree(child, graceMs) {
  const pid = child.pid;
  if (!pid) return;
  if (process.platform === "win32") {
    await terminateWindowsTree(pid);
    return;
  }

  signalProcessGroup(pid, "SIGTERM");
  const gracefulDeadline = Date.now() + graceMs;
  while (processGroupExists(pid) && Date.now() < gracefulDeadline) await delay(25);
  if (!processGroupExists(pid)) return;

  signalProcessGroup(pid, "SIGKILL");
  const forcedDeadline = Date.now() + 1_000;
  while (processGroupExists(pid) && Date.now() < forcedDeadline) await delay(25);
  if (processGroupExists(pid)) throw new Error(`Process group ${pid} remained alive after SIGKILL`);
}

function run(command, args, cwd = root, options = {}) {
  const timeoutMs = options.timeoutMs ?? defaultRunTimeoutMs;
  const terminationGraceMs = options.terminationGraceMs ?? defaultTerminationGraceMs;
  const maxOutputBytes = options.maxOutputBytes ?? defaultMaxOutputBytes;
  const abortSignal = options.signal;
  const ready = options.ready;
  return new Promise((resolvePromise, reject) => {
    const commandText = `${command} ${args.join(" ")}`;
    const child = spawn(command, args, {
      cwd,
      detached: process.platform !== "win32",
      shell: false,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let outputTruncated = false;
    let interruption;
    let cleanupPromise;
    let settled = false;
    let timer;

    const capture = (chunk, stream) => {
      const bytes = Buffer.from(chunk);
      const remaining = Math.max(0, maxOutputBytes - outputBytes);
      const kept = bytes.subarray(0, remaining);
      if (stream === "stdout") stdout += kept.toString("utf8");
      else stderr += kept.toString("utf8");
      outputBytes += kept.length;
      if (kept.length < bytes.length) outputTruncated = true;
    };
    child.stdout.on("data", (chunk) => capture(chunk, "stdout"));
    child.stderr.on("data", (chunk) => capture(chunk, "stderr"));

    const interrupt = (code, message) => {
      if (interruption) return;
      interruption = { code, message };
      cleanupPromise = terminateProcessTree(child, terminationGraceMs);
    };
    const onAbort = () => interrupt("APEX_TEST_PROCESS_ABORTED", `${commandText} aborted by the test context`);

    const finish = async (code, exitSignal, spawnError) => {
      if (settled) return;
      settled = true;
      if (timer !== undefined) clearTimeout(timer);
      abortSignal?.removeEventListener("abort", onAbort);
      try {
        if (cleanupPromise) await cleanupPromise;
      } catch (error) {
        error.code = "APEX_TEST_PROCESS_CLEANUP";
        reject(error);
        return;
      }
      if (spawnError) {
        reject(spawnError);
        return;
      }

      const output = `${stderr}${stdout}${outputTruncated ? "\n[output truncated]" : ""}`;
      if (interruption) {
        const error = new Error(`${interruption.message}${output ? `\n${output}` : ""}`);
        error.code = interruption.code;
        if (interruption.code === "APEX_TEST_PROCESS_TIMEOUT") error.timeoutMs = timeoutMs;
        error.outputTruncated = outputTruncated;
        reject(error);
      } else if (code === 0) resolvePromise({ stdout, stderr, outputTruncated });
      else reject(new Error(`${commandText} failed (${code ?? exitSignal})\n${output}`));
    };

    child.on("error", (error) => void finish(null, null, error));
    child.on("close", (code, exitSignal) => void finish(code, exitSignal));
    const armTimeout = () => {
      if (settled) return;
      timer = setTimeout(
        () => interrupt("APEX_TEST_PROCESS_TIMEOUT", `${commandText} timed out after ${timeoutMs}ms`),
        timeoutMs,
      );
    };
    if (ready === undefined) armTimeout();
    else
      Promise.resolve()
        .then(ready)
        .then(armTimeout, (error) => {
          interrupt("APEX_TEST_PROCESS_STARTUP", `${commandText} did not become ready`);
          void finish(null, null, error);
        });
    if (abortSignal?.aborted) onAbort();
    else abortSignal?.addEventListener("abort", onAbort, { once: true });
  });
}

test("run times out and terminates a resistant process tree", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "apex-process-tree-test-"));
  const pidFile = join(temporaryRoot, "pids.txt");
  context.after(async () => {
    await emergencyCleanup(pidFile);
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  const execution = run(process.execPath, [resistantProcessTree, pidFile], root, {
    timeoutMs: 250,
    terminationGraceMs: 50,
    ready: () => waitForRecordedPids(pidFile, 3, 5_000),
  });
  await assert.rejects(execution, (error) => {
    assert.equal(error.code, "APEX_TEST_PROCESS_TIMEOUT");
    assert.match(error.message, /timed out after 250ms/);
    return true;
  });
  const pids = await recordedPids(pidFile);
  assert.equal(pids.length, 3);
  assert.deepEqual(pids.filter(processExists), []);
});

test("run caps diagnostics from a timed-out process", async () => {
  await assert.rejects(
    run(process.execPath, ["-e", 'process.stdout.write("x".repeat(8_192)); setInterval(() => {}, 1_000)'], root, {
      timeoutMs: 100,
      terminationGraceMs: 25,
      maxOutputBytes: 128,
    }),
    (error) => {
      assert.equal(error.code, "APEX_TEST_PROCESS_TIMEOUT");
      assert.equal(error.outputTruncated, true);
      assert.match(error.message, /\[output truncated\]/);
      assert.ok(Buffer.byteLength(error.message) < 512);
      return true;
    },
  );
});

test("run terminates a resistant process tree when its test context aborts", async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "apex-process-abort-test-"));
  const pidFile = join(temporaryRoot, "pids.txt");
  const controller = new AbortController();
  context.after(async () => {
    await emergencyCleanup(pidFile);
    await rm(temporaryRoot, { recursive: true, force: true });
  });

  const execution = run(process.execPath, [resistantProcessTree, pidFile], root, {
    signal: controller.signal,
    timeoutMs: 5_000,
    terminationGraceMs: 50,
  });
  await waitForRecordedPids(pidFile, 3);
  controller.abort();

  await assert.rejects(execution, (error) => {
    assert.equal(error.code, "APEX_TEST_PROCESS_ABORTED");
    assert.match(error.message, /aborted by the test context/);
    return true;
  });
  const pids = await recordedPids(pidFile);
  assert.deepEqual(pids.filter(processExists), []);
});

test("packs and clean-installs the vNext runtime reproducibly", { timeout: 240_000 }, async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "apex-pack-test-"));
  context.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const runInTest = (command, args, cwd = root, options = {}) =>
    run(command, args, cwd, { ...options, signal: context.signal });
  const outputDirectory = join(temporaryRoot, "packages");
  const secondOutputDirectory = join(temporaryRoot, "packages-repeat");
  await runInTest(process.execPath, [
    join(root, "tools", "scripts", "pack-vnext.mjs"),
    "--output-dir",
    outputDirectory,
  ]);
  await runInTest(process.execPath, [
    join(root, "tools", "scripts", "pack-vnext.mjs"),
    "--output-dir",
    secondOutputDirectory,
  ]);

  const outputFiles = (await readdir(outputDirectory)).sort();
  assert.deepEqual((await readdir(secondOutputDirectory)).sort(), outputFiles);
  for (const file of outputFiles) {
    assert.deepEqual(await readFile(join(secondOutputDirectory, file)), await readFile(join(outputDirectory, file)));
  }

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

    const dryRun = JSON.parse(
      (await runInTest("npm", ["pack", "--workspace", entry.package, "--json", "--dry-run"])).stdout,
    );
    const expectedFiles = dryRun[0].files.map(({ path }) => path).sort();
    const actualFiles = (await runInTest("tar", ["-tzf", tarball])).stdout
      .split("\n")
      .filter((path) => path.startsWith("package/") && !path.endsWith("/"))
      .map((path) => path.slice("package/".length))
      .sort();
    assert.deepEqual(actualFiles, expectedFiles, `${entry.package} dry-run inventory differs from its tarball`);
  }

  for (const securityEntry of Object.values(release.security)) {
    const bytes = await readFile(join(outputDirectory, securityEntry.file));
    assert.equal(securityEntry.sha256, createHash("sha256").update(bytes).digest("hex"));
  }
  const releaseRefs = release.packages.map((entry) => `${entry.package}@${entry.version}`).sort();
  const sbom = JSON.parse(await readFile(join(outputDirectory, release.security.sbom.file), "utf8"));
  const sbomReleaseRefs = sbom.components
    .map((component) => component["bom-ref"])
    .filter((reference) => reference.startsWith("@apex/"))
    .sort();
  assert.deepEqual(sbomReleaseRefs, releaseRefs);
  const rootDependency = sbom.dependencies.find(({ ref }) => ref === sbom.metadata.component["bom-ref"]);
  assert.deepEqual(rootDependency.dependsOn.filter((reference) => reference.startsWith("@apex/")).sort(), releaseRefs);
  const provenance = JSON.parse(await readFile(join(outputDirectory, release.security.provenance.file), "utf8"));
  assert.deepEqual(
    provenance.subject.map(({ name, digest }) => ({ name, sha256: digest.sha256 })),
    [
      ...release.packages.map(({ file, sha256 }) => ({ name: file, sha256 })),
      { name: release.security.sbom.file, sha256: release.security.sbom.sha256 },
    ],
  );
  assert.equal(provenance.predicate.buildDefinition.resolvedDependencies[0].digest.gitCommit, release.sourceCommit);
  assert.equal(provenance.predicate.buildDefinition.resolvedDependencies[0].uri, release.sourceRepository);
  assert.deepEqual(provenance.predicate.buildDefinition.internalParameters, release.toolchain);

  const testkitOutput = join(temporaryRoot, "packages-with-testkit");
  await runInTest(process.execPath, [
    join(root, "tools", "scripts", "pack-vnext.mjs"),
    "--output-dir",
    testkitOutput,
    "--include-testkit",
  ]);
  const testkitRelease = JSON.parse(await readFile(join(testkitOutput, "release-manifest.json"), "utf8"));
  assert.ok(testkitRelease.packages.some(({ package: name }) => name === "@apex/testkit"));
  const testkitSbom = JSON.parse(await readFile(join(testkitOutput, testkitRelease.security.sbom.file), "utf8"));
  assert.ok(testkitSbom.components.some((component) => component["bom-ref"] === "@apex/testkit@0.1.0"));
  const testkitProvenance = JSON.parse(
    await readFile(join(testkitOutput, testkitRelease.security.provenance.file), "utf8"),
  );
  assert.equal(testkitProvenance.predicate.buildDefinition.externalParameters.includeTestkit, true);

  const cliEntry = release.packages.find(({ package: name }) => name === "@apex/cli");
  const cliTarball = join(outputDirectory, cliEntry.file);
  const listing = (await runInTest("tar", ["-tzf", cliTarball])).stdout.split("\n").filter(Boolean);
  assert.ok(listing.includes("package/assets/customizations/.github/agents/apex.agent.md"));
  assert.ok(listing.includes("package/assets/config/workflow.v1.json"));
  assert.ok(
    listing.every((path) => !path.includes("/dist/test/") && !path.endsWith(".map") && !path.endsWith(".tsbuildinfo")),
  );

  const runtimeTarballs = release.packages.map((entry) => join(outputDirectory, entry.file));
  const approvedCache = join(temporaryRoot, "approved-npm-cache");
  const createConsumer = async (name) => {
    const directory = join(temporaryRoot, name);
    await mkdir(directory, { recursive: true });
    await runInTest("npm", ["init", "--yes"], directory);
    return directory;
  };
  const installCandidate = async (directory, offline = false) =>
    await runInTest(
      "npm",
      [
        "install",
        ...(offline ? ["--offline"] : []),
        "--cache",
        approvedCache,
        "--ignore-scripts",
        "--no-audit",
        "--no-fund",
        ...runtimeTarballs,
      ],
      directory,
    );

  const unpreparedConsumer = await createConsumer("consumer-unprepared");
  await assert.rejects(installCandidate(unpreparedConsumer, true), /ENOTCACHED/);
  const cacheSeed = await createConsumer("cache-seed");
  await installCandidate(cacheSeed);
  await runInTest("npm", ["cache", "verify", "--cache", approvedCache]);
  const project = await createConsumer("consumer");
  await installCandidate(project, true);

  const apexBin = join(project, "node_modules", ".bin", process.platform === "win32" ? "apex.cmd" : "apex");
  const version = JSON.parse((await runInTest(apexBin, ["version", "--json"], project)).stdout);
  assert.deepEqual(version, { ok: true, result: { version: "0.1.0", bundleVersion: "0.1.0", configVersion: "1.0.0" } });
  await runInTest("git", ["init", "--initial-branch", "qualification"], project);
  await runInTest(apexBin, ["init", "--project", "demo", "--json"], project);
  await readFile(join(project, ".github", "agents", "apex.agent.md"));
  const mcpConfig = JSON.parse(await readFile(join(project, ".vscode", "mcp.json"), "utf8")).servers.apex;
  const workspaceValue = (value) => value.replaceAll("${workspaceFolder}", project);
  const sdkRoot = join(project, "node_modules", "@modelcontextprotocol", "sdk", "dist", "esm", "client");
  const [{ Client }, { StdioClientTransport }] = await Promise.all([
    import(pathToFileURL(join(sdkRoot, "index.js")).href),
    import(pathToFileURL(join(sdkRoot, "stdio.js")).href),
  ]);
  const mcpClient = new Client({ name: "packed-consumer-test", version: "1.0.0" });
  const mcpTransport = new StdioClientTransport({
    command: workspaceValue(mcpConfig.command),
    args: mcpConfig.args.map(workspaceValue),
    cwd: workspaceValue(mcpConfig.cwd),
    stderr: "pipe",
  });
  try {
    await mcpClient.connect(mcpTransport);
    const tools = await mcpClient.listTools();
    assert.ok(tools.tools.some(({ name }) => name === "status"));
    const status = await mcpClient.callTool({ name: "status", arguments: {} });
    assert.equal(status.isError, undefined);
    assert.equal(status.structuredContent.run.projectId, "demo");
  } finally {
    await mcpClient.close();
  }
  for (const path of [".apex/local/run/saved.tfplan", ".apex/work/run/task/output.json", ".apex/cache/content/item"]) {
    await mkdir(join(project, path, ".."), { recursive: true });
    await writeFile(join(project, path), "derived\n");
    await runInTest("git", ["check-ignore", "--quiet", path], project);
  }
  await assert.rejects(
    runInTest("git", ["check-ignore", "--quiet", ".apex/projects/demo/project.json"], project),
    /failed \(1\)/,
  );
  await readFile(join(project, ".apex", "runtime", "workflow.v1.json"));
  const governancePack = "azure-governance-discovery";
  const capability = async (args) =>
    JSON.parse((await runInTest(apexBin, ["capability", ...args, "--json"], project)).stdout).result;
  const absentPack = await capability(["status", "--pack", governancePack]);
  assert.equal(absentPack.state, "not-installed");
  const installedPack = await capability(["install", "--pack", governancePack, "--yes"]);
  assert.equal(installedPack.state, "installed");
  assert.equal(installedPack.changed, true);
  assert.equal((await capability(["verify", "--pack", governancePack])).state, "installed");
  const updatedPack = await capability(["update", "--pack", governancePack, "--yes"]);
  assert.equal(updatedPack.state, "installed");
  assert.equal(updatedPack.changed, true);
  const rolledBackPack = await capability(["rollback", "--pack", governancePack, "--yes"]);
  assert.equal(rolledBackPack.state, "installed");
  assert.equal(rolledBackPack.changed, true);
  const removedPack = await capability(["uninstall", "--pack", governancePack, "--yes"]);
  assert.equal(removedPack.state, "not-installed");
  assert.equal(removedPack.changed, true);
  assert.equal((await capability(["status", "--pack", governancePack])).state, "not-installed");
  await assert.rejects(readFile(join(project, ".apex", "capability-packs", governancePack, "pack.lock.json")), {
    code: "ENOENT",
  });
  await readFile(join(project, ".apex", "runtime", "capability-packs.registry.json"));
  await writeFile(join(project, "keep.txt"), "preserve me\n", "utf8");
  const lock = JSON.parse(await readFile(join(project, ".apex", "customizations.lock.json"), "utf8"));
  for (const file of [...lock.files, ...lock.runtime]) {
    const path = lock.files.includes(file) ? join(project, file.path) : join(project, ".apex", "runtime", file.path);
    const hash = createHash("sha256")
      .update(await readFile(path))
      .digest("hex");
    assert.equal(file.sourceHash, hash);
    assert.equal(file.currentHash, hash);
  }
  const uninstall = JSON.parse((await runInTest(apexBin, ["customizations", "uninstall", "--json"], project)).stdout);
  assert.equal(uninstall.ok, true);
  assert.deepEqual(uninstall.result.conflicts, []);
  await assert.rejects(readFile(join(project, ".github", "agents", "apex.agent.md")), { code: "ENOENT" });
  assert.equal(await readFile(join(project, ".apex", ".gitignore"), "utf8"), "/cache/\n/local/\n/work/\n");
  await assert.rejects(readFile(join(project, ".apex", "customizations.lock.json")), { code: "ENOENT" });
  assert.equal(await readFile(join(project, "keep.txt"), "utf8"), "preserve me\n");
  await readFile(join(project, ".apex", "runtime", "workflow.v1.json"));
  await readFile(join(project, ".apex", "projects", "demo", "project.json"));
});
