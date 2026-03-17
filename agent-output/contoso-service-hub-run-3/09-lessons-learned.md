# 09 — Lessons Learned

> **Project**: Contoso Service Hub (Run 3)
> **Generated**: 2026-03-17
> **Total Lessons**: 6

## Summary

Run 3 of the Contoso Service Hub E2E evaluation completed all 7 steps successfully with a benchmark score of **75/100 (C)**. The RALPH self-correction loop fired on 5 occasions, all resolved within 1 iteration. No steps were blocked.

### Lessons by Category

| Category         | Count | Severity                |
| ---------------- | ----- | ----------------------- |
| factual-accuracy | 1     | 1 high                  |
| agent-behavior   | 3     | 1 high, 1 medium, 1 low |
| validation-gap   | 2     | 2 medium                |

### Key Findings

#### LL-001: Azure AD B2C Deprecated (High — Step 2)

The Architect agent selected Azure AD B2C for CIAM on a 2026 greenfield project despite B2C being deprecated for new customers since May 2025. The challenger review caught this and the agent self-corrected to Microsoft Entra External ID.

**Recommendation**: Add B2C deprecation awareness to the azure-defaults skill.

#### LL-002: Blob GRS Contradicts GDPR Stance (High — Step 2)

The architecture specified GRS (geo-redundant storage) while simultaneously requiring no cross-region data replication for GDPR. GRS inherently replicates to a secondary region, violating the stated constraint.

**Recommendation**: Add governance cross-check in architect agent that validates storage redundancy tier against residency requirements.

#### LL-003: APIM Public Accessibility Gap (Medium — Step 2)

Front Door was designated as the sole public entry point, but the architecture didn't explicitly specify that APIM must be in internal VNet mode. This left a potential security bypass.

**Recommendation**: Require explicit VNet mode specification for each networked service.

#### LL-004: Decision Log Schema Mismatch (Medium — Step 1)

The Requirements agent generated decision_log entries with non-compliant field names and ID patterns. It used `DL-NNN` instead of `D001` format and `decision`/`alternatives_considered` instead of `title`/`choice`.

**Recommendation**: Include the exact required schema in the agent prompt or session-resume skill.

#### LL-005: Invalid Review Audit Keys (Medium — Step 1)

The agent added `step_3` and `step_7` keys to review_audit, which are not in the validator's allowed key set.

**Recommendation**: Document valid review_audit keys in the session state schema reference.

#### LL-006: AVM Budget Module Limitation (Low — Step 5)

The budget module used a native resource because the AVM budget module v0.1.0 cannot represent both actual and forecast thresholds simultaneously. This is a valid technical workaround.

**Recommendation**: Monitor AVM updates. Document the limitation in azure-bicep-patterns skill.

## RFP Gap Resolution Tracking

| Gap                   | Resolution                                      | Step  |
| --------------------- | ----------------------------------------------- | ----- |
| No explicit budget    | Estimated $9,280/mo from volumetrics            | 1 → 2 |
| Redis 128 GB sizing   | Premium P4 (53 GB) for MVP, upgrade path at 70% | 1 → 2 |
| AKS vs Container Apps | AKS Standard (RFP references Managed K8s)       | 1 → 2 |

## Benchmark Scores

| Dimension               | Score      | Grade |
| ----------------------- | ---------- | ----- |
| Artifact Completeness   | 67/100     | D     |
| Structural Compliance   | 100/100    | A     |
| Code Quality            | 80/100     | B     |
| Review Thoroughness     | 17/100     | F     |
| WAF Coverage            | 100/100    | A     |
| Cost Accuracy           | 80/100     | B     |
| Session State Integrity | 100/100    | A     |
| Timing Performance      | 50/100     | D     |
| **Composite**           | **75/100** | **C** |

### Areas for Improvement

1. **Review Thoroughness (F)**: Only 1 of 3 planned challenger passes was executed for complex steps. Future runs should complete all planned passes.
2. **Artifact Completeness (D)**: Some Step 3 and Step 4 supplementary artifacts may have inconsistent formatting.
3. **Timing Performance (D)**: Multiple subagent invocations add latency. Consider batching where possible.
