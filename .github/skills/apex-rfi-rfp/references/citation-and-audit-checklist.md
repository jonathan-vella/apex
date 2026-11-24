<!-- ref:citation-and-audit-checklist-v1 -->

# Citation Provenance, SKU Retirement / Regional GA Traps & Pre-Release Audit

Quality-assurance reference for HTTP-200 Microsoft Learn `<title>` citations, mandatory epistemic tagging, curated Azure retirement and regional GA checks (`RD-07`), and final pre-release verification.

## 1. Microsoft Learn `<title>` & Epistemic Tagging Contract

### HTTP-200 Official Microsoft Learn Citations

- Ground all Azure platform claims (service SLAs, throughput/scale limits, Availability Zone behavior, regional pairing, encryption/HSM compliance, and retirement timelines) using [`.github/skills/apex-microsoft-docs/SKILL.md`](../../apex-microsoft-docs/SKILL.md).
- Every cited Microsoft Learn link in [`../templates/evidence-and-provenance.template.md`](../templates/evidence-and-provenance.template.md), compliance matrices, and architecture packs MUST:
  1. Resolve `HTTP 200` against `https://learn.microsoft.com/...` (strip locale segments such as `/en-us/` only if the locale-neutral URL also resolves `HTTP 200`, or keep the verified canonical URL).
  2. Cite the **exact webpage `<title>` text** retrieved from the live page alongside the `retrieved_at` UTC date.
  3. Paraphrase the applicable engineering or billing rule concisely—never copy full documentation pages into repository artifacts, and **never attribute third-party ISV sizing rules, partner MSP SLAs, or customer assumptions to a Microsoft Learn link**.

### Mandatory Epistemic Tags

Every requirement response, capacity formula, resilience target, and commercial dependency MUST carry an explicit epistemic badge so evaluators and bid reviewers can distinguish verified platform facts from assumptions:

| Epistemic Tag | Exact Meaning | Example Usage |
| --- | --- | --- |
| `source-verified` | Verified directly against a fetched HTTP-200 first-party document, `SHA-256` retail API record, live `az` SKU query, or hashed RFP clause | "`Standard_D8lsv5` offered in `swedencentral` zones `1, 2, 3` (`source-verified`)" |
| `customer-reported` | Taken from customer solicitation schedules or Q&A responses without independent telemetry validation | "Peak daily change churn stated as `1.2 TB/day` in RFP Annex B (`customer-reported`)" |
| `vendor confirmation required` | Depends on third-party ISV licensing, appliance throughput, telco last-mile circuit delivery, or partner commercial underwriting | "Third-party core banking adapter certification on PostgreSQL 16 (`vendor confirmation required`)" |
| `drill unproven` | Architecture and Azure service SLAs support the target RTO/RPO, but actual workload recovery time remains unproven until an end-to-end cutover drill runs | "2-hour application RTO across database + integration tier (`drill unproven`)" |

## 2. Curated Azure Retirement & Regional GA Checklist (`RD-07`)

[`../scripts/audit_pursuit_skus_and_rates.py`](../scripts/audit_pursuit_skus_and_rates.py) checks `.github/data/azure-deprecations.json` **and** enforces this curated pursuit retirement table so greenfield ROMs and BAFO schedules never propose legacy or retiring services:

| Legacy / Retiring Proposal Trap | Compliant Modern Replacement | Bid / Architecture Watchout |
| --- | --- | --- |
| Compute `Fsv2`-series VMs | `Dlsv5` / `Dsv5` / `Fx` current-gen v5/v6 series | Re-verify vCPU-to-memory ratio (`2 GiB/vCPU` on `Fsv2` vs. `Dlsv5`) and local NVMe vs. remote disk IOPS |
| Burstable `Bv1` (`Standard_B*` v1) | `Bsv2` / `Basv2` / `Bpsv2` | `Bsv2` separates OS/data disk performance and updates baseline CPU credit rules |
| Classic `API Management` v1 (`Developer`/`Basic`/`Standard`/`Premium` classic) | `APIM v2` (`Basic v2`, `Standard v2`, `Premium v2`) + APIM Workspaces | Verify `APIM v2` inbound Private Endpoint + outbound VNet integration vs. classic VNet injection needs and regional GA |
| Azure Functions Linux `Consumption` (`Y1` classic) | `Flex Consumption` (`FC1`) | Supports virtual network integration, instance-memory choices, and always-ready instances |
| Non-AZ VPN Gateways (`VpnGw1`–`VpnGw5`) | Zone-redundant `AZ` SKUs (`VpnGw1AZ`–`VpnGw5AZ`) | Pair with `Standard` zone-redundant Public IPs; never combine with `Basic` Public IP |
| `Basic Public IP` & `Basic Load Balancer` | `Standard Public IP` (zone-redundant) & `Standard Load Balancer` | `Standard` IPs default to closed inbound security; include explicit NSG/firewall rules |
| Classic `Application Insights` | `Workspace-based Application Insights` | Price underlying `Log Analytics` daily ingestion (`GB/day`) and retention beyond 31/90 days |
| Legacy Log Alerts (classic Log Search v1) | `Scheduled Query Rules v2` | Price per-rule/dimensions evaluation meters accurately when alert counts are large |
| Storage `GPv1` / legacy Blob Storage | `GPv2` (`StorageV2`) with `ZRS` / `GZRS` | Enforce HTTPS-only, TLS 1.2+, disabled shared key when policy requires, and disabled public blob access |
| Key Vault `Access Policies` | `Azure RBAC` permission model (`enableRbacAuthorization: true`) | Map least-privilege data-plane roles (`Key Vault Secrets User`, `Crypto User`) in RACI/architecture |
| `Azure Dedicated HSM` (Thales Luna 7 retiring) | `Azure Cloud HSM` or `Azure Key Vault Managed HSM` | Verify PKCS#11 / JCA client requirements (`Cloud HSM`) vs. REST/key-vault native CMK (`Managed HSM`) and 3-node/cluster minimums |
| `Azure Synapse Dedicated SQL Pool` (new greenfield bids) | `Microsoft Fabric Data Warehouse` | Price `Fabric` `F`-SKU capacity (`CU`), OneLake storage, and verify VNet Data Gateway / Private Link needs |
| `Azure Cache for Redis` (legacy Basic/Standard/Premium/Enterprise) | `Azure Managed Redis` (Balanced, Memory, Compute, or Flash Optimized) | Active-geo replication, zone redundancy, and memory-to-vCPU ratios follow `Azure Managed Redis` SKU tiers |
| `Application Gateway v1`, `Azure CDN Classic`, `ACR Classic`, `Service Bus Basic` (from `.github/data/azure-deprecations.json`) | `Application Gateway v2` (`Standard_v2`/`WAF_v2`), `Azure Front Door Standard/Premium`, `ACR Basic/Standard/Premium`, `Service Bus Standard/Premium` | Production enterprise messaging with Private Endpoints requires `Service Bus Premium` |

### Mandatory Live Target-Region & AZ Verification

An Azure Retail Prices API row **never** proves that a SKU is GA, unrestricted for a subscription, or offered across 3 Availability Zones in the target region. Follow [`.github/skills/apex-azure-quotas/references/sku-availability.md`](../../apex-azure-quotas/references/sku-availability.md) (`az vm list-skus --all`, `az storage sku list`, provider resourceType location checks) against default `swedencentral` (and `germanywestcentral` / `westeurope` when applicable), and audit these **regional asymmetries** before committing to multi-region or hybrid designs:

- **Restricted or Capacity-Gated Secondary Regions**: Secondary regions may carry subscription `Location` or `Zone` restrictions (`NotAvailableForSubscription`), requiring explicit capacity/quota disclaimers rather than guaranteed immediate provisioning.
- **`APIM v2` Tier & Feature Asymmetry**: Confirm the exact `Basic v2` / `Standard v2` / `Premium v2` tier and workspace/networking capabilities in both primary (`swedencentral`) and failover (`germanywestcentral`) regions.
- **`Azure VMware Solution (AVS)` & `Nutanix Cloud Clusters (NC2)` Bare-Metal Host Variance**: Host generations (`AV36P`, `AV48`, `AV64`, or `NC2` bare-metal node families) frequently differ between primary and DR regions—never assume identical node counts, NVMe cache sizes, or stretch-cluster availability without per-region SKU verification (`vendor confirmation required` where NC2 portal/licensing applies).
- **`ExpressRoute Global Reach` Coverage**: Verify `ExpressRoute Global Reach` availability for both the Azure regions and the customer's telecom peering country/metro before basing east-west DR or on-premises transit on Global Reach.
- **`Microsoft Fabric` Workload & Regional DR Availability**: Verify `Fabric` capacity availability, supported compliance certifications, and cross-region disaster recovery support in the target sovereign/EU region pair.

## 3. Pre-Release Audit Checklist

Run [`../scripts/verify_pursuit_package.py`](../scripts/verify_pursuit_package.py) and confirm every item below passes before human review or gated packaging:

- [ ] **Immutable Source Verification**: All files in `_meta/source-manifest.json` exist unmodified with matching `SHA-256` digests.
- [ ] **Primary Pricing & Supplemental Rate Audit**: Every Azure dollar figure traces to `cost-estimate-subagent` (`cost-estimate-v2` or `retail-rate-quote-v1`) + `audit_pursuit_skus_and_rates.py` (`0` `DevTestConsumption` leaks; `UNRESOLVED` or `"PARTNER QUOTE REQUIRED"` sentinels used instead of `$0.00`).
- [ ] **Excel AST, `<v>` Cache & OOXML Health**: `xlsx_ast_cache.py` exits `0` with `workbook.xml.rels` sheet resolution, typed `<v>` caches (`n`, `str`, `b`), Excel `ROUND_HALF_UP`, responsive control-cell permutations, headers/footers `<= 255` chars, and clean `--compare-template` preservation on customer BAFO schedules.
- [ ] **Cross-Artifact Headline Parity**: Monthly, annual, multi-year, one-time, RI/Savings Plan, and unresolved sentinel counts/totals match identically across `contracts/*.json`, `.xlsx` cached `<v>` summary cells, `.md` ROM tables, and `.pptx` slides.
- [ ] **4K Diagram Integrity (`dlib.py`)**: Diagrams generated with `.github/skills/apex-python-diagrams/scripts/dlib.py` render at 4K resolution with **`0` overflow/clipping warnings**, clean zone/region boundaries, and matching SKU labels.
- [ ] **Citation & Epistemic Completeness**: All Microsoft Learn links resolve `HTTP 200` with exact `<title>` citations; zero third-party claims misattributed to Learn; `source-verified`, `customer-reported`, `vendor confirmation required`, and `drill unproven` tags applied consistently.
- [ ] **Workspace Coexistence & Link Hygiene**: `agent-output/{project}/README.md` uses the exact 5 `PROJECT-README` H2s, states no numbered delivery step completion is asserted, emits zero reserved delivery filenames, and contains zero broken relative links or `../` archive escapes.
- [ ] **Purview & Commercial Release Gate (`RD-05`, `RD-09`)**: `--exclude-restricted-originals` and `--acknowledge-purview-clearance "<ref>"` (or `--internal-only`) enforced; AI-assistance and commercial/legal validation responsibility notice included in playbook and handoff email; zero unauthorized `git` commits/pushes executed.
