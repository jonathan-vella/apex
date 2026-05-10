#!/usr/bin/env node
/**
 * Stage 5-Audit (Plan 2 / Sensei GEPA Pipeline) — structural-regression detector.
 *
 * Compares a "before" SKILL.md to a GEPA "candidate" SKILL.md and classifies the
 * candidate as SAFE / REVIEW / REJECT. Audit mode only — never writes to
 * .github/skills/{skill}/SKILL.md. Pure structural detection (no LLM calls).
 *
 * Detector rules (locked 2026-05-10 by user decision):
 *
 *   REJECT  - any "## H2" section in `before` is missing in `candidate`
 *   REJECT  - any `references/*.md` link in `before` is missing in `candidate`
 *             AND that file exists on disk (orphans an existing reference)
 *   REJECT  - any in-scope skill name (other than this skill) mentioned in
 *             `before` body is absent from `candidate` body
 *   REVIEW  - a markdown table loses rows
 *   REVIEW  - a fenced code block disappears
 *   REVIEW  - frontmatter `version:` changes
 *   REVIEW  - token count drops by more than 25%
 *
 * Verdict: REJECT > REVIEW > SAFE (highest severity wins).
 *
 * Usage:
 *   node tools/scripts/audit-gepa-candidate.mjs \
 *     --skill azure-prepare \
 *     --before .github/skills/_audits/stage5-snapshots/azure-prepare.before.md \
 *     --candidate .github/skills/_audits/stage5-snapshots/azure-prepare.candidate.md \
 *     [--json]
 */

import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { dirname, resolve, basename } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..", "..");

// ── Markdown structural parsing ──────────────────────────────────────────────

function splitFrontmatter(text) {
  if (!text.startsWith("---")) return { frontmatter: "", body: text };
  const end = text.indexOf("\n---", 4);
  if (end < 0) return { frontmatter: "", body: text };
  return {
    frontmatter: text.slice(0, end + 4),
    body: text.slice(end + 4),
  };
}

function parseFrontmatterField(frontmatter, field) {
  // Match top-level OR indented field (e.g. `version:` is nested under `metadata:`).
  const re = new RegExp(`^\\s*${field}:\\s*(.+?)\\s*$`, "m");
  const m = frontmatter.match(re);
  return m ? m[1].replace(/^["']|["']$/g, "") : null;
}

function extractH2Sections(body) {
  const sections = [];
  for (const line of body.split("\n")) {
    if (line.startsWith("## ")) sections.push(line.slice(3).trim());
  }
  return sections;
}

function extractReferenceLinks(body) {
  // Match markdown link target like `references/foo.md` or `references/sub/bar.md`.
  // Captures both inline `(references/...)` and reference-style `[id]: references/...`.
  const out = new Set();
  const inlineRe = /\(\s*(references\/[^)\s#]+\.md)/g;
  for (const m of body.matchAll(inlineRe)) out.add(m[1]);
  const refStyleRe = /^\s*\[[^\]]+\]:\s*(references\/[^\s#]+\.md)/gm;
  for (const m of body.matchAll(refStyleRe)) out.add(m[1]);
  // Also match plain backtick mentions like `references/foo.md` for completeness.
  const backtickRe = /`(references\/[^`\s#]+\.md)`/g;
  for (const m of body.matchAll(backtickRe)) out.add(m[1]);
  return [...out];
}

function listInScopeSkills() {
  const skillsDir = resolve(REPO_ROOT, ".github", "skills");
  return readdirSync(skillsDir).filter((name) => {
    if (["sensei", "archived_skills", "_audits"].includes(name)) return false;
    if (name.startsWith(".") || name.endsWith(".md")) return false;
    const path = resolve(skillsDir, name);
    return statSync(path).isDirectory();
  });
}

function countTableRows(body) {
  // A "table row" is a line that starts with `|` and ends with `|` AND is not
  // a header separator (`| --- | --- |`).
  const rows = body
    .split("\n")
    .filter((line) => /^\s*\|.+\|\s*$/.test(line))
    .filter((line) => !/^\s*\|\s*[-:|\s]+\|\s*$/.test(line));
  return rows.length;
}

function countFencedCodeBlocks(body) {
  // Open + close fence pairs. Match ``` at line start.
  const fences = body.split("\n").filter((line) => /^```/.test(line));
  return Math.floor(fences.length / 2);
}

function tokenEstimate(charCount) {
  // Rough char-to-token estimate (sensei uses 4 chars/token); good enough for
  // a first-pass regression flag. The plan's authoritative count comes from
  // sensei's tokens CLI; we surface the rough delta here for the REVIEW rule.
  return Math.round(charCount / 4);
}

// ── Detector ─────────────────────────────────────────────────────────────────

function audit({ skill, before, candidate }) {
  const beforeText = readFileSync(before, "utf8");
  const candText = readFileSync(candidate, "utf8");

  const beforeSplit = splitFrontmatter(beforeText);
  const candSplit = splitFrontmatter(candText);

  const beforeBody = beforeSplit.body;
  const candBody = candSplit.body;

  const findings = [];
  const inScopeSkills = listInScopeSkills().filter((s) => s !== skill);

  // RULE 1 — H2 section preservation (REJECT)
  const beforeH2 = extractH2Sections(beforeBody);
  const candH2 = extractH2Sections(candBody);
  const lostH2 = beforeH2.filter((title) => !candH2.includes(title));
  if (lostH2.length > 0) {
    findings.push({
      rule: "h2-preservation",
      severity: "REJECT",
      detail: `${lostH2.length} H2 section(s) removed`,
      items: lostH2,
    });
  }

  // RULE 2 — references/*.md orphans (REJECT)
  const beforeRefs = extractReferenceLinks(beforeBody);
  const candRefs = extractReferenceLinks(candBody);
  const skillDir = resolve(REPO_ROOT, ".github", "skills", skill);
  const lostRefs = beforeRefs.filter((ref) => {
    if (candRefs.includes(ref)) return false;
    // Only flag if the reference file actually exists on disk.
    return existsSync(resolve(skillDir, ref));
  });
  if (lostRefs.length > 0) {
    findings.push({
      rule: "reference-orphans",
      severity: "REJECT",
      detail: `${lostRefs.length} references/*.md link(s) removed (existing files orphaned)`,
      items: lostRefs,
    });
  }

  // RULE 3 — cross-skill mentions (REJECT)
  const lostSkillMentions = [];
  for (const otherSkill of inScopeSkills) {
    // Word-boundary match to avoid false positives.
    const re = new RegExp(`\\b${otherSkill.replace(/[-]/g, "\\-")}\\b`, "g");
    const beforeMatches = (beforeBody.match(re) || []).length;
    const candMatches = (candBody.match(re) || []).length;
    if (beforeMatches > 0 && candMatches === 0) {
      lostSkillMentions.push({ skill: otherSkill, beforeMatches });
    }
  }
  if (lostSkillMentions.length > 0) {
    findings.push({
      rule: "cross-skill-mentions",
      severity: "REJECT",
      detail: `${lostSkillMentions.length} cross-skill mention(s) lost (potential hand-off rule regression)`,
      items: lostSkillMentions.map(
        (m) => `${m.skill} (${m.beforeMatches} mention${m.beforeMatches > 1 ? "s" : ""} → 0)`
      ),
    });
  }

  // RULE 4 — table row count (REVIEW)
  const beforeTableRows = countTableRows(beforeBody);
  const candTableRows = countTableRows(candBody);
  if (candTableRows < beforeTableRows) {
    findings.push({
      rule: "table-rows",
      severity: "REVIEW",
      detail: `Table row count dropped: ${beforeTableRows} → ${candTableRows} (Δ ${candTableRows - beforeTableRows})`,
      items: [],
    });
  }

  // RULE 5 — fenced code block count (REVIEW)
  const beforeCodeBlocks = countFencedCodeBlocks(beforeBody);
  const candCodeBlocks = countFencedCodeBlocks(candBody);
  if (candCodeBlocks < beforeCodeBlocks) {
    findings.push({
      rule: "code-blocks",
      severity: "REVIEW",
      detail: `Fenced code block count dropped: ${beforeCodeBlocks} → ${candCodeBlocks} (Δ ${candCodeBlocks - beforeCodeBlocks})`,
      items: [],
    });
  }

  // RULE 6 — frontmatter version change (REVIEW)
  const beforeVersion = parseFrontmatterField(beforeSplit.frontmatter, "version");
  const candVersion = parseFrontmatterField(candSplit.frontmatter, "version");
  if (beforeVersion && candVersion && beforeVersion !== candVersion) {
    findings.push({
      rule: "version-bump",
      severity: "REVIEW",
      detail: `frontmatter version changed: ${beforeVersion} → ${candVersion}`,
      items: [],
    });
  }

  // RULE 7 — token reduction (REVIEW if > 25%)
  const beforeTokens = tokenEstimate(beforeText.length);
  const candTokens = tokenEstimate(candText.length);
  const tokenDelta = candTokens - beforeTokens;
  const tokenPct = beforeTokens === 0 ? 0 : (tokenDelta / beforeTokens) * 100;
  if (tokenPct < -25) {
    findings.push({
      rule: "aggressive-trim",
      severity: "REVIEW",
      detail: `Token reduction ${tokenDelta} (${tokenPct.toFixed(1)}%) exceeds 25% (likely over-aggressive)`,
      items: [],
    });
  }

  // ── Verdict ─────────────────────────────────────────────────────────────
  let verdict = "SAFE";
  if (findings.some((f) => f.severity === "REJECT")) verdict = "REJECT";
  else if (findings.some((f) => f.severity === "REVIEW")) verdict = "REVIEW";

  return {
    skill,
    before,
    candidate,
    verdict,
    findings,
    metrics: {
      h2_before: beforeH2.length,
      h2_after: candH2.length,
      refs_before: beforeRefs.length,
      refs_after: candRefs.length,
      table_rows_before: beforeTableRows,
      table_rows_after: candTableRows,
      code_blocks_before: beforeCodeBlocks,
      code_blocks_after: candCodeBlocks,
      tokens_before_estimate: beforeTokens,
      tokens_after_estimate: candTokens,
      tokens_delta_pct: Number(tokenPct.toFixed(2)),
      version_before: beforeVersion,
      version_after: candVersion,
    },
  };
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const opts = { json: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--skill") opts.skill = argv[++i];
    else if (arg === "--before") opts.before = argv[++i];
    else if (arg === "--candidate") opts.candidate = argv[++i];
    else if (arg === "--json") opts.json = true;
    else throw new Error(`Unknown arg: ${arg}`);
  }
  for (const required of ["skill", "before", "candidate"]) {
    if (!opts[required]) throw new Error(`Missing required --${required}`);
  }
  return opts;
}

function renderTable(report) {
  const lines = [];
  const verdictBadge =
    report.verdict === "REJECT" ? "❌ REJECT" : report.verdict === "REVIEW" ? "⚠️  REVIEW" : "✅ SAFE";
  lines.push(`Skill:      ${report.skill}`);
  lines.push(`Before:     ${report.before}`);
  lines.push(`Candidate:  ${report.candidate}`);
  lines.push(`Verdict:    ${verdictBadge}`);
  lines.push("");
  lines.push("Metrics:");
  for (const [k, v] of Object.entries(report.metrics)) {
    lines.push(`  ${k.padEnd(28)} ${v}`);
  }
  lines.push("");
  if (report.findings.length === 0) {
    lines.push("Findings:   (none — all checks passed)");
  } else {
    lines.push("Findings:");
    for (const f of report.findings) {
      const tag = f.severity === "REJECT" ? "❌" : "⚠️ ";
      lines.push(`  ${tag} [${f.rule}] ${f.detail}`);
      for (const item of f.items.slice(0, 10)) {
        lines.push(`     - ${item}`);
      }
      if (f.items.length > 10) {
        lines.push(`     ... and ${f.items.length - 10} more`);
      }
    }
  }
  return lines.join("\n");
}

function main() {
  let opts;
  try {
    opts = parseArgs(process.argv.slice(2));
  } catch (err) {
    console.error(err.message);
    console.error(
      "Usage: node tools/scripts/audit-gepa-candidate.mjs --skill <name> --before <path> --candidate <path> [--json]"
    );
    process.exit(2);
  }

  const report = audit(opts);

  if (opts.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(renderTable(report));
  }

  // Exit code reflects the verdict:
  //   0 = SAFE, 1 = REVIEW, 2 = REJECT.
  if (report.verdict === "REJECT") process.exit(2);
  if (report.verdict === "REVIEW") process.exit(1);
  process.exit(0);
}

main();
