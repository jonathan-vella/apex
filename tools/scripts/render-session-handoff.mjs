#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { ARTIFACT_HEADINGS } from "./_lib/artifact-headings.mjs";
import { parseFrontmatter } from "./_lib/parse-frontmatter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const digest = (content) => crypto.createHash("sha256").update(content).digest("hex");
const inline = (value) => {
  const text = String(value);
  if (/[\r\n]/.test(text)) throw new Error("Multiline handoff values require owner reconciliation");
  return text;
};

export function renderHandoff(view, { owner, operation }) {
  if (!view.session?.steps || !view.project) throw new Error("Authoritative project state is required");
  const session = view.session;
  for (const result of Object.values(session.effective_reviews || {})) {
    if (result.status !== "current") throw new Error("Selected review is invalid; return to its owner");
  }
  const lines = [
    `# ${inline(view.project)} - Handoff`,
    `Next owner: ${inline(owner)} | Requested operation: ${inline(operation)}`,
    "",
  ];
  const sections = ARTIFACT_HEADINGS["00-handoff.md"];
  const bodies = [
    Object.entries(session.steps).map(([step, value]) => `- Step ${inline(step)}: ${inline(value.status)}.`),
    ["iac_tool", "region", "deployment_strategy", "plan_status"]
      .filter((key) => session.decisions?.[key] !== undefined)
      .map((key) => `- ${key}: ${inline(session.decisions[key])}`),
    (session.open_findings || []).map((finding) => `- Recorded finding (owner must reconcile): ${inline(finding)}`),
    [
      `- Human-selected next owner: ${inline(owner)}.`,
      "- This handoff grants no new approval, review allowance, deployment permission or data-plane access.",
      "- Preserve frozen inputs and current reviews; incomplete evidence returns to its owner.",
    ],
    Object.entries(session.review_selections || {}).map(
      ([step, record]) => `- Step ${inline(step)} selection: ${inline(record.path)}; ${inline(record.input_coverage)}.`,
    ),
    (view.artifacts || [])
      .filter((artifact) =>
        /(?:04-(?:iac-contract|environment-manifest|policy-property-map)|sku-manifest|05-iac-handoff)\.json$/.test(
          artifact.file,
        ),
      )
      .map((artifact) => `- ${inline(artifact.file)}`),
  ];
  if (!bodies[2].length)
    bodies[2].push("- No blocking entries in recall; check selected reviews and current preflight before advancement.");
  for (const [index, heading] of sections.entries()) lines.push(heading, "", ...bodies[index], "");
  if (lines.length >= 60)
    throw new Error(
      `Required handoff content exceeds limit (${lines.length} lines); reconcile findings, never truncate`,
    );
  return `${lines.join("\n").trimEnd()}\n`;
}

export function writeHandoff(destination, text, expectedSha) {
  const directory = path.dirname(destination);
  if (fs.realpathSync(directory) !== path.resolve(directory))
    throw new Error("Handoff directory must not traverse symlinks");
  const lock = `${destination}.write-lock`;
  const handle = fs.openSync(lock, "wx");
  let scratch;
  try {
    const check = () => {
      const stat = fs.lstatSync(destination, { throwIfNoEntry: false });
      if (stat?.isSymbolicLink() || (stat && !stat.isFile()))
        throw new Error("Handoff must be a regular non-symlink file");
      if (stat && (!expectedSha || digest(fs.readFileSync(destination)) !== expectedSha)) {
        throw new Error("Existing handoff changed or replacement not authorized with --expected-sha");
      }
      if (!stat && expectedSha) throw new Error("Expected handoff is missing");
      return stat;
    };
    const original = check();
    scratch = fs.mkdtempSync(path.join(directory, ".handoff-"));
    const temporary = path.join(scratch, "content.md");
    fs.writeFileSync(temporary, text, { flag: "wx" });
    check();
    if (original) fs.renameSync(temporary, destination);
    else fs.linkSync(temporary, destination);
  } finally {
    if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
    fs.closeSync(handle);
    fs.unlinkSync(lock);
  }
}

export function main(argv = process.argv.slice(2)) {
  const { values } = parseArgs({
    args: argv,
    options: {
      project: { type: "string" },
      owner: { type: "string" },
      operation: { type: "string" },
      write: { type: "boolean" },
      "expected-sha": { type: "string" },
      help: { type: "boolean" },
    },
  });
  if (values.help) {
    console.log(
      "Usage: render-session-handoff.mjs --project NAME --owner 'Exact agent name' --operation SCOPE [--write --expected-sha SHA]\nDefault: stdout only. Existing files require exact SHA for replacement. No state transition occurs.",
    );
    return 0;
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(values.project || "") || !values.owner || !values.operation)
    throw new Error("Project, owner and operation are required");
  const registry = JSON.parse(fs.readFileSync(path.join(ROOT, "tools/registry/agent-registry.json"), "utf8"));
  const agentPaths = [];
  const visit = (record) => {
    if (!record || typeof record !== "object") return;
    if (typeof record.agent === "string") agentPaths.push(record.agent);
    else for (const child of Object.values(record)) visit(child);
  };
  visit(registry.agents);
  const owners = agentPaths.map((file) => parseFrontmatter(fs.readFileSync(path.join(ROOT, file), "utf8"))?.name);
  if (!owners.includes(values.owner)) throw new Error("Unknown next owner; use the exact registry agent name");
  const root = process.env.APEX_ROOT || ROOT;
  const result = spawnSync("apex-recall", ["show", values.project, "--json"], { cwd: root, encoding: "utf8" });
  if (result.status !== 0) throw new Error(`Recall view unavailable: ${result.stderr}`);
  const text = renderHandoff(JSON.parse(result.stdout), values);
  if (!values.write) {
    console.log(text);
    return 0;
  }
  const destination = path.join(root, "agent-output", values.project, "00-handoff.md");
  writeHandoff(destination, text, values["expected-sha"]);
  console.log(`Handoff written: ${destination}`);
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
