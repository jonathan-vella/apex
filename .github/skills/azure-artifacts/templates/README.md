# Agent Artifact Templates

Canonical templates for all 16 workflow artifacts (Steps 1–7 + PROJECT-README).
These templates define the invariant H2 structure that agents must follow when
generating workflow documentation.

## Template Inventory

| Artifact | Template File | Producing Agent |
| --- | --- | --- |
| Step 1: Requirements | `01-requirements.template.md` | Requirements |
| Step 2: Architecture | `02-architecture-assessment.template.md` | Architect |
| Step 3: Cost Estimate | `03-des-cost-estimate.template.md` | Architect |
| Step 4: Governance | `04-governance-constraints.template.md` | Bicep Plan |
| Step 4: Impl Plan | `04-implementation-plan.template.md` | Bicep Plan |
| Step 4: Preflight | `04-preflight-check.template.md` | Bicep Code |
| Step 5: Impl Reference | `05-implementation-reference.template.md` | Bicep Code |
| Step 6: Deployment | `06-deployment-summary.template.md` | Deploy |
| Step 7: Doc Index | `07-documentation-index.template.md` | azure-artifacts |
| Step 7: Design Doc | `07-design-document.template.md` | azure-artifacts |
| Step 7: Runbook | `07-operations-runbook.template.md` | azure-artifacts |
| Step 7: Inventory | `07-resource-inventory.template.md` | azure-artifacts |
| Step 7: Cost (As-Built) | `07-ab-cost-estimate.template.md` | azure-artifacts |
| Step 7: Backup/DR | `07-backup-dr-plan.template.md` | azure-artifacts |
| Step 7: Compliance | `07-compliance-matrix.template.md` | azure-artifacts |
| Project README | `PROJECT-README.template.md` | Any agent |

## Template Structure

Each template defines:

1. **Invariant H2 sections**: Required headings in required order
2. **Anchor section**: The last required H2 (optionals may follow)
3. **Optional sections**: May appear after anchor, with relaxed ordering
4. **Guidance**: Brief instructions or examples under each section

### Template Authority Rule

> **Required H2 headings must match template exactly (text and order).**
> Additional context sections are permitted only AFTER the anchor heading.

- ✅ Use exact heading text: `## Approval Gate` (not `## Approval Checkpoint`)
- ✅ Maintain heading order as defined in template
- ✅ Add extra H2/H3 sections only after the anchor
- ❌ Do not paraphrase, abbreviate, or reorder required headings

## Validation

Templates and generated artifacts are validated by:

- **Script**: `scripts/validate-artifact-templates.mjs`
- **npm script**: `npm run lint:artifact-templates`

All 16 templates use `standard` strictness (missing/out-of-order headings
are errors, not warnings).

## Drift Prevention

Templates use a **link-based approach** to prevent drift:

- ✅ Agents link to templates or reference the azure-artifacts SKILL.md
- ❌ Agents do NOT embed skeleton structure inline
- ✅ Validator checks agents for embedded skeletons
- ✅ Validator checks agents link to templates or skill

## Usage for Agents

When generating any artifact:

1. Read the template file for structure (or check SKILL.md H2 lists)
2. Follow the H2 heading order exactly
3. Fill in content under each section
4. Add optional sections only after the anchor (last required H2)
5. Include `## References` at the end (when template specifies it)

---

_Templates enforce consistency and prevent structure drift._
