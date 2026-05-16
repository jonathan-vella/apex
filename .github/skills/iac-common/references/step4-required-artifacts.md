<!-- ref:step4-required-artifacts-v1 -->

# Step 4 Required-Artifacts Presence Check

**Owner**: `05-IaC Planner` (Phase 5 attestation block)
**Enforced by**: planner agent body + (advisory) per-artifact validators
**Failure mode**: Step 5 (CodeGen) consumes stale or missing inputs; downstream `validate-iac-handoff`, `validate-policy-property-map`, and `validate-governance-trace` fall over.

## Why

Step 3.5 (Governance) and Step 4 (Planning) each write multiple artifacts, but `apex-recall complete-step 4` does not itself check that the files landed on disk. The nordic project shipped a Step 5 handoff whose `l1m_ref` and diagram references pointed to files that had been lost between sessions — validators warned-but-passed at the time, and the gap surfaced only at Step 6 when the deploy precheck needed them.

This contract makes the presence check mandatory and explicit.

## Required Files

Before `apex-recall complete-step <project> 4 --json`, every file below MUST exist on disk under `agent-output/<project>/`. If any is missing, BLOCK and remediate per the third column.

| Artifact                          | Source phase  | Remediation                                                              |
| --------------------------------- | ------------- | ------------------------------------------------------------------------ |
| `04-implementation-plan.md`       | Phase 4       | Re-run plan generation                                                   |
| `04-iac-contract.json`            | Phase 4       | Re-run contract emission                                                 |
| `04-policy-property-map.json`     | Phase 4       | Re-run L1m emission                                                      |
| `04-governance-constraints.json`  | Step 3.5      | Traverse `▶ Refresh Governance` handoff to `04g-Governance`              |
| `04-governance-constraints.md`    | Step 3.5      | Traverse `▶ Refresh Governance` handoff to `04g-Governance`              |
| `04-dependency-diagram.png`       | Phase 4       | `python3 agent-output/<project>/04-dependency-diagram.py` (renders PNG)  |
| `04-runtime-diagram.png`          | Phase 4       | `python3 agent-output/<project>/04-runtime-diagram.py` (renders PNG)     |

## Diagram-rendering rule

If a `.py` diagram source exists but its `.png` sibling does not, render it **before** completing the step. Do not defer to Step 5 — the plan references the PNG and `validate-artifacts.mjs` will hard-fail on the dangling reference.

```bash
for py in agent-output/<project>/04-*-diagram.py; do
  [ -f "${py%.py}.png" ] || python3 "$py"
done
```

## How to verify

```bash
project=<project>
missing=0
for f in 04-implementation-plan.md 04-iac-contract.json 04-policy-property-map.json \
         04-governance-constraints.json 04-governance-constraints.md \
         04-dependency-diagram.png 04-runtime-diagram.png; do
  [ -f "agent-output/$project/$f" ] || { echo "MISSING: $f"; missing=1; }
done
[ $missing -eq 0 ] && echo "all required Step 4 artifacts present"
```

## Failure example (nordic, May 2026)

Session state moved `step_4` to complete despite missing `04-governance-constraints.{json,md}` and both `.png` diagrams. `validate-iac-handoff` and `validate-policy-property-map` warned-and-skipped on the missing files (subsequently hardened to hard-fail). Recovery required re-running governance discovery and re-rendering both diagrams from `.py` sources.
