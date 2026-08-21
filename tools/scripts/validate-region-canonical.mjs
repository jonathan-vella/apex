#!/usr/bin/env node
/** Enforce canonical ownership of Azure defaults without maintaining a mirror. */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Reporter } from "./_lib/reporter.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "../..");
const CANONICAL_PATH = path.join(REPO_ROOT, ".github/copilot-instructions.md");
const SKILL_PATH = path.join(REPO_ROOT, ".github/skills/azure-defaults/SKILL.md");
const CANONICAL_LINK = "../../copilot-instructions.md#azure-defaults-canonical";

const REQUIRED_CANONICAL_HEADINGS = [
  "### Default Regions",
  "### Required Tags (Azure Policy Enforced)",
  "### Security baseline + AVM mandate",
];
const FORBIDDEN_SKILL_HEADINGS = [/^### Default Regions$/m, /^### Required Tags/m, /^### Security Baseline/m];
const FORBIDDEN_REGION_LITERALS = ["swedencentral", "westeurope", "germanywestcentral"];
const FORBIDDEN_CANONICAL_SIGNATURES = [
  "technical-contact",
  "backup-policy",
  "'TLS1_2'",
  "Public blob access",
  "Managed Identity over keys",
];

export function runValidator({ canonicalPath = CANONICAL_PATH, skillPath = SKILL_PATH } = {}) {
  const r = new Reporter("Azure Defaults Canonical Ownership Validator");
  r.header();

  for (const filePath of [canonicalPath, skillPath]) {
    r.tick();
    if (!fs.existsSync(filePath)) r.error(path.relative(REPO_ROOT, filePath), "file not found");
  }
  if (r.errors) {
    r.summary();
    return 1;
  }

  const canonical = fs.readFileSync(canonicalPath, "utf8");
  const skill = fs.readFileSync(skillPath, "utf8");

  for (const heading of REQUIRED_CANONICAL_HEADINGS) {
    r.check(`canonical heading: ${heading}`, canonical.includes(heading));
  }
  r.check("skill links to canonical Azure defaults", skill.includes(CANONICAL_LINK));

  for (const heading of FORBIDDEN_SKILL_HEADINGS) {
    r.check(`skill omits duplicated heading ${heading}`, !heading.test(skill));
  }
  for (const region of FORBIDDEN_REGION_LITERALS) {
    r.check(`skill omits canonical region literal ${region}`, !skill.includes(region));
  }
  for (const signature of FORBIDDEN_CANONICAL_SIGNATURES) {
    r.check(`skill omits canonical signature ${signature}`, !skill.includes(signature));
  }

  r.summary();
  if (r.errors === 0) console.log("\n✅ Azure defaults have one canonical owner");
  else console.error("\n❌ Azure defaults ownership validation failed");
  return r.errors > 0 ? 1 : 0;
}

const invokedAsScript = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(runValidator());
