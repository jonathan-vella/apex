<!-- ref:architect-validation-checklist-v1 -->

# Architect Validation Checklist

Load once before presenting the Step 2 Approval Gate. Every item must hold.

- [ ] All 5 WAF pillars scored with rationale and confidence level
- [ ] Service Maturity Assessment table included
- [ ] Cost estimate uses worker-verified MCP data or the documented direct-API evidence fallback, with truthful sources
- [ ] **Every dollar figure** in 02 and 03 artifacts traces back to `cost-estimate-subagent` response — no hardcoded prices
- [ ] Line-item totals sum correctly to reported monthly total
- [ ] H2 headings match apex-azure-artifacts templates exactly
- [ ] Region selection justified (default: swedencentral)
- [ ] AVM modules recommended where available
- [ ] No deprecated services recommended (checked against apex-azure-defaults Deprecated Services table)
- [ ] Service retirement timelines verified for any multi-year RI commitments
- [ ] Storage redundancy tier compatible with data residency requirements (no GRS with single-region GDPR)
- [ ] Global/non-regional services (Front Door, Entra, Traffic Manager) flagged for EU Data Boundary compliance
- [ ] SKU zone-redundancy capabilities verified for all services claiming AZ support
- [ ] A recorded owner decision that conflicts with the budget was asked about, not substituted
- [ ] No `*.tmp.md` or `FAILED` cost estimate remains in the project folder; superseded files are in `_meta/`

## WAF scoring table format

Illustrative structure only; compute every score and confidence from project evidence, never from examples.

```markdown
| WAF Pillar | Score | Confidence | Key Factor |
| --- | --- | --- | --- |
| {pillar} | {evidence-based score}/10 | {confidence} | {verified factor} |
```
