# Agent Artifact Templates

Canonical templates for core workflow artifacts. These templates define the invariant structure
that agents must follow when generating workflow documentation.

## Wave 1: Core Workflow Artifacts

| Artifact                        | Template File                            | Producing Agent        |
| ------------------------------- | ---------------------------------------- | ---------------------- |
| Step 1: Requirements            | `01-requirements.template.md`            | @requirements (custom) |
| Step 2: Architecture Assessment | `02-architecture-assessment.template.md` | architect              |
| Step 4: Implementation Plan     | `04-implementation-plan.template.md`     | bicep-plan             |
| Step 6: Deployment Summary      | `06-deployment-summary.template.md`      | Deploy Agent           |

**Design Cost Estimate** (`03-des-cost-estimate.template.md`) and
**As-Built Cost Estimate** (`07-ab-cost-estimate.template.md`) are also available,
validated by separate drift guard.

## Template Structure

Each template defines:

1. **Invariant H2 sections**: Required headings in required order
2. **Anchor section**: The last required H2 (defines where optionals may start)
3. **Optional sections**: May appear after anchor, with relaxed ordering
4. **Guidance**: Brief instructions or examples under each section

### Template Authority Rule

> **Required H2 headings must match template exactly (text and order).**
> Additional context sections are permitted only AFTER the anchor heading (last required H2).

- ✅ Use exact heading text: `## Approval Gate` (not `## Approval Checkpoint`)
- ✅ Maintain heading order as defined in template
- ✅ Add extra H2/H3 sections only after the anchor
- ❌ Do not paraphrase, abbreviate, or reorder required headings

## Validation

Templates and their usage are validated by:

- **Script**: `scripts/validate-wave1-artifacts.mjs`
- **CI Workflow**: `.github/workflows/wave1-artifact-drift-guard.yml`
- **npm script**: `npm run lint:wave1-artifacts`

### Strictness Modes

| Mode       | Behavior                                                              |
| ---------- | --------------------------------------------------------------------- |
| `relaxed`  | Missing/out-of-order invariants warn; optionals warn if before anchor |
| `standard` | Missing/out-of-order invariants fail; optionals warn if before anchor |

**Default**: `relaxed` (set via `STRICTNESS` env var in CI workflow)

**Ratchet plan**: Promote to `standard` after 2 conforming scenario regenerations.

## Drift Prevention

Templates use a **link-based approach** to prevent drift:

- ✅ Agents link to templates (e.g., `[template](../templates/01-requirements.template.md)`)
- ❌ Agents do NOT embed skeleton structure inline
- ✅ Validator checks agents for embedded skeletons
- ✅ Validator checks agents link to templates

## Usage for Agents

When generating a Wave 1 artifact:

1. Read the template file for structure
2. Follow the H2 heading order exactly
3. Fill in content under each section
4. Add optional sections only after the anchor (last required H2)
5. Reference the template in the artifact footer or header

## Future Waves

- **Wave 2**: Step 3 artifacts (diagrams, ADRs)
- **Wave 3**: Step 7 artifacts (as-built documentation)
- **Wave 4**: Governance and testing artifacts

---

_Templates enforce consistency and prevent structure drift across agent generations._
