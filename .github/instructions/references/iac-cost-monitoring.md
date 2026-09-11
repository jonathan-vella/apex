# IaC Cost Monitoring

Every IaC plan must include cost monitoring unless governance records an
allowed exception. Governance constraints in `04-governance-constraints.json`
always override repository defaults.

The complete contract has one canonical owner:

- [Cost monitoring baseline](../../skills/apex-azure-defaults/references/cost-alerts-baseline.md)
  covers notifications, scopes, AVM lookup, Action Group routing, anomaly
  detection, modes, and governance precedence.

Use the stack-specific implementation reference when generating code:

- [Bicep implementation](../../skills/apex-azure-defaults/references/cost-alerts-bicep.md)
- [Terraform implementation](../../skills/apex-azure-defaults/references/cost-alerts-terraform.md)

Do not duplicate thresholds, resource matrices, or exception schemas here.
