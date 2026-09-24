---
applyTo: "**/agent-output/**/*.md"
description: "Template compliance rules for artifact generation"
---

# Artifact Generation Rules

Use exact H2 headings from the template files. Violations block commits and PRs.

The artifact contract is enforced at commit/CI time only — agents do not
self-lint. Validated by the lefthook `artifact-validation` pre-commit hook
(which wraps `npm run validate:artifacts`) and CI; see
[`agent-authoring.instructions.md`](agent-authoring.instructions.md#no-direct-markdownlint-on-agent-output-rule).

The `apex-azure-artifacts/SKILL.md` is authoritative — read it for templates, workflow, styling.

## Structural Elements (Beyond H2 Headings)

Reproduce the template's badge row, collapsible TOC, attribution line, cross-navigation
table, Mermaid blocks, traffic-light status (✅ / ⚠️ / ❌) and `<details>` sections.
Details: [`styling-standards.md`](../skills/apex-azure-artifacts/references/styling-standards.md).

## Complete H2 Heading Reference

Copy-paste headings from the template files. Do not paraphrase. Full templates live in
`templates/`; the `references/` files are H2 navigation summaries.

| Artifacts                            | H2 summary (`references/`)         | Full template (`templates/`)                        |
| ------------------------------------ | ---------------------------------- | --------------------------------------------------- |
| 01-requirements                      | `01-requirements-template.md`      | `01-requirements.template.md`                       |
| 02-architecture, 03-cost-estimate    | `02-architecture-template.md`      | `02-architecture-assessment.template.md`, `03-des-cost-estimate.template.md` |
| 04-plan, 04-governance, 04-preflight | `04-plan-template.md`              | `04-implementation-plan.template.md`, `04-governance-constraints.template.md`, `04-preflight-check.template.md` |
| 05-implementation-reference          | `05-code-template.md`              | `05-implementation-reference.template.md`           |
| 06-deployment-summary                | `06-deploy-template.md`            | `06-deployment-summary.template.md`                 |
| 07-\* (all Step 7 docs)              | `07-docs-template.md`              | `07-*.template.md`                                  |
| project README                       | —                                  | `PROJECT-README.template.md` (H2 set byte-exact incl. emoji) |
| sku-manifest                         | —                                  | `sku-manifest.template.md` + [`sku-manifest.instructions.md`](sku-manifest.instructions.md) (rendered from `sku-manifest.json`; schema-driven, not H2-sync-enforced) |

H2 fixes are human-run (`npm run fix:artifact-h2`); agents do **not** invoke validation or
fix scripts against `agent-output/**`.

## Revision Workflow (Targeted Edits Over Full Rewrites)

Revise existing artifacts with targeted edits or `apply_patch`, not `create_file`.
Batch independent accepted fixes where practical; validate before dependent follow-up edits.
A structural rewrite (H2 reordering, template version bump, >50 % of lines) is recorded with
`apex-recall decide <project> --decision "Full rewrite of <artifact>" --rationale "<why>" --step <N> --json`.
Full procedure: [`revision-workflow.md`](../skills/apex-azure-artifacts/references/revision-workflow.md).

**Scoped precheck rule**: `sku-manifest.json`, `00-handoff.md` and the project `README.md`
change at nearly every gate, so revision-2+ writes to them MUST use targeted editing tools;
`create_file` is permitted only on the first write. Other artifacts may be re-rendered when
their structure changes substantially.

## Common Errors and Fixes

- `missing required H2 headings: ## Outputs (Expected)`
  **Fix**: Use EXACT heading text. `## Outputs` ≠ `## Outputs (Expected)`.
- `contains extra H2 headings: ## Cost Summary`
  **Fix**: Remove, change to H3, or move after `## References`.
