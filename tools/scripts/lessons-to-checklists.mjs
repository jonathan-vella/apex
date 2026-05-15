#!/usr/bin/env node
/**
 * Lessons → challenger-checklist gap report.
 *
 * Scans every `09-lessons-learned.json` under `agent-output/{project}/` and
 * diffs the lessons against the per-lens checklists in
 * `.github/skills/azure-defaults/references/adversarial-checklists.md`.
 * Emits a markdown report of "lessons our challengers missed" — patterns
 * that surfaced post-deployment but aren't covered by any checklist
 * line.
 *
 * **Human-reviewed; never auto-applied.** This is a periodic gap-report
 * to inform manual checklist updates.
 *
 * Usage:
 *   npm run report:challenger-gaps
 *
 * Output: stdout markdown report.
 */

import fs from "node:fs";
import path from "node:path";

const AGENT_OUTPUT = "agent-output";
const CHECKLIST_PATH = ".github/skills/azure-defaults/references/adversarial-checklists.md";

function listLessons() {
  if (!fs.existsSync(AGENT_OUTPUT)) return [];
  const acc = [];
  for (const entry of fs.readdirSync(AGENT_OUTPUT, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith("_")) continue;
    const p = path.join(AGENT_OUTPUT, entry.name, "09-lessons-learned.json");
    if (fs.existsSync(p)) acc.push({ project: entry.name, path: p });
  }
  return acc;
}

function loadChecklist() {
  if (!fs.existsSync(CHECKLIST_PATH)) return "";
  return fs.readFileSync(CHECKLIST_PATH, "utf-8").toLowerCase();
}

/**
 * Very rough heuristic: a lesson "matches" the checklist if at least 2
 * non-trivial tokens from its title appear somewhere in the checklist
 * (case-insensitive). False positives are fine — they just reduce the
 * gap list. False negatives are what we care about: lessons NOT in the
 * checklist surface as gaps.
 */
function lessonCovered(title, checklist) {
  if (!title) return true;
  const tokens = title
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4);
  if (tokens.length === 0) return true;
  let hits = 0;
  for (const t of tokens) {
    if (checklist.includes(t)) hits++;
    if (hits >= 2) return true;
  }
  return false;
}

const checklist = loadChecklist();
const projects = listLessons();

const gaps = [];

for (const { project, path: lessonsPath } of projects) {
  let doc;
  try {
    doc = JSON.parse(fs.readFileSync(lessonsPath, "utf-8"));
  } catch (e) {
    console.error(`  ❌ ${lessonsPath}: invalid JSON (${e.message})`);
    process.exitCode = 1;
    continue;
  }
  const items = Array.isArray(doc.lessons) ? doc.lessons : Array.isArray(doc) ? doc : [];
  for (const item of items) {
    const title = item.title ?? item.summary ?? item.lesson ?? "";
    if (!title) continue;
    if (!lessonCovered(title, checklist)) {
      gaps.push({
        project,
        title,
        category: item.category ?? "(uncategorized)",
        severity: item.severity ?? "(unknown)",
        source: lessonsPath,
      });
    }
  }
}

const report = [];
report.push("# Challenger Coverage Gap Report");
report.push("");
report.push("Lessons-learned items from completed projects that do **not** appear to be covered");
report.push("by any line in `adversarial-checklists.md`. Heuristic match (token-overlap);");
report.push("human review required before adding new checklist lines.");
report.push("");
report.push(`Generated: ${new Date().toISOString()}`);
report.push(`Lessons sources scanned: ${projects.length}`);
report.push(`Potential gaps surfaced: ${gaps.length}`);
report.push("");
if (gaps.length === 0) {
  report.push("✅ No gaps detected.");
} else {
  report.push("| Project | Severity | Category | Lesson | Source |");
  report.push("| ------- | -------- | -------- | ------ | ------ |");
  for (const g of gaps) {
    // Markdown table cell escaping: backslashes must be escaped FIRST,
    // otherwise the subsequent `\|` substitution doubles back over its
    // own output (CodeQL "Incomplete string escaping or encoding").
    const title = String(g.title).replace(/\\/g, "\\\\").replace(/\|/g, "\\|").slice(0, 100);
    report.push(`| ${g.project} | ${g.severity} | ${g.category} | ${title} | ${g.source} |`);
  }
}
console.log(report.join("\n"));
