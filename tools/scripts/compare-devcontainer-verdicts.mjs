#!/usr/bin/env node
/**
 * Compare dev container validation verdicts across independently built trees and CPU architectures.
 *
 * @example
 * node tools/scripts/compare-devcontainer-verdicts.mjs \
 *   --input tmp/devcontainer-validation-artifacts \
 *   --output tmp/devcontainer-validation-summary/verdict-summary.json \
 *   --markdown tmp/devcontainer-validation-summary/summary.md
 */

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { parseJsonc } from "./_lib/parse-jsonc.mjs";

const EXPECTED_LEGS = [
  ["baseline", "amd64"],
  ["candidate", "amd64"],
  ["baseline", "arm64"],
  ["candidate", "arm64"],
];

export const REQUIRED_CHECKS = [
  "expected-distro-id",
  "expected-os-version",
  "expected-architecture",
  "nonroot-user",
  "passwordless-sudo",
  "post-create-summary",
  "post-start-idempotency",
  "test-dependency-setup",
  "runtime-version-contract",
  "tool-version-contracts",
  "azure-cli",
  "azure-cli-extensions",
  "bicep-cli",
  "powershell",
  "powershell-analyzer",
  "python-version",
  "node-version",
  "npm-version",
  "github-cli",
  "uv",
  "markdownlint-cli2",
  "graphviz",
  "gitleaks",
  "terraform",
  "azd",
  "azqr",
  "ruff",
  "apex-recall",
  "python-package-imports",
  "format-check",
  "git-hook-tests",
  "validate-all",
  "bicep-compile",
  "terraform-init-validate",
  "diagram-render",
];

const numericVersion = (value) => typeof value === "string" && /^\d+(?:\.\d+){0,2}$/.test(value);

function selectedFeature(config, tool) {
  const features = config.features ?? {};
  const local = `./features/${tool}`;
  if (Object.hasOwn(features, local)) return [local, features[local]];
  const prefix = tool === "azd" ? "ghcr.io/azure/azure-dev/azd:" : `ghcr.io/devcontainers/features/${tool}:`;
  return Object.entries(features).find(([key]) => key.startsWith(prefix));
}

export function matchesRuntimeVersion(observed, expected, mode = "exact") {
  if (!numericVersion(observed) || !numericVersion(expected)) return false;
  const actual = observed.split(".").map(Number);
  const target = expected.split(".").map(Number);
  if (mode === "exact") return target.every((part, index) => part === (actual[index] ?? 0));
  if (mode !== "minimum") return false;
  for (let index = 0; index < target.length; index += 1) {
    if ((actual[index] ?? 0) !== target[index]) return (actual[index] ?? 0) > target[index];
  }
  return true;
}

// Resolve contracts in the tree being tested, never in the evaluator's candidate checkout.
export async function readRuntimeContract(workspaceRoot, { variant, expectedPython = "", expectedNode = "" } = {}) {
  if (!["baseline", "candidate"].includes(variant)) throw new Error("Invalid runtime contract variant");
  const root = path.resolve(workspaceRoot);
  const config = parseJsonc(fs.readFileSync(path.join(root, ".devcontainer/devcontainer.json"), "utf8"));
  const selectedPath = path.join(root, ".devcontainer/install/versions.json");
  const selected = fs.existsSync(selectedPath) ? parseJsonc(fs.readFileSync(selectedPath, "utf8")) : {};
  const featureVersion = (tool) => selectedFeature(config, tool)?.[1]?.version;
  const python = expectedPython || selected.python?.version || featureVersion("python");
  const node = expectedNode || selected.node?.version || featureVersion("node");
  const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const nodeMinimum = /^>=\s*(\d+(?:\.\d+){0,2})$/.exec(manifest.engines?.node ?? "")?.[1];
  if (!numericVersion(python))
    throw new Error("Expected a selected numeric Python version or --expected-python-version");
  if (!numericVersion(node) && (variant === "candidate" || !numericVersion(nodeMinimum))) {
    throw new Error(
      "Expected a selected numeric Node version or --expected-node-version (baseline may use engines.node minimum)",
    );
  }
  return {
    python: { version: python, mode: variant === "baseline" && !expectedPython ? "minimum" : "exact" },
    node: {
      version: numericVersion(node) ? node : nodeMinimum,
      mode: variant === "baseline" && !expectedNode ? "minimum" : "exact",
    },
  };
}

const TOOL_LOGS = {
  uv: "uv",
  gitleaks: "gitleaks",
  terraform: "terraform",
  gh: "github-cli",
  bicep: "bicep-cli",
  "azure-cli": "azure-cli",
  powershell: "powershell",
  azd: "azd",
  azqr: "azqr",
  npm: "npm-version",
};

export function verifyToolVersionLogs(workspaceRoot, logDirectory) {
  const root = path.resolve(workspaceRoot);
  const config = parseJsonc(fs.readFileSync(path.join(root, ".devcontainer/devcontainer.json"), "utf8"));
  const manifestPath = path.join(root, ".devcontainer/download-checksums.json");
  const downloads = fs.existsSync(manifestPath) ? parseJsonc(fs.readFileSync(manifestPath, "utf8")) : {};
  const packageManifest = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8"));
  const expected = {};
  for (const tool of ["uv", "gitleaks", "terraform", "gh", "bicep", "azd", "azqr"]) {
    if (numericVersion(downloads[tool]?.version)) {
      expected[tool] = { version: downloads[tool].version, source: ".devcontainer/download-checksums.json" };
    }
  }
  for (const tool of ["azure-cli", "powershell", "azd"]) {
    if (expected[tool]) continue;
    const feature = selectedFeature(config, tool);
    if (numericVersion(feature?.[1]?.version)) {
      expected[tool] = {
        version: feature[1].version,
        source: `.devcontainer/devcontainer.json features[${feature[0]}]`,
      };
    }
  }
  const npmVersion = packageManifest.packageManager?.startsWith("npm@") ? packageManifest.packageManager.slice(4) : "";
  if (numericVersion(npmVersion)) expected.npm = { version: npmVersion, source: "package.json packageManager" };
  const checks = [];
  for (const [tool, contract] of Object.entries(expected)) {
    const logPath = path.join(logDirectory, `${TOOL_LOGS[tool]}.log`);
    const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, "utf8") : "";
    let observed = "";
    if (tool === "azure-cli") {
      try {
        observed = JSON.parse(log)["azure-cli"] ?? "";
      } catch {
        // A malformed command result cannot establish the selected version.
      }
    } else {
      observed = /(\d+\.\d+(?:\.\d+)?(?:[-+][\w.-]+)?)/.exec(log)?.[1] ?? "";
    }
    const status =
      tool === "azqr" && log.trim() === "optional azqr unavailable"
        ? "WARN"
        : matchesRuntimeVersion(observed, contract.version)
          ? "PASS"
          : "FAIL";
    checks.push({ tool, expected: contract.version, observed, source: contract.source, status });
  }
  return {
    status: checks.every((check) => check.status !== "FAIL") ? "PASS" : "FAIL",
    checks,
    unpinned: Object.keys(TOOL_LOGS).filter((tool) => !expected[tool]),
  };
}

function uniqueSorted(values) {
  return [...new Set(values)].sort();
}

function legKey(variant, arch) {
  return `${variant}-${arch}`;
}

function findVerdictFiles(root) {
  if (!fs.existsSync(root)) return [];

  const files = [];
  const visit = (entryPath) => {
    const stat = fs.statSync(entryPath);
    if (stat.isDirectory()) {
      for (const entry of fs.readdirSync(entryPath)) {
        visit(path.join(entryPath, entry));
      }
    } else if (path.basename(entryPath) === "verdict.json") {
      files.push(entryPath);
    }
  };

  visit(root);
  return files.sort();
}

function validateVerdict(verdict, filePath) {
  const errors = [];
  const requiredStrings = [
    "variant",
    "expected_arch",
    "observed_arch",
    "expected_distro_id",
    "observed_distro_id",
    "expected_os",
    "observed_os",
    "status",
  ];

  if (!verdict || typeof verdict !== "object" || Array.isArray(verdict)) {
    return [`${filePath}: verdict must be a JSON object`];
  }

  for (const field of requiredStrings) {
    if (typeof verdict[field] !== "string" || verdict[field].length === 0) {
      errors.push(`${filePath}: missing or invalid string field '${field}'`);
    }
    if (verdict.schema_version !== 1) errors.push(`${filePath}: unsupported schema_version`);
  }

  if (!Array.isArray(verdict.warnings) || !verdict.warnings.every((warning) => typeof warning === "string")) {
    errors.push(`${filePath}: 'warnings' must be an array of strings`);
  }

  if (!Array.isArray(verdict.checks)) {
    errors.push(`${filePath}: 'checks' must be an array`);
  } else {
    const names = new Set();
    for (const check of verdict.checks) {
      if (!check || typeof check.name !== "string" || !check.name) {
        errors.push(`${filePath}: invalid check name`);
        continue;
      }
      if (names.has(check.name)) errors.push(`${filePath}: duplicate check '${check.name}'`);
      names.add(check.name);
      if (!["PASS", "FAIL", ...(check.name === "azqr" ? ["WARN"] : [])].includes(check.status)) {
        errors.push(`${filePath}: invalid status for check '${check.name}'`);
      } else if (check.status === "FAIL") {
        errors.push(`${filePath}: failed check '${check.name}'`);
      } else if (
        check.status === "WARN" &&
        (!Array.isArray(verdict.warnings) || !verdict.warnings.includes(check.message))
      ) {
        errors.push(`${filePath}: optional check '${check.name}' warning is missing from warnings`);
      }
    }
    for (const name of REQUIRED_CHECKS) {
      if (!names.has(name)) errors.push(`${filePath}: missing required check '${name}'`);
    }
  }

  if (!["PASS", "FAIL"].includes(verdict.status)) {
    errors.push(`${filePath}: status must be PASS or FAIL`);
  }

  if (!["baseline", "candidate"].includes(verdict.variant)) {
    errors.push(`${filePath}: variant must be baseline or candidate`);
  }

  if (!["amd64", "arm64"].includes(verdict.expected_arch)) {
    errors.push(`${filePath}: expected_arch must be amd64 or arm64`);
  }

  return errors;
}

export function loadVerdicts(inputDir) {
  const verdicts = [];
  const errors = [];

  for (const filePath of findVerdictFiles(inputDir)) {
    let verdict;
    try {
      verdict = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (error) {
      errors.push(`${filePath}: malformed JSON (${error.message})`);
      continue;
    }

    const validationErrors = validateVerdict(verdict, filePath);
    if (validationErrors.length > 0) {
      errors.push(...validationErrors);
      continue;
    }

    verdicts.push({ ...verdict, source_file: filePath });
  }

  return { verdicts, errors };
}

export function compareVerdicts(verdicts, loadErrors = [], metadata = {}) {
  const blockers = [...loadErrors];
  const legs = {};
  const newWarnings = {};

  for (const verdict of verdicts) {
    const errors = validateVerdict(verdict, verdict?.source_file ?? legKey(verdict?.variant, verdict?.expected_arch));
    blockers.push(...errors);
    if (verdict?.status === "FAIL") {
      blockers.push(`${legKey(verdict.variant, verdict.expected_arch)}: validation status is FAIL`);
    }
    if (errors.length > 0) continue;
    const key = legKey(verdict.variant, verdict.expected_arch);
    if (legs[key]) {
      blockers.push(`duplicate verdict for ${key}`);
      continue;
    }
    legs[key] = verdict;
  }

  for (const variant of ["baseline", "candidate"]) {
    const amd64 = legs[legKey(variant, "amd64")];
    const arm64 = legs[legKey(variant, "arm64")];
    if (
      amd64 &&
      arm64 &&
      (amd64.expected_distro_id !== arm64.expected_distro_id || amd64.expected_os !== arm64.expected_os)
    ) {
      blockers.push(`${variant}: architecture legs disagree on expected distro or OS version`);
    }
  }

  for (const [variant, arch] of EXPECTED_LEGS) {
    const key = legKey(variant, arch);
    const verdict = legs[key];

    if (!verdict) {
      blockers.push(`missing verdict for ${key}`);
      continue;
    }

    if (verdict.observed_arch !== verdict.expected_arch) {
      blockers.push(`${key}: expected architecture ${verdict.expected_arch}, observed ${verdict.observed_arch}`);
    }

    if (verdict.observed_os !== verdict.expected_os) {
      blockers.push(`${key}: expected OS version ${verdict.expected_os}, observed ${verdict.observed_os}`);
    }

    if (verdict.observed_distro_id !== verdict.expected_distro_id) {
      blockers.push(`${key}: expected distro ${verdict.expected_distro_id}, observed ${verdict.observed_distro_id}`);
    }

    if (verdict.status !== "PASS") {
      blockers.push(`${key}: validation status is ${verdict.status}`);
    }
  }

  for (const arch of ["amd64", "arm64"]) {
    const baseline = legs[legKey("baseline", arch)];
    const candidate = legs[legKey("candidate", arch)];
    if (!baseline || !candidate) continue;

    const baselineWarnings = new Set(baseline.warnings);
    const added = uniqueSorted(candidate.warnings.filter((warning) => !baselineWarnings.has(warning)));
    newWarnings[arch] = added;

    for (const warning of added) {
      blockers.push(`candidate-${arch}: new setup warning: ${warning}`);
    }
  }

  return {
    schema_version: 1,
    generated_at: new Date().toISOString(),
    status: blockers.length === 0 ? "PASS" : "BLOCKED",
    candidate_image: metadata.candidateImage ?? "",
    candidate_digest: metadata.candidateDigest ?? "",
    legs,
    new_warnings: newWarnings,
    blockers: uniqueSorted(blockers),
  };
}

function escapeCell(value) {
  return String(value ?? "")
    .replaceAll("|", "\\|")
    .replaceAll("\n", " ");
}

export function renderMarkdown(summary) {
  const lines = ["## Dev Container Base Validation", "", `**Overall verdict:** ${summary.status}`, ""];

  if (summary.candidate_image) lines.push(`- Candidate image: \`${summary.candidate_image}\``);
  if (summary.candidate_digest) lines.push(`- Candidate digest: \`${summary.candidate_digest}\``);
  if (summary.candidate_image || summary.candidate_digest) lines.push("");

  lines.push("| Variant | Architecture | Expected distro / OS | Observed distro / OS | Result | Warnings |");
  lines.push("| --- | --- | --- | --- | --- | ---: |");

  for (const [variant, arch] of EXPECTED_LEGS) {
    const key = legKey(variant, arch);
    const verdict = summary.legs[key];
    lines.push(
      `| ${variant} | ${arch} | ${escapeCell(verdict ? `${verdict.expected_distro_id} / ${verdict.expected_os}` : "missing")} | ` +
        `${escapeCell(verdict ? `${verdict.observed_distro_id} / ${verdict.observed_os}` : "missing")} | ${escapeCell(verdict?.status ?? "MISSING")} | ` +
        `${verdict?.warnings?.length ?? 0} |`,
    );
  }

  if (summary.blockers.length > 0) {
    lines.push("", "### Blockers", "");
    for (const blocker of summary.blockers) lines.push(`- ${blocker}`);
  }

  lines.push("");
  return `${lines.join("\n")}\n`;
}

function parseArgs(argv) {
  const options = { input: "", output: "", markdown: "", candidateImage: "", candidateDigest: "" };

  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (!value || !flag.startsWith("--")) throw new Error(`Missing value for ${flag}`);

    switch (flag) {
      case "--input":
        options.input = value;
        break;
      case "--output":
        options.output = value;
        break;
      case "--markdown":
        options.markdown = value;
        break;
      case "--candidate-image":
        options.candidateImage = value;
        break;
      case "--candidate-digest":
        options.candidateDigest = value;
        break;
      default:
        throw new Error(`Unknown option: ${flag}`);
    }
    index += 1;
  }

  for (const required of ["input", "output", "markdown"]) {
    if (!options[required]) throw new Error(`Required option --${required} is missing`);
  }

  return options;
}

async function main() {
  if (process.argv[2] === "--runtime-contract") {
    const [, , , workspaceRoot, variant, expectedPython, expectedNode] = process.argv;
    try {
      console.log(JSON.stringify(await readRuntimeContract(workspaceRoot, { variant, expectedPython, expectedNode })));
      return 0;
    } catch (error) {
      console.error(error.message);
      return 1;
    }
  }
  if (process.argv[2] === "--tool-version-contracts") {
    try {
      const result = verifyToolVersionLogs(process.argv[3], process.argv[4]);
      console.log(JSON.stringify(result, null, 2));
      return result.status === "PASS" ? 0 : 1;
    } catch (error) {
      console.error(error.message);
      return 1;
    }
  }
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
  } catch (error) {
    console.error(`❌ ${error.message}`);
    return 2;
  }

  const loaded = loadVerdicts(path.resolve(options.input));
  const summary = compareVerdicts(loaded.verdicts, loaded.errors, options);
  const markdown = renderMarkdown(summary);

  fs.mkdirSync(path.dirname(options.output), { recursive: true });
  fs.mkdirSync(path.dirname(options.markdown), { recursive: true });
  fs.writeFileSync(options.output, `${JSON.stringify(summary, null, 2)}\n`);
  fs.writeFileSync(options.markdown, markdown);
  console.log(markdown.trimEnd());

  return summary.status === "PASS" ? 0 : 1;
}

const isMain = process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;
if (isMain) process.exit(await main());
