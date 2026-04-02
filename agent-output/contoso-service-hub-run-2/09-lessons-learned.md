# 📝 Lessons Learned — Contoso Service Hub (Run 2)

> Refreshed after E2E repair and benchmark rerun | 2026-04-02

---

## 📊 Benchmark Summary

| Dimension | Score | Grade |
| --- | --- | --- |
| Artifact Completeness | 63/100 | D |
| Structural Compliance | 100/100 | A |
| Code Quality | 80/100 | B |
| Review Thoroughness | 100/100 | A |
| WAF Coverage | 100/100 | A |
| Cost Accuracy | 80/100 | B |
| Session State Integrity | 100/100 | A |
| Timing Performance | 100/100 | A |
| **Composite** | **88/100** | **B** |

**Verdict**: PASS (threshold: 60)

---

## ✅ Strengths

- All mandatory E2E steps now validate successfully after the repair cycle.
- Challenger reviews exist for the critical steps and no must-fix findings remain.
- Live Azure Policy discovery replaced the earlier template-only governance baseline.
- The Bicep package now aligns with the live 9-tag governance contract and cumulative deployment phases.
- The deployment summary is explicit about local-only validation evidence and no longer overstates Azure-side preview coverage.

---

## 📈 Improvement Areas

| # | Area | Impact | Effort |
| --- | --- | --- | --- |
| 1 | Add drawio diagram artifacts alongside the Python diagram sources and PNG renders | Benchmark score uplift | Medium |
| 2 | Capture a real Azure `what-if` preview | Deployment-readiness evidence | Medium |
| 3 | Parameterize customer-specific naming and certificate defaults | Template portability | Medium |
| 4 | Replace the raw Key Vault certificate child resource when a typed module becomes available | Cleaner Bicep diagnostics | Low |

---

## 🔑 Key Lessons

### LL-001: Drawio Benchmark Gap

The repaired run is functionally strong, but the benchmark still penalizes missing `drawio` artifacts for the Step 4 diagrams. The existing Python sources and PNG renders are sufficient for human review, but not for the current completeness rubric.

### LL-002: Raw Key Vault Certificate Warning

Moving the Application Gateway certificate flow into the template removed a real deployment blocker. The remaining tradeoff is a non-blocking `BCP081` warning because Bicep does not currently ship full type metadata for `Microsoft.KeyVault/vaults/certificates`.

### LL-003: Provider-Side Preview Still Missing

The deployment summary is now honest and structurally correct, but a real Azure `what-if` output is still absent. That means provider-side create/modify counts and policy side effects remain unverified.

### LL-004: Template Portability Gap

The repaired Bicep is accurate for Contoso, but some workload naming and certificate defaults remain customer-specific. If this package is reused beyond the Contoso scenario, those defaults should move fully into parameter-file inputs.

---

## References

- [08-benchmark-scores.json](08-benchmark-scores.json)
- [08-benchmark-report.md](08-benchmark-report.md)
- [00-session-state.json](00-session-state.json)
