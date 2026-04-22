#!/usr/bin/env node
/**
 * Registry Skill-Coverage Validator
 *
 * Cross-checks `tools/registry/agent-registry.json` against how each agent actually
 * references its skills inside the corresponding `.agent.md` body.
 *
 * Rules:
 *   - ERROR  Agent body reads `.github/skills/{name}/...` but `{name}` is
 *            absent from both `skills[]` and `capability_skills[]`.
 *   - ERROR  A skill in `skills[]` is never explicitly referenced in the
 *            agent body (should either be removed or moved to
 *            `capability_skills[]`).
 *   - WARN   A skill in `capability_skills[]` IS explicitly referenced in
 *            the body (suggests it should move to `skills[]`).
 */

import { readFileSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const REGISTRY_PATH = join(ROOT, "tools/registry/agent-registry.json");

const SKILL_REF_RE = /\.github\/skills\/([a-z0-9][a-z0-9-]*)(?:\/|\b)/g;

function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function extractSkillRefs(body) {
  const names = new Set();
  let m;
  while ((m = SKILL_REF_RE.exec(body)) !== null) {
    names.add(m[1]);
  }
  return names;
}

function* walk(registry) {
  for (const [key, entry] of Object.entries(registry.agents || {})) {
    yield* expand(key, entry);
  }
  for (const [key, entry] of Object.entries(registry.subagents || {})) {
    yield* expand(key, entry);
  }
}

function* expand(key, entry) {
  if (entry.bicep || entry.terraform) {
    if (entry.bicep) yield [`${key} (bicep)`, entry.bicep];
    if (entry.terraform) yield [`${key} (terraform)`, entry.terraform];
    return;
  }
  yield [key, entry];
}

const registry = readJson(REGISTRY_PATH);
let errors = 0;
let warnings = 0;
let checked = 0;

for (const [key, entry] of walk(registry)) {
  const agentPath = entry.agent ? join(ROOT, entry.agent) : null;
  if (!agentPath) continue;
  let body;
  try {
    body = readFileSync(agentPath, "utf8");
  } catch {
    console.error(`❌ [${key}] agent file not readable: ${entry.agent}`);
    errors += 1;
    continue;
  }
  checked += 1;
  const refs = extractSkillRefs(body);
  const declared = new Set(entry.skills || []);
  const capability = new Set(entry.capability_skills || []);

  // Rule 1: read references must be declared in either array
  for (const ref of refs) {
    if (!declared.has(ref) && !capability.has(ref)) {
      console.error(
        `❌ [${key}] body references skill "${ref}" but it is missing from skills[] and capability_skills[]`,
      );
      errors += 1;
    }
  }

  // Rule 2: declared required skills must be referenced in the body
  for (const skill of declared) {
    if (!refs.has(skill)) {
      console.error(
        `❌ [${key}] skill "${skill}" in skills[] is never referenced in the agent body (remove or move to capability_skills[])`,
      );
      errors += 1;
    }
  }

  // Rule 3 (warn): capability skill explicitly referenced should become required
  for (const skill of capability) {
    if (refs.has(skill)) {
      console.warn(
        `⚠️  [${key}] capability_skills entry "${skill}" is explicitly referenced in the body — consider moving to skills[]`,
      );
      warnings += 1;
    }
  }
}

console.log(
  `\n📊 Registry skill-coverage: checked ${checked}, ${errors} error(s), ${warnings} warning(s)`,
);

if (errors > 0) {
  console.error("❌ Registry skill-coverage validation failed\n");
  process.exit(1);
}

console.log("✅ Registry skill-coverage validation passed\n");
