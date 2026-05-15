# Budget — hub-spoke-complex fixture

Hub-spoke topology with private endpoints, exercises the `complex` tier
in `workflow-graph.json#metadata.complexity_routing.tiers` and
`decisions.deployment_strategy = "phased"`.

- **Monthly budget (USD)**: 1200
- **Forecast alerts**: 80%, 100%, 120%
- **Anomaly detection**: enabled
- **Owner contact**: `platform-team@example.local`

Resources: hub VNet with Azure Firewall + Bastion, two spoke VNets,
private DNS zones, Key Vault, Storage with private endpoint, App Service
with VNet integration, Log Analytics. Used by phased-deployment +
network-topology contract emission tests.
