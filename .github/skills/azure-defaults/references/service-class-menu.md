<!-- ref:service-class-menu-v1 -->
---
name: Service Class Menu
description: Phase 3 service-class question batches for the Requirements agent
---

# Phase 3: Service Recommendations — runbook

Referenced by [`02-Requirements`](../../../agents/02-requirements.agent.md)
Phase 3. Externalised from the agent body to keep per-turn system-prompt
replay small (per `tmp/plan-input-token-reduction-v3.md` Phase 8).

This phase is required. Use **batched `askQuestions` calls** to gather
service-class decisions. Group questions whose options / multiSelect /
recommendations do not depend on a prior answer into a single batched call
(the `questions[]` array accepts multiple entries). Only split into separate
calls when a later question's option set or recommendation is computed from
an earlier answer (see Step 3b's `application_layers` gating below).

Required batching (saves ~10 turns per Phase 3):

- **Batch A — NFR profile** (Step 3a): service_tier, availability_target,
  recovery_profile in one call. All three are independent.
- **Batch B — Topology + compute + data** (Steps 3b–3f): combine
  compute_host, relational_db, non_relational_store, storage_needs into a
  single batched call. Conditionally include application_layers in Batch B
  if the workload pattern is N-Tier or microservices (set its
  `multiSelect: true`); otherwise omit it.
- **Batch C — Integration + platform** (Steps 3g–3h): messaging_events and
  supporting_services in one batched call. supporting_services pre-checks
  defaults (Monitor, App Insights, Log Analytics, Key Vault) plus ACR when
  a container host was selected in Batch B.
- **Confirm step** (Step 3i): one final batched call with the consolidated
  service list (`multiSelect: true`, all chosen preselected).
- **Batch D — SKU & sizing preferences** (Step 3j): one batched call per
  service class confirmed at 3i, asking for pinned SKU/size, tier floor,
  or explicit "no preference". Mandatory for every project (see
  [`sku-manifest.instructions.md`](../../../instructions/sku-manifest.instructions.md#mandatory-elicitation-at-step-1)).

Use business-friendly descriptions with Azure service names in parentheses.

## 3a. NFR profile and tier

Use `askQuestions` for:

- Service tier: cost-optimized, balanced, or enterprise.
- Availability target with downtime-oriented labels.
- Recovery objective profile (single-select):
  - Relaxed: RTO 24h, RPO 12h, SLA 99.5%.
  - Standard: RTO 4h, RPO 1h, SLA 99.9%.
  - Mission-Critical: RTO 15m, RPO 5m, SLA 99.99%.
  - Custom: freeform RTO/RPO/SLA.

## 3b. Application topology

If the workload pattern is N-Tier or microservices, use `askQuestions` for
application layers with `multiSelect: true` (Presentation/Web, API,
Background worker, Batch/Job, Real-time/Events, Other). Skip when the
pattern is purely static-site or single-binding serverless and there is no
obvious layering.

## 3c. Compute host (web and API tier)

Use `askQuestions` for the primary compute host. Single-select unless the
user clarifies multiple workloads. Options include business-friendly
descriptions:

- App Service (managed web/API hosting on App Service Plan).
- Container Apps (managed container hosting with KEDA-style scaling).
- Azure Kubernetes Service (full Kubernetes platform).
- Functions (event-driven serverless).
- Static Web Apps (static frontend + APIs; pinned to `westeurope` for EU).
- Other / unsure.

Recommend the option that matches the inferred workload pattern. Avoid
recommending AKS for a small MVP team unless the user explicitly asks for
Kubernetes.

## 3d. Relational data store

Use `askQuestions` for the operational relational data store
(single-select):

- Azure SQL Database (managed SQL, Microsoft ecosystem default).
- Azure Database for PostgreSQL Flexible Server (open-source SQL).
- Azure Database for MySQL Flexible Server (open-source SQL, LAMP-style
  apps).
- Azure SQL Managed Instance (lift-and-shift SQL Server compatibility).
- None or not needed.
- Other / unsure.

Record the answer with
`apex-recall decide <project> --key relational_db --value <choice> --json`.

## 3e. Non-relational data store

Use `askQuestions` for a non-relational data store, if any (single-select):

- Azure Cosmos DB (NoSQL, multi-model).
- Azure Cache for Redis (cache layer; pair with a primary store).
- Azure Table Storage (cheap key/value, simple needs).
- None or not needed.
- Other / unsure.

## 3f. Storage and content

Use `askQuestions` for storage needs with `multiSelect: true`:

- Blob storage for media or document files.
- Azure Files (SMB share) for legacy file-share workloads.
- Azure Data Lake Storage Gen2 for analytics.
- No additional storage needed.

## 3g. Messaging and events

Use `askQuestions` for messaging/event services with `multiSelect: true`
when the workload description mentions async work, integrations, or
analytics. Otherwise ask once with a clear "None" option:

- Azure Service Bus (transactional queues/topics).
- Azure Event Hubs (high-throughput event ingestion).
- Azure Event Grid (pub/sub for cloud events).
- Azure Storage Queues (lightweight queues).
- None.

## 3h. Observability and supporting services

Use `askQuestions` for required supporting platform services with
`multiSelect: true` and pre-checked recommendations:

- Azure Monitor + Application Insights (recommended).
- Log Analytics workspace (recommended).
- Key Vault for secrets/certs (recommended).
- Azure Container Registry (only if container hosts are selected).
- Azure Front Door / Application Gateway / CDN for edge ingress.
- API Management (only when an external API surface is explicit).

## 3i. Confirm Azure services in scope

After collecting per-class answers, present a final `askQuestions` summary
list with `multiSelect: true`, preselected with all chosen services, so the
user can add or remove items before artifact generation.

## 3j. SKU and sizing preferences (mandatory for every project)

This step is **required** for every project — the user must be asked, even
when the expected answer is "no preference". The goal is to capture **hard
preferences** the user already knows so Architect treats them as locked
user-pins; everything else is left for Architect to evaluate at Step 2.

Use one **batched `askQuestions` call (Batch D)** with one question per
service class confirmed at 3i. For each in-scope class, present three
options plus a freeform field:

- **Pinned SKU/size** — freeform (e.g. `P1v3`, `GP_Standard_D2s_v3`,
  `S2 (50 DTU)`, `Standard_DS3_v2`).
- **Tier floor only** — freeform (e.g. `Standard or higher`,
  `Premium_v3 family`).
- **No preference — let Architect decide** (recommended default).

Question mapping (only ask for classes confirmed in 3i):

| Class confirmed at 3i           | `header`                | Question                                                                     |
| ------------------------------- | ----------------------- | ---------------------------------------------------------------------------- |
| Compute host (App Service)      | `sku_app_service`       | Preferred App Service Plan SKU or tier floor?                                |
| Compute host (Container Apps)   | `sku_container_apps`    | Preferred Container Apps workload profile / consumption settings?            |
| Compute host (AKS)              | `sku_aks_nodepool`      | Preferred AKS system & user node-pool VM SKU?                                |
| Compute host (Functions)        | `sku_functions`         | Preferred Functions plan (Consumption / Premium EP / App Service Plan host)? |
| Relational DB                   | `sku_sql`               | Preferred SQL/PostgreSQL/MySQL tier or compute size?                         |
| Non-relational (Cosmos / Redis) | `sku_nosql`             | Preferred Cosmos throughput mode or Redis tier?                              |
| Storage replication             | `sku_storage_repl`      | Preferred Storage replication (LRS / ZRS / GRS / RA-GRS)?                    |
| Ingress (App Gateway / Front Door) | `sku_ingress`        | Preferred ingress SKU (App Gateway WAF_v2 / Front Door Premium / etc.)?      |
| API Management                  | `sku_apim`              | Preferred APIM tier (Developer / Basic / Standard / Premium / Consumption)?  |
| Reserved-instance commitment    | `sku_commitment`        | Reserved 1-yr, Reserved 3-yr, on-demand only, or no preference?              |
| Per-environment override        | `sku_env_override`      | Apply preferences to all environments, or different SKU for `dev` / `prod`?  |

Skip rows whose class was not selected in 3i. If no creative-SKU class was
selected (e.g. static site only), still issue Batch D with just
`sku_commitment` and `sku_env_override` so the elicitation is recorded.

After the batch returns, persist outcomes:

1. For each **Pinned SKU/size** or **Tier floor** answer, append a
   `services[]` entry to `agent-output/{project}/sku-manifest.json` with
   `source: "user-pin"`, `source_step: "1"`, `last_modified_rev: 1`. Use
   tier-floor answers as a `notes` field plus a representative `size`.
2. For **No preference** answers, do **not** add a manifest entry — the
   elicitation is recorded by the decision flag below.
3. Record the mandatory elicitation flag (always, regardless of pins):

```bash
apex-recall decide <project> --key sku_preferences_captured --value true --json
```

4. Record any pinned answers as durable decisions (one per pin):

```bash
apex-recall decide <project> --decision "User pinned <class>=<sku>" --rationale "<user note>" --step 1 --json
```
