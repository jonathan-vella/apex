#!/usr/bin/env node
/**
 * Create, validate, and render exact-head live qualification evidence.
 *
 * @example
 * node tools/scripts/live-qualification.mjs validate --file evidence.json --evidence-manifest manifest.json --evidence-file payload.json --release-manifest release-manifest.json
 */

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const COMMAND_OPTIONS = {
  template: new Set([
    "actor",
    "branch",
    "created-at",
    "environment",
    "evidence-manifest",
    "output",
    "package-lock",
    "project",
    "release-manifest",
    "run",
    "runtime-bundle",
    "target-scope",
  ]),
  validate: new Set([
    "branch",
    "evidence-file",
    "evidence-manifest",
    "file",
    "package-lock",
    "release-manifest",
    "runtime-bundle",
  ]),
  render: new Set(["file", "output"]),
};

export function parseLiveQualificationArguments(argv) {
  const command = argv[0];
  const allowed = COMMAND_OPTIONS[command];
  if (allowed === undefined) throw new Error("Command must be template, validate, or render");
  const options = { command };
  for (let index = 1; index < argv.length; index += 2) {
    const argument = argv[index];
    const value = argv[index + 1];
    if (!argument?.startsWith("--") || value === undefined) throw new Error(`Expected --name value at ${argument}`);
    const name = argument.slice(2);
    if (!allowed.has(name)) throw new Error(`Unknown ${command} option: --${name}`);
    if (name === "evidence-file") {
      options[name] ??= [];
      options[name].push(value);
    } else {
      options[name] = value;
    }
  }
  return options;
}

export function createEvidenceManifestTemplate({ projectId, runId, createdAt }) {
  return { schemaVersion: "1.0.0", projectId, runId, createdAt, entries: [] };
}

export function createLiveQualificationTemplate({
  scenarioIds,
  projectId,
  runId,
  candidate,
  evidenceManifestHash,
  createdAt,
  actor,
  environment,
  targetScope,
  toolVersions,
}) {
  return {
    schemaVersion: "1.0.0",
    projectId,
    runId,
    candidate,
    createdAt,
    evidenceManifestHash,
    scenarios: scenarioIds.map((id) => ({
      id,
      environment,
      targetScope,
      actor,
      startedAt: createdAt,
      completedAt: createdAt,
      toolVersions,
      outcome: "unavailable",
      evidenceRefs: [],
      disposition: {
        reason: "Scenario has not been executed",
        owner: actor,
        nextAction: `Execute ${id} against the bound candidate`,
      },
    })),
  };
}

function secretIssues(value, fieldPattern, valuePattern, path = "") {
  if (Array.isArray(value))
    return value.flatMap((item, index) => secretIssues(item, fieldPattern, valuePattern, `${path}/${index}`));
  if (value !== null && typeof value === "object") {
    return Object.entries(value)
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, item]) => [
        ...(fieldPattern.test(key) ? [`${path}/${key}: secret-bearing field is not allowed`] : []),
        ...secretIssues(item, fieldPattern, valuePattern, `${path}/${key}`),
      ]);
  }
  return typeof value === "string" && valuePattern.test(value)
    ? [`${path || "/"}: secret-bearing value is not allowed`]
    : [];
}

export function validateLiveQualification(qualification, evidenceManifest, actual, dependencies) {
  const findings = [
    ...dependencies.qualificationSchemaErrors(qualification).map((message) => `qualification schema: ${message}`),
    ...dependencies
      .evidenceManifestSchemaErrors(evidenceManifest)
      .map((message) => `evidence manifest schema: ${message}`),
  ];
  if (findings.length > 0) return findings;
  if (!dependencies.hasValidLiveQualification(qualification))
    findings.push("qualification semantics: required scenarios or timestamps are invalid");
  for (const [field, expected] of Object.entries(actual.candidate)) {
    if (qualification.candidate[field] !== expected)
      findings.push(`candidate.${field}: expected ${expected}, found ${qualification.candidate[field]}`);
  }
  if (qualification.evidenceManifestHash !== actual.evidenceManifestHash)
    findings.push("evidenceManifestHash: evidence manifest bytes do not match");
  if (qualification.projectId !== evidenceManifest.projectId)
    findings.push(`projectId: expected evidence manifest project ${evidenceManifest.projectId}`);
  if (qualification.runId !== evidenceManifest.runId)
    findings.push(`runId: expected evidence manifest run ${evidenceManifest.runId}`);
  const knownEvidence = new Set(evidenceManifest.entries.map(({ hash }) => hash));
  if (knownEvidence.size !== evidenceManifest.entries.length)
    findings.push("evidence manifest: duplicate entry hashes are not allowed");
  for (const scenario of qualification.scenarios) {
    for (const reference of scenario.evidenceRefs) {
      if (!knownEvidence.has(reference))
        findings.push(`scenarios/${scenario.id}: unknown evidence reference ${reference}`);
    }
  }
  findings.push(...secretIssues(qualification, dependencies.secretFieldPattern, dependencies.secretValuePattern));
  return findings.sort();
}

export function validateEvidencePayloads(evidenceManifest, payloads) {
  if (
    !Array.isArray(evidenceManifest?.entries) ||
    evidenceManifest.entries.some(
      (entry) =>
        entry === null ||
        typeof entry !== "object" ||
        typeof entry.kind !== "string" ||
        typeof entry.hash !== "string" ||
        !Number.isInteger(entry.bytes),
    )
  ) {
    return ["evidence payloads: evidence manifest entries are invalid"];
  }
  const findings = [];
  const entriesByHash = new Map(evidenceManifest.entries.map((entry) => [entry.hash, entry]));
  const matchedHashes = new Set();
  for (const { path, bytes } of payloads) {
    const hash = sha256(bytes);
    const entry = entriesByHash.get(hash);
    if (entry === undefined) {
      findings.push(`evidence payload ${path}: hash ${hash} is not declared in the evidence manifest`);
      continue;
    }
    if (matchedHashes.has(hash)) {
      findings.push(`evidence payload ${path}: duplicates manifest entry ${entry.kind}`);
      continue;
    }
    matchedHashes.add(hash);
    if (bytes.byteLength !== entry.bytes) {
      findings.push(`evidence payload ${path}: expected ${entry.bytes} bytes, found ${bytes.byteLength}`);
    }
  }
  for (const entry of evidenceManifest.entries) {
    if (!matchedHashes.has(entry.hash)) findings.push(`evidence manifest entry ${entry.kind}: payload is missing`);
  }
  return findings.sort();
}

const escapeCell = (value) => String(value).replaceAll("|", "\\|").replaceAll("\n", " ");

export function renderLiveQualification(qualification) {
  const counts = Object.fromEntries(
    ["pass", "fail", "unavailable"].map((outcome) => [
      outcome,
      qualification.scenarios.filter((scenario) => scenario.outcome === outcome).length,
    ]),
  );
  const rows = qualification.scenarios.map(
    (scenario) =>
      `| ${escapeCell(scenario.id)} | ${scenario.outcome} | ${escapeCell(scenario.environment)} | ${escapeCell(scenario.targetScope)} | ${scenario.evidenceRefs.length} |`,
  );
  return [
    "# Live Qualification",
    "",
    `- Repository: \`${qualification.candidate.repository}\``,
    `- Branch: \`${qualification.candidate.branch}\``,
    `- Commit: \`${qualification.candidate.commit}\``,
    `- Project/run: \`${qualification.projectId}\` / \`${qualification.runId}\``,
    `- Created: ${qualification.createdAt}`,
    `- Outcomes: ${counts.pass} pass, ${counts.fail} fail, ${counts.unavailable} unavailable`,
    "",
    "| Scenario | Outcome | Environment | Target | Evidence |",
    "| -------- | ------- | ----------- | ------ | -------- |",
    ...rows,
    "",
  ].join("\n");
}

const sha256 = (bytes) => createHash("sha256").update(bytes).digest("hex");

async function readJsonBytes(path) {
  const bytes = await readFile(path);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

async function writeNew(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, { encoding: "utf8", flag: "wx" });
}

async function writeNewFiles(files) {
  const written = [];
  try {
    for (const [path, contents] of files) {
      await writeNew(path, contents);
      written.push(path);
    }
  } catch (error) {
    await Promise.all(written.map((path) => rm(path, { force: true })));
    throw error;
  }
}

async function writeRendered(path, contents) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, contents, "utf8");
}

const required = (options, name) => {
  const value = options[name];
  if (typeof value !== "string" || value.length === 0) throw new Error(`--${name} is required`);
  return value;
};

function gitValue(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

export function assertCleanGitStatus(status) {
  if (status.trim().length > 0) throw new Error("Live qualification requires a clean Git worktree");
}

export function assertReleaseManifest(manifest, commit) {
  const validPackage = (entry) =>
    entry !== null &&
    typeof entry === "object" &&
    typeof entry.package === "string" &&
    typeof entry.version === "string" &&
    typeof entry.file === "string" &&
    typeof entry.sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(entry.sha256) &&
    Number.isInteger(entry.bytes) &&
    entry.bytes >= 0 &&
    entry.dependencies !== null &&
    typeof entry.dependencies === "object" &&
    !Array.isArray(entry.dependencies);
  const validSecurityEntry = (entry) =>
    entry !== null &&
    typeof entry === "object" &&
    typeof entry.file === "string" &&
    typeof entry.sha256 === "string" &&
    /^[0-9a-f]{64}$/.test(entry.sha256);
  const packageNames = new Set(manifest?.packages?.map((entry) => entry.package));
  const packageFiles = new Set(manifest?.packages?.map((entry) => entry.file));
  if (
    manifest?.version !== 1 ||
    manifest.sourceCommit !== commit ||
    typeof manifest.sourceRepository !== "string" ||
    manifest.sourceRepository.length === 0 ||
    manifest.toolchain === null ||
    typeof manifest.toolchain !== "object" ||
    !Array.isArray(manifest.packages) ||
    manifest.packages.length === 0 ||
    !manifest.packages.every(validPackage) ||
    packageNames.size !== manifest.packages.length ||
    packageFiles.size !== manifest.packages.length ||
    !validSecurityEntry(manifest.security?.sbom) ||
    !validSecurityEntry(manifest.security?.provenance)
  ) {
    throw new Error("Release manifest is invalid or does not match the current commit");
  }
}

async function currentCandidate(options) {
  const packageLockPath = resolve(options["package-lock"] ?? join(ROOT, "package-lock.json"));
  const runtimeBundlePath = resolve(options["runtime-bundle"] ?? join(ROOT, "config", "runtime-bundle.v1.json"));
  const releaseManifestPath = resolve(required(options, "release-manifest"));
  const packageMetadata = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
  const detectedBranch = gitValue(["rev-parse", "--abbrev-ref", "HEAD"]);
  const branch = detectedBranch === "HEAD" ? required(options, "branch") : detectedBranch;
  if (options.branch !== undefined && options.branch !== branch)
    throw new Error(`--branch ${options.branch} does not match checked-out branch ${branch}`);
  const commit = gitValue(["rev-parse", "HEAD"]);
  const releaseManifestBytes = await readFile(releaseManifestPath);
  const releaseManifest = JSON.parse(releaseManifestBytes.toString("utf8"));
  assertReleaseManifest(releaseManifest, commit);
  return {
    repository: packageMetadata.repository.url.replace(/^git\+/, "").replace(/\.git$/, ""),
    branch,
    commit,
    packageLockHash: sha256(await readFile(packageLockPath)),
    releaseManifestHash: sha256(releaseManifestBytes),
    runtimeBundleHash: sha256(await readFile(runtimeBundlePath)),
  };
}

function createSchemaErrors(validate) {
  return (value) => {
    if (validate(value)) return [];
    return (validate.errors ?? []).map(
      ({ instancePath, message }) => `${instancePath || "/"}: ${message ?? "is invalid"}`,
    );
  };
}

async function loadDependencies() {
  const [{ default: Ajv }, { default: addFormats }, contracts] = await Promise.all([
    import("ajv"),
    import("ajv-formats"),
    import("../../packages/contracts/dist/index.js"),
  ]);
  const ajv = new Ajv({ allErrors: true, strict: true });
  addFormats(ajv);
  return {
    scenarioIds: contracts.LIVE_QUALIFICATION_SCENARIO_IDS,
    qualificationSchemaErrors: createSchemaErrors(ajv.compile(contracts.LiveQualificationV1Schema)),
    evidenceManifestSchemaErrors: createSchemaErrors(ajv.compile(contracts.EvidenceManifestV1Schema)),
    hasValidLiveQualification: contracts.hasValidLiveQualification,
    secretFieldPattern: contracts.SECRET_FIELD_PATTERN,
    secretValuePattern: contracts.SECRET_VALUE_PATTERN,
  };
}

async function main() {
  const options = parseLiveQualificationArguments(process.argv.slice(2));
  if (options.command === "render") {
    const qualification = JSON.parse(await readFile(resolve(required(options, "file")), "utf8"));
    const dependencies = await loadDependencies();
    const schemaErrors = dependencies.qualificationSchemaErrors(qualification);
    const secrets = secretIssues(qualification, dependencies.secretFieldPattern, dependencies.secretValuePattern);
    if (schemaErrors.length > 0 || !dependencies.hasValidLiveQualification(qualification) || secrets.length > 0) {
      const detail = [...schemaErrors, ...secrets].join("; ") || "semantic failure";
      throw new Error(`Cannot render invalid live qualification: ${detail}`);
    }
    const rendered = renderLiveQualification(qualification);
    if (options.output) await writeRendered(resolve(options.output), rendered);
    else process.stdout.write(rendered);
    return;
  }
  assertCleanGitStatus(gitValue(["status", "--porcelain"]));
  const dependencies = await loadDependencies();
  const evidenceManifestPath = resolve(required(options, "evidence-manifest"));
  if (options.command === "template") {
    const createdAt = required(options, "created-at");
    if (!Number.isFinite(Date.parse(createdAt))) throw new Error("--created-at must be an ISO date-time");
    const evidenceManifest = createEvidenceManifestTemplate({
      projectId: required(options, "project"),
      runId: required(options, "run"),
      createdAt,
    });
    const evidenceManifestBytes = `${JSON.stringify(evidenceManifest, null, 2)}\n`;
    const qualification = createLiveQualificationTemplate({
      scenarioIds: dependencies.scenarioIds,
      projectId: evidenceManifest.projectId,
      runId: evidenceManifest.runId,
      candidate: await currentCandidate(options),
      evidenceManifestHash: sha256(evidenceManifestBytes),
      createdAt,
      actor: required(options, "actor"),
      environment: required(options, "environment"),
      targetScope: required(options, "target-scope"),
      toolVersions: {
        apex: JSON.parse(await readFile(join(ROOT, "package.json"), "utf8")).version,
        node: process.version,
      },
    });
    await writeNewFiles([
      [evidenceManifestPath, evidenceManifestBytes],
      [resolve(required(options, "output")), `${JSON.stringify(qualification, null, 2)}\n`],
    ]);
    return;
  }
  const qualification = await readJsonBytes(resolve(required(options, "file")));
  const evidenceManifest = await readJsonBytes(evidenceManifestPath);
  const evidencePayloads = await Promise.all(
    (options["evidence-file"] ?? []).map(async (path) => ({ path, bytes: await readFile(resolve(path)) })),
  );
  const findings = [
    ...validateLiveQualification(
      qualification.value,
      evidenceManifest.value,
      {
        candidate: await currentCandidate(options),
        evidenceManifestHash: sha256(evidenceManifest.bytes),
      },
      dependencies,
    ),
    ...validateEvidencePayloads(evidenceManifest.value, evidencePayloads),
  ].sort();
  if (findings.length > 0) {
    for (const finding of findings) process.stderr.write(`❌ ${finding}\n`);
    process.exitCode = 1;
  } else {
    process.stdout.write("✅ Live qualification evidence is valid\n");
  }
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    process.stderr.write(`❌ ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
