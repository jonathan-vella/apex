#!/usr/bin/env node
/**
 * Build a read-only, evidence-backed census of every tracked file at a Git baseline.
 *
 * @example
 * node tools/scripts/audit-retirement-candidates.mjs --baseline HEAD --write
 * node tools/scripts/audit-retirement-candidates.mjs --check .archive/retirement-scan-2026-08-27.json
 */

import { execFileSync, spawnSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadValidator } from "./_lib/ajv-validator.mjs";

const REPO_ROOT = path.resolve(fileURLToPath(import.meta.url), "..", "..", "..");
const SCHEMA_PATH = path.join(REPO_ROOT, "tools/schemas/retirement-scan.schema.json");
const DEFAULT_JSON = ".archive/retirement-scan-2026-08-27.json";
const DEFAULT_MARKDOWN = ".archive/retirement-scan-2026-08-27.md";
const SCAN_DATE = new Date().toISOString().slice(0, 10);
const TEXT_EXTENSIONS = new Set([
  ".astro",
  ".bicep",
  ".cjs",
  ".css",
  ".html",
  ".js",
  ".json",
  ".jsonc",
  ".md",
  ".mdx",
  ".mjs",
  ".ps1",
  ".py",
  ".sh",
  ".tf",
  ".ts",
  ".tsx",
  ".txt",
  ".yaml",
  ".yml",
]);
const RETIREMENT_MARKER =
  /(?:status\s*:\s*retired|deprecated\s*(?:—|--|:)|obsolete\s+(?:workflow|file|path|content)|superseded\s+by|legacy-only|historical-only)/i;
const MAX_TEXT_ANALYSIS_BYTES = 1024 * 1024;
const MAX_SIMILARITY_BYTES = 256000;
const MIN_SIMILARITY_BYTES = 400;
const MIN_LENGTH_RATIO = 0.65;
const MIN_JACCARD_SCORE = 0.82;

function git(args, options = {}) {
  return execFileSync("git", args, {
    cwd: REPO_ROOT,
    encoding: options.encoding ?? "utf8",
    env: options.env ?? process.env,
    maxBuffer: 128 * 1024 * 1024,
  });
}

export function stableFileId(filePath) {
  return `FILE-${crypto.createHash("sha256").update(filePath).digest("hex").slice(0, 12)}`;
}

export function parseLsFiles(buffer) {
  const entries = [];
  for (const record of buffer.toString("utf8").split("\0")) {
    if (!record) continue;
    const match = record.match(/^(\d{6}) ([0-9a-f]{40}) (\d)\t([\s\S]+)$/);
    if (!match) throw new Error(`Unable to parse git ls-files record: ${record}`);
    entries.push({ mode: match[1], sha: match[2], stage: Number(match[3]), path: match[4] });
  }
  return entries.filter((entry) => entry.stage === 0).sort((a, b) => a.path.localeCompare(b.path));
}

export function listTrackedAtBaseline(baseline) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "apex-retirement-index-"));
  const indexPath = path.join(tempDir, "index");
  const env = { ...process.env, GIT_INDEX_FILE: indexPath };
  try {
    git(["read-tree", baseline], { env });
    const output = execFileSync("git", ["ls-files", "-s", "-z"], {
      cwd: REPO_ROOT,
      env,
      encoding: "buffer",
      maxBuffer: 128 * 1024 * 1024,
    });
    return parseLsFiles(output);
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

function blobSizes(entries) {
  const input = `${entries.map((entry) => entry.sha).join("\n")}\n`;
  const result = spawnSync("git", ["cat-file", "--batch-check=%(objectname) %(objectsize)"], {
    cwd: REPO_ROOT,
    input,
    encoding: "utf8",
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(result.stderr || "git cat-file --batch-check failed");
  return new Map(
    result.stdout
      .trim()
      .split("\n")
      .filter(Boolean)
      .map((line) => {
        const [sha, size] = line.split(" ");
        return [sha, Number(size)];
      }),
  );
}

function readBlob(sha) {
  return execFileSync("git", ["cat-file", "blob", sha], {
    cwd: REPO_ROOT,
    encoding: "buffer",
    maxBuffer: 16 * 1024 * 1024,
  });
}

export function domainFor(filePath) {
  if (filePath.startsWith(".archive/")) return "archive";
  if (filePath.startsWith(".github/agents/")) return "agents";
  if (filePath.startsWith(".github/skills/")) return "skills";
  if (filePath.startsWith(".github/instructions/")) return "instructions";
  if (filePath.startsWith(".github/workflows/") || filePath.startsWith(".github/actions/")) return "ci";
  if (filePath.startsWith("tools/tests/")) return "tests";
  if (filePath.startsWith("tools/schemas/")) return "schemas";
  if (filePath.startsWith("tools/registry/")) return "registries";
  if (filePath.startsWith("tools/")) return "tooling";
  if (filePath.startsWith("site/src/content/docs/")) return "documentation";
  if (filePath.startsWith("site/")) return "site";
  if (filePath.startsWith("infra/")) return "infrastructure";
  if (filePath.startsWith("agent-output/")) return "agent-output";
  return "root-config";
}

function contentType(filePath, mode) {
  if (mode === "120000") return "symlink";
  if (mode === "160000") return "submodule";
  const extension = path.extname(filePath).toLowerCase();
  if (
    TEXT_EXTENSIONS.has(extension) ||
    ["LICENSE", "OWNERS", "CODEOWNERS", "CNAME"].includes(path.basename(filePath))
  ) {
    return "text";
  }
  return extension ? `binary:${extension.slice(1)}` : "binary";
}

export function protectionFor(filePath) {
  const rules = [
    [/^\.archive\//, "existing_archive"],
    [/^\.github\/agents\/.*\.agent\.md$/, "auto_discovered_agent"],
    [/^\.github\/prompts\/.*\.prompt\.md$/, "auto_discovered_prompt"],
    [/^\.github\/skills\/[^/]+\/SKILL\.md$/, "auto_discovered_skill"],
    [/^\.github\/instructions\/.*\.instructions\.md$/, "glob_applied_instruction"],
    [/^\.github\/(?:workflows|actions|hooks)\//, "automation_entrypoint"],
    [/^tools\/schemas\//, "dynamic_schema_contract"],
    [/^tools\/registry\//, "registry_or_source_of_truth"],
    [/^tools\/tests\//, "test_or_fixture"],
    [/^site\/public\/downloads\//, "published_download"],
    [/^site\/public\//, "published_site_asset"],
    [/^infra\//, "infrastructure_source"],
  ];
  return rules.find(([pattern]) => pattern.test(filePath))?.[1] ?? null;
}

function generatedOwner(filePath) {
  const owners = {
    "site/public/architecture-explorer-graph.json": {
      generated_by: ["tools/scripts/generate-explorer-graph.mjs"],
      source_of_truth: ".github, package.json, and repository workflow metadata",
      regeneration_command: "npm run build:explorer-graph",
    },
    "tools/scripts/_lib/artifact-headings-summary.json": {
      generated_by: ["tools/scripts/render-headings-summary.mjs"],
      source_of_truth: ".github/skills/azure-artifacts templates and references",
      regeneration_command: "npm run render:headings-summary",
    },
    "freshness-report.json": {
      generated_by: ["tools/scripts/check-docs-freshness.mjs"],
      source_of_truth: "active repository documentation",
      regeneration_command: "npm run lint:docs-freshness",
    },
    "tools/registry/challenger-telemetry.json": {
      generated_by: ["tools/scripts/challenger-telemetry.mjs"],
      source_of_truth: "agent-output challenge finding sidecars",
      regeneration_command: "npm run challenger-telemetry",
    },
    "tools/registry/challenger-coverage-evidence.md": {
      generated_by: ["tools/scripts/challenger-telemetry.mjs"],
      source_of_truth: "agent-output challenge finding sidecars",
      regeneration_command: "npm run challenger-telemetry",
    },
    "tools/registry/challenger-effectiveness.md": {
      generated_by: ["tools/scripts/challenger-telemetry.mjs"],
      source_of_truth: "agent-output challenge finding sidecars",
      regeneration_command: "npm run challenger-telemetry",
    },
    "tools/registry/count-manifest.json": {
      generated_by: ["tools/scripts/generate-explorer-graph.mjs"],
      source_of_truth: "tracked repository entities",
      regeneration_command: "npm run build:explorer-graph",
    },
    ".github/data/azure-deprecations.json": {
      generated_by: ["tools/scripts/fetch-azure-deprecations.mjs"],
      source_of_truth: "Azure service deprecation feeds",
      regeneration_command: "npm run fetch:deprecations",
    },
    ".github/data/avm-module-index.json": {
      generated_by: ["tools/scripts/refresh-avm-module-index.mjs"],
      source_of_truth: "Azure Verified Module registries",
      regeneration_command: "npm run refresh:avm-module-index",
    },
  };
  return owners[filePath] ?? { generated_by: [], source_of_truth: null, regeneration_command: null };
}

function parseCodeowners(text) {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const [pattern, ...owners] = line.split(/\s+/);
      return { pattern, owners };
    });
}

function codeownersFor(filePath, rules) {
  let owners = [];
  for (const rule of rules) {
    const normalized = rule.pattern.replace(/^\//, "");
    const matches =
      normalized === "*" || (normalized.endsWith("/") ? filePath.startsWith(normalized) : filePath === normalized);
    if (matches) owners = rule.owners;
  }
  return owners;
}

function dynamicEntrypoints(filePath, protection) {
  const entries = [];
  if (protection === "auto_discovered_agent") entries.push("VS Code custom-agent discovery");
  if (protection === "auto_discovered_prompt") entries.push("VS Code prompt discovery");
  if (protection === "auto_discovered_skill") entries.push("VS Code Agent Skills discovery from SKILL.md frontmatter");
  if (protection === "glob_applied_instruction") entries.push("VS Code instruction applyTo matching");
  if (protection === "automation_entrypoint") entries.push("GitHub Actions or repository hook discovery");
  if (protection === "dynamic_schema_contract") entries.push("AJV or schema-version contract loading");
  if (protection === "test_or_fixture") entries.push("Node/Pytest/package test discovery");
  if (protection === "published_download" || protection === "published_site_asset")
    entries.push("Static site publication");
  if (filePath === "package.json") entries.push("npm script entrypoint");
  return entries;
}

function historyAtBaseline(baseline, scanDate) {
  const output = git(["log", baseline, "--format=%x1e%H%x1f%aI", "--name-only"]);
  const history = new Map();
  let commit = null;
  let date = null;
  for (const line of output.split("\n")) {
    if (line.startsWith("\x1e")) {
      [commit, date] = line.slice(1).split("\x1f");
      continue;
    }
    const filePath = line.trim();
    if (!filePath || !commit) continue;
    const current = history.get(filePath);
    if (!current) history.set(filePath, { first_commit: commit, last_commit: commit, last_changed_at: date });
    else current.first_commit = commit;
  }
  const scanTime = Date.parse(`${scanDate}T00:00:00Z`);
  for (const value of history.values()) {
    const changed = Date.parse(value.last_changed_at);
    value.age_days = Number.isNaN(changed) ? null : Math.max(0, Math.floor((scanTime - changed) / 86400000));
  }
  return history;
}

function normalizedTokens(text) {
  return new Set(
    text
      .toLowerCase()
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .split(/\s+/)
      .filter((token) => token.length > 3),
  );
}

function jaccard(left, right) {
  if (left.size === 0 || right.size === 0) return 0;
  let intersection = 0;
  for (const token of left) if (right.has(token)) intersection++;
  return intersection / (left.size + right.size - intersection);
}

function candidateReferences(textFiles, trackedPaths) {
  const references = new Map(trackedPaths.map((filePath) => [filePath, new Set()]));
  const trackedPathSet = new Set(trackedPaths);
  const byBasename = new Map();
  for (const filePath of trackedPaths) {
    const basename = path.basename(filePath);
    if (!byBasename.has(basename)) byBasename.set(basename, []);
    byBasename.get(basename).push(filePath);
  }
  const tokenPattern = /[A-Za-z0-9_.@{}-]+(?:\/[A-Za-z0-9_.@{}-]+)+|[A-Za-z0-9_.@-]+\.[A-Za-z0-9]{1,8}/g;
  for (const [sourcePath, text] of textFiles) {
    for (const token of new Set(text.match(tokenPattern) ?? [])) {
      const clean = token.replace(/^[./]+/, "").replace(/[),:;]+$/, "");
      const relative = path.posix.normalize(path.posix.join(path.posix.dirname(sourcePath), clean));
      const exact = trackedPathSet.has(clean) ? [clean] : trackedPathSet.has(relative) ? [relative] : [];
      const basenameMatches = byBasename.get(path.basename(clean)) ?? [];
      const candidates = exact.length > 0 ? exact : basenameMatches.length === 1 ? basenameMatches : [];
      for (const target of candidates) {
        if (
          target !== sourcePath &&
          (clean === target || target.endsWith(`/${clean}`) || clean === path.basename(target))
        ) {
          references.get(target).add(sourcePath);
        }
      }
    }
  }
  return references;
}

function archiveMembership(entries) {
  const membership = new Map(entries.map((entry) => [entry.path, []]));
  const errors = [];
  for (const entry of entries.filter((item) => item.path.endsWith(".tar.gz"))) {
    const archivePath = path.join(REPO_ROOT, entry.path);
    if (!fs.existsSync(archivePath)) continue;
    const result = spawnSync("tar", ["-tzf", archivePath], { encoding: "utf8" });
    if (result.status !== 0) {
      errors.push(`${entry.path}: ${result.stderr.trim() || `tar exited ${result.status}`}`);
      continue;
    }
    for (const member of result.stdout.split("\n").filter(Boolean)) {
      if (membership.has(member)) membership.get(member).push(entry.path);
    }
  }
  return { membership, errors };
}

function packageReachability(textFiles, trackedPaths, scanFindings) {
  const packageText = textFiles.get("package.json");
  if (!packageText) return new Map();
  let scripts = {};
  try {
    scripts = JSON.parse(packageText).scripts ?? {};
  } catch (error) {
    scanFindings.push(`package.json could not be parsed for script reachability: ${error.message}`);
  }
  const result = new Map(trackedPaths.map((filePath) => [filePath, []]));
  for (const [name, command] of Object.entries(scripts)) {
    for (const filePath of trackedPaths) {
      if (command.includes(filePath) || command.includes(path.basename(filePath))) result.get(filePath).push(name);
    }
  }
  return result;
}

function workflowReachability(textFiles, trackedPaths) {
  const result = new Map(trackedPaths.map((filePath) => [filePath, []]));
  for (const [sourcePath, text] of textFiles) {
    if (!sourcePath.startsWith(".github/workflows/")) continue;
    for (const filePath of trackedPaths) {
      if (text.includes(filePath) || text.includes(path.basename(filePath))) result.get(filePath).push(sourcePath);
    }
  }
  return result;
}

function duplicateGroups(entries) {
  const byBlob = new Map();
  for (const entry of entries) {
    if (!byBlob.has(entry.sha)) byBlob.set(entry.sha, []);
    byBlob.get(entry.sha).push(entry.path);
  }
  return [...byBlob.entries()]
    .filter(([sha, paths]) => paths.length > 1 && entries.find((entry) => entry.sha === sha)?.size !== 0)
    .sort((a, b) => a[1][0].localeCompare(b[1][0]))
    .map(([sha, paths]) => ({ id: `DUP-${sha.slice(0, 12)}`, sha, paths: paths.sort() }));
}

function similarityMap(entries, textFiles) {
  const result = new Map(entries.map((entry) => [entry.path, []]));
  const eligible = entries
    .filter(
      (entry) =>
        textFiles.has(entry.path) &&
        textFiles.get(entry.path).length >= MIN_SIMILARITY_BYTES &&
        textFiles.get(entry.path).length <= MAX_SIMILARITY_BYTES,
    )
    .map((entry) => ({
      ...entry,
      extension: path.extname(entry.path),
      tokens: normalizedTokens(textFiles.get(entry.path)),
    }));
  const buckets = new Map();
  for (const entry of eligible) {
    const key = `${domainFor(entry.path)}:${entry.extension}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  }
  for (const bucket of buckets.values()) {
    for (let leftIndex = 0; leftIndex < bucket.length; leftIndex++) {
      for (let rightIndex = leftIndex + 1; rightIndex < bucket.length; rightIndex++) {
        const left = bucket[leftIndex];
        const right = bucket[rightIndex];
        const lengthRatio =
          Math.min(textFiles.get(left.path).length, textFiles.get(right.path).length) /
          Math.max(textFiles.get(left.path).length, textFiles.get(right.path).length);
        if (lengthRatio < MIN_LENGTH_RATIO) continue;
        const score = jaccard(left.tokens, right.tokens);
        if (score < MIN_JACCARD_SCORE) continue;
        result.get(left.path).push({ path: right.path, score: Number(score.toFixed(3)) });
        result.get(right.path).push({ path: left.path, score: Number(score.toFixed(3)) });
      }
    }
  }
  for (const values of result.values()) values.sort((a, b) => b.score - a.score || a.path.localeCompare(b.path));
  return result;
}

function securityFlags(filePath) {
  const flags = [];
  if (/(?:^|\/)(?:\.env|id_rsa|.*\.(?:pem|pfx|key))$/i.test(filePath)) flags.push("potential_secret_material");
  return flags;
}

function legalFlags(filePath) {
  const flags = [];
  if (/(?:^|\/)(?:LICENSE|NOTICE)(?:\.|$)/i.test(filePath)) flags.push("license_preservation_required");
  if (/\.(?:zip|pptx|tar\.gz)$/i.test(filePath)) flags.push("binary_provenance_review");
  return flags;
}

export function buildInventory({ baseline, branch, scanDate = SCAN_DATE, baselineChecks = [] }) {
  const resolvedBaseline = git(["rev-parse", `${baseline}^{commit}`]).trim();
  const entries = listTrackedAtBaseline(resolvedBaseline);
  const sizes = blobSizes(entries);
  for (const entry of entries) entry.size = sizes.get(entry.sha) ?? 0;
  const scanFindings = [];
  const ancestry = spawnSync("git", ["merge-base", "--is-ancestor", resolvedBaseline, "HEAD"], { cwd: REPO_ROOT });
  if (ancestry.status !== 0) scanFindings.push("baseline_commit is not an ancestor of the current HEAD");
  const textFiles = new Map();
  for (const entry of entries) {
    if (contentType(entry.path, entry.mode) !== "text" || sizes.get(entry.sha) > MAX_TEXT_ANALYSIS_BYTES) continue;
    textFiles.set(entry.path, readBlob(entry.sha).toString("utf8"));
  }
  const paths = entries.map((entry) => entry.path);
  const codeownerRules = parseCodeowners(textFiles.get(".github/CODEOWNERS") ?? "");
  const references = candidateReferences(textFiles, paths);
  const packages = packageReachability(textFiles, paths, scanFindings);
  const workflows = workflowReachability(textFiles, paths);
  const archives = archiveMembership(entries);
  scanFindings.push(...archives.errors.map((error) => `Archive inspection failed: ${error}`));
  const duplicates = duplicateGroups(entries);
  const duplicateByPath = new Map();
  for (const group of duplicates) for (const filePath of group.paths) duplicateByPath.set(filePath, group.id);
  const similarities = similarityMap(entries, textFiles);
  const histories = historyAtBaseline(resolvedBaseline, scanDate);
  const candidateGroups = [];
  for (const group of duplicates) {
    candidateGroups.push({
      id: group.id,
      kind: "exact_duplicate",
      paths: group.paths,
      review_state: "human_review_required",
    });
  }

  const inventory = entries.map((entry) => {
    const protection = protectionFor(entry.path);
    const text = textFiles.get(entry.path) ?? "";
    const hasMarker = RETIREMENT_MARKER.test(text.slice(0, 20000));
    const directReferences = [...references.get(entry.path)].sort();
    const packageScripts = [...new Set(packages.get(entry.path))].sort();
    const workflowFiles = [...new Set(workflows.get(entry.path))].sort();
    const similarityCandidates = similarities.get(entry.path).slice(0, 5);
    const duplicateGroup = duplicateByPath.get(entry.path) ?? null;
    const generated = generatedOwner(entry.path);
    const dynamic = dynamicEntrypoints(entry.path, protection);
    const hasStrongReachability =
      directReferences.length > 0 ||
      packageScripts.length > 0 ||
      workflowFiles.length > 0 ||
      dynamic.length > 0 ||
      generated.generated_by.length > 0;
    const evidence = [];
    let status = protection ? "protected" : "retain";
    let category = protection ?? "active_repository_content";
    let risk = protection ? "high" : "low";
    let rationale = protection
      ? `Protected by ${protection}; reference counts alone cannot establish retirement eligibility.`
      : "No sufficient retirement evidence was found by the automated scan.";

    if (duplicateGroup)
      evidence.push({ type: "exact_duplicate", detail: `Member of ${duplicateGroup}; human review required.` });
    if (similarityCandidates.length > 0) {
      evidence.push({
        type: "normalized_similarity",
        detail: "High normalized-text similarity; unique semantics require review.",
      });
    }
    if (hasMarker)
      evidence.push({
        type: "retirement_marker",
        detail: "Contains retirement-related terminology; context requires review.",
      });
    if (directReferences.length > 0)
      evidence.push({ type: "direct_reference", detail: "Referenced by tracked text content." });
    if (dynamic.length > 0) evidence.push({ type: "dynamic_entrypoint", detail: dynamic.join("; ") });
    if (generated.generated_by.length > 0)
      evidence.push({ type: "generated_ownership", detail: generated.generated_by.join(", ") });
    if (contentType(entry.path, entry.mode) === "text" && sizes.get(entry.sha) > MAX_TEXT_ANALYSIS_BYTES) {
      evidence.push({
        type: "bounded_analysis",
        detail: `Content exceeds ${MAX_TEXT_ANALYSIS_BYTES} bytes; identity, history, references, and exact hashes were analyzed, but normalized text was not.`,
      });
    }

    if (!protection && (duplicateGroup || (!hasStrongReachability && (similarityCandidates.length > 0 || hasMarker)))) {
      status = "defer";
      category = duplicateGroup
        ? "duplicate_review"
        : hasMarker
          ? "retirement_marker_review"
          : "semantic_overlap_review";
      risk = "medium";
      rationale = "Automated evidence warrants human review but is insufficient for retirement approval.";
    }

    if (securityFlags(entry.path).length > 0) {
      status = "defer";
      category = "security_review";
      risk = "blocked";
      rationale = "Potential secret material requires a dedicated purge decision, not normal archival.";
    }

    const history = histories.get(entry.path) ?? {
      first_commit: null,
      last_commit: null,
      last_changed_at: null,
      age_days: null,
    };
    return {
      id: stableFileId(entry.path),
      path: entry.path,
      git_mode: entry.mode,
      blob_sha: entry.sha,
      size_bytes: sizes.get(entry.sha) ?? 0,
      content_type: contentType(entry.path, entry.mode),
      domain: domainFor(entry.path),
      status,
      category,
      risk,
      evidence,
      reachability: {
        direct_references: directReferences,
        runtime_callers: directReferences.filter((filePath) =>
          /\.(?:js|mjs|cjs|ts|tsx|py|sh|ps1|ya?ml)$/.test(filePath),
        ),
        dynamic_entrypoints: dynamic,
        package_scripts: packageScripts,
        workflows: workflowFiles,
        tests: directReferences.filter((filePath) => filePath.startsWith("tools/tests/")),
        site_routes: directReferences.filter((filePath) => filePath.startsWith("site/")),
      },
      ownership: {
        codeowners: codeownersFor(entry.path, codeownerRules),
        generated_by: generated.generated_by,
        source_of_truth: generated.source_of_truth,
        regeneration_command: generated.regeneration_command,
        archive_membership: archives.membership.get(entry.path),
      },
      duplication: {
        exact_duplicate_group: duplicateGroup,
        similarity_candidates: similarityCandidates,
        functional_overlap: [],
        unique_content: null,
      },
      history,
      retirement: {
        canonical_replacement: null,
        dependency_updates: [],
        archive_group: null,
        restore_method: null,
        pre_checks: [],
        post_checks: [],
      },
      governance: {
        security_flags: securityFlags(entry.path),
        legal_flags: legalFlags(entry.path),
        approval_required: status === "candidate" || status === "defer",
        review_state: status === "candidate" || status === "defer" ? "human_review_required" : "not_required",
        decision_notes: null,
      },
      rationale,
    };
  });

  for (const item of inventory.filter((entry) => entry.status === "defer")) {
    if (item.duplication.similarity_candidates.length > 0) {
      candidateGroups.push({
        id: `SIM-${item.id.slice(-12)}`,
        kind: "normalized_similarity",
        paths: [item.path, ...item.duplication.similarity_candidates.map((candidate) => candidate.path)].sort(),
        review_state: "human_review_required",
      });
    }
    if (item.evidence.some((entry) => entry.type === "retirement_marker")) {
      candidateGroups.push({
        id: `MARK-${item.id.slice(-12)}`,
        kind: "retirement_marker",
        paths: [item.path],
        review_state: "human_review_required",
      });
    }
  }

  const byStatus = {};
  const byDomain = {};
  for (const item of inventory) {
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
    byDomain[item.domain] = (byDomain[item.domain] ?? 0) + 1;
  }
  return {
    schema_version: "retirement-scan-v1",
    scan_date: scanDate,
    baseline_commit: resolvedBaseline,
    branch,
    status: "generated",
    scope: {
      source: "git ls-files -s -z against baseline_commit",
      included: ["Every tracked file at baseline_commit"],
      excluded: ["Untracked dependencies, caches, virtual environments, ignored output, and .git internals"],
    },
    baseline_checks: baselineChecks,
    scan_findings: scanFindings,
    analysis_policy: {
      max_text_analysis_bytes: MAX_TEXT_ANALYSIS_BYTES,
      similarity: {
        min_bytes: MIN_SIMILARITY_BYTES,
        max_bytes: MAX_SIMILARITY_BYTES,
        min_length_ratio: MIN_LENGTH_RATIO,
        min_jaccard_score: MIN_JACCARD_SCORE,
      },
      limitations: [
        "Dynamic references assembled entirely at runtime require human review.",
        "Similarity is token-based nomination evidence, not semantic proof.",
        "Security flags inspect paths only; repository secret scanning remains authoritative.",
      ],
    },
    statistics: {
      total_files: inventory.length,
      by_status: byStatus,
      by_domain: byDomain,
      candidate_bytes: inventory
        .filter((item) => item.status === "candidate" || item.status === "defer")
        .reduce((sum, item) => sum + item.size_bytes, 0),
      duplicate_groups: duplicates.length,
    },
    inventory,
    candidate_groups: candidateGroups
      .filter((group, index, groups) => groups.findIndex((other) => other.id === group.id) === index)
      .sort((a, b) => a.id.localeCompare(b.id)),
    approval: {
      state: "pending",
      human_required: true,
      reviewer: null,
      reviewed_at: null,
      decisions: [],
    },
  };
}

export function renderMarkdown(scan) {
  const lines = [
    "# Whole-Repository Retirement Scan",
    "",
    `> Baseline: \`${scan.baseline_commit}\` | Scan date: ${scan.scan_date} | Approval: **${scan.approval.state}**`,
    "",
    "## Summary",
    "",
    "| Status | Files |",
    "| --- | ---: |",
    ...Object.entries(scan.statistics.by_status)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([status, count]) => `| ${status} | ${count} |`),
    "",
    "## Domains",
    "",
    "| Domain | Files |",
    "| --- | ---: |",
    ...Object.entries(scan.statistics.by_domain)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([domain, count]) => `| ${domain} | ${count} |`),
    "",
    "## Review Queue",
    "",
  ];
  const reviewItems = scan.inventory.filter((item) => item.status === "candidate" || item.status === "defer");
  if (reviewItems.length === 0) lines.push("No retirement candidates or deferred findings were generated.");
  else {
    lines.push("| ID | Status | Risk | Path | Evidence |", "| --- | --- | --- | --- | --- |");
    for (const item of reviewItems) {
      lines.push(
        `| ${item.id} | ${item.status} | ${item.risk} | \`${item.path}\` | ${item.evidence.map((entry) => entry.type).join(", ")} |`,
      );
    }
  }
  lines.push(
    "",
    "## Approval Gate",
    "",
    "No item in this report is approved for retirement. A named human must review every queued item and record a",
    "decision in the JSON inventory before any source consolidation, removal, or archive creation.",
    "",
  );
  return `${lines.join("\n")}\n`;
}

export function validateCoverage(scan, baseline) {
  const expected = listTrackedAtBaseline(baseline).map((entry) => entry.path);
  const actual = scan.inventory.map((entry) => entry.path);
  const duplicates = actual.filter((filePath, index) => actual.indexOf(filePath) !== index);
  const missing = expected.filter((filePath) => !actual.includes(filePath));
  const extra = actual.filter((filePath) => !expected.includes(filePath));
  return { valid: duplicates.length === 0 && missing.length === 0 && extra.length === 0, duplicates, missing, extra };
}

export function validateScan(scan) {
  const validate = loadValidator(SCHEMA_PATH);
  const schemaValid = validate(scan);
  const coverage = validateCoverage(scan, scan.baseline_commit);
  return { valid: Boolean(schemaValid) && coverage.valid, schemaErrors: validate.errors ?? [], coverage };
}

function parseArgs(argv) {
  const options = {
    baseline: "HEAD",
    branch: null,
    scanDate: SCAN_DATE,
    jsonPath: DEFAULT_JSON,
    markdownPath: DEFAULT_MARKDOWN,
    write: false,
    checkPath: null,
  };
  for (let index = 0; index < argv.length; index++) {
    const value = argv[index];
    if (value === "--write") options.write = true;
    else if (value === "--baseline") options.baseline = argv[++index];
    else if (value === "--branch") options.branch = argv[++index];
    else if (value === "--scan-date") options.scanDate = argv[++index];
    else if (value === "--json") options.jsonPath = argv[++index];
    else if (value === "--markdown") options.markdownPath = argv[++index];
    else if (value === "--check") options.checkPath = argv[++index];
    else throw new Error(`Unknown argument: ${value}`);
  }
  return options;
}

export function runCli(argv = process.argv.slice(2)) {
  try {
    const options = parseArgs(argv);
    if (options.checkPath) {
      const scan = JSON.parse(fs.readFileSync(path.resolve(REPO_ROOT, options.checkPath), "utf8"));
      const validation = validateScan(scan);
      if (!validation.valid) {
        console.error(JSON.stringify(validation, null, 2));
        return 1;
      }
      console.log(`✅ Retirement scan valid: ${scan.statistics.total_files} tracked files classified`);
      return 0;
    }
    const branch = options.branch ?? git(["branch", "--show-current"]).trim();
    const scan = buildInventory({ baseline: options.baseline, branch, scanDate: options.scanDate });
    const validation = validateScan(scan);
    if (!validation.valid) {
      console.error(JSON.stringify(validation, null, 2));
      return 1;
    }
    if (options.write) {
      fs.writeFileSync(path.resolve(REPO_ROOT, options.jsonPath), `${JSON.stringify(scan, null, 2)}\n`);
      fs.writeFileSync(path.resolve(REPO_ROOT, options.markdownPath), renderMarkdown(scan));
    }
    console.log(
      `✅ Retirement scan generated: ${scan.statistics.total_files} files, ${scan.statistics.by_status.defer ?? 0} review items`,
    );
    return 0;
  } catch (error) {
    console.error(`❌ Retirement scan failed: ${error.message}`);
    return 1;
  }
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(runCli());
