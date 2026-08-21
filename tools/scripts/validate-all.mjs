#!/usr/bin/env node
/**
 * Cache-aware validation suite runner.
 *
 * Node validator modules run sequentially in this process so their imported
 * workspace, frontmatter, workflow, JSON, artifact, and schema caches are
 * shared. Commands that require another runtime remain in a bounded child pool.
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { expandScript } from "./_lib/npm-script-graph.mjs";

const ROOT = process.cwd();
const DEFAULT_SUITE = "validate:_node-ci";
const DEFAULT_CONCURRENCY = 4;

class ValidatorExit extends Error {
  constructor(code) {
    super(`validator exited with code ${code}`);
    this.code = Number(code ?? 0);
  }
}

function parseArgs(argv) {
  const suiteArg = argv.find((arg) => arg.startsWith("--suite="));
  const concurrencyArg = argv.find((arg) => arg.startsWith("--concurrency="));
  const concurrency = Number(concurrencyArg?.split("=")[1] ?? DEFAULT_CONCURRENCY);
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    throw new Error("--concurrency must be a positive integer");
  }
  return {
    suite: suiteArg?.split("=")[1] ?? DEFAULT_SUITE,
    concurrency,
  };
}

function loadScripts() {
  return JSON.parse(fs.readFileSync(path.join(ROOT, "package.json"), "utf8")).scripts ?? {};
}

function suiteNames(scripts, suite) {
  return expandScript(scripts, suite);
}

function classifyTask(name, command) {
  const match = command.match(/^((?:[A-Z][A-Z0-9_]*=\S+\s+)*)node\s+(?!.*(?:^|\s)--test(?:\s|$))(\S+\.mjs)(.*)$/);
  if (!match) return { name, type: "subprocess" };

  const env = {};
  for (const assignment of match[1].trim().split(/\s+/).filter(Boolean)) {
    const separator = assignment.indexOf("=");
    env[assignment.slice(0, separator)] = assignment.slice(separator + 1);
  }
  return {
    name,
    type: "module",
    modulePath: path.resolve(ROOT, match[2]),
    args: match[3].trim().split(/\s+/).filter(Boolean),
    env,
  };
}

export async function runModuleValidator(task, sequence = 0) {
  const startedAt = performance.now();
  const originalArgv = process.argv;
  const originalExit = process.exit;
  const originalExitCode = process.exitCode;
  const originalEnv = new Map();

  process.argv = [process.execPath, task.modulePath, ...task.args];
  process.exitCode = undefined;
  for (const [key, value] of Object.entries(task.env)) {
    originalEnv.set(key, process.env[key]);
    process.env[key] = value;
  }
  process.exit = (code) => {
    throw new ValidatorExit(code);
  };

  let exitCode;
  try {
    const url = pathToFileURL(task.modulePath);
    url.searchParams.set("validationRun", String(sequence));
    await import(url.href);
    exitCode = Number(process.exitCode ?? 0);
  } catch (error) {
    if (error instanceof ValidatorExit) exitCode = error.code;
    else {
      exitCode = 1;
      console.error(`\n❌ ${task.name}: ${error.stack ?? error.message}`);
    }
  } finally {
    process.argv = originalArgv;
    process.exit = originalExit;
    process.exitCode = originalExitCode;
    for (const [key, value] of originalEnv) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }

  return { name: task.name, exitCode, durationMs: performance.now() - startedAt };
}

function runSubprocess(task) {
  const startedAt = performance.now();
  return new Promise((resolve) => {
    const child = spawn("npm", ["run", task.name], {
      cwd: ROOT,
      env: process.env,
      stdio: "inherit",
    });
    child.on("error", (error) => {
      console.error(`\n❌ ${task.name}: ${error.message}`);
      resolve({ name: task.name, exitCode: 1, durationMs: performance.now() - startedAt });
    });
    child.on("close", (code) => {
      resolve({ name: task.name, exitCode: Number(code ?? 1), durationMs: performance.now() - startedAt });
    });
  });
}

async function runBounded(tasks, concurrency) {
  const results = [];
  let cursor = 0;
  async function worker() {
    while (cursor < tasks.length) {
      const task = tasks[cursor++];
      results.push(await runSubprocess(task));
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker));
  return results;
}

export async function runValidationSuite({ suite = DEFAULT_SUITE, concurrency = DEFAULT_CONCURRENCY } = {}) {
  const scripts = loadScripts();
  const tasks = suiteNames(scripts, suite).map((name) => {
    if (!scripts[name]) throw new Error(`Unknown validation script: ${name}`);
    return classifyTask(name, scripts[name]);
  });
  const moduleTasks = tasks.filter((task) => task.type === "module");
  const subprocessTasks = tasks.filter((task) => task.type === "subprocess");
  const startedAt = performance.now();
  const results = [];

  console.log(`\n🚀 ${suite}: ${moduleTasks.length} shared-process modules, ${subprocessTasks.length} child commands`);
  for (const [index, task] of moduleTasks.entries()) {
    results.push(await runModuleValidator(task, index));
  }
  results.push(...(await runBounded(subprocessTasks, concurrency)));

  const failed = results.filter((result) => result.exitCode !== 0);
  const durationMs = performance.now() - startedAt;
  console.log(`\n${"─".repeat(64)}`);
  console.log(
    `Validation summary: ${results.length - failed.length} passed, ${failed.length} failed, ${(durationMs / 1000).toFixed(2)}s`,
  );
  if (failed.length) console.error(`Failed: ${failed.map((result) => result.name).join(", ")}`);
  return { exitCode: failed.length ? 1 : 0, durationMs, results };
}

const invokedAsScript =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname);
if (invokedAsScript) {
  try {
    const result = await runValidationSuite(parseArgs(process.argv.slice(2)));
    process.exit(result.exitCode);
  } catch (error) {
    console.error(`❌ validate-all: ${error.message}`);
    process.exit(2);
  }
}
