# Agentic InfraOps

> Azure infrastructure engineered by agents. Verified. Well-Architected. Deployable.

A multi-agent orchestration system for Azure infrastructure development.
Specialized AI agents collaborate through a structured 7-step workflow:
**Requirements → Architecture → Design → Plan → Code → Deploy → Documentation**.

## Setup Commands

```bash
# Create your own repo from the Accelerator template:
#   https://github.com/jonathan-vella/azure-agentic-infraops-accelerator
# Then clone YOUR repo and open in dev container
git clone https://github.com/YOUR-USERNAME/my-infraops-project.git
cd my-infraops-project
code .
# F1 → Dev Containers: Reopen in Container

# Install Node.js dependencies (validation scripts, linting)
npm install

# Python dependencies (Azure Pricing MCP server, diagrams)
pip install -r requirements.txt
```

### Pre-installed Tools (Dev Container)

- **Azure CLI** (`az`) with Bicep extension
- **Terraform CLI** with TFLint
- **GitHub CLI** (`gh`)
- **Node.js** + npm (validation scripts)
- **Python 3** + pip (MCP server, diagram generation)
- **Go** (Terraform MCP server)

## Build & Validation

```bash
# Full validation suite
npm run validate:all

# Individual checks
npm run lint:md                          # Markdown linting
npm run lint:json                        # JSON/JSONC validation
npm run lint:agent-frontmatter           # Agent definition frontmatter
npm run lint:skills-format               # Skill file format
npm run lint:instruction-frontmatter     # Instruction file format
npm run lint:artifact-templates          # Artifact template compliance
npm run lint:h2-sync                     # H2 heading sync between templates and artifacts
npm run lint:governance-refs             # Governance reference validation
npm run validate:instruction-refs        # Instruction reference validation
npm run validate:session-state           # Session state JSON schema validation
npm run validate:session-lock            # Session lock/claim model validation
npm run validate:workflow-graph          # Workflow DAG graph validation
npm run validate:agent-registry          # Agent registry consistency
npm run validate:skill-affinity          # Skill/agent affinity catalog validation

# Bicep validation (replace {project} with actual project name)
bicep build infra/bicep/{project}/main.bicep
bicep lint infra/bicep/{project}/main.bicep

# Terraform validation
terraform fmt -check -recursive infra/terraform/
# Per-project: cd infra/terraform/{project} && terraform init -backend=false && terraform validate
npm run validate:terraform
```

## Code Style

### Naming Conventions (CAF)

Follow Azure Cloud Adoption Framework naming:

| Resource        | Abbreviation | Pattern                     | Max Length |
| --------------- | ------------ | --------------------------- | ---------- |
| Resource Group  | `rg`         | `rg-{project}-{env}`        | 90         |
| Virtual Network | `vnet`       | `vnet-{project}-{env}`      | 64         |
| Key Vault       | `kv`         | `kv-{short}-{env}-{suffix}` | 24         |
| Storage Account | `st`         | `st{short}{env}{suffix}`    | 24         |
| App Service     | `app`        | `app-{project}-{env}`       | 60         |

### Required Tags (Azure Policy Enforced)

Every Azure resource must include these 4 tags at minimum:

| Tag           | Example Values           |
| ------------- | ------------------------ |
| `Environment` | `dev`, `staging`, `prod` |
| `ManagedBy`   | `Bicep` or `Terraform`   |
| `Project`     | Project identifier       |
| `Owner`       | Team or individual name  |

### Default Region

- **Primary**: `swedencentral` (EU GDPR-compliant)
- **Exception**: Static Web Apps → `westeurope`
- **Failover**: `germanywestcentral`

### Azure Verified Modules (AVM) First

Always prefer AVM modules over raw resource definitions:

- **Bicep**: `br/public:avm/res/{provider}/{resource}:{version}`
- **Terraform**: `registry.terraform.io/Azure/avm-res-{provider}-{resource}/azurerm`

### Unique Suffix Pattern

Generate once, pass everywhere:

- **Bicep**: `uniqueString(resourceGroup().id)`
- **Terraform**: `random_string` (4 chars, lowercase)

## Security Baseline

These are non-negotiable for all generated infrastructure code:

- TLS 1.2 minimum on all services
- HTTPS-only traffic (`supportsHttpsTrafficOnly: true`)
- No public blob access (`allowBlobPublicAccess: false`)
- Managed Identity preferred over keys/connection strings
- Azure AD-only authentication for SQL
- Public network access disabled for production data services

## Testing

```bash
# Run all validations (CI equivalent)
npm run validate:all

# Pre-commit hooks (installed via lefthook)
npm run prepare

# Pre-push hook (diff-based, automatic via lefthook)
# Only validates file types that changed: *.bicep, *.tf, *.md, *.agent.md, etc.
# Runs domain-scoped validators in parallel for speed
git push  # triggers diff-based-push-check.sh automatically

# Bicep: lint + build before committing templates
bicep lint infra/bicep/{project}/main.bicep
bicep build infra/bicep/{project}/main.bicep

# Terraform: format + validate before committing
terraform fmt -recursive infra/terraform/
cd infra/terraform/{project} && terraform init -backend=false && terraform validate
```

## Commit & PR Guidelines

Use [Conventional Commits](https://www.conventionalcommits.org/):

```text
<type>[optional scope]: <description>
```

| Type       | Purpose                        |
| ---------- | ------------------------------ |
| `feat`     | New feature                    |
| `fix`      | Bug fix                        |
| `docs`     | Documentation only             |
| `refactor` | Code refactor (no feature/fix) |
| `ci`       | CI/config changes              |
| `chore`    | Maintenance/misc               |

Scopes: `agents`, `skills`, `instructions`, `bicep`, `terraform`, `mcp`, `docs`, `scripts`.

Always run `npm run lint:md` and relevant validations before committing.

## Project Structure

```text
.github/
  agents/              # Agent definitions (*.agent.md) — 14 top-level + 9 subagents
    _subagents/        # Subagent definitions (non-user-invocable)
  skills/              # Reusable domain knowledge (SKILL.md per skill)
    workflow-engine/   # DAG model, workflow-graph.json
    context-shredding/ # Runtime context compression tiers and templates
    iac-common/        # Shared deploy patterns + circuit-breaker.md
  instructions/        # File-type rules with glob-based auto-application
  agent-registry.json  # Machine-readable agent role → file/model/skills mapping
  skill-affinity.json  # Skill/agent affinity weights (primary/secondary/never)
  copilot-instructions.md  # VS Code Copilot-specific orchestration instructions
agent-output/          # All agent-generated artifacts organized by project
  {project}/           # Per-project: 00-session-state.json + 01-requirements.md through 07-*.md
infra/
  bicep/{project}/     # Bicep templates (main.bicep + modules/)
  terraform/{project}/ # Terraform configurations (main.tf + modules/)
mcp/
  azure-pricing-mcp/   # Custom Azure Pricing MCP server (Python)
scripts/               # Validation and maintenance scripts (Node.js) — 27 validators
docs/                  # User-facing documentation
.vscode/
  mcp.json             # MCP server configuration (github, microsoft-learn, azure-pricing, terraform)
```

### Agent Workflow (7 Steps)

| Step | Phase        | Output                                                   | Review |
| ---- | ------------ | -------------------------------------------------------- | ------ |
| 1    | Requirements | `01-requirements.md`                                     | 1x     |
| 2    | Architecture | `02-architecture-assessment.md` + cost estimate          | 3x+1x  |
| 3    | Design (opt) | `03-des-*.{py,png,md}` diagrams and ADRs                 | —      |
| 4    | IaC Plan     | `04-implementation-plan.md` + governance + diagrams      | 1x+3x  |
| 5    | IaC Code     | `infra/bicep/{project}/` or `infra/terraform/{project}/` | 3x     |
| 6    | Deploy       | `06-deployment-summary.md`                               | 1x     |
| 7    | As-Built     | `07-*.md` documentation suite                            | —      |

All outputs go to `agent-output/{project}/`.
Dual IaC tracks: Bicep (agents 05b/06b/07b) and Terraform (agents 05t/06t/07t).
The Conductor agent orchestrates the full workflow with human approval gates.
Review column = adversarial passes by `challenger-review-subagent` (3x = rotating lenses; 1x = comprehensive).

### Content Sharing Decision Framework

| Content Type            | Mechanism                                | When to Use                                    |
| ----------------------- | ---------------------------------------- | ---------------------------------------------- |
| Enforcement rules       | Instructions (auto-loaded by glob)       | Rules that must apply to all files of a type   |
| Shared domain knowledge | Skill `references/`                      | Deep content loaded on-demand by agents        |
| Executable scripts      | Skill `scripts/` (NOT `references/`)     | Deterministic operations, build/deploy scripts |
| Cross-agent boilerplate | Subagent or instruction with narrow glob | Repeated patterns across multiple agent bodies |

## Terraform Conventions

- **Provider pin**: `~> 4.0` (AzureRM)
- **Backend**: Azure Storage Account
- **Required tags**: Same as above, with `ManagedBy = "Terraform"`
- **Unique suffix**: `random_string` resource (4 chars, lowercase)
- **AVM registry**: `registry.terraform.io/Azure/avm-res-*/azurerm`

## Bicep Conventions

- **Unique suffix**: `uniqueString(resourceGroup().id)` — generated once in `main.bicep`, passed to all modules
- **Required tags**: Same as above, with `ManagedBy = "Bicep"`
- **AVM registry**: `br/public:avm/res/{provider}/{resource}:{version}`
- **Parameter files**: Use `.bicepparam` format
- **Deployment scripts**: PowerShell (`deploy.ps1`) in each project folder

## Security Considerations

- Never hardcode secrets, connection strings, or API keys in templates
- Use Key Vault references for sensitive parameters
- Managed Identity is the default authentication method
- All storage accounts: HTTPS-only, TLS 1.2, no public blob access
- SQL databases: Azure AD-only authentication
- Production environments: disable public network access on data services
- Always check `04-governance-constraints.md` for subscription-level Azure Policy requirements

## Quarterly Context Audit

Run every 3 months to prevent context bloat regression:

1. `npm run lint:skill-size` — check for skills >200 lines without references
2. `npm run lint:agent-body-size` — check for agents >350 lines
3. `npm run lint:glob-audit` — check for broad wildcards on large files
4. `npm run lint:skill-references` — check for orphaned reference files
5. `npm run lint:orphaned-content` — check for unreferenced skills
6. `npm run lint:docs-freshness` — check docs counts and links
7. Review `QUALITY_SCORE.md` and update if metrics changed
8. Run `npm run snapshot:baseline` to capture current state for future diffs
