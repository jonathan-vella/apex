# Agentic InfraOps

> Azure infrastructure engineered by agents. Verified. Well-Architected. Deployable.

A multi-agent orchestration system for Azure infrastructure development.
Specialized AI agents collaborate through a structured 7-step workflow:
**Requirements → Architecture → Design → Plan → Code → Deploy → Documentation**.

## Setup Commands

```bash
# Clone and open in dev container (all tools pre-installed)
git clone https://github.com/jonathan-vella/azure-agentic-infraops.git
cd azure-agentic-infraops
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
    _subagents/        # Subagent definitions (non-user-invokable)
  skills/              # Reusable domain knowledge (SKILL.md per skill)
  instructions/        # File-type rules with glob-based auto-application
  copilot-instructions.md  # VS Code Copilot-specific orchestration instructions
agent-output/          # All agent-generated artifacts organized by project
  {project}/           # Per-project: 00-session-state.json + 01-requirements.md through 07-*.md
infra/
  bicep/{project}/     # Bicep templates (main.bicep + modules/)
  terraform/{project}/ # Terraform configurations (main.tf + modules/)
mcp/
  azure-pricing-mcp/   # Custom Azure Pricing MCP server (Python)
scripts/               # Validation and maintenance scripts (Node.js)
docs/                  # User-facing documentation
.vscode/
  mcp.json             # MCP server configuration (github, microsoft-learn, azure-pricing, terraform)
  infraops.toolsets.jsonc  # Workspace tool groups for interactive chat (8 toolsets)
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
