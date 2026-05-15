# Budget — manual-identity fixture

Workload with `decisions.identity_resolution = "manual"` — exercises the
04-environment-manifest.json path where the user fills in
`deployer_object_id` and `existing_app_*_object_ids` before deploy.

- **Monthly budget (USD)**: 150
- **Forecast alerts**: 80%, 100%, 120%
- **Anomaly detection**: enabled
- **Owner contact**: `platform-team@example.local`

Resources: App Service Plan B1, Linux Web App, Key Vault, Log
Analytics workspace, single UAMI bound to the web app. Used by
identity-resolution.md compliance tests.
