#!/usr/bin/env node
/**
 * Validates the offline APEX vNext project-control contract.
 *
 * @example
 * node tools/scripts/validate-vnext-project-controls.mjs
 */

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as yaml from "js-yaml";
import { Reporter } from "./_lib/reporter.mjs";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PROJECT_DIR = "docs/vnext";
const PHASE_0A_DIR = "docs/vnext/phase-0a";
const FROZEN_PHASE_0A_DIGEST = "d4c774504df69f12814fd056fa76cf85de608f91e95a0309229162f79d9ff26b";
const REQUIRED_DOCUMENTS = ["README.md", "PROJECT.md", "PRD.md", "ROADMAP.md", "REGISTER.md", "DECISIONS.md"];
const REQUIRED_WORK_ITEM_FIELDS = [
  "workstream",
  "outcome",
  "requirements",
  "dependencies",
  "compatibility",
  "security",
  "evidence",
  "manual-live",
  "definition-of-done",
  "safety",
];
const REQUIRED_BUG_FIELDS = ["integration-head", "failed-check", "regression-test"];

function findFiles(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? findFiles(entryPath) : [entryPath];
    })
    .sort();
}

function digestTree(directory) {
  const digest = crypto.createHash("sha256");
  for (const filePath of findFiles(directory)) {
    digest.update(path.relative(directory, filePath));
    digest.update("\0");
    digest.update(fs.readFileSync(filePath));
    digest.update("\0");
  }
  return digest.digest("hex");
}

function extractIds(content, pattern) {
  return [...content.matchAll(pattern)].map((match) => match[1]);
}

function extractLocalLinks(root, sourcePath, content) {
  return [...content.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)]
    .map((match) => match[1].split("#", 1)[0])
    .filter((target) => target && !/^[a-z][a-z\d+.-]*:/i.test(target))
    .map((target) => {
      const targetPath = path.resolve(path.dirname(path.join(root, sourcePath)), decodeURIComponent(target));
      return {
        source: sourcePath,
        target,
        exists: fs.existsSync(targetPath),
      };
    });
}

function loadIssueForm(root, relativePath) {
  const filePath = path.join(root, relativePath);
  const content = fs.readFileSync(filePath, "utf8");
  return yaml.load(content);
}

export function loadProjectControls(root) {
  const documents = Object.fromEntries(
    REQUIRED_DOCUMENTS.map((name) => {
      const relativePath = path.join(PROJECT_DIR, name);
      const filePath = path.join(root, relativePath);
      return [name, fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null];
    }),
  );
  const localLinks = Object.entries(documents).flatMap(([name, content]) =>
    content ? extractLocalLinks(root, path.join(PROJECT_DIR, name), content) : [],
  );

  return {
    documents,
    localLinks,
    phase0aDigest: digestTree(path.join(root, PHASE_0A_DIR)),
    workItemForm: loadIssueForm(root, ".github/ISSUE_TEMPLATE/vnext-work-item.yml"),
    bugForm: loadIssueForm(root, ".github/ISSUE_TEMPLATE/bug-report.yml"),
  };
}

function findDuplicates(values) {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))].sort();
}

function formFieldIds(form) {
  return new Set((form.body ?? []).map((field) => field.id).filter(Boolean));
}

export function validateProjectControls(model) {
  const findings = [];
  const addFinding = (ruleId, message) => findings.push({ ruleId, message });

  for (const [name, content] of Object.entries(model.documents)) {
    if (content === null) addFinding("document.required", `${name} is missing`);
  }

  const prd = model.documents["PRD.md"] ?? "";
  const requirementIds = extractIds(prd, /^### (REQ-[A-Z]+-\d{3}):/gm);
  for (const duplicate of findDuplicates(requirementIds)) {
    addFinding("requirement.unique", `${duplicate} is declared more than once`);
  }

  const knownRequirementIds = new Set(requirementIds);
  for (const [name, content] of Object.entries(model.documents)) {
    if (!content) continue;
    const references = new Set(extractIds(content, /\b(REQ-[A-Z]+-\d{3})\b/g));
    for (const reference of references) {
      if (!knownRequirementIds.has(reference)) {
        addFinding("requirement.reference", `${name} references unknown ${reference}`);
      }
    }
  }

  const decisions = extractIds(model.documents["DECISIONS.md"] ?? "", /^## (DECISION-\d{3}):/gm);
  for (const duplicate of findDuplicates(decisions)) {
    addFinding("decision.unique", `${duplicate} is declared more than once`);
  }

  for (const link of model.localLinks) {
    if (!link.exists) addFinding("link.local", `${link.source} has missing target ${link.target}`);
  }

  if (model.phase0aDigest !== FROZEN_PHASE_0A_DIGEST) {
    addFinding("phase-0a.frozen", `Phase 0A digest changed to ${model.phase0aDigest}`);
  }

  const workItemFields = formFieldIds(model.workItemForm);
  for (const field of REQUIRED_WORK_ITEM_FIELDS) {
    if (!workItemFields.has(field)) addFinding("work-item.required-field", `work item form is missing ${field}`);
  }

  const bugFields = formFieldIds(model.bugForm);
  for (const field of REQUIRED_BUG_FIELDS) {
    if (!bugFields.has(field)) addFinding("bug.required-field", `bug form is missing ${field}`);
  }

  return findings;
}

function main() {
  const reporter = new Reporter("vNext Project Controls");
  reporter.header();
  const findings = validateProjectControls(loadProjectControls(REPO_ROOT));
  reporter.tick();
  if (findings.length === 0) {
    reporter.ok("project controls", "documents, references, forms, links, and frozen evidence are valid");
  } else {
    for (const finding of findings) reporter.error(finding.ruleId, finding.message);
  }
  reporter.summary();
  reporter.exitOnError("vNext project controls are valid");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
