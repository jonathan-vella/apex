#!/usr/bin/env node
/** Install reviewed consumer templates without overwriting local customizations. */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";

export const CONSUMER_WORKFLOWS = Object.freeze([
  "governance-policy-baseline.yml",
  "iac-checks.yml",
  "weekly-maintenance.yml",
]);
const REPOSITORY = "jonathan-vella/apex";
const STATE_PATH = ".github/consumer-workflows-state.json";
const digest = (content) => crypto.createHash("sha256").update(content).digest("hex");

function regularPath(root, relative) {
  let target = root;
  for (const component of relative.split("/")) {
    target = path.join(target, component);
    try {
      if (fs.lstatSync(target).isSymbolicLink()) throw new Error(`Refusing symlink: ${relative}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return target;
}

export async function syncWorkflows({ root = process.cwd(), ref = "main", dryRun = true, fetchImpl = fetch } = {}) {
  const get = async (url, json = false) => {
    const response = await fetchImpl(url);
    if (!response.ok) throw new Error(`Download failed (${response.status}): ${url}`);
    return json ? response.json() : response.text();
  };
  const commit = await get(`https://api.github.com/repos/${REPOSITORY}/commits/${encodeURIComponent(ref)}`, true);
  if (!/^[a-f0-9]{40}$/.test(commit.sha ?? "")) throw new Error("Upstream did not resolve to a commit SHA");
  const statePath = regularPath(root, STATE_PATH);
  const prior = fs.existsSync(statePath) ? JSON.parse(fs.readFileSync(statePath, "utf8")) : { files: {} };
  if (prior.schema_version && (prior.schema_version !== "consumer-workflows-v1" || prior.repository !== REPOSITORY))
    throw new Error("Unsupported workflow provenance");
  if (!prior.files || typeof prior.files !== "object" || Array.isArray(prior.files))
    throw new Error("Invalid workflow provenance files");
  const entries = [];
  for (const name of CONSUMER_WORKFLOWS) {
    const content = await get(
      `https://raw.githubusercontent.com/${REPOSITORY}/${commit.sha}/.github/consumer-workflows/${name}`,
    );
    const workflow = yaml.load(content);
    if (
      !workflow ||
      typeof workflow !== "object" ||
      !workflow.on ||
      !workflow.jobs ||
      !Object.values(workflow.jobs).every((job) => typeof job.if === "string" && Array.isArray(job.steps))
    )
      throw new Error(`Invalid consumer workflow template: ${name}`);
    const target = regularPath(root, `.github/workflows/${name}`);
    const current = fs.existsSync(target) ? fs.readFileSync(target, "utf8") : null;
    const hash = digest(content);
    const status =
      current === content
        ? "unchanged"
        : current === null
          ? "add"
          : digest(current) === prior.files[name]
            ? "update"
            : "conflict";
    entries.push({ name, target, content, hash, status });
  }
  const retired = Object.keys(prior.files).filter((name) => !CONSUMER_WORKFLOWS.includes(name));
  const report = {
    repository: REPOSITORY,
    commit: commit.sha,
    dryRun,
    changes: entries.map(({ name, status }) => ({ name, status })),
    retired,
  };
  if (entries.some(({ status }) => status === "conflict")) return { ...report, exitCode: 2 };
  if (!dryRun) {
    for (const entry of entries) {
      if (entry.status === "unchanged") continue;
      fs.mkdirSync(path.dirname(entry.target), { recursive: true });
      fs.writeFileSync(entry.target, entry.content);
    }
    const state = {
      schema_version: "consumer-workflows-v1",
      repository: REPOSITORY,
      commit: commit.sha,
      files: { ...prior.files, ...Object.fromEntries(entries.map(({ name, hash }) => [name, hash])) },
    };
    fs.mkdirSync(path.dirname(statePath), { recursive: true });
    fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
  }
  return { ...report, exitCode: 0 };
}

export async function main(args = process.argv.slice(2)) {
  const options = {};
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === "--apply") options.dryRun = false;
    else if (arg === "--dry-run" || arg === "--dry") options.dryRun = true;
    else if (arg === "--ref" && args[index + 1]) options.ref = args[++index];
    else if (arg === "--help" || arg === "-h") {
      console.log(
        "Usage: npm run sync:workflows -- [--dry-run | --apply] [--ref COMMIT]\nDefaults to preview. Review changes before applying; conflicts and retirements require human review.",
      );
      return 0;
    } else throw new Error(`Unknown or incomplete argument: ${arg}`);
  }
  const report = await syncWorkflows(options);
  console.log(JSON.stringify(report, null, 2));
  return report.exitCode;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = await main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
