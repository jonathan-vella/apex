# IaC Security Baseline

Shared security rules for both Bicep and Terraform IaC generation.
Referenced by `iac-bicep-best-practices.instructions.md` and
`iac-terraform-best-practices.instructions.md`.

## First Principle

Azure Policy always wins. Current Azure Policy implementation cannot
be changed. Code adapts to policy, never the reverse.

Precedence, highest first: (1) effective policy discovered in the target tenant, including
management-group-inherited assignments; (2) the [ALZ Corp floor](#alz-corp-inherited-policy-floor)
when discovery is not used; (3) this baseline where it is stricter than both. Where this baseline
and the ALZ Corp floor differ, the ALZ Corp floor governs and the difference is reported, not
silently resolved.

## Private Networking And DNS

These defaults apply in every environment, including development and synthetic-data tests.
Policy discovery may add constraints; absence of a Deny policy does not relax this baseline.

| Boundary | Required posture |
| --- | --- |
| PaaS data services supporting Private Link, except Azure Monitor below | Private endpoints; public access disabled |
| Log Analytics and workspace-based Application Insights | Authenticated public query/ingestion permitted as below |
| App Service hosting an API | Private endpoint and public network access disabled |
| App Service hosting a public-facing web application | Public HTTPS ingress permitted only where effective policy allows it; the ALZ Corp floor denies it, so use private access behind an approved edge; authentication and other security controls still apply |

Log Analytics workspaces and workspace-based Application Insights do not require AMPLS solely because they
support Private Link. Public query and ingestion endpoints are permitted when effective Azure Policy and
approved requirements allow them. Record query and ingestion settings separately for each resource in the
Plan and IaC contract. Preserve HTTPS/TLS, Entra authentication for queries, least-privilege RBAC and supported
authenticated ingestion; public network reachability does not mean anonymous access or waive local-auth controls.
This exception does not extend to Storage, SQL, Key Vault, ACR or other PaaS data services.

Require AMPLS when effective Azure Policy or approved isolation requirements mandate private Azure Monitor access.
In that case, plan scoped resources, private endpoints, DNS and reachable ingestion/query clients before disabling
public endpoints. Do not add Bastion, a jump VM, NAT or monitoring subnets solely to satisfy the generic PaaS rule
when public monitoring is approved. Existing private-only requirements are not automatically relaxed.

Classify the application boundary during Requirements. For mixed web/API hosting, clarify the API
exposure before architecture; do not use the web exception to silently expose an API. An App Service
Plan has no application endpoint. App Service VNet integration provides outbound connectivity and is
not an inbound private endpoint. Private services require a reachable client/runner path as well as DNS.
Unsupported services, SKU incompatibility or budget conflicts are blockers for an explicit design decision,
not permission to substitute public access. Do not attach private endpoints to resource types that cannot support them.

Private DNS resolution is mandatory for every private endpoint. The plan must account for the service-correct
zone, records/zone group, VNet links and any required forwarding. Reuse verified central DNS where present;
never point at a zone that no owner provisions.

The ALZ Corp default assigns DINE zone-group creation against zones in a central DNS subscription
and resource group. Its zone IDs are placeholders, so the platform team must confirm zone and
VNet-link ownership before the plan relies on it; the project does not deploy duplicate zones.

Project IaC owns the required DNS components unless an effective DeployIfNotExists (DINE) assignment
is verified to own those specific components. Record its assignment/definition, applicable resource scope,
parameters and zone IDs, exclusions/exemptions, deployment template, managed identity/RBAC and remediation
behavior. A policy that only creates zone groups does not prove zones or VNet links exist. Do not duplicate
policy-owned resources; explicitly provide or obtain approval for missing components. Unknown ownership blocks
affected planning. Confirm DNS resolution and policy deployment completion before claiming connectivity.

DINE evaluates asynchronously; existing noncompliant resources may require an authorized remediation task.
An assignment alone is not evidence that DNS was deployed successfully. See
[DINE evaluation](https://learn.microsoft.com/en-us/azure/governance/policy/concepts/effect-deploy-if-not-exists)
and [private endpoint DNS](https://learn.microsoft.com/en-us/azure/private-link/private-endpoint-dns).

The source security scanner rejects explicit enabled-public-access literals by default in both IaC tracks.
For an approved public-facing Web App isolated in its own known resource/AVM-module file, pass
`npm run validate:iac-security-baseline -- --public-web-app <infra/path/to/web-app.bicep>`
(or the corresponding `.tf` file; repeat the flag for additional public web files).
Never use this flag for an API. Mixed-resource or unknown-module files cannot receive this exception.
This is an explicit reviewed-scope declaration, not automatic approval or proof of the application's role.
The scanner is single-line source checking: it cannot establish PE coverage, evaluate expressions,
prove module internals, or test DNS. Plan/code review must check those contracts, and connectivity validation
must verify actual resolution from the intended private client before claiming operational readiness.

## ALZ Corp Inherited Policy Floor

Source: `alz-corp-default` baseline (`root`, `landing_zones` and `corp` archetypes, pinned in
`alz_library_ref`). It is assumed governance, not tenant-verified; live discovery replaces it.

### Enforced Deny rules the IaC must satisfy

| Assignment (scope) | IaC requirement |
| --- | --- |
| `Deny-Public-Endpoints` (corp) | Public network access disabled, or private-only, for Storage, SQL, Key Vault, Cosmos DB, ACR, Redis, App Configuration, Service Bus, Event Hubs/Grid, Search, AI Services, Data Factory, Data Explorer, Synapse, PostgreSQL/MySQL, AKS (private cluster), Container Apps (environment and external ingress) and App Service, Function and Logic apps and slots. Log Analytics and Application Insights are not listed. |
| `Deny-Public-IP-On-NIC` (corp) | No public IP on a network interface; Bastion, Application Gateway and Front Door own their own public endpoints. |
| `Deny-HybridNetworking` (corp) | No ExpressRoute, VPN/P2S gateway, virtual WAN, virtual hub or virtual network gateway in the project. |
| `Deny-Classic-Resources` (root) | No classic resource types. |
| `Deny-Subnet-Without-Nsg` (landing_zones) | Every subnet has an NSG except `GatewaySubnet`, `AzureFirewallSubnet`, `AzureFirewallManagementSubnet` and `RouteServerSubnet`. `AzureBastionSubnet` is not excluded and needs an NSG with the Bastion-required rules. |
| `Deny-MgmtPorts-Internet` (landing_zones) | No inbound management-port rule (for example 22 or 3389) from the Internet. |
| `Deny-IP-forwarding` (landing_zones) | Network interface IP forwarding disabled. |
| `Deny-Storage-http`, `Enforce-TLS-SSL-Q225` (landing_zones) | HTTPS-only on Storage, App Service, Function, Logic and Container Apps; TLS 1.2 or newer on SQL, Storage and Event Hubs. |
| `Enforce-GR-KeyVault` (landing_zones) | Soft delete and purge protection on; Azure RBAC permission model; RSA keys and certificates at least 2048 bits; secrets with a content type and a validity of at most 90 days; certificates not expiring within 90 days. |

### Platform-owned remediation (DINE and Modify)

Expect these assignments to act after deployment. Plan and cost them, and do not duplicate what
they own: diagnostic settings named `setByPolicy-LogAnalytics` (still wire project diagnostics,
below), private DNS zone groups, SQL auditing, TDE and threat protection, Defender plans, the
Activity Log, service health alerts and the DDoS plan association on virtual networks (Modify:
do not set a DDoS plan in project IaC).

### Assigned but not enforced

The `Enforce-GR-*` guardrails for services other than Key Vault and the `Enforce-Encrypt-CMK0`
customer-managed key rules are assigned with `DoNotEnforce`. They do not require CMK; treat them
as recommendations, not gates.

### Stricter than the ALZ Corp floor (kept, reported to the owner)

- Storage shared-key access disabled; SQL Entra-only authentication; Cosmos DB local auth disabled.
- Container Registry admin user disabled; App Service HTTP/2; FTPS not `AllAllowed`; no remote debugging.
- Redis non-TLS port blocked and MySQL/PostgreSQL SSL enforcement required.
- TLS 1.2 minimum on every service, not only the types ALZ lists.
- Diagnostic settings wired in IaC on every supported resource; ALZ remediates them only after deployment.
- Key Vault network ACL default action Deny (warning).
- The APEX greenfield tag set: the ALZ Corp default has no tag policy.
- Application Gateway WAF: ALZ only audits it.

### Verify at tenant discovery

`Subnets should be private` (default outbound access), zone-resilience and Application Gateway WAF
assignments are present, but their effect is not recorded in the snapshot. Confirm each effect
before a design depends on explicit outbound access, and before a production design chooses a
single-zone posture.

## Zone Redundancy SKUs

Zone redundancy applies only to production environments. Do not require, plan, price or flag the
absence of zone redundancy in dev, test or staging; use single-zone SKUs and instance counts there.
A production design records an explicit `az_posture` decision.

| SKU       | Zone Redundancy | Use Case            |
| --------- | --------------- | ------------------- |
| S1/S2     | Not supported   | Dev/test            |
| P1v3/P2v3 | Supported       | Production          |
| P1v4/P2v4 | Supported       | Production (latest) |

## Diagnostic Settings — required on every resource

Every Azure resource that supports diagnostic settings must route platform
logs and metrics to the project Log Analytics workspace. A plan that wires
diagnostics for **App Service only** (a common omission) is non-compliant.

### Minimum coverage

| Service | Log categories | Metrics | Notes |
| ------- | -------------- | ------- | ----- |
| Key Vault | `AuditEvent`, `AzurePolicyEvaluationDetails` | `AllMetrics` | Required for secret-access audit trail. |
| Storage (account + blob/file/queue/table services) | `StorageRead`, `StorageWrite`, `StorageDelete` | `Transaction` | Diagnostics belong on the service resource (blobServices/fileServices), not the account itself. |
| SQL Server / Database | `SQLSecurityAuditEvents`, `AutomaticTuning`, `Blocks`, `DatabaseWaitStatistics` | `Basic` | Auditing already routes to Log Analytics via `auditing.isAzureMonitorTargetEnabled`; diagnostic settings provide the complementary platform-log stream. |
| App Service / Function App | `AppServiceHTTPLogs`, `AppServiceConsoleLogs`, `AppServiceAppLogs`, `AppServiceAuditLogs` | `AllMetrics` | Already commonly wired; keep enabled. |
| Networking (NSG, VNet, Private Endpoint, App Gateway, Front Door) | `AllLogs` (service-dependent) | `AllMetrics` | Required for flow-log + private-link diagnostics. |
| Container Registry / Container Apps / AKS | service-specific log categories | `AllMetrics` | Required for image-pull + runtime audit. |

### Required parameter shape

The diagnostic settings block (Bicep) lives on the AVM module call or as a
sibling `Microsoft.Insights/diagnosticSettings` resource:

```bicep
resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2026-03-01' existing = {
  name: logAnalyticsWorkspaceName
}

// inside the AVM module params or the sibling resource
diagnosticSettings: [
  {
    workspaceResourceId: logAnalytics.id
    logs: [ /* service-specific categories */ ]
    metrics: [ { category: 'AllMetrics', enabled: true } ]
    logAnalyticsDestinationType: 'Dedicated'  // recommended over 'AzureDiagnostics'
  }
]
```

Modules take the workspace **name** (`logAnalyticsWorkspaceName`, per the Bicep
[module interface](../../skills/apex-azure-bicep-patterns/references/module-interface.md))
and resolve its resource ID with `existing`. Terraform modules take the workspace ID.
The workspace parameter must appear in every module's Code-Generation Contract that
owns a diag-settings-bearing resource — not only the App Service module.

### Anti-pattern

A plan whose Code-Generation Contract lists the workspace parameter only
on `compute.bicep` (App Service) and omits it from `keyvault.bicep`,
`storage.bicep`, `database.bicep`, or `networking.bicep` fails this rule.
The Challenger flags it as a `should_fix` (Operational Excellence).
