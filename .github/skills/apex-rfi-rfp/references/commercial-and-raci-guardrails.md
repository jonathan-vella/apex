<!-- ref:commercial-and-raci-guardrails-v1 -->

# Commercial Personas, Architectural Discipline & Release Guardrails

Commercial framing, RACI boundaries, Keep-vs-Discard engineering rules, and Microsoft Purview / derived-data release gates (`RD-05`) for every `apex-rfi-rfp` pursuit.

## 1. Neutral Configurable Bidder Personas

Never hardcode one organization's commercial posture across all bids. Select and record one of three explicit bidder personas at intake (`bidder_persona`):

| Dimension | `microsoft_1p_partner_advisory` | `partner_prime_bidder` | `isv_solution_provider` |
| --- | --- | --- | --- |
| **Role in Bid** | Cloud provider 1P technical/ROM advisory supporting a bidding partner | System integrator / MSP submitting prime binding commercial offer | ISV / SaaS / Managed Application vendor quoting software + Azure hosting |
| **Currency & Rates** | **1P Azure Public Retail USD only** | Configurable target bid currency via explicit FX rate + FX hedge control cells | Configurable target bid currency via explicit FX rate + FX hedge control cells |
| **Partner Margin / Buffer** | **`0%` partner margin, `0%` FX buffer, `0%` variance markup** | Separate **Reseller Margin %** and **Fixed-Tier Variance Buffer %** control cells | Separate **ISV Gross Margin / Uplift %** and **Hosting Variance Buffer %** control cells |
| **Labor, MSP & 3P Scope** | Excluded from dollar totals; marked `"PARTNER QUOTE REQUIRED"` + Submission Blocker Banner | Priced in dedicated one-time labor, recurring MSP, and 3P pass-through schedules | Priced across ISV license tiers, onboarding/integration services, and stamp hosting |
| **RACI Topology** | 3-party or 4-party (`Cloud Provider`, `Prime Bidder / MSP`, optional `ISV`, `Customer`) | 3-party or 4-party (`Cloud Provider`, `Prime Bidder / MSP`, optional `ISV`, `Customer`) | 3-party or 4-party (`Cloud Provider`, optional `Channel Partner / MSP`, `ISV`, `Customer`) |

### Persona 1: `microsoft_1p_partner_advisory`

When producing an advisory ROM pack to assist a bidding partner:

- **1P Public Retail USD Only**: Report all priced Azure meters strictly in **USD** at verified 1P Azure Public Retail rates (`0%` partner margin, `0%` FX buffer).
- **Consumption Rate-Lock Disclaimer (Mandatory)**: State explicitly in the workbook assumptions tab, [`../templates/bid-commercial-playbook.template.md`](../templates/bid-commercial-playbook.template.md), and [`../templates/handoff-email.template.md`](../templates/handoff-email.template.md) that **non-reserved PAYG consumption meters cannot be price-locked by Microsoft** across bid-validity windows or multi-year contract terms. Reserved Instances (`1 Year` / `3 Years`) and Azure Compute Savings Plans lock eligible compute/resource rates only upon purchase at order-execution pricing, and variable egress, storage transaction, and log-ingestion meters remain usage-billed.
- **`"PARTNER QUOTE REQUIRED"` String Sentinels + Submission Blocker Banner**: Never enter `$0.00` for partner-owned commercial obligations and never guess partner labor rates. Place `"PARTNER QUOTE REQUIRED"` in the cost column, surface a prominent red/amber **Submission Blocker Banner** at the top of the summary sheet, and assign these items explicitly to the Partner:
  - Target bid currency FX conversion and multi-year FX hedging cost
  - Bid-validity rate-lock underwriting and fixed-price commercial risk reserve
  - Partner reseller margin, EA/CSP/MCA discount pass-through, and rebate treatment
  - Fixed-tier consumption variance buffer for variable usage meters
  - Assessment, landing-zone build, migration, cutover, and custom interface/integration labor
  - 24x7 managed service provider (MSP) L1–L3 operations, incident response, and patching SLAs
  - BYOL licenses, third-party virtual appliances (NVAs, backup software, SIEM connectors), and telco circuits (`ExpressRoute` provider loops)
  - Legal T&Cs, liquidated damages / SLA credit backstops, local tax/VAT/withholding, and statutory pass/fail returnables

### Persona 2: `partner_prime_bidder`

When generating a prime bidder commercial model:

- **Dedicated `Assumptions_&_Controls` Tab**: Centralize `Source_Currency` (`USD`), `Target_Currency`, `Spot_FX_Rate`, `FX_Hedge_Buffer_Pct`, `Reseller_Margin_Pct`, `Consumption_Variance_Buffer_Pct`, `Contract_Term_Months`, and `Commitment_Posture` (`PAYG`, `1Y_RI`, `3Y_RI`, `Savings_Plan`).
- **Prevent Double-Compounding Between Margin and Variance Buffer**: Keep `Reseller_Margin_Pct` (commercial gross margin/markup) and `Consumption_Variance_Buffer_Pct` (technical/usage contingency for fixed-price or capped consumption tiers) in **separate cells and separate waterfall lines**:
  - Recommended transparent additive uplift on base cloud cost $C_{\text{cloud}}$:
    $$\text{Risk-Adjusted Cloud} = C_{\text{cloud}} \times (1 + \text{Variance\_Buffer\_Pct})$$
    $$\text{Partner Cloud Sell} = C_{\text{cloud}} \times (1 + \text{Variance\_Buffer\_Pct} + \text{Reseller\_Margin\_Pct}) \quad \text{or explicit documented margin-on-cost policy}$$
  - Never bury an undocumented `base * (1 + fx) * (1 + buffer) * (1 + margin) * (1 + contingency)` cascade across hidden columns; display each commercial bridge line (`Base 1P USD` -> `FX Conversion` -> `Variance Buffer` -> `Partner Margin` -> `One-Time Implementation Labor` -> `Recurring MSP` -> `3P / BYOL Pass-Through`) explicitly in the executive summary.

### Persona 3: `isv_solution_provider`

When bidding an ISV or SaaS workload hosted on Azure:

- Separate **ISV Software Subscription / Licensing**, **Dedicated Per-Customer Stamp Azure Infrastructure**, **Amortized Shared Control-Plane Allocation**, and **Onboarding / Custom Connector Professional Services** into distinct schedule sections.
- Maintain separate FX, hosting-variance buffer, and ISV margin controls on `Assumptions_&_Controls` with zero hidden compounding.
- Explicitly document tenant isolation, data residency (`swedencentral` default), customer-managed key (`CMK`) responsibilities, and upgrade maintenance windows in the RACI matrix.

## 2. 3-Party and 4-Party RACI Matrix Contract

Include an explicit RACI matrix (`R` = Responsible, `A` = Accountable, `C` = Consulted, `I` = Informed) in [`../templates/bid-commercial-playbook.template.md`](../templates/bid-commercial-playbook.template.md) covering all participating parties (`Cloud Provider`, `Prime Bidder / MSP`, `ISV / Specialist Vendor` when present, and `Customer`):

| Domain Activity | Cloud Provider | Prime Bidder / MSP | ISV / Specialist Vendor | Customer |
| --- | --- | --- | --- | --- |
| Physical datacenter, host hardware, and Azure platform service SLAs | `R / A` | `I` | `I` | `I` |
| Landing zone, VNet/Private DNS, HA/AZ topology, and IaC build | `C` | `R / A` | `C` | `C / I` |
| Application runtime configuration, schema upgrades, and ISV patches | `I` | `C` | `R / A` | `C` |
| BCDR runbooks, backup immutability config, and live failover drills | `I` | `R` | `C` | `A` |
| 24x7 monitoring, alert triage, OS patching, and FinOps RI/SP optimization | `I` | `R / A` | `C` | `I` |
| Data classification, Microsoft Entra ID user governance, and UAT sign-off | `I` | `C` | `C` | `R / A` |
| Binding bid pricing, FX lock, legal T&Cs, and statutory returnables | `I` | `R / A` | `C` (3P scope) | `I` |

*(For 3-party pursuits without a separate ISV, collapse `ISV / Specialist Vendor` responsibilities into `Prime Bidder / MSP` or `Customer` according to application ownership.)*

## 3. Core Architectural & Scope Guardrails

### Immutable Read-Only Source Archive (`SHA-256`)

- Treat every customer solicitation document, spreadsheet, addendum, and Q&A log as **strictly read-only**.
- Run [`../scripts/extract_pursuit_sources.py`](../scripts/extract_pursuit_sources.py) before analysis to record byte size and `SHA-256` digest in `_meta/source-manifest.json`, and re-verify via [`../scripts/verify_pursuit_package.py`](../scripts/verify_pursuit_package.py) at completion so zero customer files are ever altered in place.

### Compliance Wins Over Cost + Zero Over-Engineering

Apply both halves of this invariant together:

1. **Compliance Wins Over Cost**: Never violate a mandatory solicitation requirement (data residency, Availability Zone SLA, encryption/HSM standard, audit retention, private networking, or mandated RTO/RPO) to make the ROM look cheaper. If a customer requirement forces a higher SKU tier (for example `APIM Standard v2` / `Premium v2` for VNet/zone requirements, or `Azure Cloud HSM` / `Managed HSM` for FIPS 140-3 Level 3), keep the compliant SKU and cite the exact RFP clause.
2. **Zero Over-Engineering (Explicit Keep-vs-Discard Audit)**: Every billable line item, environment stamp, and add-on must earn its place via a documented requirement ID or non-negotiable platform dependency:
   - **Single-Region Multi-AZ by Default**: Architect in a single Azure region (`swedencentral`) across Availability Zones `1, 2, 3` (`ZRS` storage, zone-redundant gateways, zone-redundant compute/databases) **unless** the solicitation explicitly requires secondary-region disaster recovery, dual-region regulatory residency, or an RTO/RPO against full regional outage. When multi-region DR is mandated, pair `swedencentral` with `germanywestcentral` (and `westeurope` where Static Web Apps applies), and model passive/pilot-light DR storage/compute accurately rather than duplicating 100% active production stamps unless active-active is explicitly required.
   - **Discard Unrequested Bloat**: Strip unrequested multi-hub firewalls, duplicate SIEM/monitoring ingestion, redundant backup layers, oversized dev/sandbox stamps, and speculative AI/analytics add-ons, recording every disposition in the Keep-vs-Discard table.
   - **Clean Rebuild Over Patching Bloated Prior Models**: When a pursuit inherits an inflated prior-round workbook or a multi-tower template containing out-of-scope tabs, **rebuild cleanly** from the customer's authoritative schedule and reconcile every delta in [`../templates/model-changelog-bridge.template.md`](../templates/model-changelog-bridge.template.md) instead of hiding rows or patching broken formulas.

## 4. Two-Part Sensitivity & Derived-Data Release Gate (`RD-05`)

Cryptographic hashes (`SHA-256`) prove **integrity and provenance**—they **never** grant confidentiality clearance or permission to distribute customer material externally.

### Why Stripping Originals Alone Is Insufficient

Even when [`../scripts/package_pursuit.py`](../scripts/package_pursuit.py) runs with `--exclude-restricted-originals` to omit raw customer `.pdf`, `.docx`, `.xlsx`, and `.eml`/`.msg` files, **derived artifacts still contain customer-sensitive information**:

- `.md` compliance matrices and architecture packs quote solicitation clauses, internal system names, RTO/RPO targets, and security gaps.
- `.xlsx` ROM and BAFO workbooks encode estate sizing, VM/storage inventories, commercial margins, and unit pricing.
- `.pptx` executive decks and `.png`/`.svg` diagrams expose network topologies, integration endpoints, and risk registers.

### Mandatory Release Gate Procedure

1. **Classify Sensitivity Inheritance**: Record the highest sensitivity classification of all ingested inputs (for example `Confidential`, `Restricted`, or Microsoft Purview label ID/name) in `_meta/source-manifest.json` and [`../templates/evidence-and-provenance.template.md`](../templates/evidence-and-provenance.template.md). All derived outputs inherit at least that classification unless formally anonymized and human-approved.
2. **Enforce Both Packaging Controls**: `scripts/package_pursuit.py` refuses to build an external handoff `.zip` unless:
   - `--exclude-restricted-originals` strips restricted raw customer files (unless explicit written redistribution authorization is recorded), **AND**
   - `--acknowledge-purview-clearance "<approval-reference>"` records explicit sensitivity-label owner approval for the derived deliverables (or `--internal-only` marks the bundle strictly for authorized internal workspace storage).
3. **Include Mandatory AI-Assistance & Validation Responsibility Notice**: Every [`../templates/handoff-email.template.md`](../templates/handoff-email.template.md) and [`../templates/bid-commercial-playbook.template.md`](../templates/bid-commercial-playbook.template.md) MUST include a visible notice stating:
   - Deliverables were prepared with AI-assisted engineering automation (`apex-rfi-rfp`) against point-in-time public retail/documentation snapshots.
   - The submitting bidder's authorized commercial, finance/FX, tax, legal, and lead solution architecture owners remain solely responsible for independent verification before binding customer submission.
