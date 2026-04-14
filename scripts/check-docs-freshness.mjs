/**
 * Docs Freshness Checker
 *
 * Validates that documentation references and links remain in sync with
 * the actual filesystem. Produces human-readable output and an optional
 * JSON report for CI consumption.
 *
 * Canonical documentation source: site/src/content/docs/
 * Entity counts validated against: count-manifest.json computed_from globs
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const findings = [];

// ── Helpers ─────────────────────────────────────────────────────────

function addFinding(file, line, issue, severity) {
  findings.push({ file, line, issue, severity });
}

async function exists(p) {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

async function readText(p) {
  try {
    return await readFile(p, "utf8");
  } catch {
    return null;
  }
}

async function listDirs(base) {
  const entries = await readdir(base, { withFileTypes: true });
  return entries.filter((e) => e.isDirectory()).map((e) => e.name);
}

async function collectMdFiles(dir, exclude = []) {
  const results = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry.name);
    const rel = relative(ROOT, full);
    if (exclude.some((ex) => rel.includes(ex))) continue;
    if (entry.isDirectory()) {
      results.push(...(await collectMdFiles(full, exclude)));
    } else if (entry.name.endsWith(".md") || entry.name.endsWith(".mdx")) {
      results.push(full);
    }
  }
  return results;
}

// ── Check 1: Prohibited references ──────────────────────────────────

async function checkProhibitedRefs(cachedSiteMdFiles) {
  const prohibited = [
    { pattern: /diagram\.agent\.md/, label: "diagram.agent.md (removed)" },
    { pattern: /adr\.agent\.md/, label: "adr.agent.md (removed)" },
    { pattern: /docs\.agent\.md/, label: "docs.agent.md (removed)" },
  ];

  const scanPaths = [join(ROOT, ".github", "instructions")];
  const singleFiles = [join(ROOT, ".github", "copilot-instructions.md")];

  // Scan site docs and instructions
  // Exclude CHANGELOG files — they are historical records that may legitimately
  // reference paths that have since been removed or restructured.
  const mdFiles = [...cachedSiteMdFiles].filter(
    (f) => !relative(ROOT, f).toLowerCase().includes("changelog"),
  );
  for (const dir of scanPaths) {
    mdFiles.push(...(await collectMdFiles(dir, [])));
  }
  for (const f of singleFiles) {
    if (await exists(f)) mdFiles.push(f);
  }

  for (const file of mdFiles) {
    const content = await readText(file);
    if (!content) continue;
    const rel = relative(ROOT, file);
    const lines = content.split("\n");
    for (const { pattern, label } of prohibited) {
      for (let i = 0; i < lines.length; i++) {
        // Skip lines that document prohibited refs (e.g. "❌ ... → Use ...")
        if (/[❌→]/.test(lines[i]) || /^\s*[-*]\s*❌/.test(lines[i])) {
          continue;
        }
        if (pattern.test(lines[i])) {
          addFinding(rel, i + 1, `Prohibited reference: ${label}`, "HIGH");
        }
      }
    }
  }
}

// ── Check 2: Deprecated path links ──────────────────────────────────

async function checkSupersededLinks(cachedSiteMdFiles) {
  const deprecatedPaths = [/_superseded\//, /\.github\/templates\//];

  for (const file of cachedSiteMdFiles) {
    const content = await readText(file);
    if (!content) continue;
    const rel = relative(ROOT, file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      for (const pattern of deprecatedPaths) {
        if (pattern.test(lines[i])) {
          addFinding(
            rel,
            i + 1,
            "Link to removed directory in live docs",
            "MEDIUM",
          );
        }
      }
    }
  }
}

// ── Check 3: Skill references freshness ─────────────────────────────

async function checkSkillReferences() {
  const skillDir = join(ROOT, ".github", "skills");
  if (!(await exists(skillDir))) return;

  const skills = await listDirs(skillDir);
  for (const skill of skills) {
    const refsDir = join(skillDir, skill, "references");
    if (!(await exists(refsDir))) continue;

    const skillMd = join(skillDir, skill, "SKILL.md");
    if (!(await exists(skillMd))) continue;

    const skillContent = await readText(skillMd);
    const refFiles = (await readdir(refsDir)).filter((f) => f.endsWith(".md"));

    // Check each reference file has a canary marker
    for (const refFile of refFiles) {
      const refContent = await readText(join(refsDir, refFile));
      if (!refContent) continue;

      if (!refContent.includes("<!-- ref:")) {
        addFinding(
          `.github/skills/${skill}/references/${refFile}`,
          1,
          `Reference file missing canary marker (<!-- ref:{name}-v1 -->)`,
          "LOW",
        );
      }
    }

    // Check SKILL.md has a Reference Index section if references exist
    if (refFiles.length > 0 && !skillContent.includes("Reference Index")) {
      addFinding(
        `.github/skills/${skill}/SKILL.md`,
        0,
        `Has ${refFiles.length} reference files but no "## Reference Index" section`,
        "MEDIUM",
      );
    }
  }
}

// ── Check 4: Hardcoded version headers in site docs ─────────────────

async function checkVersionHeaders(cachedSiteMdFiles) {
  const versionPattern = /> Version \d+\.\d+\.\d+/;
  for (const file of cachedSiteMdFiles) {
    const content = await readText(file);
    if (!content) continue;
    const rel = relative(ROOT, file);
    const lines = content.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (versionPattern.test(lines[i])) {
        addFinding(
          rel,
          i + 1,
          "Hardcoded version header — use [Current Version](../VERSION.md) instead",
          "LOW",
        );
      }
    }
  }
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("📋 Docs Freshness Checker\n");

  // Scan the canonical site docs tree
  const siteDocsDir = join(ROOT, "site", "src", "content", "docs");
  const siteMdFiles = await collectMdFiles(siteDocsDir, []);

  console.log("─── Prohibited References ───");
  await checkProhibitedRefs(siteMdFiles);

  console.log("─── Superseded Links ───");
  await checkSupersededLinks(siteMdFiles);

  console.log("─── Skill References Freshness ───");
  await checkSkillReferences();

  console.log("─── Version Header Check ───");
  await checkVersionHeaders(siteMdFiles);

  // Print findings
  console.log("");

  // Write JSON report (always, even when clean)
  const report = {
    findings,
    summary:
      findings.length === 0
        ? "No issues found"
        : `${findings.length} issue(s) found`,
  };
  await writeFile(
    join(ROOT, "freshness-report.json"),
    JSON.stringify(report, null, 2) + "\n",
  );
  console.log("📄 Report written to freshness-report.json");

  if (findings.length === 0) {
    console.log("✅ No freshness issues found\n");
    process.exit(0);
  }

  console.log("=".repeat(50));
  console.log(`📋 ${findings.length} issue(s) found\n`);
  for (const f of findings) {
    const icon =
      f.severity === "HIGH" ? "❌" : f.severity === "MEDIUM" ? "⚠️" : "ℹ️";
    const loc = f.line > 0 ? `${f.file}:${f.line}` : f.file;
    console.log(`${icon} [${f.severity}] ${loc}`);
    console.log(`   ${f.issue}\n`);
  }

  process.exit(1);
}

main();
