import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawn } from "node:child_process";
import test from "node:test";

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
      clearTimeout(timer);
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
    const timer = setTimeout(
      () => interrupt("APEX_TEST_PROCESS_TIMEOUT", `${commandText} timed out after ${timeoutMs}ms`),
      timeoutMs,
    );
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
  }).then(
    () => ({ status: "resolved" }),
    (error) => ({ status: "rejected", error }),
  );
  const outcome = await Promise.race([execution, delay(750).then(() => ({ status: "pending" }))]);

  if (outcome.status === "pending") await emergencyCleanup(pidFile);
  assert.equal(outcome.status, "rejected");
  assert.equal(outcome.error.code, "APEX_TEST_PROCESS_TIMEOUT");
  assert.match(outcome.error.message, /timed out after 250ms/);
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

test("packs and clean-installs the vNext runtime", { timeout: 180_000 }, async (context) => {
  const temporaryRoot = await mkdtemp(join(tmpdir(), "apex-pack-test-"));
  context.after(() => rm(temporaryRoot, { recursive: true, force: true }));
  const runInTest = (command, args, cwd = root, options = {}) =>
    run(command, args, cwd, { ...options, signal: context.signal });
  const outputDirectory = join(temporaryRoot, "packages");
  await runInTest(process.execPath, [
    join(root, "tools", "scripts", "pack-vnext.mjs"),
    "--output-dir",
    outputDirectory,
  ]);

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
  const listing = (await runInTest("tar", ["-tzf", cliTarball])).stdout.split("\n").filter(Boolean);
  assert.ok(listing.includes("package/assets/customizations/.github/agents/apex.agent.md"));
  assert.ok(listing.includes("package/assets/config/workflow.v1.json"));
  assert.ok(
    listing.every((path) => !path.includes("/dist/test/") && !path.endsWith(".map") && !path.endsWith(".tsbuildinfo")),
  );

  const project = join(temporaryRoot, "consumer");
  await mkdir(project, { recursive: true });
  await runInTest("npm", ["init", "--yes"], project);
  const runtimeTarballs = release.packages.map((entry) => join(outputDirectory, entry.file));
  await runInTest("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", ...runtimeTarballs], project);

  const version = JSON.parse(
    (await runInTest(join(project, "node_modules", ".bin", "apex"), ["version", "--json"], project)).stdout,
  );
  assert.deepEqual(version, { ok: true, result: { version: "0.1.0", bundleVersion: "0.1.0", configVersion: "1.0.0" } });
  await runInTest(join(project, "node_modules", ".bin", "apex"), ["init", "--project", "demo", "--json"], project);
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
