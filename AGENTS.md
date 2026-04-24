# APEX

> Agentic Platform Engineering eXperience for Azure. Verified. Well-Architected. Deployable.

A multi-agent orchestration system for Azure platform engineering.
Specialized AI agents collaborate through a structured multi-step workflow:
**Requirements → Architecture → Design → Governance → Plan → Code → Deploy → Documentation**.

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

# Azure + GitHub environment setup (OIDC, secrets, RBAC)
# See: https://jonathan-vella.github.io/azure-agentic-infraops/getting-started/azure-setup/
npm run setup
```

> **Note:** Python dependencies (diagrams, Azure Pricing MCP server, apex-recall) are installed
> automatically by the dev container's `post-create.sh` script. No manual `pip install` is needed.

## Build & Validation

```bash
# Full validation suite
npm run validate:all

# Individual checks
npm run lint:md                          # Markdown linting
npm run lint:json                        # JSON/JSONC validation
npm run lint:agent-frontmatter           # Agent definition frontmatter
npm run lint:skills-format               # Skill file format
npm run validate:instruction-checks      # Instruction file format and reference validation
npm run lint:artifact-templates          # Artifact template compliance
npm run lint:h2-sync                     # H2 heading sync between templates and artifacts
npm run lint:governance-refs             # Governance reference validation
npm run validate:session-state           # Session state JSON schema validation
npm run validate:session-lock            # Session lock/claim model validation
npm run validate:workflow-graph          # Workflow DAG graph validation
npm run validate:agent-registry          # Agent registry consistency
npm run validate:iac-security-baseline   # IaC security baseline (TLS, HTTPS, blob, identity, SQL auth)
npm run lint:workflow-table-sync          # Workflow table ↔ workflow-graph.json sync

# E2E Ralph Loop
npm run e2e:validate                     # Validate artifacts (structural, no agent invocation)
npm run e2e:benchmark                    # Benchmark scoring (8 dimensions, 0-100)

# Pre-commit/pre-push hooks (installed via lefthook)
npm run prepare                          # Install hooks
git push                                 # Triggers diff-based-push-check.sh automatically

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
- No shared key access on storage (`allowSharedKeyAccess: false`) — use Entra ID
- Managed Identity preferred over keys/connection strings
- Azure AD-only authentication for SQL
- App Service HTTP/2 enabled (`http20Enabled: true`)
- Container Registry admin user disabled (`adminUserEnabled: false`)
- MySQL/PostgreSQL SSL enforcement required
- Public network access disabled for production data services (dev/test exempt)
- Never hardcode secrets, connection strings, or API keys — use Key Vault references
- Always check `04-governance-constraints.md` for subscription-level Azure Policy requirements

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

## Agent Workflow

| Step | Phase        | Output                                                   | Review                           |
| ---- | ------------ | -------------------------------------------------------- | -------------------------------- |
| 1    | Requirements | `01-requirements.md`                                     | 1×                               |
| 2    | Architecture | `02-architecture-assessment.md` + cost estimate          | 1× + 1 cost (opt-in: multi-pass) |
| 3    | Design (opt) | `03-des-*.{py,png,md}` diagrams and ADRs                 | —                                |
| 3.5  | Governance   | `04-governance-constraints.md/.json`                     | 1×                               |
| 4    | IaC Plan     | `04-implementation-plan.md` + `04-*-diagram.py/.png`     | opt-in (default: skip)           |
| 5    | IaC Code     | `infra/bicep/{project}/` or `infra/terraform/{project}/` | opt-in (default: skip)           |
| 6    | Deploy       | `06-deployment-summary.md`                               | —                                |
| 7    | As-Built     | `07-*.md` documentation suite                            | —                                |
| Post | Lessons      | `09-lessons-learned.json/.md`                            | —                                |

All outputs go to `agent-output/{project}/`.
Programmatic source of truth: `.github/skills/workflow-engine/templates/workflow-graph.json`.
Unified planner (05-IaC Planner) feeds into dual IaC tracks: Bicep (06b/07b) and Terraform (06t/07t).
The Orchestrator agent orchestrates the full workflow with human approval gates.
Review column = adversarial passes by challenger subagents, complexity-dependent
Complexity-dependent. Conditional early exits reduce actual passes.
Reviews target AI-generated creative decisions (architecture, governance, plan, code) not
tool output (what-if/plan previews).

## Conventions Detail

The sections above (Code Style, Security Baseline) are always loaded. For deeper
guidance, agents should read these on demand:

- **Bicep conventions**: `infra/bicep/AGENTS.md`
- **Terraform conventions**: `infra/terraform/AGENTS.md`
- **azd multi-project rules**: `.github/instructions/azure-yaml.instructions.md` (auto-loaded for `azure.yaml`)
- **Azure infrastructure defaults**: `.github/skills/azure-defaults/SKILL.md`
- **Workflow DAG (machine-readable)**: `.github/skills/workflow-engine/templates/workflow-graph.json`
- **Full validation reference**: [Validation & Linting Reference](https://jonathan-vella.github.io/azure-agentic-infraops/reference/validation-reference/)
