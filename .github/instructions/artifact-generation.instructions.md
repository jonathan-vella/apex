---
applyTo: "**/agent-output/**/*.md"
description: "MANDATORY template compliance rules for artifact generation"
---

# Artifact Generation Rules

> **CRITICAL**: All agents MUST follow these rules when generating artifacts in `agent-output/`.
> Violations will cause CI validation failures and PR blocking.

## Single Source of Truth

**THE COMPLETE H2 REFERENCE IS HERE:**
📚 [artifact-h2-reference.instructions.md](artifact-h2-reference.instructions.md)

## Mandatory Pre-Generation Workflow

Before creating ANY artifact file, agents MUST:

```
1. READ artifact-h2-reference.instructions.md (linked above)
2. FIND the section for your artifact type (e.g., "06-deployment-summary.md")
3. COPY the EXACT H2 headings listed there
4. USE those headings in order in your generated artifact
5. ADD ## References at the end (always allowed)
```

## Template Mapping

| Artifact Pattern | Template File |
|------------------|---------------|
| `01-requirements.md` | `01-requirements.template.md` |
| `02-architecture-assessment.md` | `02-architecture-assessment.template.md` |
| `03-des-cost-estimate.md` | `03-des-cost-estimate.template.md` |
| `04-governance-constraints.md` | `04-governance-constraints.template.md` |
| `04-implementation-plan.md` | `04-implementation-plan.template.md` |
| `04-preflight-check.md` | `04-preflight-check.template.md` |
| `05-implementation-reference.md` | `05-implementation-reference.template.md` |
| `06-deployment-summary.md` | `06-deployment-summary.template.md` |
| `07-ab-cost-estimate.md` | `07-ab-cost-estimate.template.md` |
| `07-backup-dr-plan.md` | `07-backup-dr-plan.template.md` |
| `07-compliance-matrix.md` | `07-compliance-matrix.template.md` |
| `07-design-document.md` | `07-design-document.template.md` |
| `07-documentation-index.md` | `07-documentation-index.template.md` |
| `07-operations-runbook.md` | `07-operations-runbook.template.md` |
| `07-resource-inventory.md` | `07-resource-inventory.template.md` |

## Enforcement Layers

| Layer | Mechanism | What Happens |
|-------|-----------|--------------|
| **1. Instructions** | This file + H2 reference | Copilot sees rules during generation |
| **2. Pre-commit** | Lefthook runs validation | Blocks commit if H2 mismatch |
| **3. CI/CD** | GitHub Action | Fails PR if validation fails |
| **4. Auto-fix** | `npm run fix:artifact-h2` | Attempts to correct common mistakes |

## Common Errors and Fixes

### Missing H2 heading

```
Error: missing required H2 headings: ## Outputs (Expected)
```

**Fix**: You used `## Outputs` instead of exact text. Use: `## Outputs (Expected)`

### Extra H2 heading

```
Warning: contains extra H2 headings: ## Cost Summary
```

**Fix**: Either:
1. Remove `## Cost Summary`
2. Change to H3: `### Cost Summary` (under a valid H2)
3. Move after `## References`

## Quick Fix Command

```bash
# Analyze what's wrong
npm run fix:artifact-h2 agent-output/{project}/{file}.md

# Auto-fix where possible
npm run fix:artifact-h2 agent-output/{project}/{file}.md --apply
```

## Why This Matters

- Consistent structure enables automation
- Validation catches errors before deployment
- Templates ensure quality documentation
- CI/CD gates prevent broken artifacts from merging
