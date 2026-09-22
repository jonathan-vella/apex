---
title: "Security Baseline"
description: "Non-negotiable security requirements for IaC"
---

> Non-negotiable security requirements for all generated infrastructure code.

The security baseline is enforced by the `validate:iac-security-baseline` validator
(pre-commit hook + CI pipeline) and the `challenger-review-subagent` at adversarial
review gates. Violations block code generation and deployment.

## Rules

| #   | Rule                                   | Bicep Property                         | Terraform Argument                        | WAF Pillar |
| --- | -------------------------------------- | -------------------------------------- | ----------------------------------------- | ---------- |
| 1   | TLS 1.2 minimum                        | `minimumTlsVersion: 'TLS1_2'`          | `min_tls_version = "1.2"`                 | SE:07      |
| 2   | HTTPS-only traffic                     | `supportsHttpsTrafficOnly: true`       | `https_traffic_only_enabled = true`       | SE:07      |
| 3   | No public blob access                  | `allowBlobPublicAccess: false`         | `allow_nested_items_to_be_public = false` | SE:05      |
| 4   | Managed Identity preferred             | `identity: { type: 'SystemAssigned' }` | `identity { type = "SystemAssigned" }`    | SE:05      |
| 5   | Microsoft Entra ID-only SQL auth       | `azureADOnlyAuthentication: true`      | `azuread_authentication_only = true`      | SE:05      |
| 6   | Private PaaS data services and APIs    | `publicNetworkAccess: 'Disabled'`      | `public_network_access_enabled = false`   | SE:06      |
| 7   | No shared key access on storage        | `allowSharedKeyAccess: false`          | `shared_access_key_enabled = false`       | SE:05      |
| 8   | App Service HTTP/2 enabled             | `http20Enabled: true`                  | `http2_enabled = true`                    | SE:07      |
| 9   | Container Registry admin user disabled | `adminUserEnabled: false`              | `admin_enabled = false`                   | SE:05      |

## Private Networking

PaaS data services use private endpoints and disabled public access in every environment, including development.
App Service APIs must be private. App Service hosting a public-facing web application may use public HTTPS ingress;
the remaining identity and security controls still apply. VNet integration is outbound connectivity, not an
inbound private endpoint. Unsupported services or incompatible SKUs require an explicit design decision,
not a silent public fallback.

Private DNS resolution is mandatory. Project IaC provisions DNS unless verified central infrastructure or an
effective DeployIfNotExists policy owns the specific components. Check assignment scope, parameters, zone IDs,
permissions, deployment behavior and remediation before omitting those components. A zone-group policy does not
prove the DNS zone or VNet link exists. Do not duplicate policy-owned DNS; verify resolution from intended clients.
See [DINE evaluation][dine] and [private endpoint DNS][private-dns].

> **WAF pillar key**: SE:05 = Identity & access, SE:06 = Network security, SE:07 = Encryption.

## Extended Checks

The validator also catches these anti-patterns:

| Pattern                 | Bicep                                 | Terraform                                 | Severity          |
| ----------------------- | ------------------------------------- | ----------------------------------------- | ----------------- |
| Redis non-SSL port      | `enableNonSslPort: true`              | `enable_non_ssl_port = true`              | Blocks deployment |
| FTPS allowed            | `ftpsState: 'AllAllowed'`             | `ftps_state = "AllAllowed"`               | Blocks deployment |
| Remote debugging        | `remoteDebuggingEnabled: true`        | `remote_debugging_enabled = true`         | Blocks deployment |
| Cosmos DB local auth    | `disableLocalAuth: false`             | `local_authentication_disabled = false`   | Blocks deployment |
| PostgreSQL SSL disabled | `sslEnforcement: 'Disabled'`          | `ssl_enforcement_enabled = false`         | Blocks deployment |
| MySQL SSL disabled      | `sslEnforcement: 'Disabled'`          | `ssl_enforcement_enabled = false`         | Blocks deployment |
| Key Vault network open  | `networkAcls.defaultAction: 'Allow'`  | `default_action = "Allow"`                | Warning           |
| Wildcard CORS           | `allowedOrigins: ['*']`               | `allowed_origins = ["*"]`                 | Warning           |
| Storage OAuth default   | `defaultToOAuthAuthentication: false` | `default_to_oauth_authentication = false` | Warning           |

## Enforcement Points

The security baseline is checked at multiple points in the workflow:

1. **CodeGen Phase 4** — `npm run validate:iac-security-baseline` runs after lint/review
   subagents. Violations are a hard gate before adversarial review.
2. **Deploy Preflight** — the validator runs again before what-if/plan analysis.
   Conditional skip if CodeGen already passed (`security_validation_status: PASSED`).
3. **Pre-commit hook** — `lefthook.yml` runs the validator on staged `.bicep`/`.tf` files.
4. **CI pipeline** — `validate:_node` includes the security baseline in the parallel
   validation suite.

## Running the Validator

```bash title="Run the security baseline validator" frame="terminal"
# Check all IaC files
npm run validate:iac-security-baseline

# Explicitly reviewed public web application, isolated in a known Web App resource/module file
npm run validate:iac-security-baseline -- --public-web-app infra/bicep/project/web-app.bicep

# Full validation suite (includes security baseline)
npm run validate:all
```

## Limitations

The validator uses regex-based single-line pattern matching. Nested or multi-line
property assignments (e.g., a property split across multiple lines) may not be caught.
The challenger-review-subagent provides a second layer of defense for patterns the
regex cannot detect.

The public-web flag accepts a dedicated known Web App resource or AVM-module file, not mixed-resource files.
Use the corresponding `.tf` path for Terraform. The flag declares reviewed scope; it does not approve an API's
public exposure. Automated runs without that scope remain fail-closed. Source scans cannot prove endpoint coverage,
module internals or DNS resolution. Those require plan/code review and actual connectivity evidence.

When refining previously approved requirements under this baseline, return to Requirements for reconciliation,
independent review and renewed approval. Do not silently rewrite approved project artifacts or treat old findings
as current evidence for changed inputs.

## Further Reading

- [Microsoft Cloud Security Benchmark][mcsb] — per-service security baselines
- [WAF Security Pillar][waf-sec] — Well-Architected Framework security patterns
- [Validation Reference](/reference/validation-reference/) — full list of validators
- [Cost Governance](/reference/cost-governance/) — budget and cost monitoring rules
- [Workflow](/concepts/workflow/) — where security checks fit in the agent pipeline

[mcsb]: https://learn.microsoft.com/security/benchmark/azure/overview
[waf-sec]: https://learn.microsoft.com/azure/well-architected/security/
[dine]: https://learn.microsoft.com/en-us/azure/governance/policy/concepts/effect-deploy-if-not-exists
[private-dns]: https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns

## Related

- [Quickstart](/getting-started/quickstart/) — install and run your first project
- [Workflow](/concepts/workflow/) — how agents collaborate across steps
- [Troubleshooting](/guides/troubleshooting/) — diagnose failed deploys
