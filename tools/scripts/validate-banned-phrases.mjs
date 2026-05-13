#!/usr/bin/env node
/**
 * validate-banned-phrases.mjs
 *
 * Scoped, per-file banned-phrase lint. Each rule names exactly one
 * target file and a regex; the file fails if any match is found. The
 * scope is deliberately narrow — global string bans would catch
 * legitimate references in other files (e.g. "IaC Planner" appears
 * legitimately in 04g-governance handoffs, 05-iac-planner.agent.md,
 * etc.).
 *
 * Phase K1 of the nordic-foods lessons plan.
 *
 * Usage:
 *   node tools/scripts/validate-banned-phrases.mjs
 *
 * Exit codes:
 *   0 — clean
 *   1 — at least one banned phrase found
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const RULES = [
  {
    file: ".github/agents/03-architect.agent.md",
    regex: /hand(?:\s|-)?off to (?:the )?IaC Planner/i,
    reason:
      "Architect must route to Design (Step 3) or Governance Discovery (Step 3.5), not directly to IaC Planner. See Phase A5 of the nordic-foods lessons plan.",
  },
  {
    file: ".github/copilot-instructions.md",
    regex: /Minimum baseline \(PascalCase, exact casing\)/,
    reason:
      "Tag baseline must derive from live Azure Policy; PascalCase is demoted to a deprecated convention. See azure-defaults/references/tag-strategy.md.",
  },
  {
    file: ".github/agents/04g-governance.agent.md",
    regex: /RG\/resource same-region enforcement/,
    reason:
      "Same-region is now a silent default with auditable marker; remove from Phase 2.7 askQuestions panel. See Phase E1 of the nordic-foods lessons plan.",
  },
];

function main() {
  let failed = 0;
  for (const rule of RULES) {
    const full = path.join(ROOT, rule.file);
    if (!fs.existsSync(full)) {
      console.warn(`[validate-banned-phrases] skip: ${rule.file} not found`);
      continue;
    }
    const text = fs.readFileSync(full, "utf-8");
    // Walk line-by-line so the error message can cite a line number.
    const lines = text.split("\n");
    const hits = [];
    for (let i = 0; i < lines.length; i++) {
      if (rule.regex.test(lines[i])) {
        hits.push({ line: i + 1, text: lines[i].trim() });
      }
    }
    if (hits.length > 0) {
      failed++;
      console.error(`❌ ${rule.file}: banned phrase detected (regex: ${rule.regex})`);
      console.error(`   Reason: ${rule.reason}`);
      for (const h of hits) {
        console.error(`   L${h.line}: ${h.text}`);
      }
    } else {
      console.log(`✅ ${rule.file}: clean (regex: ${rule.regex})`);
    }
  }
  if (failed > 0) {
    console.error(`\n❌ ${failed} file(s) contain banned phrases.`);
    process.exit(1);
  }
  console.log("\n✅ all scoped banned-phrase checks passed");
  return 0;
}

main();
