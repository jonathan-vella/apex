# :material-shield-check: Security Baseline

> Non-negotiable security requirements for all generated infrastructure code.

The security baseline is enforced by the `validate:iac-security-baseline` validator
(pre-commit hook + CI pipeline) and the `challenger-review-subagent` at adversarial
review gates. Violations block code generation and deployment.

## Rules

| #   | Rule                           | Bicep Property                         | Terraform Argument                        |
| --- | ------------------------------ | -------------------------------------- | ----------------------------------------- |
| 1   | TLS 1.2 minimum                | `minimumTlsVersion: 'TLS1_2'`          | `min_tls_version = "1.2"`                 |
| 2   | HTTPS-only traffic             | `supportsHttpsTrafficOnly: true`       | `https_traffic_only_enabled = true`       |
| 3   | No public blob access          | `allowBlobPublicAccess: false`         | `allow_nested_items_to_be_public = false` |
| 4   | Managed Identity preferred     | `identity: { type: 'SystemAssigned' }` | `identity { type = "SystemAssigned" }`    |
| 5   | Azure AD-only SQL auth         | `azureADOnlyAuthentication: true`      | `azuread_authentication_only = true`      |
| 6   | Public network disabled (prod) | `publicNetworkAccess: 'Disabled'`      | `public_network_access_enabled = false`   |

## Extended Checks

The validator also catches these anti-patterns:

| Pattern                 | Bicep                                | Terraform                               | Severity          |
| ----------------------- | ------------------------------------ | --------------------------------------- | ----------------- |
| Redis non-SSL port      | `enableNonSslPort: true`             | `enable_non_ssl_port = true`            | Blocks deployment |
| FTPS allowed            | `ftpsState: 'AllAllowed'`            | `ftps_state = "AllAllowed"`             | Blocks deployment |
| Remote debugging        | `remoteDebuggingEnabled: true`       | `remote_debugging_enabled = true`       | Blocks deployment |
| Cosmos DB local auth    | `disableLocalAuth: false`            | `local_authentication_disabled = false` | Blocks deployment |
| PostgreSQL SSL disabled | `sslEnforcement: 'Disabled'`         | `ssl_enforcement_enabled = false`       | Blocks deployment |
| Key Vault network open  | `networkAcls.defaultAction: 'Allow'` | `default_action = "Allow"`              | Warning           |
| Wildcard CORS           | `allowedOrigins: ['*']`              | `allowed_origins = ["*"]`               | Warning           |

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

```bash
# Check all IaC files
npm run validate:iac-security-baseline

# Full validation suite (includes security baseline)
npm run validate:all
```

## Limitations

The validator uses regex-based single-line pattern matching. Nested or multi-line
property assignments (e.g., a property split across multiple lines) may not be caught.
The challenger-review-subagent provides a second layer of defense for patterns the
regex cannot detect.

## Further Reading

- [Validation Reference](validation-reference.md) — full list of validators
- [Cost Governance](cost-governance.md) — budget and cost monitoring rules
- [Workflow](workflow.md) — where security checks fit in the agent pipeline
