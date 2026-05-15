# APEX

## Setup Commands

```bash
# Clone the Accelerator template and open in dev container
# https://github.com/jonathan-vella/azure-agentic-infraops-accelerator
git clone https://github.com/YOUR-USERNAME/my-infraops-project.git && cd my-infraops-project
code . # then: F1 → Dev Containers: Reopen in Container

npm install                              # Node.js deps (validators, linting)
npm run setup                            # Azure + GitHub OIDC/secrets/RBAC
```

> Python deps (diagrams, Azure Pricing MCP, apex-recall) install automatically
> via the dev container's `post-create.sh`. Setup details:
> https://jonathan-vella.github.io/azure-agentic-infraops/getting-started/azure-setup/

## Build & Validation

```bash
# Full validation suite
npm run validate:all

# Individual checks (most-used)
npm run lint:md                          # Markdown linting
npm run lint:json                        # JSON/JSONC validation
npm run validate:agents                  # Agent + prompt frontmatter, model alignment
npm run validate:agent-registry          # Registry shape (file path, model, step)
npm run validate:iac-security-baseline   # TLS/HTTPS/Entra-only/no-public-blob baseline
npm run lint:safe-shell                  # No interactive shell prompts in committed snippets

# Full list (≈30 scripts) → npm run | grep -E "^  (lint|validate|test):" or
# https://jonathan-vella.github.io/azure-agentic-infraops/reference/validation-reference/

# Pre-commit/pre-push hooks (installed via lefthook on `npm run prepare`)
git push                                 # Triggers diff-based-push-check.sh automatically

# IaC validation
bicep build infra/bicep/{project}/main.bicep && bicep lint infra/bicep/{project}/main.bicep
terraform fmt -check -recursive infra/terraform/ && npm run validate:terraform
```

## Code Style

Code style (CAF naming, required tags, default region, AVM-first, unique
suffix pattern) is documented in
[.github/skills/azure-defaults/SKILL.md](.github/skills/azure-defaults/SKILL.md).
Agents read that file as part of their mandatory skill load; this file
no longer duplicates the tables.

## Security Baseline

The non-negotiable security baseline (TLS 1.2 minimum, HTTPS-only, no public
blob, no shared key, Managed Identity, Entra-only SQL, App Service HTTP/2,
Container Registry admin disabled, MySQL/PostgreSQL SSL, no public network
access for prod data services, no hardcoded secrets) is documented in
[.github/instructions/references/iac-policy-compliance.md](.github/instructions/references/iac-policy-compliance.md).
This is the source of truth for IaC validators (`validate:iac-security-baseline`)
and the Architect / IaC Planner / CodeGen agents. Always cross-check
`04-governance-constraints.md` for subscription-level Azure Policy
requirements that may add to the baseline.

## Commit & PR Guidelines

Use [Conventional Commits](https://www.conventionalcommits.org/):
`<type>[optional scope]: <description>`. Types: `feat` (feature), `fix`,
`docs`, `refactor`, `ci`, `chore`. Scopes: `agents`, `skills`, `instructions`,
`bicep`, `terraform`, `mcp`, `docs`, `scripts`. Run `npm run lint:md` and
relevant validations before committing.

## Agent Workflow

| Step | Phase        | Output                                                   | Review                                                    |
| ---- | ------------ | -------------------------------------------------------- | --------------------------------------------------------- |
| 1    | Requirements | `01-requirements.md` + `sku-manifest.{json,md}` (rev 1)  | 1× comprehensive (mandatory)                              |
| 2    | Architecture | `02-architecture-assessment.md` + cost estimate          | 1× comprehensive + 1 cost-feasibility (opt-in: deep)      |
| 3    | Design (opt) | `03-des-*.{py,png,md}` diagrams and ADRs                 | opt-in: 1× comprehensive on ADRs (skipped when no Step 3) |
| 3.5  | Governance   | `04-governance-constraints.md/.json`                     | 1× governance-reconciliation (skip when no constraints)   |
| 4    | IaC Plan     | `04-implementation-plan.md` + `04-*-diagram.py/.png`     | 1× comprehensive (mandatory; opt-in: deep)                |
| 5    | IaC Code     | `infra/bicep/{project}/` or `infra/terraform/{project}/` | opt-in (default: skip)                                    |
| 6    | Deploy       | `06-deployment-summary.md`                               | none (policy precheck folded in as informational H2)      |
| 7    | As-Built     | `07-*.md` documentation suite                            | —                                                         |
| Post | Lessons      | `09-lessons-learned.json/.md`                            | —                                                         |

All outputs → `agent-output/{project}/`. Source of truth:
`.github/skills/workflow-engine/templates/workflow-graph.json`.
The Orchestrator drives all steps with human approval gates. The unified
05-IaC Planner feeds dual IaC tracks: Bicep (06b/07b) and Terraform (06t/07t).
Review column = single-pass `comprehensive` (or `governance-reconciliation` at
Step 3.5) by challenger subagents — the default flow never auto-fires
multi-pass. Multi-pass reviews are an explicit opt-in via
`decisions.review_depth = "deep"` (captured once per project by
01-Orchestrator) or via direct `10-Challenger` invocation. Reviews target
AI-generated creative decisions — not tool output (what-if/plan previews).

`sku-manifest.{json,md}` is created at Step 1 (user pins only — empty
`services[]` is the common case) and mutated through Step 7: Step 2
authoring, Step 3.5 read-only findings, Step 4 reconciliation +
`requires[]` cross-check, Step 6 substitution on quota/region conflict
(via the block-with-escalation pattern), Step 7 bidirectional drift
detection. Authoring rules:
[`.github/instructions/sku-manifest.instructions.md`](.github/instructions/sku-manifest.instructions.md).

## Conventions Detail

For deeper guidance, agents read these on demand:

- Bicep conventions: `infra/bicep/AGENTS.md`
- Terraform conventions: `infra/terraform/AGENTS.md`
- azd multi-project rules: `.github/instructions/azure-yaml.instructions.md` (auto-loaded for `azure.yaml`)
- Terminal hygiene (no `mv -i`/`rm -i`/`read -p`, pipe long output to file):
  `.github/instructions/no-interactive-shell.instructions.md` (enforced by `lint:safe-shell`)
- Azure defaults: `.github/skills/azure-defaults/SKILL.md`
- Workflow DAG: `.github/skills/workflow-engine/templates/workflow-graph.json`
- Full validation reference: <https://jonathan-vella.github.io/azure-agentic-infraops/reference/validation-reference/>
