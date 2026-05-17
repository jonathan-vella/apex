# Plan: VNet Planning Gate in azure-defaults — Rev 3

> **Resume note (multi-device)**: This file is the single source of
> truth for the plan. No session memory or `apex-recall` state is
> required to continue — Rev 3 folds in every adversarial finding
> from Rev 1 (M1–M4, S1–S4, G1) and Rev 2 (S2-A, S2-B, G3). G4 and
> G5 are explicitly deferred (see Deferred / Out of scope). Implement
> Phase A → E in order; the trailing "Adversarial Review" section is
> historical audit only.

Add an interactive VNet planning gate to the `azure-defaults` skill so
that whenever the architecture includes resources that consume or
embed a Virtual Network (App Service regional VNet integration,
Private Endpoint, App Gateway, AKS, VM/VMSS, APIM internal mode,
Bastion, Azure Firewall, VPN/ER Gateway, NAT Gateway), 03-Architect
runs an `askQuestions` flow that captures (a) new-or-existing VNet
decision, (b) IP address space, and (c) a SKU-aware subnet plan.
Recommendations are proposed upfront as a single table that the user
confirms or edits with an unbounded refinement loop (per-finding `Done`
gate). The gate slots in **after Phase 6a SKU confirmation** and
**before the cost estimate** so subnet counts AND any reserved-subnet
network resources (Bastion / Firewall / NAT Gateway / Gateways) are
appended to the pricing resource_list. The full contract (trigger
condition, askQuestions templates, subnet sizing matrix per workload
with Learn citations, CIDR math, AVM module references) lives in
[`.github/skills/azure-defaults/references/vnet-planning.md`](.github/skills/azure-defaults/references/vnet-planning.md).
Resulting decisions (`vnet_mode`, `existing_vnet_id`,
`vnet_address_space`, `subnet_plan`, `vnet_planning_mode`,
`vnet_plan_decision`) flow to 05-IaC Planner via `apex-recall`.

## Decisions captured (Rev 3 — incorporates Rev 1 + Rev 2 adversarial findings)

- **Trigger contract (M1 + S2-A fix)**: gate fires when **either**
  condition holds for the in-scope architecture:
  1. Any `services[].requires[]` row contains `vnet-integration` or
     `private-endpoints` (already-canonical tokens in
     [`sku-manifest.instructions.md`](.github/instructions/sku-manifest.instructions.md)).
  2. Any `services[].service_name` is in the **vnet-attached service
     whitelist**: `app-gateway`, `aks`, `vm`, `vmss`, `apim-internal`,
     `bastion`, `azure-firewall`, `vpn-gateway`, `expressroute-gateway`,
     `nat-gateway`, `application-gateway-for-containers`.
  **Single source of truth (S2-A)**: this whitelist is owned **only**
  by [`vnet-planning.md`](.github/skills/azure-defaults/references/vnet-planning.md)
  as a fenced ```yaml``` block under heading `## vnet-attached service
  whitelist`. `validate:sku-manifest` parses that fenced block via the
  workspace-relative path and does **not** redeclare the list — keeps
  the whitelist DRY. Validator warns when a whitelisted `service_name`
  is present and no `vnet_mode` decision is recorded post-Step 2.
  Public-edge-only workloads (Static Web Apps + Functions Consumption
  + Storage public + Front Door) do not trigger the gate.
- **Owning agent**: 03-Architect, after Phase 6a (SKU confirmation),
  before Phase 7 (pricing).
- **Existing-VNet flow (M4 + S2-B fix)**: when `vnet_mode = use-existing`,
  Architect runs a **two-step** capture-time validation:
  1. **Auth preamble (S2-B)** — `az account show -o none 2>/dev/null`.
     On failure (no `az login`, expired token, missing CLI), fall back
     to "trust user input, defer validation to Planner Phase 4" and
     emit a Challenger-tagged informational finding
     (`existing_vnet_validation_deferred`). This mirrors the auth
     fallback in
     [`azure-cli-auth-validation.md`](.github/skills/azure-defaults/references/azure-cli-auth-validation.md)
     used by 04g-Governance.
  2. **Resource probe (M4)** — when auth succeeds, run
     `az network vnet show --ids "${existing_vnet_id}" --query "{addr:addressSpace.addressPrefixes,loc:location,name:name}" -o json`.
     Three outcomes — (a) exists + reachable → store
     `vnet_address_space` from the live `addressSpace.addressPrefixes[0]`
     (overrides any user-typed value; that becomes authoritative for
     subnet-overlap math); (b) NotFound / Forbidden → re-prompt with
     the error inline; (c) tenant/subscription/region mismatch → block
     until user supplies correct ID or switches to `create-new`.
  Implementation detail in `vnet-planning.md` ("Existing-VNet
  validation").
- **Subnet recommendation style (S1 fix)**: propose a full subnet
  table upfront, then loop the standard per-finding askMe pattern —
  options `Apply edit (freeform diff)`, `Skip this row`, `Done`. After
  3 consecutive edits with no `Done`, emit a soft warning ("3 edit
  rounds — consider Done") but never auto-defer.
- **Opt-out (S4 fix)**: new top-level decision key
  `vnet_planning_mode` (`guided` default | `fast` | `deferred`):
  - `guided` — full two-round askQuestions, mandatory for prod.
  - `fast` — Round 1 only; Round 2 auto-confirms the proposed table
    with a Challenger-tagged informational finding ("subnet plan
    auto-confirmed in fast mode").
  - `deferred` — gate writes a placeholder `subnet_plan = []` and a
    Challenger-tagged informational finding ("VNet planning deferred;
    sandbox/exploration mode"). Disallowed when the inferred environment
    is `prod` (block with explanation).
- **Governance precedence (S3 fix)**: matches cost-monitoring baseline.
  `04-governance-constraints.json` wins when its `network_constraints`
  block declares allowed address ranges, required subnet names, mandatory
  NSG/UDR attachment, or no-public-IP. If governance is loaded
  post-Step 2 and conflicts with the captured plan, 04g-Governance
  emits a `must_fix` reconciliation finding referencing D-V5.
- **Pricing wiring (M2 fix)**: `subnet_plan` resources of types
  `bastion`, `azure-firewall`, `nat-gateway`, `vpn-gateway`,
  `expressroute-gateway`, `application-gateway` are appended to the
  Step 7 `resource_list` passed to `cost-estimate-subagent` (entries
  outside the static-fallback whitelist must be priced live). VNet
  base / NSG / subnet / route-table remain on the static-fallback
  whitelist (no MCP cost).

## Phase A — azure-defaults skill content

1. Edit [`.github/skills/azure-defaults/SKILL.md`](.github/skills/azure-defaults/SKILL.md):
   - Add a "VNet Planning Baseline" 5-line summary parallel to the
     other baselines. Show: trigger contract (requires[] OR service_name
     whitelist), default address space (`10.0.0.0/16` greenfield),
     Owner = Architect Phase 6b (between 6a SKU and 7 pricing),
     recommendation style (table + per-row askMe loop),
     opt-out key (`vnet_planning_mode`).
   - Add a Rule: "**VNet planning is interactive** — never auto-pick
     CIDRs without confirmation. Trigger: any
     `services[].requires[] ∈ {vnet-integration, private-endpoints}`
     **OR** `services[].service_name` in vnet-attached whitelist.
     Governance constraints in `04-governance-constraints.json`
     `network_constraints` block override defaults. Contract:
     [`references/vnet-planning.md`](.github/skills/azure-defaults/references/vnet-planning.md)."
   - Add a Step (between security-baseline and cost-monitoring): "Run
     the VNet planning gate if trigger contract holds. Skip when
     `decisions.vnet_planning_mode = deferred` (sandbox only)."
   - Append `references/vnet-planning.md` to the Reference Index.
   - (G2 follow-up — defer): Reference Index is now 4 baseline rows;
     leave the index flat for this pass and reconsider a
     `baselines.md` umbrella in a separate cleanup PR.

2. Create [`.github/skills/azure-defaults/references/vnet-planning.md`](.github/skills/azure-defaults/references/vnet-planning.md):
   - **Trigger contract** — the two-branch test above; include the
     authoritative `vnet-attached service whitelist` table.
   - **`vnet_planning_mode`** — describes the 3 modes, prod guardrail,
     and the Challenger informational findings emitted in fast/deferred.
   - **askQuestions Round 1** (single batched call when
     `mode ∈ {guided, fast}`):
     - Q1 `vnet_mode`: options `create-new` (default) / `use-existing`.
     - Q2 (when `create-new`) `vnet_address_space`: freeform CIDR
       (default `10.0.0.0/16`; hint: at least `/22` so subnets up to
       `/24` fit; greenfield rule: pick from RFC1918 not already used
       by governance-declared ranges).
     - Q3 (when `use-existing`) `existing_vnet_id`: freeform resource
       ID. After receipt, Architect runs the M4 CLI validation **before
       proceeding to Round 2**.
   - **Existing-VNet validation** — exact `az network vnet show`
     command, error-handling matrix (NotFound / Forbidden / wrong
     subscription / wrong region), how to overwrite
     `vnet_address_space` with live data.
   - **Subnet sizing matrix** (Rev 2 — Microsoft Learn citations
     required; (min, recommended) tuples; deprecation flags):
     - **App Gateway v2** — min `/26` (non-autoscale), recommended
       `/24` (autoscale headroom for v2 instance growth). Cite Learn:
       "Application Gateway infrastructure subnet sizing".
     - **APIM stv2** — min `/28` single-instance, recommended `/27`
       multi-instance / zone-redundant. Cite Learn: "API Management
       virtual network — subnet size requirements".
     - **AKS (Azure CNI Overlay)** — recommended `/24` per system
       node pool; parameterize by `(max_pods, target_node_count)` —
       formula `IPs = (max_pods × node_count) + (node_count × 1) + 1`
       rounded up to nearest CIDR. Cite Learn: "Plan IP addressing
       for your cluster — Azure CNI Overlay".
     - **AKS (Azure CNI, non-overlay)** — recommended `/22` minimum;
       same formula but each pod consumes a VNet IP. Surface a
       warning to prefer Overlay for new clusters.
     - **AKS (kubenet)** — **DEPRECATED** (retirement March 2028).
       Do **not** recommend for greenfield. If user pins kubenet,
       emit a `should_fix` Challenger finding referencing
       `deprecated-services.md` and use `/24` minimum.
     - **Private Endpoint subnet** — min `/29` (5 usable + 3 PE
       headroom), recommended `/27` for PE-heavy boundaries (≥8 PEs).
       NSG support: allowed since Sept 2021 GA; route-table support
       likewise. Cite Learn: "Private Endpoint network policies".
     - **App Service VNet integration (regional)** — min `/28` (5
       reserved Azure IPs), recommended `/26` (autoscale headroom).
       Delegation: `Microsoft.Web/serverFarms`. Cite Learn:
       "Integrate your app with an Azure virtual network — subnet".
     - **VM/VMSS workload** — min `/29`, recommended `/27`.
     - **Bastion** — `AzureBastionSubnet`:
       - **Basic SKU** — min `/26` (Microsoft hardened minimum for
         current Bastion deployments). Cite Learn: "Azure Bastion
         configuration settings — AzureBastionSubnet".
       - **Standard SKU with host scaling** — recommended `/26`
         minimum; `/24` for scale unit headroom.
     - **Azure Firewall** — `AzureFirewallSubnet` `/26` minimum
       (mandatory by Microsoft). Cite Learn: "Azure Firewall FAQ —
       subnet requirements".
     - **VPN/ER Gateway** — `GatewaySubnet` `/27` minimum,
       recommended `/26` if coexisting VPN + ExpressRoute.
     - **NAT Gateway** — no dedicated subnet (associates with up to
       16 subnets); ensure subnets needing outbound have it attached.
   - **CIDR math notes** — non-overlapping, all-inside-vnet,
     reserve a "spare" `/27` for growth, **5 Azure-reserved IPs per
     subnet** (network, gateway, two DNS, broadcast — important for
     `/29` and smaller).
   - **askQuestions Round 2** — present the proposed subnet table
     (purpose / SKU-derived size / address_prefix / delegation /
     NSG-attached / route-table). Per-row askMe with
     `Apply edit (freeform diff)` / `Skip this row` / `Done`. After
     3 edits without `Done`, emit soft warning then continue looping.
   - **Output** — `subnet_plan` JSON written via
     `apex-recall decide --key subnet_plan --value "$(cat plan.json)"`.
     Schema: `tools/schemas/subnet-plan.schema.json` (Phase B fix S2).
   - **Defaults that always hold** — NSG attached to every subnet;
     reserved-name subnets emitted only when the respective resource
     is in scope; service endpoints / private-endpoint-network-policies
     defaults captured per row.
   - **Cross-references** — pricing-guidance.md (gateway/Bastion/FW
     meters now in scope), adversarial-checklists.md (D-V1..D-V5),
     avm-modules.md (`avm/res/network/virtual-network` + child
     subnet child resource model), deprecated-services.md (kubenet).

## Phase B — Decision keys + schema

3. Register in [`tools/apex-recall/docs/decision-keys.md`](tools/apex-recall/docs/decision-keys.md)
   under a new "VNet planning keys" section:
   - `vnet_planning_mode` (default `guided`; `guided | fast |
deferred`; 03-Architect Phase 6b; read by 05-IaC Planner +
     06b/06t + 04g-Governance).
   - `vnet_mode` (required when gate fires; `create-new | use-existing`).
   - `existing_vnet_id` (required when `vnet_mode = use-existing`;
     full Azure resource ID; validated at capture by Architect).
   - `vnet_address_space` (CIDR string; authoritative — either user
     input for `create-new` or live `addressSpace.addressPrefixes[0]`
     for `use-existing`).
   - `subnet_plan` (JSON array conforming to
     `tools/schemas/subnet-plan.schema.json`).
   - `vnet_plan_decision` (`confirmed | edited | deferred`; status
     marker for downstream agents).

4. **Schema (S2 + G3 fix)** — create
   [`tools/schemas/subnet-plan.schema.json`](tools/schemas/subnet-plan.schema.json):
   - **Top-level (G3)**: `$schema: "https://json-schema.org/draft/2020-12/schema"`,
     `$id: "https://github.com/jonathan-vella/azure-agentic-infraops/schemas/subnet-plan/v1.json"`,
     `version: "1.0.0"`, `title: "Subnet Plan v1"`. Future fields (IPv6
     full support, NAT Gateway attachment, service-endpoint policies)
     bump to v2 in a sibling file; v1 stays frozen so old artifacts
     keep validating.
   - Array of objects.
   - Required fields: `name` (string), `address_prefix` (CIDR;
     pattern), `purpose` (enum: matches sizing matrix rows + `custom`).
   - Optional: `delegation` (enum of supported delegations + `none`),
     `nsg` (`auto | <name> | none`), `route_table` (`auto | <name> |
     none`), `service_endpoints` (string[]),
     `private_endpoint_network_policies` (`Enabled | Disabled`),
     `ipv6_prefix` (CIDR or null).
   - Wire into `validate:decision-keys` (load schema; when a project
     has `decisions.subnet_plan`, parse JSON and validate against
     schema; soft warning when missing).
   - Wire into `validate:sku-manifest` (whitelist enforcement, S2-A):
     validator loads the fenced ```yaml``` block under
     `vnet-planning.md`'s `## vnet-attached service whitelist` heading
     using a workspace-relative path constant; fails with actionable
     error if the heading or fence is missing.

## Phase C — Agent + gate wiring

5. Add a new section to
   [`.github/skills/azure-defaults/references/workflow-gates.md`](.github/skills/azure-defaults/references/workflow-gates.md):
   "**Architect (Step 2) — Phase 6b: VNet planning gate**". Body
   describes when to fire (trigger contract), the
   `vnet_planning_mode` branch, the two-round askQuestions templates
   (concise; defers full text to `vnet-planning.md`), the M4+S2-B
   two-step validation (auth preamble → resource probe; reference
   [`azure-cli-auth-validation.md`](.github/skills/azure-defaults/references/azure-cli-auth-validation.md)
   for the auth-fallback pattern), and the recall write-backs.

6. Edit [`.github/agents/03-architect.agent.md`](.github/agents/03-architect.agent.md):
   - Insert **one** numbered step between current 6a (SKU confirmation
     gate) and step 7 (pricing): "\*\*6b: VNet planning gate (MANDATORY
     when trigger contract holds; honor `decisions.vnet_planning_mode`)
     — follow the protocol in
     [`workflow-gates.md§architect-step-2--phase-6b-vnet-planning-gate`](.github/skills/azure-defaults/references/workflow-gates.md).
     Append any priced network resources (Bastion / Firewall /
     NAT-Gateway / VPN-Gateway / ER-Gateway / App-Gateway) from
     `subnet_plan` to the Step 7 resource_list."
   - Body line check: current file is 543 lines total, but the 520
     post-frontmatter cap has headroom (verified — `validate:agents`
     passes today). Adding ~3 lines (the step + a single bullet) stays
     well under cap. (G1 from Rev 1 was a false alarm; resolved.)

7. Edit [`.github/agents/05-iac-planner.agent.md`](.github/agents/05-iac-planner.agent.md):
   - Append one sentence to the Phase 4 cost-monitoring blockquote:
     "Also verify `subnet_plan` from Architect Phase 6b is reflected
     in the resource inventory. When `vnet_mode = use-existing`,
     record an exception entry if the existing VNet's live address
     space diverges from `vnet_address_space` (Architect already
     reconciled it at capture, so divergence here implies the VNet
     was mutated mid-flight)."

8. Edit [`.github/agents/_subagents/cost-estimate-subagent.agent.md`](.github/agents/_subagents/cost-estimate-subagent.agent.md):
   - In the resource_list ingestion section, document that
     reserved-subnet network resources (Bastion / Azure Firewall /
     NAT Gateway / VPN-Gateway / ER-Gateway / App Gateway / Application
     Gateway for Containers) arrive with explicit SKU fields and must
     be priced live (not static-fallback). Add the corresponding
     `product_filter` entries to `pricing-guidance.md` so the bulk
     call doesn't return 0 rows.

9. Edit [`.github/agents/04g-governance.agent.md`](.github/agents/04g-governance.agent.md)
   reconciliation step: when `04-governance-constraints.json` has a
   `network_constraints` block, compare against `vnet_address_space`,
   `subnet_plan` names, and NSG/route-table attachment defaults.
   Emit `must_fix` reconciliation findings on conflict referencing
   D-V5 (Phase D).

10. **No changes** to 02-Requirements or CodeGen agents — they consume
    `subnet_plan` from `apex-recall` already. The 06b/06t Wave 2
    "Networking (VNet, subnets, NSGs)" row becomes deterministic.

## Phase D — Adversarial assertions

11. Add to [`.github/skills/azure-defaults/references/adversarial-checklists.md`](.github/skills/azure-defaults/references/adversarial-checklists.md)
    near existing PE subnet / VNet sizing checks:
    - **D-V1 VNet trigger honored** — when the trigger contract holds,
      the plan emits a VNet resource (or references an existing one
      via `existing_vnet_id` with a verified live address space).
    - **D-V2 Address space valid** — `vnet_address_space` is at least
      `/22`; subnet CIDRs are non-overlapping and all inside
      `vnet_address_space`; 5 Azure-reserved IPs accounted for per
      subnet.
    - **D-V3 Subnet sizing per SKU** — every subnet meets the per-SKU
      (min, recommended) from `vnet-planning.md`. Specifically: App
      Gateway v2 ≥`/26`, APIM stv2 ≥`/28` (single) / `/27` (multi),
      AKS Azure CNI Overlay ≥formula result, PE ≥`/29`, App Service
      VNet integration ≥`/28`, Bastion ≥`/26` (any SKU), Firewall
      `/26`, Gateway ≥`/27`.
    - **D-V4 Reserved subnet names** — `AzureBastionSubnet` /
      `AzureFirewallSubnet` / `GatewaySubnet` only emitted when the
      respective resource is in scope.
    - **D-V5 Governance precedence honored** — when
      `04-governance-constraints.json` `network_constraints` declares
      allowed address ranges, required subnet names, mandatory NSG/UDR,
      or no-public-IP, every plan element conforms; conflicts surface
      as `must_fix` reconciliation findings from 04g-Governance.
    - **D-V6 Deprecated services flagged** — if `subnet_plan` infers
      AKS kubenet (or any service in `deprecated-services.md`), a
      `should_fix` finding is emitted with the retirement date.

## Phase E — Validation

12. `npm run validate:agents` — confirm 03-Architect body ≤520
    post-frontmatter (already has headroom; verified pre-change).
13. `npm run lint:md` — fix any MD013 in new content.
14. `npm run lint:vendor-prompting` — confirms the askQuestions
    invocations follow vendor rules (Round 1 multi-options OK; Round 2
    per-row askMe uses canonical 3-option pattern).
15. `npm run validate:decision-keys` — confirms the 6 new keys are
    registered AND the `subnet-plan.schema.json` schema is loaded
    (with `$id`/`$schema`/`version` per G3).
16. `npm run validate:sku-manifest` — confirms the new
    `vnet-attached service whitelist` enforcement (warn when whitelisted
    `service_name` present without `vnet_mode` decision post-Step 2)
    AND that the validator successfully loads the whitelist from the
    `vnet-planning.md` fenced block (S2-A — fails fast if heading or
    fence is missing).
17. **Manual smoke** (interactive): walk a fresh project through
    Architect Step 2 with an App Service + SQL workload using VNet
    integration + Private Endpoints + Bastion. Confirm: (a) gate fires
    after Phase 6a; (b) auth preamble + M4 CLI runs when user provides
    `existing_vnet_id`; (c) auth-fail fallback emits the informational
    finding instead of erroring (S2-B); (d) Bastion appears in Step 7
    pricing call; (e) `vnet_planning_mode = deferred` is blocked for
    prod; (f) governance reconciliation fires when constraints conflict.

## Deferred / Out of scope

- CLI-based existing-VNet picker (`az network vnet list` numbered
  menu). Plan keeps freeform resource-ID input + M4 validation.
- Multi-VNet / hub-spoke topology design (single VNet only —
  hub-spoke remains an opt-in pattern under `azure-bicep-patterns` /
  `terraform-patterns`).
- Subnet IP-exhaustion projection charts.
- Auto-detection of overlap with on-prem CIDR ranges (would require a
  separate "site networks" decision key).
- IPv6 subnets (schema field reserved; behavior deferred until
  governance requires it; v2 schema bump).
- `baselines.md` umbrella index in azure-defaults (G2 — separate
  cleanup PR).
- `vnet_planning_mode` distribution telemetry (G4 — fold into
  lesson-collection prompts in a follow-up PR; not blocking).
- Microsoft Learn URL freshness sweep (G5 — add a TODO in
  `vnet-planning.md` to revisit citations every release-train; the
  existing link-check covers anchor rot but not URL reorganization).

---

## Adversarial Review — Rev 2 (comprehensive lens, re-run)

**Verdict**: APPROVED with 2 should-fix + 3 suggestions. All Rev 1
must-fixes resolved. Ready to implement after addressing S1–S2 inline
during Phase A/B.

### Resolved from Rev 1

- ✅ **M1 Trigger taxonomy** — now grounded in canonical
  `sku-manifest.instructions.md` `requires[]` tokens (`vnet-integration`,
  `private-endpoints`) **OR** an explicit vnet-attached `service_name`
  whitelist owned by `vnet-planning.md` and enforced by
  `validate:sku-manifest`. Trigger now fires deterministically.
- ✅ **M2 Pricing ordering** — gate stays before pricing AND the
  reserved-subnet network resources (Bastion/Firewall/NAT-Gateway/
  Gateways/App-Gateway) are appended to the Step 7 resource_list with
  explicit `product_filter` documentation. No silently-zero meters.
- ✅ **M3 Sizing matrix** — rewritten with (min, recommended) tuples,
  Microsoft Learn citations, kubenet deprecation flag, AKS Azure CNI
  parameterized formula, App Gateway `/26` min / `/24` recommended,
  APIM stv2 `/28` single / `/27` multi, App Service VNet integration
  `/28` min, Bastion `/26` (any SKU), 5-reserved-IPs caveat for `/29`.
- ✅ **M4 Existing-VNet validation** — single `az network vnet show`
  at capture time; live `addressSpace.addressPrefixes[0]` becomes
  authoritative; explicit error matrix.
- ✅ **S1 Refinement loop** — replaced one-shot cap with the canonical
  per-row askMe loop (`Apply edit | Skip | Done`); soft warning at 3
  rounds without `Done` instead of auto-defer.
- ✅ **S2 subnet_plan schema** — `tools/schemas/subnet-plan.schema.json`
  introduced and wired into `validate:decision-keys`.
- ✅ **S3 Governance precedence** — explicit precedence statement +
  04g-Governance reconciliation step + D-V5 assertion.
- ✅ **S4 Opt-out** — `vnet_planning_mode = guided|fast|deferred` with
  prod guardrail.
- ✅ **G1 Body line budget** — verified via `wc -l` + passing
  `validate:agents`; 543 total / ≤520 post-frontmatter has headroom.
  Plan adds ~3 lines.

### Should-fix (Rev 2)

- **S2-A `vnet-attached service whitelist` is dual-sourced.**
  Phase A2 puts the whitelist in `vnet-planning.md`, but the trigger
  test runs at Architect Phase 6b which loads `azure-defaults`. If
  `validate:sku-manifest` also enforces it, the whitelist now exists
  in **two** files. **Fix**: declare the whitelist once in
  `vnet-planning.md`, then have the validator load it from there
  (single source of truth). Mention in Phase B/E that the validator
  reads it via a relative path.

- **S2-B Existing-VNet validation needs an `az` availability check.**
  M4 assumes `az` is on PATH and authenticated. In greenfield clone
  scenarios (no `az login`) the CLI call will throw a confusing token
  error mid-askQuestions. **Fix**: Architect Phase 6b preamble runs
  `az account show -o none 2>/dev/null` once when `vnet_mode =
use-existing` is chosen; on failure, fall back to "trust user input,
  defer validation to Planner Phase 4" with a Challenger informational
  finding. This mirrors how 04g-Governance handles missing auth.

### Suggestions (Rev 2)

- **G3 Schema versioning.** `subnet-plan.schema.json` should embed
  `$id` and `$schema` (Draft 2020-12) so future fields (IPv6, NAT
  Gateway attachment, service-endpoint policies) can be added with
  a `version` field and old artifacts validate against the v1 schema.
- **G4 Telemetry hook (defer).** `vnet_planning_mode` distribution
  across projects (guided vs fast vs deferred) would be a useful
  lesson-learned input. Not blocking — add to lesson-collection
  prompts in a follow-up.
- **G5 Learn citation rot.** The Phase A2 sizing matrix locks in
  Microsoft Learn URLs. Add a TODO in `vnet-planning.md` to revisit
  citations every release-train (link-check already covers anchor
  rot, but Azure docs reorganize URLs without redirects sometimes).

### Smallest viable Rev 3 patch (applied — this is now Rev 3)

1. ✅ Consolidate vnet-attached whitelist to `vnet-planning.md` only;
   validator loads it from there (S2-A) — see Decisions captured /
   Phase B step 4.
2. ✅ Add `az account show` preamble + fallback to Phase 6b (S2-B) —
   see Decisions captured / Phase C step 5.
3. ✅ Add `$id`/`$schema`/`version` to `subnet-plan.schema.json` (G3)
   — see Phase B step 4.
4. ✅ Move G4 (telemetry) and G5 (citation rot) to Deferred / Out of
   scope so they don't block implementation.

Rev 3 is implementation-ready. No further adversarial round required
before starting Phase A.
