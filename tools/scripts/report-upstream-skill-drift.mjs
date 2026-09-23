#!/usr/bin/env node
/**
 * Upstream Skill Drift Report
 *
 * Compares the reviewed azure-skills tag pinned in tools/registry/upstream-skill-pins.json with the latest
 * upstream tag. Reports changed upstream files per pinned APEX skill (flagging imported files), changelog
 * lines since the reviewed tag, new or retired upstream skills, and whether each defect probe still matches
 * upstream. It clones into a temporary directory and never writes under .github/skills.
 *
 * Exit codes:
 *   0 — report produced (no drift, or drift without --fail-on-drift)
 *   1 — drift found and --fail-on-drift was set
 *   2 — invalid input or upstream unreachable
 *
 * @example
 *   node tools/scripts/report-upstream-skill-drift.mjs
 *   node tools/scripts/report-upstream-skill-drift.mjs --output tmp/upstream-drift.md --fail-on-drift
 *   node tools/scripts/report-upstream-skill-drift.mjs --json --tag v1.2.60
 */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MANIFEST_PATH = "tools/registry/upstream-skill-pins.json";
const PROTECTED_DIR = path.join(".github", "skills");
const RELEASE_TAG = /^v(\d+)\.(\d+)\.(\d+)$/;
// Keeps the rendered report well under GitHub's 65,536-character issue body limit.
const MAX_ROWS_PER_SKILL = 40;
const MAX_CHANGELOG_LINES = 60;

function version(tag) {
  const match = RELEASE_TAG.exec(tag ?? "");
  return match ? match.slice(1).map(Number) : null;
}

function compareVersions(left, right) {
  for (let index = 0; index < 3; index += 1) {
    if (left[index] !== right[index]) return left[index] - right[index];
  }
  return 0;
}

/** Picks the highest `vX.Y.Z` tag from `git ls-remote --tags` output. */
export function latestTag(lsRemoteOutput) {
  const tags = lsRemoteOutput
    .split("\n")
    .map((line) => line.split("\t")[1]?.replace(/^refs\/tags\//, ""))
    .filter((tag) => version(tag));
  return tags.sort((left, right) => compareVersions(version(left), version(right))).at(-1) ?? null;
}

/** Maps each tag to its commit, preferring the peeled `^{}` entry of annotated tags. */
export function tagCommits(lsRemoteOutput) {
  const commits = new Map();
  for (const line of lsRemoteOutput.split("\n")) {
    const [sha, ref] = line.split("\t");
    const match = /^refs\/tags\/(.+?)(\^\{\})?$/.exec(ref ?? "");
    if (match && (match[2] || !commits.has(match[1]))) commits.set(match[1], sha);
  }
  return commits;
}

/** Returns changelog lines for releases after `fromTag` up to and including `toTag`. */
export function changelogSince(changelog, fromTag, toTag) {
  const from = version(fromTag);
  const to = version(toTag);
  const lines = [];
  let inRange = false;
  for (const line of changelog.split("\n")) {
    // Release headings look like "## 1.2.51"; the entries below belong to that release.
    const heading = /^## (\d+\.\d+\.\d+)\s*$/.exec(line);
    if (heading) {
      const release = heading[1].split(".").map(Number);
      inRange = compareVersions(release, from) > 0 && compareVersions(release, to) <= 0;
      if (inRange) lines.push(line);
    } else if (inRange && line.trim()) {
      lines.push(line);
    }
  }
  return lines;
}

function defaultGit(args, cwd) {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function firstLine(error) {
  return (
    String(error.stderr || error.message)
      .split("\n")
      .find((line) => line.trim()) ?? "unknown error"
  );
}

function parseArgs(args) {
  const value = (name) => {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
  };
  return {
    manifest: value("--manifest") ?? MANIFEST_PATH,
    repo: value("--repo"),
    tag: value("--tag"),
    output: value("--output"),
    json: args.includes("--json"),
    failOnDrift: args.includes("--fail-on-drift"),
  };
}

function realPath(target) {
  const missing = [];
  let existing = target;
  while (!fs.existsSync(existing) && path.dirname(existing) !== existing) {
    missing.unshift(path.basename(existing));
    existing = path.dirname(existing);
  }
  return path.join(fs.realpathSync(existing), ...missing);
}

function isProtected(rootDir, target) {
  const resolved = path.resolve(rootDir, target);
  if (fs.lstatSync(resolved, { throwIfNoEntry: false })?.isSymbolicLink()) return true;
  const real = realPath(resolved);
  const protectedDir = realPath(path.resolve(rootDir, PROTECTED_DIR));
  return real === protectedDir || real.startsWith(`${protectedDir}${path.sep}`);
}

function manifestError(manifest) {
  const upstream = manifest?.upstream;
  if (typeof upstream?.repository !== "string" || typeof upstream?.plugin_path !== "string") {
    return "upstream.repository and upstream.plugin_path are required";
  }
  if (typeof upstream.reviewed?.tag !== "string" || typeof upstream.reviewed?.commit !== "string") {
    return "upstream.reviewed.tag and upstream.reviewed.commit are required";
  }
  const skills = manifest.skills;
  if (!Array.isArray(skills) || !skills.every((s) => Array.isArray(s.upstream) && Array.isArray(s.imports))) {
    return "skills[] entries need upstream[] and imports[]";
  }
  if (!Array.isArray(manifest.defect_probes)) return "defect_probes[] is required";
  return null;
}

function isImported(skill, file) {
  return skill.imports.some(({ from }) => (from.endsWith("/") ? file.startsWith(from) : file === from));
}

function compareTrees({ git, workdir, manifest, pinned, latest }) {
  const pluginPath = manifest.upstream.plugin_path;
  const pinnedCommit = git(["rev-parse", `refs/tags/${pinned}^{commit}`], workdir).trim();
  const latestCommit = git(["rev-parse", "HEAD"], workdir).trim();
  const changed = git(["diff", "--no-renames", "--name-status", pinnedCommit, latestCommit, "--", pluginPath], workdir)
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [status, file] = line.split("\t");
      return { status, file: file.slice(pluginPath.length + 1) };
    });
  const skillDirs = (commit) =>
    new Set(
      git(["ls-tree", "-d", "--name-only", `${commit}:${pluginPath}`], workdir)
        .split("\n")
        .filter(Boolean),
    );
  const before = skillDirs(pinnedCommit);
  const after = skillDirs(latestCommit);
  const tracked = new Set(manifest.skills.flatMap((skill) => skill.upstream));
  const read = (file) => git(["show", `${latestCommit}:${file}`], workdir);
  const exists = (file) => git(["ls-tree", latestCommit, "--", file], workdir).trim() !== "";

  const changelogPath = `${path.posix.dirname(pluginPath)}/CHANGELOG.md`;
  return {
    pinnedCommit,
    latestCommit,
    changelog: exists(changelogPath) ? changelogSince(read(changelogPath), pinned, latest) : [],
    skills: manifest.skills
      .map((skill) => ({
        apex: skill.apex,
        status: skill.status,
        upstream: skill.upstream,
        changes: changed
          .filter(({ file }) => skill.upstream.includes(file.split("/")[0]))
          .map((change) => ({ ...change, imported: isImported(skill, change.file) })),
      }))
      .filter((skill) => skill.changes.length > 0),
    added: [...after].filter((name) => !before.has(name)).map((name) => ({ name, tracked: tracked.has(name) })),
    retired: [...before].filter((name) => !after.has(name)).map((name) => ({ name, tracked: tracked.has(name) })),
    probes: manifest.defect_probes.map((probe) => {
      const file = `${pluginPath}/${probe.path}`;
      if (!exists(file)) return { id: probe.id, path: probe.path, defect: probe.defect, result: "file removed" };
      const present = new RegExp(probe.pattern, probe.flags ?? "").test(read(file));
      return {
        id: probe.id,
        path: probe.path,
        defect: probe.defect,
        result: present ? "still present" : "fixed upstream",
      };
    }),
  };
}

function hasDrift(report) {
  if (report.pinnedCommit !== report.pinned.commit) return true;
  if (!report.newer) return false;
  return (
    report.skills.length > 0 ||
    report.added.length > 0 ||
    report.retired.length > 0 ||
    report.probes.some((probe) => probe.result !== "still present")
  );
}

/** Renders the report as Markdown suitable for an issue body. */
export function renderMarkdown(report) {
  const short = (commit) => (commit ? `\`${commit.slice(0, 8)}\`` : "n/a");
  const lines = [
    "# Upstream Skill Drift Report",
    "",
    "| Item | Value |",
    "| --- | --- |",
    `| Upstream | \`${report.repository}\` |`,
    `| Reviewed tag | ${report.pinned.tag} (${short(report.pinned.commit)}) |`,
    `| Latest tag | ${report.latest.tag} (${short(report.latestCommit)}) |`,
    `| Generated | ${report.generatedAt} |`,
    "",
  ];
  if (!report.pinnedCommit) {
    lines.push(`> ⚠️ Tag ${report.pinned.tag} no longer exists upstream.`, "");
  } else if (report.pinnedCommit !== report.pinned.commit) {
    lines.push(
      `> ⚠️ Tag ${report.pinned.tag} now points to ${short(report.pinnedCommit)}, not the reviewed commit.`,
      "",
    );
  }
  if (!report.newer) {
    lines.push(`No upstream tag is newer than ${report.pinned.tag}.`, "");
    return lines.join("\n");
  }
  if (!report.skills) {
    lines.push(`Tree comparison skipped: ${report.pinned.tag} is missing upstream. Re-review and update the pin.`, "");
    return lines.join("\n");
  }
  const importedChanges = report.skills.flatMap((skill) => skill.changes).filter((change) => change.imported);
  const fixed = report.probes.filter((probe) => probe.result !== "still present");
  lines.push(
    "## Summary",
    "",
    `- ${report.skills.length} pinned skills have upstream changes (${importedChanges.length} imported files changed)`,
    `- ${report.added.length} new and ${report.retired.length} retired upstream skills`,
    `- ${fixed.length} defect probes no longer match upstream (review before retiring the local fix)`,
    "",
    `## Changelog Since ${report.pinned.tag}`,
    "",
  );
  const changelog = report.changelog.slice(0, MAX_CHANGELOG_LINES);
  if (changelog.length === 0) lines.push("No changelog entries found.");
  for (const line of changelog) {
    // Upstream release headings become H3s so they nest under this section.
    if (line.startsWith("## ")) lines.push("", `### ${line.slice(3)}`, "");
    else lines.push(line);
  }
  if (report.changelog.length > changelog.length) {
    lines.push(`- … ${report.changelog.length - changelog.length} more lines`);
  }
  lines.push("", "## Changed Files By Skill", "");
  if (report.skills.length === 0) lines.push("No pinned skill changed upstream.", "");
  for (const skill of report.skills) {
    lines.push(
      `### ${skill.apex}`,
      "",
      `Status \`${skill.status}\`; upstream ${skill.upstream.map((name) => `\`${name}\``).join(", ")}.`,
      "",
      "| Change | Upstream file | Imported |",
      "| --- | --- | --- |",
    );
    for (const change of skill.changes.slice(0, MAX_ROWS_PER_SKILL)) {
      lines.push(`| ${change.status} | \`${change.file}\` | ${change.imported ? "yes" : "no"} |`);
    }
    if (skill.changes.length > MAX_ROWS_PER_SKILL) {
      lines.push(`| … | ${skill.changes.length - MAX_ROWS_PER_SKILL} more files | |`);
    }
    lines.push("");
  }
  lines.push("## New And Retired Upstream Skills", "");
  const skillRows = [
    ...report.added.map((skill) => ({ ...skill, change: "new" })),
    ...report.retired.map((skill) => ({ ...skill, change: "retired" })),
  ];
  if (skillRows.length === 0) lines.push("None.", "");
  else {
    lines.push("| Upstream skill | Change | Pinned in APEX |", "| --- | --- | --- |");
    for (const skill of skillRows)
      lines.push(`| \`${skill.name}\` | ${skill.change} | ${skill.tracked ? "yes" : "no"} |`);
    lines.push("");
  }
  lines.push("## Defect Probes", "", "| ID | Upstream file | Result | Defect |", "| --- | --- | --- | --- |");
  for (const probe of report.probes) {
    lines.push(`| ${probe.id} | \`${probe.path}\` | ${probe.result} | ${probe.defect} |`);
  }
  lines.push("", "This report is read-only. Port upstream changes into `.github/skills` by hand after review.", "");
  return lines.join("\n");
}

export async function runDriftReport({
  rootDir = process.cwd(),
  args = [],
  git = defaultGit,
  now = () => new Date().toISOString(),
  log = (message) => process.stdout.write(`${message}\n`),
  status = (message) => process.stderr.write(`${message}\n`),
} = {}) {
  const options = parseArgs(args);
  let manifest;
  try {
    manifest = JSON.parse(fs.readFileSync(path.resolve(rootDir, options.manifest), "utf8"));
  } catch (error) {
    status(`❌ Cannot read ${options.manifest}: ${error.message}`);
    return 2;
  }
  const invalid = manifestError(manifest);
  if (invalid) {
    status(`❌ Invalid manifest ${options.manifest}: ${invalid}`);
    return 2;
  }
  if (options.output && isProtected(rootDir, options.output)) {
    status(`❌ Refusing to write the report under ${PROTECTED_DIR} or through a symlink`);
    return 2;
  }

  const repository = manifest.upstream.repository;
  const repo = options.repo ?? `https://github.com/${repository}.git`;
  const pinned = manifest.upstream.reviewed.tag;
  let refs;
  try {
    refs = git(["ls-remote", "--tags", repo], rootDir);
  } catch (error) {
    status(`❌ Cannot list upstream tags: ${firstLine(error)}`);
    return 2;
  }
  const latest = options.tag ?? latestTag(refs);
  if (!version(latest) || !version(pinned)) {
    status(`❌ Expected vX.Y.Z tags; reviewed ${pinned}, latest ${latest ?? "none"}`);
    return 2;
  }

  const report = {
    repository,
    generatedAt: now(),
    pinned: { tag: pinned, commit: manifest.upstream.reviewed.commit },
    latest: { tag: latest },
    pinnedCommit: tagCommits(refs).get(pinned) ?? null,
    newer: compareVersions(version(latest), version(pinned)) > 0,
  };
  if (report.newer && report.pinnedCommit) {
    const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "upstream-skills-"));
    try {
      // A blobless, depth-1 clone downloads trees only; blobs load on demand for the few files read.
      git(
        ["clone", "-q", "--filter=blob:none", "--no-checkout", "--depth=1", "--branch", latest, repo, workdir],
        rootDir,
      );
      git(["fetch", "-q", "--depth=1", "origin", `refs/tags/${pinned}:refs/tags/${pinned}`], workdir);
      Object.assign(report, compareTrees({ git, workdir, manifest, pinned, latest }));
    } catch (error) {
      status(`❌ Cannot compare upstream trees: ${firstLine(error)}`);
      return 2;
    } finally {
      fs.rmSync(workdir, { recursive: true, force: true });
    }
  }
  report.drift = hasDrift(report);

  const rendered = options.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report);
  if (options.output) {
    const target = path.resolve(rootDir, options.output);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, rendered, "utf8");
    status(`✅ Report written to ${options.output}`);
  } else {
    log(rendered);
  }
  if (!report.drift) {
    status(`✅ No upstream drift since ${pinned}.`);
    return 0;
  }
  status(`⚠️  Upstream drift found: ${pinned} → ${latest}.`);
  return options.failOnDrift ? 1 : 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(await runDriftReport({ args: process.argv.slice(2) }));
}
