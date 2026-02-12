/**
 * Docs Freshness Checker
 *
 * Validates that documentation counts, references, and links remain
 * in sync with the actual filesystem. Produces human-readable output
 * and an optional JSON report for CI consumption.
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
    } else if (entry.name.endsWith(".md")) {
      results.push(full);
    }
  }
  return results;
}

function extractNumber(text, pattern) {
  const m = text.match(pattern);
  return m ? parseInt(m[1], 10) : null;
}

// ── Check 1: Agent count ────────────────────────────────────────────

async function checkAgentCount() {
  const agentDir = join(ROOT, ".github", "agents");
  const entries = await readdir(agentDir, { withFileTypes: true });
  const agentFiles = entries
    .filter(
      (e) =>
        e.isFile() &&
        e.name.endsWith(".agent.md") &&
        !["_subagents"].includes(e.name),
    )
    .map((e) => e.name);
  const actual = agentFiles.length;

  const readme = await readText(join(ROOT, "docs", "README.md"));
  if (!readme) return;
  const documented = extractNumber(readme, /## Agents \((\d+)/);
  if (documented !== null && documented !== actual) {
    addFinding(
      "docs/README.md",
      0,
      `Agent count mismatch: docs say ${documented}, filesystem has ${actual}`,
      "HIGH",
    );
  }
}

// ── Check 2: Skill count ────────────────────────────────────────────

async function checkSkillCount() {
  const skillDir = join(ROOT, ".github", "skills");
  const dirs = await listDirs(skillDir);
  const actual = dirs.length;

  const readme = await readText(join(ROOT, "docs", "README.md"));
  if (!readme) return;
  const documented = extractNumber(readme, /## Skills \((\d+)/);
  if (documented !== null && documented !== actual) {
    addFinding(
      "docs/README.md",
      0,
      `Skill count mismatch: docs say ${documented}, filesystem has ${actual}`,
      "HIGH",
    );
  }
}

// ── Check 3: Prohibited references ──────────────────────────────────

async function checkProhibitedRefs() {
  const prohibited = [
    { pattern: /diagram\.agent\.md/g, label: "diagram.agent.md (removed)" },
    { pattern: /adr\.agent\.md/g, label: "adr.agent.md (removed)" },
    { pattern: /docs\.agent\.md/g, label: "docs.agent.md (removed)" },
    { pattern: /docs\/guides\//g, label: "docs/guides/ (non-existent path)" },
  ];

  const scanPaths = [join(ROOT, "docs"), join(ROOT, ".github", "instructions")];
  const singleFiles = [join(ROOT, ".github", "copilot-instructions.md")];

  const mdFiles = [];
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
      pattern.lastIndex = 0;
      for (let i = 0; i < lines.length; i++) {
        // Skip lines that document prohibited refs (e.g. "❌ ... → Use ...")
        if (/[❌→]/.test(lines[i]) || /^\s*[-*]\s*❌/.test(lines[i])) {
          pattern.lastIndex = 0;
          continue;
        }
        if (pattern.test(lines[i])) {
          addFinding(rel, i + 1, `Prohibited reference: ${label}`, "HIGH");
        }
        pattern.lastIndex = 0;
      }
    }
  }
}

// ── Check 4: Deprecated path links ──────────────────────────────────

async function checkSupersededLinks() {
  const docsDir = join(ROOT, "docs");
  const mdFiles = await collectMdFiles(docsDir, ["presenter"]);

  const deprecatedPaths = [/_superseded\//, /\.github\/templates\//];

  for (const file of mdFiles) {
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

// ── Check 5: Agent table verification ───────────────────────────────

async function checkAgentTable() {
  const readme = await readText(join(ROOT, "docs", "README.md"));
  if (!readme) return;
  // Extract only the Agents section (between ## Agents and next ## heading)
  const agentSection = readme.match(
    /^## Agents[^\n]*\n([\s\S]*?)(?=\n## [^#])/m,
  );
  if (!agentSection) return;
  const section = agentSection[1];
  // Match agent names from table rows like: | `requirements` |
  const agentNames = [...section.matchAll(/^\|\s*`([a-z][\w-]*)`\s*\|/gm)].map(
    (m) => m[1],
  );

  const agentDir = join(ROOT, ".github", "agents");
  for (const name of agentNames) {
    // Check both as direct .agent.md and in _subagents/
    const directPath = join(agentDir, `${name}.agent.md`);
    const subPath = join(agentDir, "_subagents", `${name}.agent.md`);
    if (!(await exists(directPath)) && !(await exists(subPath))) {
      addFinding(
        "docs/README.md",
        0,
        `Agent table lists '${name}' but no matching .agent.md found`,
        "HIGH",
      );
    }
  }
}

// ── Check 6: Skill table verification ───────────────────────────────

async function checkSkillTable() {
  const readme = await readText(join(ROOT, "docs", "README.md"));
  if (!readme) return;
  const skillSection = readme.split(/^## Skills/m)[1];
  if (!skillSection) return;
  // Match skill names from table rows like: | `azure-diagrams` |
  const skillNames = [
    ...skillSection.matchAll(/^\|\s*`([a-z][\w-]*)`\s*\|/gm),
  ].map((m) => m[1]);

  const skillDir = join(ROOT, ".github", "skills");
  for (const name of skillNames) {
    if (!(await exists(join(skillDir, name)))) {
      addFinding(
        "docs/README.md",
        0,
        `Skill table lists '${name}' but no matching directory in .github/skills/`,
        "HIGH",
      );
    }
  }
}

// ── Check 7: Hardcoded version headers ──────────────────────────────

async function checkVersionHeaders() {
  const docsDir = join(ROOT, "docs");
  const entries = await readdir(docsDir, { withFileTypes: true });
  const mdFiles = entries
    .filter((e) => e.isFile() && e.name.endsWith(".md"))
    .map((e) => join(docsDir, e.name));

  const versionPattern = /> Version \d+\.\d+\.\d+/;
  for (const file of mdFiles) {
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

  console.log("─── Agent & Skill Counts ───");
  await checkAgentCount();
  await checkSkillCount();

  console.log("─── Prohibited References ───");
  await checkProhibitedRefs();

  console.log("─── Superseded Links ───");
  await checkSupersededLinks();

  console.log("─── Agent Table Verification ───");
  await checkAgentTable();

  console.log("─── Skill Table Verification ───");
  await checkSkillTable();

  console.log("─── Version Header Check ───");
  await checkVersionHeaders();

  // Print findings
  console.log("");
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

  // Write JSON report
  const report = {
    findings,
    summary: `${findings.length} issue(s) found`,
  };
  await writeFile(
    join(ROOT, "freshness-report.json"),
    JSON.stringify(report, null, 2),
  );
  console.log("📄 Report written to freshness-report.json");

  process.exit(1);
}

main();
