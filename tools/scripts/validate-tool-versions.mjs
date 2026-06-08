#!/usr/bin/env node
/**
 * Tool Version Pin Validator
 *
 * Asserts the dev container + CI environment runs the minimum required
 * versions of bicep, terraform, az, and node. Mismatches block
 * Step 5 validation/Step 6 deploy because earlier versions miss the
 * built-in diagnostics path (bicep ≥ 0.21.0 for readEnvironmentVariable)
 * and AVM-TF v0.3+ semantics.
 *
 * Pins are sourced from tools/registry/tool-version-pins.json (created
 * if missing with sane defaults). CI invokes this validator before any
 * other Step 5/6 check.
 *
 * Usage:
 *   node tools/scripts/validate-tool-versions.mjs
 *   node tools/scripts/validate-tool-versions.mjs --json
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Reporter } from "./_lib/reporter.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const PINS_PATH = path.join(ROOT, "tools/registry/tool-version-pins.json");

const DEFAULT_PINS = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  description:
    "Minimum tool versions required by the APEX Step 5 validate gate and Step 6 deploy. Bump pins via PR with rationale.",
  pins: {
    bicep: { min: "0.21.0", check_cmd: "bicep --version", parser: "bicep" },
    terraform: { min: "1.6.0", check_cmd: "terraform version -json", parser: "terraform-json" },
    az: { min: "2.55.0", check_cmd: "az version --output json", parser: "az-json" },
    node: { min: "20.0.0", check_cmd: "node --version", parser: "node" },
  },
};

function ensureDefaultPins() {
  if (fs.existsSync(PINS_PATH)) return;
  fs.mkdirSync(path.dirname(PINS_PATH), { recursive: true });
  fs.writeFileSync(PINS_PATH, `${JSON.stringify(DEFAULT_PINS, null, 2)}\n`);
}

function parseSemver(s) {
  const m = s.match(/(\d+)\.(\d+)\.(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

function semverCompare(a, b) {
  for (let i = 0; i < 3; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

function runVersion(cmd, parser) {
  let out;
  try {
    out = execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] }).toString();
  } catch (err) {
    return { ok: false, error: err.message.split("\n")[0] };
  }
  if (parser === "bicep") {
    const m = out.match(/Bicep CLI version[\s:]*(\d+\.\d+\.\d+)/i);
    return m ? { ok: true, version: m[1] } : { ok: false, error: `cannot parse: ${out.slice(0, 80)}` };
  }
  if (parser === "terraform-json") {
    try {
      const j = JSON.parse(out);
      return { ok: true, version: j.terraform_version };
    } catch (_e) {
      return { ok: false, error: "cannot parse terraform JSON" };
    }
  }
  if (parser === "az-json") {
    try {
      const j = JSON.parse(out);
      return { ok: true, version: j["azure-cli"] };
    } catch (_e) {
      return { ok: false, error: "cannot parse az JSON" };
    }
  }
  if (parser === "node") {
    const m = out.match(/v(\d+\.\d+\.\d+)/);
    return m ? { ok: true, version: m[1] } : { ok: false, error: out.slice(0, 80) };
  }
  return { ok: false, error: `unknown parser: ${parser}` };
}

function main() {
  const r = new Reporter("Tool Version Pin Validator");
  r.header();
  ensureDefaultPins();
  const json = process.argv.includes("--json");
  const pins = JSON.parse(fs.readFileSync(PINS_PATH, "utf-8")).pins ?? {};
  const findings = [];

  for (const [name, spec] of Object.entries(pins)) {
    r.tick();
    const result = runVersion(spec.check_cmd, spec.parser);
    if (!result.ok) {
      if (spec.optional) {
        r.warn(name, `command failed (optional): ${result.error}`);
        findings.push({ tool: name, status: "missing-optional", message: result.error });
      } else {
        r.error(name, `command failed: ${result.error}`);
        findings.push({ tool: name, status: "missing", message: result.error });
      }
      continue;
    }
    const got = parseSemver(result.version);
    const min = parseSemver(spec.min);
    if (!got || !min) {
      r.error(name, `cannot parse version "${result.version}" or pin "${spec.min}"`);
      findings.push({ tool: name, status: "unparseable", version: result.version });
      continue;
    }
    if (semverCompare(got, min) < 0) {
      r.error(name, `version ${result.version} < required min ${spec.min}`);
      findings.push({
        tool: name,
        status: "below-pin",
        version: result.version,
        min: spec.min,
      });
    } else {
      r.ok(name, `${result.version} (min ${spec.min})`);
      findings.push({ tool: name, status: "ok", version: result.version, min: spec.min });
    }
  }

  if (json) {
    console.log(JSON.stringify({ findings, errors: r.errors, warnings: r.warnings }, null, 2));
  }
  r.summary();
  r.exitOnError("Tool versions satisfy pins");
}

main();
