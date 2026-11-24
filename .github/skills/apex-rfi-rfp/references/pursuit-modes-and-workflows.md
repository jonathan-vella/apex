<!-- ref:pursuit-modes-and-workflows-v1 -->

# Pursuit Modes, Orchestration & Workspace Coexistence

Operational contract for selecting a pursuit mode, batching user intake, enforcing capability and authorization gates (`RD-09`), and coexisting cleanly inside `agent-output/{project}/` without mutating numbered delivery workflow state.

## 1. Selecting the Right Pursuit Mode

Choose the narrowest mode that satisfies the solicitation returnables:

| Mode | Solicited Returnable | Execution Topology | Mandatory Review Gates |
| --- | --- | --- | --- |
| `questionnaire_matrix` | Technical/security/compliance RFI table or vendor capability grid (no commercial BoQ pack) | Single-pass fast track | `verify_pursuit_package.py` + Learn `<title>` & epistemic tag audit |
| `rom_architecture_pack` | Full RFP/RFI response with target Azure architecture, 4K diagrams, ADRs, ROM `.xlsx` BoQ, narrative pack, and optional executive `.pptx` | Two-phase: Interactive Discovery + Hardened Plan (`docs/exec-plans/active/`) -> Autopilot `WS1`–`WS6` | `rubber-duck` on Phase 1 plan + `cost-estimate-subagent` + `code-review` on generators/workbooks |
| `bafo_customer_schedule` | Mandatory customer-issued `.xlsx` pricing/compliance schedule where structural edits risk procurement disqualification | Non-destructive customer workbook clone + cell-scoped generator + reconciliation bridge | `cost-estimate-subagent` + `xlsx_ast_cache.py --compare-template` + `code-review` |
| `draft_audit_remediation` | Existing bid draft, partner BoQ, or prior-round workbook suspected of scope bloat, retiring SKUs, stale rates, or formula/OOXML defects | Forensic audit -> Keep-vs-Discard ledger -> clean rebuild or scripted remediation | `audit_pursuit_skus_and_rates.py` + `xlsx_ast_cache.py --verify` + `code-review` |

### Mode A: `questionnaire_matrix` (Single-Pass Fast Track)

1. Run [`../scripts/extract_pursuit_sources.py`](../scripts/extract_pursuit_sources.py) to compute `SHA-256` hashes over all solicitation files and extract structured clauses/rows into `_meta/extracted/`.
2. Batch any missing material scope inputs (bidder persona, target region if not `swedencentral`, residency/compliance boundary) in a single validated `#tool:ask_user` call.
3. Verify every Azure service limit, SLA, compliance control, and GA capability via [`.github/skills/apex-microsoft-docs/SKILL.md`](../../apex-microsoft-docs/SKILL.md), tagging each clause `source-verified`, `customer-reported`, `vendor confirmation required`, or `drill unproven`.
4. Author `agent-output/{project}/README.md` ([`../templates/pursuit-readme.template.md`](../templates/pursuit-readme.template.md)), the clause-by-clause compliance matrix, and [`../templates/evidence-and-provenance.template.md`](../templates/evidence-and-provenance.template.md).
5. Run [`../scripts/verify_pursuit_package.py`](../scripts/verify_pursuit_package.py) to confirm source immutability, H2 compliance, epistemic coverage, and link integrity.

### Mode B: `rom_architecture_pack` (Two-Phase Discovery -> Autopilot `WS1`–`WS6`)

Complex architecture + ROM pursuits split interactive human alignment from deterministic artifact generation so context compaction never loses customer constraints or hash bindings.

#### Phase 1 — Interactive Discovery & Hardened Compaction-Proof Plan

1. **Read-Only Intake**: Execute `extract_pursuit_sources.py` to freeze `_meta/source-manifest.json` (`SHA-256` per input file) and inspect extracted RFP requirements, schedules, and Q&A addenda.
2. **Validated Question Batching**: Collect missing material decisions (`bidder_persona`, primary/DR regions, commitment posture, currency/FX rules for non-1P personas, Purview sensitivity boundary) through `#tool:ask_user`.
3. **Author Compaction-Proof Execution Plan**: Write `docs/exec-plans/active/{project}-pursuit-plan.md` from [`../templates/pursuit-exec-plan.template.md`](../templates/pursuit-exec-plan.template.md). Embed:
   - Exact `_meta/source-manifest.json` file list and `SHA-256` digests
   - Bidder persona (`microsoft_1p_partner_advisory`, `partner_prime_bidder`, or `isv_solution_provider`)
   - Explicit **Keep-vs-Discard** scope table (preventing gold-plated add-ons and defaulting to single-region multi-AZ unless multi-region DR is mandated)
   - Candidate SKU list, target region (`swedencentral` default; `germanywestcentral` failover when mandated; `westeurope` for Static Web Apps), and variable usage assumptions
   - Workstream file ownership and acceptance gates (`WS1`–`WS6`)
4. **Independent Plan Review**: Invoke `rubber-duck` against `docs/exec-plans/active/{project}-pursuit-plan.md` and the extracted RFP summary to challenge scope creep, retiring SKUs, unit mismatches (`TB` vs. `TiB`), and RACI gaps. Resolve blocking findings and obtain explicit user approval before entering Phase 2.

#### Phase 2 — Autopilot Workstreams (`WS1`–`WS6`)

- **`WS1` — Requirement Normalization & Traceability**: Map every mandatory customer clause, returnable schedule, SLA/RTO/RPO target, and pass/fail gate to a numbered requirement ID and Keep-vs-Discard disposition.
- **`WS2` — Architecture, Live Regional/AZ Verification & ADRs**: Design the minimum compliant Azure architecture, verify SKU + Availability Zone offerings in target regions via [`.github/skills/apex-azure-quotas/SKILL.md`](../../apex-azure-quotas/SKILL.md), and record major architecture/commercial trade-offs via [`.github/skills/apex-azure-adr/SKILL.md`](../../apex-azure-adr/SKILL.md).
- **`WS3` — Primary Pricing & Constrained Rate Audit**: Obtain primary Azure retail figures from `cost-estimate-subagent` (`cost-estimate-v2` or `retail-rate-quote-v1`) + `node tools/scripts/cost-estimate.mjs`, then run [`../scripts/audit_pursuit_skus_and_rates.py`](../scripts/audit_pursuit_skus_and_rates.py) for `SHA-256`-evidenced RI (`1 Year`/`3 Years`), Compute Savings Plan, tiered-meter, `DevTestConsumption` exclusion, `UNRESOLVED` sentinel, and retirement checks.
- **`WS4` — Deterministic Workbook Engineering & AST Cache**: Build the `.xlsx` ROM BoQ from a reproducible generator script (`generators/build_rom_workbook.py`), separating `Assumptions_&_Controls` from workload tabs, and run [`../scripts/xlsx_ast_cache.py`](../scripts/xlsx_ast_cache.py) to evaluate formulas with Excel `ROUND_HALF_UP`, populate typed `<v>` caches, verify control-cell permutations, and guard `<=255`-char headers/footers.
- **`WS5` — 4K Diagrams, Narrative Pack & Executive Deck**: Render 4K architecture diagrams via [`.github/skills/apex-python-diagrams/SKILL.md`](../../apex-python-diagrams/SKILL.md) (`0` overflow warnings) and inline workflows via [`.github/skills/apex-mermaid/SKILL.md`](../../apex-mermaid/SKILL.md). Populate `README.md`, [`../templates/bid-commercial-playbook.template.md`](../templates/bid-commercial-playbook.template.md), [`../templates/evidence-and-provenance.template.md`](../templates/evidence-and-provenance.template.md), [`../templates/handoff-email.template.md`](../templates/handoff-email.template.md), and optional `.pptx` executive summary.
- **`WS6` — Parity Audit, Code Review & Gated Release**: Run `code-review` across generator scripts and formula logic, verify exact headline parity across JSON -> `.xlsx` -> `.md` -> `.pptx`, execute `verify_pursuit_package.py`, and run [`../scripts/package_pursuit.py`](../scripts/package_pursuit.py) only within authorized Purview boundaries.

### Mode C: `bafo_customer_schedule` (Non-Destructive Customer `.xlsx` Schedule)

1. Archive the customer-supplied `.xlsx` untouched and record its `SHA-256` in `_meta/source-manifest.json`.
2. Inspect `xl/workbook.xml`, `xl/_rels/workbook.xml.rels`, locked/unlocked cell styles, merged cells, data validations, defined names, and formulas.
3. Write a deterministic Python script that clones the original customer `.xlsx` and writes **only** authorized bidder input cells (preserving customer formulas, sheet order, hidden procurement tabs, validations, and print settings).
4. Execute `xlsx_ast_cache.py --workbook <populated.xlsx> --compare-template <customer-original.xlsx>` to verify typed `<v>` caches, `<=255`-char headers/footers, and zero structural OOXML mutations.
5. Publish [`../templates/model-changelog-bridge.template.md`](../templates/model-changelog-bridge.template.md) documenting every BAFO commercial and technical delta from prior rounds.

### Mode D: `draft_audit_remediation` (Forensic Bid & Workbook Audit)

1. Hash all inherited drafts and workbooks read-only via `extract_pursuit_sources.py`.
2. Run `audit_pursuit_skus_and_rates.py` and read-only `xlsx_ast_cache.py --workbook <inherited.xlsx> --verify` against the inherited workbook and rate card without modifying hashed originals (perform any `<v>` cache repair or remediation only on an explicit working copy via `--output <working-copy.xlsx>` outside the read-only source directory) to surface:
   - Hidden cross-scope bloat (unrelated workloads, unrequested multi-region active-active stamps, duplicate Defender/monitoring charges, compounded margin-on-buffer formulas)
   - Retiring or region-unavailable Azure SKUs (`Fsv2`, `Bv1`, classic `APIM` v1, Linux `Consumption` Functions, non-AZ `VpnGw1-5`, `Basic Public IP`, classic `App Insights`, `GPv1`, Key Vault access policies, `Dedicated HSM`, `Azure Cache for Redis`)
   - Stale or `DevTestConsumption` prices, `$0.00` masking missing quotes, broken `<v>` caches, or `>255`-char Excel repair-triggering footers
   - Broken/misattributed Learn citations or missing epistemic tags (`drill unproven`, `vendor confirmation required`)
3. Rebuild cleanly from customer schedules rather than patching bloated legacy workbooks, documenting every removed, rightsized, or repriced line item in [`../templates/model-changelog-bridge.template.md`](../templates/model-changelog-bridge.template.md).

## 2. Native `#tool:ask_user` Intake Batching Contract

Apply the repository's strict question-batching contract before displaying any intake or gate prompt:

- Ask **only** missing, applicable material inputs; reuse facts already extracted from solicitation files or user instructions.
- Use distinct contextual field titles and **one field per independent decision**. Never append unconditional companion note fields or separate `"Other, explain"` fields—native fields already accept custom free text.
- Gate conditional follow-ups with `when: {input_id, equals}` referencing an already captured answer, never a suggested default. Never set defaults on `approval` or `disposition` fields.
- Keep `context` (`answers` + `fields` ledger) separate from the native `#tool:ask_user` payload (`message` + `requestedSchema` containing only `properties`).
- Preflight before calling `#tool:ask_user`:

```bash
python3 tools/scripts/validate_question_batching.py \
  --form agent-output/<project>/_meta/intake-form.json \
  --context agent-output/<project>/_meta/intake-context.json \
  --require-context
```

Read-only callers validate in memory via `validate_payload(form, context, require_context=True)` from `tools/scripts/validate_question_batching.py` without widening write scope. Remove temporary form payloads once answered.

## 3. Capability & Authorization Gates (`RD-09`)

| Action / Dependency | Mandatory Gate |
| --- | --- |
| `git commit`, `git push`, branch rename, PR/issue creation | **Never authorized by loading `apex-rfi-rfp`**. Require explicit user instruction for each operation and follow [`.github/skills/apex-github-operations/SKILL.md`](../../apex-github-operations/SKILL.md). Exclude `agent-output/` unless explicitly scoped by the user. |
| External `.zip` distribution or customer/partner email dispatch | **Never automatic**. Require two-part Purview/derived-data clearance (`RD-05`) and human release sign-off. |
| `cost-estimate-subagent` unavailable when Azure retail pricing is needed | **HARD STOP**. Report the missing subagent capability; never estimate rates from parametric memory or scrape unverified third-party calculators. |
| `rubber-duck` unavailable during `rom_architecture_pack` Phase 1 | **HARD STOP**. Report that independent plan review is unavailable in the active harness rather than silently skipping review or fabricating a review record. |
| `code-review` unavailable before `WS6` / BAFO workbook sign-off | **HARD STOP**. Report the missing capability rather than claiming independent code/formula review passed. |

## 4. Safe Coexistence in `agent-output/{project}/`

Pursuit outputs live under `agent-output/{project}/` alongside APEX projects while keeping a strict boundary from the numbered infrastructure delivery workflow:

```text
agent-output/{project}/
├── README.md                              # Exact 5 PROJECT-README H2s (from pursuit-readme.template.md)
├── pursuit-compliance-matrix.md           # Clause-by-clause RFI/RFP responses + epistemic tags
├── pursuit-architecture-pack.md           # Target architecture, sizing math, and DR posture
├── pursuit-commercial-playbook.md         # Persona rules, RACI, blockers, validation notice
├── pursuit-changelog-bridge.md            # Keep-vs-Discard & round-over-round bridge
├── pursuit-evidence-and-provenance.md     # SHA-256 manifest + HTTP-200 Learn <title> ledger
├── pursuit-handoff-email.md               # Ready-to-review transmittal + AI-assistance notice
├── assets/                                # 4K dlib.py diagrams (.py, .png, .svg)
├── contracts/                             # cost-estimate-v2 / retail-rate-quote-v1 JSON bundles
├── deliverables/                          # Generated .xlsx schedules, optional .pptx, gated .zip
├── generators/                            # Deterministic Python .xlsx / .pptx builder scripts
└── _meta/                                 # source-manifest.json, extracted text, xlsx/rate audits
```

Enforce four coexistence invariants:

1. **Exact 5 `PROJECT-README` H2s**: `agent-output/{project}/README.md` MUST contain these exact H2 headings in order (per [`.github/skills/apex-azure-artifacts/SKILL.md`](../../apex-azure-artifacts/SKILL.md)):
   - `## 📋 Project Summary`
   - `## ✅ Workflow Progress`
   - `## 🏛️ Architecture`
   - `## 📄 Generated Artifacts`
   - `## 🔗 Related Resources`
2. **Zero Delivery-Step Completion Claims**: State explicitly under `## ✅ Workflow Progress` that the directory is a standalone `apex-rfi-rfp` pursuit package and **no numbered delivery step completion is asserted**. Never call `apex-recall complete-step` or `apex-recall transition --complete` to manufacture delivery progress.
3. **Reserved Filename Prohibition**: Never create or overwrite `01-requirements.md`, `02-architecture-assessment.md`, `03-des-cost-estimate.md`, `04-governance-constraints.md`, `04-implementation-plan.md`, or `07-*.md` inside a pursuit package. If the customer later awards the bid and transitions to IaC delivery, `01-Orchestrator` starts or adopts a formal delivery project cleanly.
4. **Validator Delegation**: Never run `markdownlint-cli2` or `npm run lint:artifact-templates` directly against `agent-output/**`. Use `node tools/scripts/check-h2-order.mjs agent-output/<project>/README.md` for `README.md` H2 sanity checks and `scripts/verify_pursuit_package.py` for pursuit-specific invariants.
