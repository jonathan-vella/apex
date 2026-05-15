#!/usr/bin/env node
/**
 * promote-sku-aliases.mjs
 *
 * Scans recent `cost-estimate-*.json` files under `agent-output/` for
 * `proposed_aliases[]` entries emitted by the cost-estimate-subagent's
 * `<unresolved_sku_triage>` flow, and proposes additions to the
 * Canonical SKU Aliases table in
 * `.github/skills/azure-defaults/references/pricing-guidance.md`.
 *
 * Phase C4 of the nordic-foods lessons plan. Run monthly via cron + on
 * demand. Intentionally does NOT auto-merge; emits a patch file +
 * (optionally) opens a GitHub PR via `gh` when --pr is passed.
 *
 * Usage:
 *   node tools/scripts/promote-sku-aliases.mjs          # dry-run, prints proposal
 *   node tools/scripts/promote-sku-aliases.mjs --apply  # patches the MD in place
 *   node tools/scripts/promote-sku-aliases.mjs --pr     # commits + opens PR via gh
 *
 * Exit codes:
 *   0 — no proposals found, or proposals successfully emitted
 *   1 — hard failure (file missing, parse error)
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const AGENT_OUTPUT = path.join(ROOT, "agent-output");
const PRICING_GUIDANCE = path.join(ROOT, ".github/skills/azure-defaults/references/pricing-guidance.md");

// 30-day default lookback — long enough to capture a typical project arc.
const LOOKBACK_DAYS = Number(process.env.APEX_ALIAS_LOOKBACK_DAYS ?? 30);

function recentCostJsons() {
  if (!fs.existsSync(AGENT_OUTPUT)) return [];
  const cutoff = Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000;
  const files = [];
  for (const project of fs.readdirSync(AGENT_OUTPUT)) {
    const projDir = path.join(AGENT_OUTPUT, project);
    if (!fs.statSync(projDir).isDirectory()) continue;
    for (const name of fs.readdirSync(projDir)) {
      if (!/^cost-estimate.*\.json$|^02-cost-estimate\.json$|^07-ab-cost-estimate\.json$/.test(name)) continue;
      const full = path.join(projDir, name);
      const stat = fs.statSync(full);
      if (stat.mtimeMs >= cutoff) files.push(full);
    }
  }
  return files;
}

function loadProposals(files) {
  const proposals = [];
  for (const f of files) {
    let data;
    try {
      data = JSON.parse(fs.readFileSync(f, "utf-8"));
    } catch (err) {
      console.warn(`[promote-sku-aliases] skip ${path.relative(ROOT, f)}: parse error ${err.message}`);
      continue;
    }
    const arr = data.proposed_aliases ?? [];
    if (!Array.isArray(arr) || arr.length === 0) continue;
    for (const p of arr) {
      if (!p.input_sku_name || !p.proposed_alias) continue;
      proposals.push({
        source: path.relative(ROOT, f),
        input_sku_name: String(p.input_sku_name),
        resolved_product_filter: String(p.resolved_product_filter ?? ""),
        proposed_alias: String(p.proposed_alias),
        top_3_matches: Array.isArray(p.top_3_matches) ? p.top_3_matches : [],
      });
    }
  }
  return proposals;
}

function existingAliases(md) {
  const section = md.match(/## Canonical SKU Aliases[\s\S]*?(?=\n## )/);
  if (!section) return new Set();
  const seen = new Set();
  for (const line of section[0].split("\n")) {
    if (!line.startsWith("|")) continue;
    const cells = line
      .split("|")
      .map((c) => c.trim())
      .slice(1, -1);
    if (cells.length < 3) continue;
    if (cells[0] === "Service" || cells[0].startsWith("---")) continue;
    // Key by variant input (column index 1) — backticks stripped
    seen.add(cells[1].replace(/`/g, "").trim().toLowerCase());
  }
  return seen;
}

function dedupe(proposals, existing) {
  const seen = new Set();
  const out = [];
  for (const p of proposals) {
    const key = p.input_sku_name.trim().toLowerCase();
    if (existing.has(key)) continue; // Already in canonical table
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(p);
  }
  return out;
}

function renderProposalReport(proposals) {
  if (proposals.length === 0) {
    return "## No new SKU alias proposals\n\nLookback window scanned, all observed inputs already canonical.\n";
  }
  const lines = [
    `## SKU alias promotion proposal (${proposals.length} new candidate${proposals.length === 1 ? "" : "s"})`,
    "",
    "Review and append to the Canonical SKU Aliases table in",
    "`.github/skills/azure-defaults/references/pricing-guidance.md`.",
    "",
    "| Input from cost JSON | Proposed canonical `sku_name` | `product_filter` | Sources |",
    "| -------------------- | ----------------------------- | ---------------- | ------- |",
  ];
  for (const p of proposals) {
    lines.push(
      `| \`${p.input_sku_name}\` | \`${p.proposed_alias}\` | \`${p.resolved_product_filter || "—"}\` | ${path.basename(path.dirname(p.source))} |`,
    );
  }
  return `${lines.join("\n")}\n`;
}

function maybeOpenPr(reportPath) {
  const branchName = `chore/promote-sku-aliases-${new Date().toISOString().slice(0, 10)}`;
  const steps = [
    ["git", ["checkout", "-b", branchName]],
    ["git", ["add", reportPath]],
    ["git", ["commit", "-m", "chore(sku-aliases): propose new canonical aliases"]],
    ["git", ["push", "-u", "origin", branchName]],
    ["gh", ["pr", "create", "--fill", "--label", "chore"]],
  ];
  for (const [cmd, args] of steps) {
    const r = spawnSync(cmd, args, { stdio: "inherit" });
    if (r.status !== 0) {
      console.error(`[promote-sku-aliases] failed at: ${cmd} ${args.join(" ")}`);
      return 1;
    }
  }
  return 0;
}

function main() {
  const argv = process.argv.slice(2);
  const apply = argv.includes("--apply");
  const openPr = argv.includes("--pr");

  if (!fs.existsSync(PRICING_GUIDANCE)) {
    console.error(`[promote-sku-aliases] pricing-guidance.md not found: ${PRICING_GUIDANCE}`);
    process.exit(1);
  }

  const md = fs.readFileSync(PRICING_GUIDANCE, "utf-8");
  const existing = existingAliases(md);

  const files = recentCostJsons();
  console.log(`[promote-sku-aliases] scanned ${files.length} cost JSON file(s) (lookback ${LOOKBACK_DAYS}d)`);
  const raw = loadProposals(files);
  const proposals = dedupe(raw, existing);
  console.log(`[promote-sku-aliases] ${raw.length} proposal entr(y|ies) found, ${proposals.length} new after dedupe`);

  const report = renderProposalReport(proposals);
  if (proposals.length === 0 && !apply && !openPr) {
    console.log(report);
    return 0;
  }

  const reportPath = path.join(ROOT, "tmp", "sku-alias-promotion-report.md");
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(reportPath, report, "utf-8");
  console.log(`[promote-sku-aliases] wrote ${path.relative(ROOT, reportPath)}`);

  if (apply) {
    console.warn(
      `[promote-sku-aliases] --apply is a stub: human review required before merging into pricing-guidance.md. Report at ${path.relative(ROOT, reportPath)}`,
    );
  }
  if (openPr) {
    return maybeOpenPr(reportPath);
  }
  return 0;
}

process.exit(main());
