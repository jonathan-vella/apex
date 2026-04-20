#!/usr/bin/env node
/**
 * Governance Phase Trace Validator
 *
 * Parses a Copilot debug log (OTLP JSON) and checks that the governance
 * phase followed the expected pattern:
 *   1. The parent (04g-Governance) invoked
 *      `.github/skills/azure-governance-discovery/scripts/discover.py`
 *      via run_in_terminal (the deterministic discovery script)
 *   2. No follow-up execution_subagent calls re-queried Azure Policy APIs
 *   3. The parent did not run inline az rest / Python REST scripts
 *   4. No execution_subagent calls were used for validation work
 *
 * Usage:
 *   node scripts/validate-governance-trace.mjs <debug-log.json>
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks failed
 *   2 — invalid input (missing file, bad JSON)
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const r = new Reporter("Governance Phase Trace Validator");
r.header();

const logPath = process.argv[2];
if (!logPath || !fs.existsSync(logPath)) {
  console.error(
    "Usage: node scripts/validate-governance-trace.mjs <debug-log.json>",
  );
  process.exit(2);
}

let data;
try {
  data = JSON.parse(fs.readFileSync(logPath, "utf-8"));
} catch {
  console.error(`Failed to parse ${logPath} as JSON`);
  process.exit(2);
}

// Extract all spans from OTLP format
const spans = [];
for (const rs of data.resourceSpans || []) {
  for (const ss of rs.scopeSpans || []) {
    for (const span of ss.spans || []) {
      const attrs = {};
      for (const a of span.attributes || []) {
        const v = a.value || {};
        attrs[a.key] = v.stringValue || v.intValue || v.boolValue || null;
      }
      spans.push({
        name: span.name,
        startNs: BigInt(span.startTimeUnixNano || "0"),
        endNs: BigInt(span.endTimeUnixNano || "0"),
        attrs,
      });
    }
  }
}

r.tick();

// Check 1: Did 04g-Governance invoke discover.py via run_in_terminal?
const DISCOVER_MARKER = "azure-governance-discovery/scripts/discover.py";
const discoverInvocations = spans.filter((s) => {
  if (s.attrs["gen_ai.tool.name"] !== "run_in_terminal") return false;
  const args = s.attrs["gen_ai.tool.call.arguments"] || "";
  return args.includes(DISCOVER_MARKER);
});

if (discoverInvocations.length > 0) {
  r.ok?.(
    "discovery",
    `discover.py invoked ${discoverInvocations.length} time(s)`,
  );
  console.log(`  ✅ discover.py invoked ${discoverInvocations.length} time(s)`);
} else {
  const govSpans = spans.filter(
    (s) => s.attrs["gen_ai.agent.name"] === "04g-Governance",
  );
  if (govSpans.length === 0) {
    r.warn(
      "discovery",
      "No 04g-Governance spans found in trace — governance phase may not have run",
    );
  } else {
    r.error(
      "discovery",
      "04g-Governance ran but discover.py was NEVER invoked — agent bypassed the deterministic discovery path",
    );
  }
}

// Check 2: No follow-up execution_subagent calls for Azure REST re-queries
const azureReQueryPatterns = [
  "Azure Policy",
  "policy assignment",
  "policyAssignments",
  "policyDefinitions",
  "az rest",
  "REST discovery",
];

const reQuerySubagents = spans.filter((s) => {
  if (s.name !== "runSubagent") return false;
  const args = s.attrs["gen_ai.tool.call.arguments"] || "";
  if (args.includes("challenger-review-subagent")) return false;
  return azureReQueryPatterns.some((p) =>
    args.toLowerCase().includes(p.toLowerCase()),
  );
});

r.tick();
if (reQuerySubagents.length === 0) {
  console.log("  ✅ No follow-up Azure Policy re-query subagents detected");
} else {
  r.error(
    "re-query",
    `${reQuerySubagents.length} follow-up subagent call(s) re-queried Azure Policy APIs after initial discovery`,
  );
}

// Check 3: No inline az rest in the parent agent (discover.py wraps all REST work)
const inlineRestCalls = spans.filter((s) => {
  const args = s.attrs["gen_ai.tool.call.arguments"] || "";
  if (args.includes(DISCOVER_MARKER)) return false; // discover.py is the sanctioned path
  return (
    (s.attrs["gen_ai.tool.name"] === "run_in_terminal" ||
      s.attrs["gen_ai.tool.name"] === "execution_subagent") &&
    args.includes("az rest")
  );
});

r.tick();
if (inlineRestCalls.length === 0) {
  console.log("  ✅ No inline az rest calls outside discover.py");
} else {
  r.error(
    "inline-rest",
    `${inlineRestCalls.length} inline az rest call(s) detected outside discover.py — agent is bypassing the sanctioned discovery script`,
  );
}

// Check 4: No execution_subagent calls used for validation work.
// Validation commands (lint, JSON parse, AJV) must run directly in terminal;
// each execution_subagent call adds 60-170s of overhead.
const validationPattern = /lint:|json\.tool|ajv|re-?validate|validation/i;
const validationSubagents = spans.filter((s) => {
  if (
    s.name !== "execution_subagent" &&
    s.attrs["gen_ai.tool.name"] !== "execution_subagent"
  )
    return false;
  const args = s.attrs["gen_ai.tool.call.arguments"] || "";
  return validationPattern.test(args);
});

r.tick();
if (validationSubagents.length === 0) {
  console.log("  ✅ No execution_subagent calls used for validation work");
} else {
  r.error(
    "validation-via-subagent",
    `${validationSubagents.length} execution_subagent call(s) used for validation — run lint/JSON/AJV checks directly in terminal instead`,
  );
}

r.summary();
r.exitOnError("Governance trace validation passed");
