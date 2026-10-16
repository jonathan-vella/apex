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
  const digests = new Map();
  for (const key of ["plan_ref", "l1m_ref"]) {
    const reference = contract[key];
    if (!reference?.path) throw new Error(`Missing ${key} reference`);
    const source = path.resolve(directory, reference.path);
    if (path.dirname(source) !== path.resolve(directory) || fs.lstatSync(source).isSymbolicLink()) {
      throw new Error("Hash references must be same-project regular files");
    }
    const digest = hash(fs.readFileSync(source));
    inputs.set(source, digest);
    digests.set(key, digest);
    reference.sha256 = digest;
  }
  if (hash(fs.readFileSync(contractPath)) !== expectedSha) throw new Error("Contract changed during synchronization");
  for (const [source, digest] of inputs)
    if (hash(fs.readFileSync(source)) !== digest) throw new Error("Referenced input changed");
  return {
    text: stampText(original.toString("utf8"), digests, contract),
    reason,
    input_hashes: Object.fromEntries(inputs),
  };
}

// Replacing only the digest bytes keeps the file's formatting; re-serializing reformats it and breaks later edits.
function stampText(original, digests, contract) {
  let text = original;
  for (const [key, digest] of digests) {
    const pattern = new RegExp(`("${key}"\\s*:\\s*\\{[^{}]*?"sha256"\\s*:\\s*")[a-f0-9]{64}(")`);
    if (!pattern.test(text)) return `${JSON.stringify(contract, null, 2)}\n`;
    text = text.replace(pattern, `$1${digest}$2`);
  }
  return text;
}

export function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      project: { type: "string" },
      "expected-sha": { type: "string" },
      reason: { type: "string" },
      write: { type: "boolean" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: sync-draft-contract-hashes.mjs --project NAME --expected-sha SHA --reason TEXT [--write]\nUpdates only plan_ref/l1m_ref sha256 values and keeps the file's formatting. Prints the corrected draft on stdout unless --write replaces the contract atomically. Never writes findings or approved artifacts.",
    );
    return 0;
  }
  if (!/^[A-Za-z0-9_-]+$/.test(values.project || "")) throw new Error("Valid project is required");
  const root = process.env.APEX_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const result = spawnSync("apex-recall", ["show", values.project, "--json"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error("Authoritative project state unavailable");
  const contractPath = path.join(root, "agent-output", values.project, "04-iac-contract.json");
  const output = syncDraft(contractPath, {
    expectedSha: values["expected-sha"],
    reason: values.reason,
    state: JSON.parse(result.stdout).session,
  });
  if (values.write) {
    const temporary = `${contractPath}.sync-${process.pid}`;
    fs.writeFileSync(temporary, output.text, { flag: "wx" });
    fs.renameSync(temporary, contractPath);
  } else process.stdout.write(output.text);
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
