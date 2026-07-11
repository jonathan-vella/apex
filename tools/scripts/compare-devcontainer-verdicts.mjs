#!/usr/bin/env node
/**
 * Compare Ubuntu dev container validation verdicts across base images and CPU architectures.
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

const EXPECTED_LEGS = [
  ["baseline", "amd64"],
  ["candidate", "amd64"],
  ["baseline", "arm64"],
  ["candidate", "arm64"],
];

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
  const requiredStrings = ["variant", "expected_arch", "observed_arch", "expected_os", "observed_os", "status"];

  if (!verdict || typeof verdict !== "object" || Array.isArray(verdict)) {
    return [`${filePath}: verdict must be a JSON object`];
  }

  for (const field of requiredStrings) {
    if (typeof verdict[field] !== "string" || verdict[field].length === 0) {
      errors.push(`${filePath}: missing or invalid string field '${field}'`);
    }
  }

  if (!Array.isArray(verdict.warnings) || !verdict.warnings.every((warning) => typeof warning === "string")) {
    errors.push(`${filePath}: 'warnings' must be an array of strings`);
  }

  if (!Array.isArray(verdict.checks)) {
    errors.push(`${filePath}: 'checks' must be an array`);
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
    const key = legKey(verdict.variant, verdict.expected_arch);
    if (legs[key]) {
      blockers.push(`duplicate verdict for ${key}`);
      continue;
    }
    legs[key] = verdict;
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
      blockers.push(`${key}: expected Ubuntu ${verdict.expected_os}, observed ${verdict.observed_os}`);
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

  lines.push("| Variant | Architecture | Expected OS | Observed OS | Result | Warnings |");
  lines.push("| --- | --- | --- | --- | --- | ---: |");

  for (const [variant, arch] of EXPECTED_LEGS) {
    const key = legKey(variant, arch);
    const verdict = summary.legs[key];
    lines.push(
      `| ${variant} | ${arch} | ${escapeCell(verdict?.expected_os ?? "missing")} | ` +
        `${escapeCell(verdict?.observed_os ?? "missing")} | ${escapeCell(verdict?.status ?? "MISSING")} | ` +
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

function main() {
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
if (isMain) process.exit(main());
