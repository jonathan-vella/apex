#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";

const hash = (bytes) => crypto.createHash("sha256").update(bytes).digest("hex");

export function syncDraft(contractPath, { expectedSha, reason, state }) {
  if (!reason?.trim()) throw new Error("Explicit owner reason is required");
  if (
    state?.steps?.["4"]?.status !== "in_progress" ||
    state?.decisions?.plan_status === "APPROVED" ||
    state?.metadata?.plan_lock
  ) {
    throw new Error("Only owner-reopened, unapproved draft Plan contracts may be synchronized");
  }
  if (fs.lstatSync(contractPath).isSymbolicLink()) throw new Error("Contract must not be a symlink");
  const original = fs.readFileSync(contractPath);
  if (hash(original) !== expectedSha) throw new Error("Contract revision changed");
  const contract = JSON.parse(original);
  const directory = path.dirname(contractPath);
  if (path.basename(contractPath) !== "04-iac-contract.json")
    throw new Error("Only the draft IaC contract is supported");
  const inputs = new Map();
  for (const key of ["plan_ref", "l1m_ref"]) {
    const reference = contract[key];
    if (!reference?.path) throw new Error(`Missing ${key} reference`);
    const source = path.resolve(directory, reference.path);
    if (path.dirname(source) !== path.resolve(directory) || fs.lstatSync(source).isSymbolicLink()) {
      throw new Error("Hash references must be same-project regular files");
    }
    const digest = hash(fs.readFileSync(source));
    inputs.set(source, digest);
    reference.sha256 = digest;
  }
  if (hash(fs.readFileSync(contractPath)) !== expectedSha) throw new Error("Contract changed during synchronization");
  for (const [source, digest] of inputs)
    if (hash(fs.readFileSync(source)) !== digest) throw new Error("Referenced input changed");
  return { text: `${JSON.stringify(contract, null, 2)}\n`, reason, input_hashes: Object.fromEntries(inputs) };
}

export function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      project: { type: "string" },
      "expected-sha": { type: "string" },
      reason: { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: sync-draft-contract-hashes.mjs --project NAME --expected-sha SHA --reason TEXT\nProduces corrected draft JSON on stdout only. Never writes findings or approved artifacts.",
    );
    return 0;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(values.project || "")) throw new Error("Valid project is required");
  const root = process.env.APEX_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const result = spawnSync("apex-recall", ["show", values.project, "--json"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error("Authoritative project state unavailable");
  const output = syncDraft(path.join(root, "agent-output", values.project, "04-iac-contract.json"), {
    expectedSha: values["expected-sha"],
    reason: values.reason,
    state: JSON.parse(result.stdout).session,
  });
  process.stdout.write(output.text);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    process.exitCode = main();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
