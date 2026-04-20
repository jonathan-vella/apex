#!/usr/bin/env node
/**
 * Governance Phase Trace Validator
 *
 * Parses a Copilot debug log (OTLP JSON) and checks that the governance
 * phase followed the expected delegation pattern:
 *   1. The parent (04g-Governance) used #runSubagent to invoke
 *      governance-discovery-subagent
 *   2. No follow-up execution_subagent calls re-queried Azure Policy APIs
 *   3. The parent did not run inline az rest / Python REST scripts
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

// Check 1: Was governance-discovery-subagent invoked via runSubagent?
const govInvocations = spans.filter(
  (s) =>
    s.name === "runSubagent-governance-discovery-subagent" ||
    (s.name === "runSubagent" &&
      (s.attrs["gen_ai.tool.call.arguments"] || "").includes(
        "governance-discovery-subagent",
      )),
);

if (govInvocations.length > 0) {
  r.ok?.(
    "delegation",
    `governance-discovery-subagent invoked ${govInvocations.length} time(s)`,
  );
  console.log(
    `  ✅ governance-discovery-subagent invoked ${govInvocations.length} time(s)`,
  );
} else {
  // Check if there's a 04g-Governance span at all
  const govSpans = spans.filter(
    (s) => s.attrs["gen_ai.agent.name"] === "04g-Governance",
  );
  if (govSpans.length === 0) {
    r.warn(
      "delegation",
      "No 04g-Governance spans found in trace — governance phase may not have run",
    );
  } else {
    r.error(
      "delegation",
      "04g-Governance ran but governance-discovery-subagent was NEVER invoked — delegation failed",
    );
  }
}

// Check 2: No follow-up execution_subagent calls for Azure REST re-queries
// Look for runSubagent spans that contain Azure Policy REST query keywords
// but are NOT the governance-discovery-subagent invocation
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
  if (args.includes("governance-discovery-subagent")) return false;
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

// Check 3: No inline az rest in the parent agent (outside subagent)
// Look for tool calls with "az rest" in their arguments that are NOT inside
// a governance-discovery-subagent span
const inlineRestCalls = spans.filter((s) => {
  const args = s.attrs["gen_ai.tool.call.arguments"] || "";
  return (
    (s.attrs["gen_ai.tool.name"] === "run_in_terminal" ||
      s.attrs["gen_ai.tool.name"] === "execution_subagent") &&
    args.includes("az rest")
  );
});

r.tick();
if (inlineRestCalls.length === 0) {
  console.log("  ✅ No inline az rest calls in parent agent context");
} else {
  // This may be acceptable in Phase 1.5 fallback, so warn not error
  r.warn(
    "inline-rest",
    `${inlineRestCalls.length} inline az rest call(s) found — verify these are in Phase 1.5 fallback path only`,
  );
}

// Check 4 (v2): Parent agent must NOT read the subagent file into context.
// Reading _subagents/governance-discovery-subagent.agent.md breaks context
// isolation and causes the model to run the subagent's internal script inline.
const subagentFileReads = spans.filter((s) => {
  if (s.attrs["gen_ai.tool.name"] !== "read_file") return false;
  const args = s.attrs["gen_ai.tool.call.arguments"] || "";
  return args.includes("_subagents/governance-discovery-subagent.agent.md");
});

r.tick();
if (subagentFileReads.length === 0) {
  console.log(
    "  ✅ Parent agent did not read governance-discovery-subagent.agent.md",
  );
} else {
  r.error(
    "subagent-file-read",
    `${subagentFileReads.length} read(s) of _subagents/governance-discovery-subagent.agent.md detected — parent is bypassing delegation by reading subagent body into context`,
  );
}

// Check 5 (v2): No execution_subagent calls used for validation work.
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
