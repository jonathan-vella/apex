---
description: "IaC planning best practices for implementation plans. Policy compliance, cost monitoring, repeatability."
applyTo: "**/04-implementation-plan.md"
---

# IaC Planning Best Practices

These rules apply when generating or reviewing implementation plans,
regardless of whether the target IaC track is Bicep or Terraform.

## Policy Compliance

Azure Policy always wins. Cross-reference `04-governance-constraints.md`
and `04-governance-constraints.json` before writing the plan.
Tags come from governance constraints, not hardcoded defaults.
See `references/iac-policy-compliance.md` for the full compliance checklist.

## Cost Monitoring

Every implementation plan includes budget resources with forecast alerts
at 80%, 100%, and 120% thresholds plus anomaly detection.
See `references/iac-cost-monitoring.md` for required resources.

## Repeatability

Generated templates deploy to any tenant, region, subscription, or
customer without source code modification. Zero hardcoded project-specific
values. `projectName`/`project_name` parameter has no default.

## Diagram Artifacts

If the plan references a `.png` diagram (e.g. `04-dependency-diagram.png`,
`04-runtime-diagram.png`), the corresponding `.py` source MUST exist
**and** the `.png` MUST be rendered from it before `apex-recall
complete-step 4`. Do not defer rendering to Step 5 — `validate-artifacts.mjs`
hard-fails on dangling references. Render with:

```bash
for py in agent-output/<project>/04-*-diagram.py; do
  [ -f "${py%.py}.png" ] || python3 "$py"
done
```

## Cross-References

- Policy compliance: `references/iac-policy-compliance.md`
- Security baseline: `references/iac-security-baseline.md`
- Cost monitoring: `references/iac-cost-monitoring.md`
- Governance discovery: `.github/instructions/governance-discovery.instructions.md`
