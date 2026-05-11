#!/usr/bin/env node
/**
 * Governance Phase Trace Validator
 *
 * Two modes:
 *
 * 1. **Debug-log mode** (default) — parses a Copilot debug log (OTLP JSON)
 *    and checks that the governance phase followed the expected pattern:
 *      1. The parent (04g-Governance) invoked
 *         `.github/skills/azure-governance-discovery/scripts/discover.py`
 *         via run_in_terminal (the deterministic discovery script)
 *      2. No follow-up execution_subagent calls re-queried Azure Policy APIs
 *      3. The parent did not run inline az rest / Python REST scripts
 *      4. No execution_subagent calls were used for validation work
 *
 * 2. **Attestation-chain mode** (`--project <name>`) — enforces the
 *    L0 → L1 → L2 → L3 governance attestation chain before
 *    `complete-step 6`. Specifically:
 *      L0: `04-governance-constraints.json.discovery_metadata` present,
 *          status == COMPLETE, age <= ttl_days.
 *      L1: `04-implementation-plan.md` contains a Governance Compliance
 *          Matrix H2 section; every row has status \"✅ satisfied\".
 *      L2: A validator summary artifact exists with no governance
 *          mismatches (read from validate-subagent output, written by
 *          06b/06t CodeGen agents).
 *      L3: `apex-recall show <project>` records a `governance_trace`
 *          decision at step 6.
 *
 * Usage:
 *   node tools/scripts/validate-governance-trace.mjs <debug-log.json>
 *   node tools/scripts/validate-governance-trace.mjs --project <slug> [--allow-legacy]
 *
 * Exit codes:
 *   0 — all checks pass
 *   1 — one or more checks failed
 *   2 — invalid input (missing file, bad JSON)
 */

import fs from "node:fs";
import path from "node:path";
import { Reporter } from "./_lib/reporter.mjs";

const args = process.argv.slice(2);
const projectIdx = args.indexOf("--project");
const allowLegacy = args.includes("--allow-legacy");

if (projectIdx !== -1) {
  // Attestation-chain mode.
  const project = args[projectIdx + 1];
  if (!project) {
    console.error("Usage: node tools/scripts/validate-governance-trace.mjs --project <slug> [--allow-legacy]");
    process.exit(2);
  }
  process.exit(runAttestationChain(project, allowLegacy));
}

const r = new Reporter("Governance Phase Trace Validator");
r.header();

const logPath = args[0];
if (!logPath || !fs.existsSync(logPath)) {
  console.error("Usage: node tools/scripts/validate-governance-trace.mjs <debug-log.json>");
  console.error("       node tools/scripts/validate-governance-trace.mjs --project <slug> [--allow-legacy]");
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
  r.ok?.("discovery", `discover.py invoked ${discoverInvocations.length} time(s)`);
  console.log(`  ✅ discover.py invoked ${discoverInvocations.length} time(s)`);
} else {
  const govSpans = spans.filter((s) => s.attrs["gen_ai.agent.name"] === "04g-Governance");
  if (govSpans.length === 0) {
    r.warn("discovery", "No 04g-Governance spans found in trace — governance phase may not have run");
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
  return azureReQueryPatterns.some((p) => args.toLowerCase().includes(p.toLowerCase()));
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
    (s.attrs["gen_ai.tool.name"] === "run_in_terminal" || s.attrs["gen_ai.tool.name"] === "execution_subagent") &&
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
  if (s.name !== "execution_subagent" && s.attrs["gen_ai.tool.name"] !== "execution_subagent") return false;
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

// ============================================================================
// Attestation-chain mode (--project <slug>)
// ============================================================================

function runAttestationChain(project, allowLegacy) {
  const reporter = new Reporter(`L0→L3 Attestation Chain (${project})`);
  reporter.header();

  const root = process.cwd();
  const constraintsPath = path.join(root, "agent-output", project, "04-governance-constraints.json");
  const planPath = path.join(root, "agent-output", project, "04-implementation-plan.md");
  const validatorSummaryCandidates = [
    path.join(root, "agent-output", project, "05-implementation-reference.md"),
    path.join(root, "agent-output", project, "06-policy-precheck.json"),
  ];
  const sessionStatePath = path.join(root, "agent-output", project, "00-session-state.json");

  if (!fs.existsSync(constraintsPath)) {
    if (allowLegacy) {
      console.log(`ℹ️  ${constraintsPath} missing — skipping (--allow-legacy)`);
      return 0;
    }
    reporter.error("L0", `Missing ${constraintsPath} — L0 envelope cannot be checked`);
    reporter.summary();
    return 1;
  }

  // L0 — envelope present, COMPLETE, fresh.
  let constraints;
  try {
    constraints = JSON.parse(fs.readFileSync(constraintsPath, "utf-8"));
  } catch (err) {
    reporter.error("L0", `Cannot parse ${constraintsPath}: ${err.message}`);
    reporter.summary();
    return 1;
  }
  const envelope = constraints.discovery_metadata;
  if (!envelope) {
    if (allowLegacy) {
      console.log("ℹ️  discovery_metadata absent — skipping L0 (--allow-legacy)");
    } else {
      reporter.error("L0", "discovery_metadata envelope absent (run discover.py --refresh to emit it)");
    }
  } else {
    if (envelope.discovery_status !== "COMPLETE") {
      reporter.error("L0", `discovery_status = ${envelope.discovery_status} (expected COMPLETE)`);
    } else {
      console.log(`  ✅ L0 discovery_status=COMPLETE`);
    }
    const ageDays = (Date.now() - new Date(envelope.discovered_at).getTime()) / 86_400_000;
    if (Number.isFinite(ageDays) && ageDays > (envelope.ttl_days ?? 7)) {
      reporter.error("L0", `envelope age ${ageDays.toFixed(1)}d > ttl_days ${envelope.ttl_days}`);
    } else {
      console.log(`  ✅ L0 envelope age ${ageDays.toFixed(1)}d <= ttl ${envelope.ttl_days}d`);
    }
    if (!envelope.completeness_signature || !/^sha256:[0-9a-f]{64}$/.test(envelope.completeness_signature)) {
      reporter.error("L0", "completeness_signature missing or malformed");
    }
  }
  reporter.tick();

  // L1 — Governance Compliance Matrix in plan, every row satisfied.
  if (!fs.existsSync(planPath)) {
    if (allowLegacy) {
      console.log(`ℹ️  ${planPath} missing — skipping L1 (--allow-legacy)`);
    } else {
      reporter.error("L1", `Missing ${planPath}`);
    }
  } else {
    const plan = fs.readFileSync(planPath, "utf-8");
    const matrixMatch = plan.match(/## 🛡️ Governance Compliance Matrix([\s\S]*?)(?:\n## |$)/);
    if (!matrixMatch) {
      if (allowLegacy) {
        console.log("ℹ️  Governance Compliance Matrix H2 absent — skipping L1 (--allow-legacy)");
      } else {
        reporter.error("L1", "Governance Compliance Matrix H2 absent from 04-implementation-plan.md");
      }
    } else {
      const section = matrixMatch[1];
      const tableRows = section
        .split(/\r?\n/)
        .filter(
          (line) =>
            line.startsWith("| ") &&
            !line.includes("---") &&
            !/Resource ID/i.test(line) &&
            !/satisfied_by_property/i.test(line),
        );
      if (tableRows.length === 0) {
        if (allowLegacy) {
          console.log("ℹ️  Matrix section present but empty — skipping L1 (--allow-legacy)");
        } else {
          reporter.error("L1", "Matrix section present but contains zero rows");
        }
      } else {
        const unsatisfied = tableRows.filter((r2) => !/✅\s*satisfied/.test(r2));
        if (unsatisfied.length > 0) {
          if (allowLegacy) {
            console.log(`ℹ️  ${unsatisfied.length} matrix row(s) not satisfied — skipping L1 (--allow-legacy)`);
          } else {
            reporter.error("L1", `${unsatisfied.length} matrix row(s) not satisfied`);
          }
        } else {
          console.log(`  ✅ L1 matrix: ${tableRows.length} rows all satisfied`);
        }
      }
    }
  }
  reporter.tick();

  // L2 — validator output recorded (look for matrix verdict in 05-implementation-reference.md
  // or a 06-policy-precheck.json that shows zero mismatches).
  let l2Recorded = false;
  for (const candidate of validatorSummaryCandidates) {
    if (!fs.existsSync(candidate)) continue;
    if (candidate.endsWith(".md")) {
      const txt = fs.readFileSync(candidate, "utf-8");
      if (/Governance.*L2 attestation/i.test(txt) && /Mismatched:\s*0/i.test(txt)) {
        l2Recorded = true;
        break;
      }
    } else if (candidate.endsWith(".json")) {
      try {
        const p = JSON.parse(fs.readFileSync(candidate, "utf-8"));
        if (p?.status === "CLEAN") {
          l2Recorded = true;
          break;
        }
      } catch {
        /* ignore */
      }
    }
  }
  if (!l2Recorded) {
    if (allowLegacy) {
      console.log("ℹ️  No L2 attestation found — skipping (--allow-legacy)");
    } else {
      reporter.error(
        "L2",
        "No validate-subagent governance attestation found (expected in 05-implementation-reference.md or 06-policy-precheck.json)",
      );
    }
  } else {
    console.log("  ✅ L2 validator output recorded with zero governance mismatches");
  }
  reporter.tick();

  // L3 — apex-recall governance_trace decision at step 6.
  // Fallback: read 00-session-state.json directly when apex-recall CLI is not available.
  let l3Recorded = false;
  if (fs.existsSync(sessionStatePath)) {
    try {
      const state = JSON.parse(fs.readFileSync(sessionStatePath, "utf-8"));
      const decisions = state?.decisions ?? state?.session?.decisions ?? {};
      const decisionLog = state?.decision_log ?? state?.session?.decision_log ?? [];
      const hasKey =
        Object.prototype.hasOwnProperty.call(decisions, "governance_trace") ||
        (Array.isArray(decisionLog) &&
          decisionLog.some((d) => d?.key === "governance_trace" && (d?.step === 6 || d?.step === "6")));
      l3Recorded = Boolean(hasKey);
    } catch {
      /* ignore */
    }
  }
  if (!l3Recorded) {
    if (allowLegacy) {
      console.log("ℹ️  No L3 governance_trace decision found — skipping (--allow-legacy)");
    } else {
      reporter.error(
        "L3",
        "decisions.governance_trace not recorded at step 6 (Deploy agent must emit `apex-recall decide --key governance_trace ...` before complete-step 6)",
      );
    }
  } else {
    console.log("  ✅ L3 governance_trace decision recorded at step 6");
  }
  reporter.tick();

  reporter.summary();
  return reporter.errors > 0 ? 1 : 0;
}
