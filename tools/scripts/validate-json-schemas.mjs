#!/usr/bin/env node
/**
 * Validate JSON files against JSON Schemas.
 *
 * Reads `.vscode/settings.json` → `json.schemas` so editor and CI validation
 * stay in sync. Compiles each schema with Ajv (draft 2020-12) and validates
 * every mapped data file.
 *
 * Scope: this validator is the IDE-mapping channel. It only checks schemas
 * registered in `.vscode/settings.json` `json.schemas`. Other schemas under
 * `tools/schemas/` are loaded directly by dedicated validators
 * (e.g. `validate-model-catalog.mjs`, `validate-workflow-graph.mjs`,
 * `validate-session-state.mjs`, `validate-explorer-graph.mjs`,
 * `validate-governance-refs.mjs`). Both channels are intentional: this one
 * keeps the editor's red squigglies aligned with CI; the dedicated
 * validators add semantic checks beyond raw schema conformance.
 */

import { readFileSync, globSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");

function readJson(path) {
  const raw = readFileSync(path, "utf8");
  // Strip leading line comments (tolerate JSONC in .vscode/settings.json).
  const stripped = raw.replace(/^\s*\/\/[^\n]*\n/gm, "");
  return JSON.parse(stripped);
}

const settings = readJson(join(ROOT, ".vscode/settings.json"));
const mappings = settings["json.schemas"] ?? [];
if (mappings.length === 0) {
  console.log("No json.schemas mappings in .vscode/settings.json — nothing to validate.");
  process.exit(0);
}

const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
let failures = 0;

for (const entry of mappings) {
  const schemaPath = resolve(ROOT, entry.url);
  let schema;
  try {
    schema = readJson(schemaPath);
  } catch (err) {
    console.error(`❌ Cannot load schema ${entry.url}: ${err.message}`);
    failures += 1;
    continue;
  }
  const validate = ajv.compile(schema);
  for (const match of entry.fileMatch) {
    // Expand globs in fileMatch so a single mapping can cover an entire
    // family (e.g. agent-output/*/09-lessons-learned.json). If a glob
    // matches nothing it is silently skipped — that just means the
    // file family is empty in this checkout.
    const isGlob = /[*?[\]]/.test(match);
    const matched = isGlob ? globSync(match, { cwd: ROOT, nodir: true }) : [match];
    if (isGlob && matched.length === 0) {
      console.log(`ℹ️  ${match} (glob matched no files — skipped)`);
      continue;
    }
    for (const rel of matched) {
      const dataPath = resolve(ROOT, rel);
      let data;
      try {
        data = readJson(dataPath);
      } catch (err) {
        console.error(`❌ Cannot load data file ${rel}: ${err.message}`);
        failures += 1;
        continue;
      }
      if (validate(data)) {
        console.log(`✅ ${rel} valid against ${entry.url}`);
      } else {
        failures += 1;
        console.error(`❌ ${rel} failed validation against ${entry.url}`);
        for (const err of validate.errors ?? []) {
          console.error(`   ${err.instancePath || "/"} ${err.message}`);
        }
      }
    }
  }
}

if (failures > 0) {
  console.error(`\n${failures} schema validation failure(s).`);
  process.exit(1);
}
console.log("\nAll JSON schema validations passed.");
