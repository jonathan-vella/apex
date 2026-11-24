---
name: apex-rfi-rfp
user-invocable: true
disable-model-invocation: false
argument-hint: "pursuit folder/files, bidder role (1P/partner/ISV), and mode (matrix, ROM, BAFO, audit)"
description: '**WORKFLOW SKILL** — Build Azure RFI/RFP/BAFO responses, ROM BoQs, and bid packs. WHEN: "answer RFI", "answer RFP", "BAFO response", "compliance matrix", "ROM BoQ", "partner bid advisory", "audit bid workbook". DO NOT USE FOR: IaC code generation or deployment (05-IaC Planner, 06b/06t, apex-azure-deploy) or live tenant WAF assessments (01-Orchestrator assessment mode).'
license: MIT
metadata:
  author: apex
  version: "1.0.0"
  category: pursuit-advisory
---

# Azure RFI, RFP & BAFO Pursuit Skill

Deliver source-verified, commercially guarded Azure RFI, RFP, and Best and Final Offer (BAFO) pursuit packages without mutating customer returnables or fabricating retail rates. Invoke `/apex-rfi-rfp` with the pursuit inputs, bidder persona, and pursuit mode.

## When to Use This Skill

- **`questionnaire_matrix`** — Single-pass technical/security RFI compliance matrix with verified citations and epistemic tags.
- **`rom_architecture_pack`** — Two-phase RFP/ROM bid pack: interactive intake + hardened plan + `rubber-duck` review, followed by Autopilot workstreams (`WS1`–`WS6`) producing architecture, 4K diagrams, ADRs, verified `.xlsx` ROM BoQ, and narrative artifacts.
- **`bafo_customer_schedule`** — Non-destructive population of mandatory customer `.xlsx` schedules verified with `--compare-template` OOXML preservation checks and a reconciliation bridge.
- **`draft_audit_remediation`** — Audit and clean rebuild of inherited drafts or prior-round workbooks for cross-scope bloat, retiring SKUs, citation drift, and Excel AST/OOXML defects.
- **Neutral Bidder Personas** — Supports `microsoft_1p_partner_advisory` (1P Azure Public Retail USD only; `"PARTNER QUOTE REQUIRED"` sentinels), `partner_prime_bidder`, and `isv_solution_provider`.
- **Anti-Scope** — Do not use this skill for Bicep/Terraform generation or Azure deployment (`05-IaC Planner`, `06b-Bicep CodeGen`, `06t-Terraform CodeGen`, `apex-azure-deploy`), or live tenant Well-Architected assessments (`01-Orchestrator` with `workflow_mode=assessment`).

## Prerequisites

- **Runtime & Packages**: Python 3.14+ (`requires-python >=3.14`) and `openpyxl` (required by `extract_pursuit_sources.py`, `xlsx_ast_cache.py`, and `verify_pursuit_package.py`; installed via repository `requirements.txt`); optional `pypdf` (or `pdftotext` CLI) for `.pdf` text extraction and optional `python-pptx` for `--scaffold-pptx` executive slide generation.
- **Hard Capability Stop Rule (`RD-09`)**: Retail pricing MUST route through `cost-estimate-subagent` (`cost-estimate-v2` or `retail-rate-quote-v1`) and `node tools/scripts/cost-estimate.mjs`. Plan review (`rom_architecture_pack`) requires `rubber-duck`, and generator/workbook verification requires `code-review`. If a required worker is unavailable in the active harness, **STOP** and report the missing capability—never invent inline retail prices or self-certify reviews.
- **Authorization Boundary (`RD-09`)**: Loading this skill never authorizes `git commit`, `git push`, branch/PR creation, or external customer release.
- **Question Batching**: Validate every `#tool:ask_user` payload before display using `python3 tools/scripts/validate_question_batching.py --form <form.json> --context <context.json> --require-context`.
- **Sensitivity & Derived-Data Gate (`RD-05`)**: Derived `.md`, `.xlsx`, `.pptx`, and `.png` outputs retain customer-sensitive data even when raw originals are excluded. External packaging requires explicit sensitivity-label owner approval (`--acknowledge-purview-clearance "<ref>"`) or reviewed anonymization, plus an AI-assistance validation notice.

## Step-by-Step Workflows

1. **Archive & Extract Read-Only Inputs** — Hash customer files into `_meta/source-manifest.json` before analysis and never mutate originals:

   ```bash
   python3 .github/skills/apex-rfi-rfp/scripts/extract_pursuit_sources.py \
     --source-dir <customer-inputs> \
     --manifest-out agent-output/<project>/_meta/source-manifest.json \
     --markdown-out agent-output/<project>/_meta/extracted-sources.md
   ```

2. **Confirm Mode, Persona & Scope Guardrails** — Load [`references/pursuit-modes-and-workflows.md`](references/pursuit-modes-and-workflows.md) and [`references/commercial-and-raci-guardrails.md`](references/commercial-and-raci-guardrails.md). Enforce **Compliance Wins Over Cost + Zero Over-Engineering**: run an explicit Keep-vs-Discard scope audit and default to **single-region multi-AZ** (`swedencentral`, with `germanywestcentral` failover only when multi-region DR is mandated, and `westeurope` for Static Web Apps). For `rom_architecture_pack`, author the compaction-proof plan from [`templates/pursuit-exec-plan.template.md`](templates/pursuit-exec-plan.template.md) and run `rubber-duck` before `WS1`–`WS6`.
3. **Price & Audit SKUs Fail-Closed (`RD-02`, `RD-07`)** — Load [`references/pricing-and-workbook-engineering.md`](references/pricing-and-workbook-engineering.md). Dispatch `cost-estimate-subagent` (`purpose: "monthly-estimate"` or `purpose: "rate-quote"`), validate via `node tools/scripts/cost-estimate.mjs`, verify target-region and zone SKU availability, and run supplemental RI, Savings Plan, tiered-meter, and retirement checks (failing closed as `UNRESOLVED`, never `$0.00`):

   ```bash
   python3 .github/skills/apex-rfi-rfp/scripts/audit_pursuit_skus_and_rates.py \
     --validate-bundle agent-output/<project>/contracts/pursuit-cost-estimate.json \
     --deprecations-file .github/data/azure-deprecations.json \
     --out agent-output/<project>/_meta/sku-rate-audit.json
   ```

4. **Generate Deterministically & Verify Excel AST / OOXML (`RD-03`, `RD-04`)** — Never hand-edit derived `.xlsx`, `.pptx`, `.png`/`.svg`, `.md` ROM tables, or `.zip` archives. Update generator scripts, evaluate supported formulas with Excel `ROUND_HALF_UP`, write typed `<v>` caches, check `<=255`-char headers/footers, and run `--compare-template` for customer BAFO schedules:

   ```bash
   python3 .github/skills/apex-rfi-rfp/scripts/xlsx_ast_cache.py \
     --workbook agent-output/<project>/deliverables/commercial-schedule.xlsx \
     --compare-template <customer-schedule.xlsx> \
     --report agent-output/<project>/_meta/xlsx-audit.json
   ```

5. **Coexist Safely in `agent-output/{project}/`, Cite & Package (`RD-05`, `RD-07`)** — Load [`references/citation-and-audit-checklist.md`](references/citation-and-audit-checklist.md). Author `agent-output/{project}/README.md` from [`templates/pursuit-readme.template.md`](templates/pursuit-readme.template.md) with the exact 5 `PROJECT-README` H2s stating no numbered delivery step completion is asserted, avoid reserved delivery-step filenames, verify parity, and gate release packaging:

   ```bash
   python3 .github/skills/apex-rfi-rfp/scripts/verify_pursuit_package.py \
     --project-dir agent-output/<project> && \
   python3 .github/skills/apex-rfi-rfp/scripts/package_pursuit.py \
     --project-dir agent-output/<project> \
     --exclude-restricted-originals \
     --acknowledge-purview-clearance "<approval-ref>"
   ```

## Bundled Scripts & Templates

| Resource | Purpose |
| --- | --- |
| [`scripts/extract_pursuit_sources.py`](scripts/extract_pursuit_sources.py) | Read-only `SHA-256` source manifest and safe `.xlsx`/`.docx`/email/PDF text extraction |
| [`scripts/audit_pursuit_skus_and_rates.py`](scripts/audit_pursuit_skus_and_rates.py) | Bundle validator, constrained RI/SP/tiered checker (excluding `DevTestConsumption`), `UNRESOLVED` sentinel & retirement audit |
| [`scripts/xlsx_ast_cache.py`](scripts/xlsx_ast_cache.py) | Fail-closed Excel AST evaluator, `workbook.xml.rels` resolver, typed `<v>` cache writer, `--compare-template` & `<=255`-char header/footer guard |
| [`scripts/package_pursuit.py`](scripts/package_pursuit.py) | Two-part Purview/derived-data release packager and optional `python-pptx` executive deck scaffold |
| [`scripts/verify_pursuit_package.py`](scripts/verify_pursuit_package.py) | End-to-end source hash, headline parity, H2 coexistence, link hygiene, and sentinel verifier |
| [`templates/pursuit-readme.template.md`](templates/pursuit-readme.template.md) | Coexisting `agent-output/{project}/README.md` with exact 5 `PROJECT-README` H2s |
| [`templates/pursuit-exec-plan.template.md`](templates/pursuit-exec-plan.template.md) | Compaction-proof Phase 1 plan template (`WS1`–`WS6`, Keep-vs-Discard ledger, scope hashes) |
| [`templates/bid-commercial-playbook.template.md`](templates/bid-commercial-playbook.template.md) | Persona-aware commercial assumptions, FX/margin/buffer rules, RACI, and validation notice |
| [`templates/handoff-email.template.md`](templates/handoff-email.template.md) | Partner/stakeholder transmittal with submission blockers and AI-assistance validation notice |
| [`templates/evidence-and-provenance.template.md`](templates/evidence-and-provenance.template.md) | Source `SHA-256` ledger, HTTP-200 Microsoft Learn `<title>` citations, and epistemic tag index |
| [`templates/model-changelog-bridge.template.md`](templates/model-changelog-bridge.template.md) | Clean-rebuild and BAFO round-over-round commercial/architectural reconciliation bridge |

## Troubleshooting

| Symptom / Blocker | Resolution |
| --- | --- |
| `cost-estimate-subagent`, `rubber-duck`, or `code-review` unavailable | STOP immediately (`RD-09`); report missing capability to user without fabricating inline rates or reviews |
| Meter missing or ambiguous in `audit_pursuit_skus_and_rates.py` | Keep fail-closed `"UNRESOLVED"` or `"PARTNER QUOTE REQUIRED"` sentinel; never substitute `$0.00` |
| `UnsupportedFormulaError` in `xlsx_ast_cache.py` | Rewrite unsupported/array/3D/table formulas into deterministic supported functions and regenerate |
| `--compare-template` drift or `>255`-char `<oddHeader>`/`<oddFooter>` | Restore customer sheet/validation/merge XML and shorten header/footer strings below `255` chars |
| `package_pursuit.py` blocks external `.zip` creation | Supply `--exclude-restricted-originals` plus verified `--acknowledge-purview-clearance "<ref>"` or keep internal |

## Reference Index

Load these domain reference guides on demand:

| Reference | When to Load |
| --- | --- |
| [`references/pursuit-modes-and-workflows.md`](references/pursuit-modes-and-workflows.md) | Mode selection, `WS1`–`WS6` Autopilot execution, `#tool:ask_user` batching, capability gates, and `agent-output/{project}/` coexistence |
| [`references/commercial-and-raci-guardrails.md`](references/commercial-and-raci-guardrails.md) | Bidder personas (`1P`, `partner`, `ISV`), RACI matrices, Keep-vs-Discard single-region defaults, and Purview derived-data release gates |
| [`references/pricing-and-workbook-engineering.md`](references/pricing-and-workbook-engineering.md) | `cost-estimate-subagent` routing, supplemental RI/SP/tiered rate audits, generator-first `.xlsx` AST/`<v>` caching, and `TB` vs. `TiB` math |
| [`references/citation-and-audit-checklist.md`](references/citation-and-audit-checklist.md) | Microsoft Learn `<title>` citations, epistemic tags, curated SKU retirement & regional GA traps, and pre-release checklist |

### Composed APEX Skills

- [`.github/skills/apex-microsoft-docs/SKILL.md`](../apex-microsoft-docs/SKILL.md) — Official Microsoft Learn verification and `<title>` retrieval
- [`.github/skills/apex-python-diagrams/SKILL.md`](../apex-python-diagrams/SKILL.md) — 4K Azure architecture diagrams and cost/WAF charts (`dlib.py`)
- [`.github/skills/apex-mermaid/SKILL.md`](../apex-mermaid/SKILL.md) — Inline Mermaid sequence, swimlane, and RACI flowcharts
- [`.github/skills/apex-azure-adr/SKILL.md`](../apex-azure-adr/SKILL.md) — Architecture Decision Records for Keep-vs-Discard and SKU trade-offs
- [`.github/skills/apex-azure-quotas/SKILL.md`](../apex-azure-quotas/SKILL.md) — Live target-region and Availability Zone SKU availability checks
- [`.github/skills/apex-azure-artifacts/SKILL.md`](../apex-azure-artifacts/SKILL.md) — `PROJECT-README` H2 rules and [`pursuit-advisory-packages.md`](../apex-azure-artifacts/references/pursuit-advisory-packages.md) coexistence conventions
- [`.github/skills/apex-github-operations/SKILL.md`](../apex-github-operations/SKILL.md) — Explicitly authorized branch, commit, push, and PR workflows
