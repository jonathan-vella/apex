# 📝 E2E RALPH Loop — Lessons Learned Narrative

## Contoso Service Hub (Run 2)

**Date**: 2026-03-17 | **Benchmark**: 83/100 (B) | **Status**: E2E_COMPLETE

---

## Executive Summary

The E2E RALPH loop completed all 7 steps for the Contoso Service Hub complex project (15 Azure services, 3 environments, GDPR compliance). **9 lessons** were captured across 5 steps, with a **100% self-correction rate** — every issue identified by challengers or validators was fixed within the same session.

**Top systemic issue**: **Factual accuracy** (7 of 9 lessons). Agents consistently produced plausible-sounding but technically incorrect claims about Azure service capabilities, particularly around:

- APIM Standard v2 VNet networking model
- Redis memory reservation calculations
- Azure Front Door EU Data Boundary status
- PostgreSQL authentication defaults

**Self-correction rate**: 9/9 (100%) — all issues were caught by challenger reviews and fixed before progressing.

---

## Per-Step Findings

### Step 1: Requirements (1 lesson)

- **LL-001** (HIGH): GDPR residency gaps for non-regional Azure services. Requirements agent mapped all 15 services but did not cross-reference Microsoft EU Data Boundary documentation for global services (Front Door, Entra). Fixed by adding explicit non-regional service validation requirement.

### Step 2: Architecture (3 lessons)

- **LL-002** (HIGH): Front Door EU Data Boundary claim overstated. Architect stated Front Door Premium was "EU Data Boundary validated" when Microsoft explicitly excludes it. Fixed by marking as compliance exception requiring legal approval.
- **LL-003** (HIGH): Redis M150 usable capacity overstated. Architect claimed 150 GB raw = 128 GB usable, but ~20% memory reservation yields only ~120 GB usable. Upgraded to M200.
- **LL-004** (MEDIUM): Scalability math error. 2M transactions/month was calculated as 77 RPS instead of 0.77 RPS (forgot to divide by 3600).

### Step 4: IaC Plan (2 lessons)

- **LL-005** (HIGH): APIM Standard v2 does not support Internal VNet injection. Plan used `virtualNetworkType: Internal` which only applies to Developer/Premium tiers.
- **LL-006** (MEDIUM): PostgreSQL PE vs delegated subnet inconsistency. Module dependency table listed PE but task narrative correctly described delegated subnet.

### Step 5: IaC Code (3 lessons)

- **LL-007** (CRITICAL): PostgreSQL password-only auth violates security baseline. CodeGen set `activeDirectoryAuth: Disabled` when AAD should be enabled.
- **LL-008** (HIGH): APIM raw resource used Classic VNet injection model (`virtualNetworkType: External`) instead of Standard v2 `virtualNetworkIntegration`.
- **LL-009** (HIGH): Front Door `privateLinkLocation` inherited profile location (`global`) instead of target resource region (`swedencentral`).

### Steps 3, 3.5, 6, 7: No issues

Design, Governance, Deploy (dry-run), and As-Built steps completed without self-correction needed.

---

## Agent Improvement Recommendations

| Priority     | Agent             | Recommendation                                                                                                   | File Path                                   |
| ------------ | ----------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| 1 (CRITICAL) | 06b-Bicep CodeGen | Always set `activeDirectoryAuth: Enabled` as default for PostgreSQL. Never use password-only auth.               | `.github/agents/06b-Bicep CodeGen.agent.md` |
| 2 (HIGH)     | 03-Architect      | Check Microsoft EU Data Boundary service exclusion list. Flag excluded services as compliance blockers.          | `.github/agents/03-Architect.agent.md`      |
| 3 (HIGH)     | 06b-Bicep CodeGen | Always use AVM modules for APIM. The AVM module surfaces correct tier-specific properties.                       | `.github/agents/06b-Bicep CodeGen.agent.md` |
| 4 (HIGH)     | 06b-Bicep CodeGen | Front Door modules must use separate params: `location` (profile) and `resourceLocation` (Private Link targets). | `.github/agents/06b-Bicep CodeGen.agent.md` |
| 5 (HIGH)     | 03-Architect      | Apply memory reservation factors (~20%) when sizing cache services.                                              | `.github/agents/03-Architect.agent.md`      |
| 6 (HIGH)     | 05b-Bicep Planner | Validate APIM networking model against the selected SKU tier capabilities.                                       | `.github/agents/05b-Bicep Planner.agent.md` |

---

## Factual Accuracy Issues

| ID     | Category         | Service                  | Hallucination                  | Correct Value                                      |
| ------ | ---------------- | ------------------------ | ------------------------------ | -------------------------------------------------- |
| LL-002 | EU Data Boundary | Azure Front Door         | "EU Data Boundary validated"   | Explicitly excluded from EU Data Boundary          |
| LL-003 | Capacity         | Azure Managed Redis M150 | "150 GB = 128 GB usable"       | ~120 GB usable after 20% reservation               |
| LL-004 | Calculation      | Scalability              | "2M tx/month = 77 RPS"         | 0.77 RPS average                                   |
| LL-005 | API surface      | APIM Standard v2         | "virtualNetworkType: Internal" | Uses PE + VNet integration, not Internal injection |
| LL-008 | API surface      | APIM Standard v2         | "virtualNetworkType: External" | Uses virtualNetworkIntegration property            |

---

## Validator Coverage Gaps

No validator coverage gaps identified. All must-fix issues were caught by challenger subagents (not missed by validators). The challenger review model prove effective for catching factual accuracy issues that static validators cannot detect.

---

## Benchmark Scores

| Dimension               | Score      | Grade |
| ----------------------- | ---------- | ----- |
| Artifact Completeness   | 71/100     | C     |
| Structural Compliance   | 100/100    | A     |
| Code Quality            | 80/100     | B     |
| Review Thoroughness     | 83/100     | B     |
| WAF Coverage            | 100/100    | A     |
| Cost Accuracy           | 80/100     | B     |
| Session State Integrity | 100/100    | A     |
| Timing Performance      | 50/100     | D     |
| **Composite**           | **83/100** | **B** |

---

## Iteration Summary

| Step             | Iterations | Self-Corrected | Category                           |
| ---------------- | ---------- | -------------- | ---------------------------------- |
| 1 (Requirements) | 2          | 1 fix          | artifact-quality                   |
| 2 (Architecture) | 2          | 3 fixes        | factual-accuracy                   |
| 3 (Design)       | 1          | 0              | —                                  |
| 3.5 (Governance) | 1          | 0              | —                                  |
| 4 (IaC Plan)     | 2          | 2 fixes        | factual-accuracy, artifact-quality |
| 5 (IaC Code)     | 2          | 6 fixes        | factual-accuracy (critical)        |
| 6 (Deploy)       | 1          | 0              | —                                  |
| 7 (As-Built)     | 1          | 0              | —                                  |
| **Total**        | **12**     | **12 fixes**   | —                                  |

**Total iterations**: 12 (well within 40 max)
**Self-correction rate**: 100%
**Steps requiring correction**: 4 of 8

---

_Generated by E2E RALPH Loop Conductor | 2026-03-17_
