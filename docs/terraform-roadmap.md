# Terraform Support Roadmap

> **Extending Agentic InfraOps to support Terraform alongside Bicep**

This guide outlines the roadmap for adding Terraform support to the Agentic InfraOps workflow.
Currently, the project uses Bicep as the primary IaC language. Terraform support will enable
multi-cloud scenarios and support organizations with existing Terraform investments.

> [!NOTE]
> **Status**: Planned - See [Issue #85][tf-issue] for progress tracking.

[tf-issue]: https://github.com/jonathan-vella/azure-agentic-infraops/issues/85

---

## Overview

Adding Terraform support requires changes across several areas:

| Area | Components |
|------|------------|
| **Dev Environment** | Dev container features, VS Code extensions |
| **Git Configuration** | `.gitignore`, `.gitattributes` |
| **Copilot Agents** | `terraform-plan`, `terraform-code`, `terraform-deploy` |
| **Copilot Skills** | ADR, diagrams, workload docs, preflight, cost estimate |
| **Instructions** | Best practices for `*.tf` files |
| **CI/CD** | Validation workflows, security scanning |
| **Documentation** | Guides, glossary, workflow docs |

---

## 1. Dev Container Configuration

### Features

Add to `.devcontainer/devcontainer.json`:

```jsonc
"features": {
  // Existing features...
  "ghcr.io/devcontainers/features/terraform:1": {
    "installTFsec": true,
    "installTerragrunt": false,
    "version": "latest"
  },
  "ghcr.io/devcontainers/features/go:1": {
    "version": "latest"  // For Terratest
  }
}
```

### Environment Variables

```jsonc
"containerEnv": {
  "TF_PLUGIN_CACHE_DIR": "/home/vscode/.terraform-cache"
}
```

### Post-Create Script

Update `post-create.sh`:

```bash
# Create Terraform plugin cache directory
mkdir -p "${HOME}/.terraform-cache"
chmod 755 "${HOME}/.terraform-cache"

# Install Infracost for cost estimation
curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh
```

---

## 2. VS Code Extensions

Add to the extensions array:

| Extension | Purpose |
|-----------|---------|
| `HashiCorp.terraform` | Terraform language support, IntelliSense |
| `ms-azuretools.vscode-azureterraform` | Azure Terraform integration |
| `golang.go` | Go support for Terratest |
| `infracost.infracost-vscode` | Cost estimation in editor |

### Editor Settings

```jsonc
"settings": {
  "[terraform]": {
    "editor.tabSize": 2,
    "editor.formatOnSave": true,
    "editor.defaultFormatter": "hashicorp.terraform"
  },
  "[terraform-vars]": {
    "editor.tabSize": 2
  }
}
```

---

## 3. Git Configuration

### .gitignore Additions

```gitignore
# Terraform
*.tfstate
*.tfstate.backup
*.tfstate.*.backup
.terraform/
.terraform.lock.hcl
*.tfvars
!*.tfvars.example
crash.log
crash.*.log
override.tf
override.tf.json
*_override.tf
*_override.tf.json

# Infracost
.infracost/
```

### .gitattributes Additions

```properties
# Terraform files
*.tf           text eol=lf linguist-language=HCL
*.tfvars       text eol=lf linguist-language=HCL
*.hcl          text eol=lf linguist-language=HCL

# Go files (for Terratest)
*.go           text eol=lf
```

---

## 4. Copilot Agents

### terraform-plan.agent.md

```yaml
---
name: Terraform Planning
description: Creates Terraform implementation plans from architecture assessments
tools:
  - semantic_search
  - read_file
  - list_dir
  - create_file
---
```

**Responsibilities:**

1. Analyze `02-architecture-assessment.md` for infrastructure requirements
2. Map requirements to Terraform resources and AVM modules
3. Discover governance constraints via Azure Resource Graph
4. Generate `04-implementation-plan.md` with Terraform-specific guidance
5. Create `04-governance-constraints.md` with provider requirements

### terraform-code.agent.md

```yaml
---
name: Terraform Code
description: Generates Terraform configurations from implementation plans
tools:
  - semantic_search
  - read_file
  - create_file
  - replace_string_in_file
  - run_in_terminal
---
```

**Responsibilities:**

1. Follow `04-implementation-plan.md` specifications
2. Use Azure Verified Modules for Terraform (AVM-TF)
3. Generate modular code in `infra/terraform/{project}/`
4. Create `05-implementation-reference.md`
5. Run `terraform fmt` and `terraform validate`

### terraform-deploy.agent.md

```yaml
---
name: Terraform Deploy
description: Deploys Terraform configurations to Azure
tools:
  - run_in_terminal
  - read_file
  - create_file
---
```

**Responsibilities:**

1. Run `terraform init` with proper backend configuration
2. Execute `terraform plan` and save plan file
3. Apply after user approval
4. Generate `06-deployment-summary.md` with outputs

---

## 5. Copilot Skills

### Skill Parity Matrix

| Bicep Skill | Terraform Equivalent | Purpose |
|-------------|---------------------|---------|
| `azure-adr` | `terraform-adr` | Architecture Decision Records |
| `azure-diagrams` | `terraform-diagrams` | Generate diagrams from `.tf` files |
| `azure-workload-docs` | `terraform-workload-docs` | Resource inventory, runbooks |
| `azure-deployment-preflight` | `terraform-deployment-preflight` | Pre-deployment validation |
| N/A | `terraform-cost-estimate` | Infracost integration |

### terraform-deployment-preflight Skill

Validates before deployment:

- [ ] Provider version constraints
- [ ] Required provider features enabled
- [ ] State backend accessibility
- [ ] Variable validation passes
- [ ] `terraform plan` succeeds
- [ ] No tfsec critical/high findings

### terraform-cost-estimate Skill

Integrates with Infracost:

```bash
# Generate cost estimate
infracost breakdown --path . --format json > cost.json

# Compare with baseline
infracost diff --path . --compare-to baseline.json
```

---

## 6. Instruction Files

### terraform-code-best-practices.instructions.md

```markdown
---
applyTo: "**/*.tf"
description: "Infrastructure as Code best practices for Terraform configurations"
---

# Terraform Code Best Practices

## Provider Configuration

- Pin versions with pessimistic constraint: `~> 3.0`
- Configure backend for remote state (Azure Storage recommended)
- Use provider aliases for multi-region deployments
- Enable required features explicitly

## Module Structure

infra/terraform/{project}/
├── main.tf           # Root module, module calls
├── variables.tf      # Input variables with validation
├── outputs.tf        # Output values
├── providers.tf      # Provider configuration
├── versions.tf       # Terraform and provider versions
├── locals.tf         # Local values
├── data.tf           # Data sources
└── modules/          # Child modules
    └── {module}/
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        └── README.md

## Security Requirements

- Never hardcode secrets - use Key Vault data sources
- Enable diagnostic settings on all resources
- Use `sensitive = true` for secret outputs
- Implement network security by default

## Naming Conventions

Follow CAF: `{type}-{workload}-{env}-{region}-{instance}`

## Azure Verified Modules (AVM-TF)

PREFER AVM modules from: `Azure/terraform-azurerm-avm-*`

Example:
```hcl
module "keyvault" {
  source  = "Azure/avm-res-keyvault-vault/azurerm"
  version = "~> 0.5"

  name                = "kv-${var.workload}-${var.environment}"
  resource_group_name = azurerm_resource_group.main.name
  location            = azurerm_resource_group.main.location
  tags                = local.tags
}
```
```

---

## 7. CI/CD Workflows

### terraform-validate.yml

```yaml
name: Terraform Validation

on:
  pull_request:
    paths:
      - "infra/terraform/**"
      - ".github/workflows/terraform-*.yml"

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: hashicorp/setup-terraform@v3
        with:
          terraform_version: "~1.7"

      - name: Terraform Format Check
        run: terraform fmt -check -recursive -diff
        working-directory: infra/terraform

      - name: Terraform Init
        run: |
          for dir in */; do
            echo "::group::Init $dir"
            terraform -chdir="$dir" init -backend=false
            echo "::endgroup::"
          done
        working-directory: infra/terraform

      - name: Terraform Validate
        run: |
          for dir in */; do
            echo "::group::Validate $dir"
            terraform -chdir="$dir" validate
            echo "::endgroup::"
          done
        working-directory: infra/terraform

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: tfsec Security Scan
        uses: aquasecurity/tfsec-action@v1.0.3
        with:
          working_directory: infra/terraform
          soft_fail: false

  cost:
    runs-on: ubuntu-latest
    if: github.event_name == 'pull_request'
    steps:
      - uses: actions/checkout@v4

      - name: Infracost Breakdown
        uses: infracost/actions/setup@v3
        with:
          api-key: ${{ secrets.INFRACOST_API_KEY }}

      - name: Generate Cost Estimate
        run: |
          infracost breakdown --path infra/terraform \
            --format json --out-file /tmp/infracost.json

      - name: Post Cost Comment
        uses: infracost/actions/comment@v1
        with:
          path: /tmp/infracost.json
          behavior: update
```

---

## 8. Directory Structure

```
infra/
├── bicep/                    # Existing Bicep templates
│   └── {project}/
└── terraform/                # New Terraform templates
    ├── _baseline/            # Shared baseline modules
    │   ├── naming/
    │   ├── tagging/
    │   └── networking/
    └── {project}/
        ├── main.tf
        ├── variables.tf
        ├── outputs.tf
        ├── providers.tf
        ├── versions.tf
        ├── terraform.tfvars.example
        └── modules/
```

---

## 9. Scenarios

### S09-terraform-baseline

```
scenarios/S09-terraform-baseline/
├── README.md
├── DEMO-SCRIPT.md
├── prompts/
│   ├── 01-requirements.prompt.md
│   ├── 02-architecture.prompt.md
│   └── 03-implement.prompt.md
├── solution/
│   ├── main.tf
│   ├── variables.tf
│   ├── outputs.tf
│   ├── providers.tf
│   └── modules/
│       ├── networking/
│       └── compute/
└── validation/
    ├── validate.sh
    └── test/
        └── baseline_test.go
```

---

## 10. Azure Verified Modules for Terraform

### Common AVM-TF Modules

| Resource | Module | Registry |
|----------|--------|----------|
| Resource Group | `Azure/avm-res-resources-resourcegroup/azurerm` | [View module][avm-rg] |
| Virtual Network | `Azure/avm-res-network-virtualnetwork/azurerm` | [View module][avm-vnet] |
| Key Vault | `Azure/avm-res-keyvault-vault/azurerm` | [View module][avm-kv] |
| Storage Account | `Azure/avm-res-storage-storageaccount/azurerm` | [View module][avm-st] |
| App Service | `Azure/avm-res-web-site/azurerm` | [View module][avm-web] |

[avm-rg]: https://registry.terraform.io/modules/Azure/avm-res-resources-resourcegroup/azurerm
[avm-vnet]: https://registry.terraform.io/modules/Azure/avm-res-network-virtualnetwork/azurerm
[avm-kv]: https://registry.terraform.io/modules/Azure/avm-res-keyvault-vault/azurerm
[avm-st]: https://registry.terraform.io/modules/Azure/avm-res-storage-storageaccount/azurerm
[avm-web]: https://registry.terraform.io/modules/Azure/avm-res-web-site/azurerm

> [!TIP]
> Search for AVM modules: https://registry.terraform.io/search/modules?q=avm&namespace=Azure

---

## 11. State Management

### Recommended: Azure Storage Backend

```hcl
terraform {
  backend "azurerm" {
    resource_group_name  = "rg-terraform-state"
    storage_account_name = "stterraformstate"
    container_name       = "tfstate"
    key                  = "{project}/{environment}.tfstate"
  }
}
```

### State Locking

Azure Storage backend provides automatic state locking via blob leases.

### State Security

- Enable storage account firewall
- Use private endpoints for production
- Enable soft delete for state recovery
- Use customer-managed keys (CMK) for encryption

---

## Summary

| Component | Files/Locations |
|-----------|-----------------|
| **Dev Container** | `.devcontainer/devcontainer.json`, `post-create.sh` |
| **VS Code** | Extensions and settings in `devcontainer.json` |
| **Git Config** | `.gitignore`, `.gitattributes` |
| **Agents** | `.github/agents/terraform-*.agent.md` |
| **Skills** | `.github/skills/terraform-*/` |
| **Instructions** | `.github/instructions/terraform-*.instructions.md` |
| **Infrastructure** | `infra/terraform/{project}/` |
| **Scenarios** | `scenarios/S09-terraform-baseline/` |
| **CI/CD** | `.github/workflows/terraform-*.yml` |

> [!IMPORTANT]
> This roadmap enables Terraform to coexist with Bicep while maintaining the structured
> Agentic InfraOps workflow. Organizations can choose their preferred IaC tool per project.

---

## References

- [Azure Verified Modules for Terraform](https://azure.github.io/Azure-Verified-Modules/)
- [Terraform Azure Provider](https://registry.terraform.io/providers/hashicorp/azurerm/latest/docs)
- [Infracost Documentation](https://www.infracost.io/docs/)
- [tfsec Security Scanner](https://aquasecurity.github.io/tfsec/)
- [Terratest](https://terratest.gruntwork.io/)
- [Issue #85: Add Terraform Support](https://github.com/jonathan-vella/azure-agentic-infraops/issues/85)
