<!-- ref:azd-vs-deploy-guide-v2 -->

# azd vs deploy.ps1 — Deployment Guide

> **⚠️ deploy.ps1 is deprecated.** New projects MUST use `azd`. Codegen agents still
> generate `deploy.ps1` for backward compatibility, but `azure.yaml` + `azd` is the
> required deployment method. Use azd hooks (`preprovision`/`postprovision`) for
> phased deployment workflows that previously relied on `deploy.ps1 -Phase`.

Consolidated reference for choosing and using deployment strategies in this repo.
Both deploy agents (07b-Bicep, 07t-Terraform) load this guide on demand.

> **See also**: [recipe-selection.md](../../azure-prepare/references/recipe-selection.md)
> for choosing the IaC recipe (AZD vs Bicep vs Terraform vs AZCLI).

---

## Quick Decision

| Scenario                              | Use                          | Why                                                            |
| ------------------------------------- | ---------------------------- | -------------------------------------------------------------- |
| New Bicep project                     | **azd**                      | Default, cross-platform, built-in env management               |
| New Terraform project                 | **azd**                      | `infra.provider: terraform` gives TF + azd simplicity          |
| Existing project with `azure.yaml`    | **azd**                      | Already configured                                             |
| Existing project without `azure.yaml` | **azd** (generate azure.yaml) | Generate `azure.yaml` via azure-prepare, then use azd          |
| Need fine-grained phased deployment   | **azd** with hooks           | Use `preprovision`/`postprovision` hooks for phased logic      |
| CI/CD pipeline (non-interactive)      | **azd**                      | `azd provision --no-prompt` with env vars                      |
| Legacy project with deploy.ps1 only   | deploy.ps1 *(deprecated)*    | Migrate to azd when possible                                   |

**Default: azd** for all projects. `deploy.ps1` is deprecated and retained only for backward compatibility.

---

## Comparison

| Factor                      | azd                                                                                                                         | deploy.ps1                                                          |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| **Cross-platform**          | Yes (Linux, macOS, Windows)                                                                                                 | PowerShell only                                                     |
| **Environment management**  | Built-in (`azd env new/set/list`)                                                                                           | Manual parameters per invocation                                    |
| **Hooks (pre/post deploy)** | `azure.yaml` hooks (`preprovision`, `postprovision`)                                                                        | Custom script logic in deploy.ps1                                   |
| **Phased deployment**       | Use `preprovision`/`postprovision` hooks for phased logic                                                                   | Fine-grained phases *(deprecated — migrate to azd hooks)*           |
| **Preview / what-if**       | `azd provision --preview`                                                                                                   | `deploy.ps1 -WhatIf`                                                |
| **IaC providers**           | Bicep (default) or Terraform (`infra.provider: terraform`)                                                                  | Bicep only                                                          |
| **Secret management**       | `azd env set-secret` (Key Vault-backed)                                                                                     | Manual parameters                                                   |
| **CI/CD generation**        | `azd pipeline config` generates GitHub Actions / Azure Pipelines                                                            | Manual workflow authoring                                           |
| **Service deployment**      | `azd deploy` (app code to Azure resources)                                                                                  | Not supported (infra only)                                          |
| **Install**                 | Pre-installed in devcontainer (`azd version`)                                                                               | PowerShell pre-installed                                            |
| **Project isolation**       | Per-project: `infra/{iac}/{project}/azure.yaml` + `.azure/`                                                                 | Per-project: `infra/{iac}/{project}/deploy.ps1`                     |
| **Env naming**              | `{project}-{env}` (e.g., `hub-spoke-dev`)                                                                                   | Manual per invocation                                               |
| **Official docs**           | [learn.microsoft.com/azure/developer/azure-developer-cli](https://learn.microsoft.com/azure/developer/azure-developer-cli/) | N/A (custom script)                                                 |

---

## Per-Project Convention

This repo supports multiple independent projects. Each project is a fully
self-contained azd project — `azure.yaml` and `.azure/` live **inside** the
IaC project directory, never at the repo root.

```text
infra/{iac}/{project}/
├── azure.yaml              # azd manifest (infra.path: .)
├── .azure/                 # git-ignored; per-environment state
│   ├── plan.md             # azure-prepare output — source of truth
│   └── {project}-{env}/    # e.g., hub-spoke-dev/
│       └── .env            # azd environment variables
├── main.bicep (or main.tf) # IaC entry point (co-located)
├── deploy.ps1              # DEPRECATED — legacy fallback only
└── modules/
```

**Key rules**:

- **Never** place `azure.yaml` or `.azure/` at the repo root
- Environment names use `{project}-{env}` to avoid collisions
- `.azure/` folders are git-ignored (contains subscription IDs, env-specific state)
- Run azd from the project directory: `cd infra/{iac}/{project}` then `azd` commands
- Or use `-C` flag from repo root: `azd -C infra/{iac}/{project} env list`

---

## azd Workflow

### 1. Prepare (azure-prepare skill)

```bash
# Recipe selection → plan → generate infrastructure
# Creates: azure.yaml, main.bicep/main.tf, modules/, .azure/plan.md
```

### 2. Validate (azure-validate skill)

```bash
cd infra/{iac}/{project}

# Bicep
azd provision --preview

# Terraform
azd provision --preview    # or: terraform validate + terraform plan
```

### 3. Deploy (azure-deploy skill)

```bash
cd infra/{iac}/{project}

# Create environment
azd env new {project}-{env}
azd env set AZURE_LOCATION swedencentral

# Full provision + deploy
azd up --no-prompt

# Or infrastructure only
azd provision
```

### Environment Preflight (required for --no-prompt)

Before `azd provision --no-prompt`, verify these values are set:

```bash
azd env get-values
# Must have: AZURE_SUBSCRIPTION_ID, AZURE_LOCATION, AZURE_ENV_NAME
# If missing:
azd env set AZURE_SUBSCRIPTION_ID "$(az account show --query id -o tsv)"
azd env set AZURE_LOCATION swedencentral
```

---

## Phased Deployment with azd Hooks

Use `preprovision` and `postprovision` hooks in `azure.yaml` to implement phased
deployment logic that previously required `deploy.ps1 -Phase`. Define hook scripts
that run validation, ordering checks, or staged resource creation.

```yaml
# azure.yaml
hooks:
  preprovision:
    posix:
      shell: sh
      run: ./hooks/pre-provision.sh
    windows:
      shell: pwsh
      run: ./hooks/pre-provision.ps1
  postprovision:
    posix:
      shell: sh
      run: ./hooks/post-provision.sh
    windows:
      shell: pwsh
      run: ./hooks/post-provision.ps1
```

Hook scripts can implement phase gates, RBAC propagation waits, DNS convergence
checks, and post-deployment verification — all functionality that previously
lived inside `deploy.ps1`.

---

## deploy.ps1 Workflow (Deprecated)

> **⚠️ Deprecated.** This workflow is retained for backward compatibility only.
> New projects MUST use `azd` with hooks. Migrate existing `deploy.ps1` usage
> to `azure.yaml` hooks when possible.

Use only for legacy projects that have not yet adopted `azure.yaml`.

### Single Deployment

```powershell
cd infra/bicep/{project}
pwsh deploy.ps1 -WhatIf                    # Preview
pwsh deploy.ps1                             # Deploy all
```

### Phased Deployment

```powershell
cd infra/bicep/{project}

# Deploy each phase with approval gates
pwsh deploy.ps1 -Phase Foundation -WhatIf   # Preview
pwsh deploy.ps1 -Phase Foundation            # Deploy

pwsh deploy.ps1 -Phase Security -WhatIf
pwsh deploy.ps1 -Phase Security

pwsh deploy.ps1 -Phase Data -WhatIf
pwsh deploy.ps1 -Phase Data

pwsh deploy.ps1 -Phase Compute -WhatIf
pwsh deploy.ps1 -Phase Compute

pwsh deploy.ps1 -Phase Edge -WhatIf
pwsh deploy.ps1 -Phase Edge
```

| Phase      | Resources                             | When to Use      |
| ---------- | ------------------------------------- | ---------------- |
| Foundation | Resource group, networking, Key Vault | Always first     |
| Security   | Identity, RBAC, certificates          | After networking |
| Data       | Storage, databases, messaging         | After security   |
| Compute    | App Service, Functions, containers    | After data layer |
| Edge       | CDN, Front Door, DNS                  | After compute    |

**When to prefer phased over single**: Large deployments (>10 resources),
production environments, resources with ordering dependencies that Bicep
`dependsOn` alone cannot capture (e.g., RBAC propagation delays, DNS convergence).

---

## azd Hooks

azd hooks replace custom pre/post logic that deploy.ps1 handles in-script.
Define in `azure.yaml`:

```yaml
hooks:
  preprovision:
    posix:
      shell: sh
      run: ./scripts/pre-provision.sh
    windows:
      shell: pwsh
      run: ./scripts/pre-provision.ps1
  postprovision:
    posix:
      shell: sh
      run: ./scripts/post-provision.sh
    windows:
      shell: pwsh
      run: ./scripts/post-provision.ps1
```

**Common hook patterns**:

| Hook            | Purpose               | Example                                                   |
| --------------- | --------------------- | --------------------------------------------------------- |
| `preprovision`  | Auth validation       | `az account get-access-token --output none`               |
| `preprovision`  | Prerequisite check    | Verify quota, check policy compliance                     |
| `postprovision` | Resource verification | Query Azure Resource Graph for `Succeeded` state          |
| `postprovision` | RBAC assignment       | Assign roles (use `\|\| true` to handle "already exists") |
| `postprovision` | SQL setup             | Run EF migrations, configure managed identity             |
| `postprovision` | Diagnostic setup      | Enable diagnostic settings, configure alerts              |

---

## azure.yaml Schema (Key Fields)

```yaml
name: {project}
metadata:
  template: {project}@1.0.0
infra:
  provider: bicep          # or: terraform
  path: .                  # co-located with azure.yaml
  module: main             # entry point (main.bicep or main.tf)
services:                  # optional — app code deployment
  web:
    project: ./src/web
    language: js
    host: containerapp
  api:
    project: ./src/api
    language: python
    host: appservice
hooks:                     # optional — lifecycle hooks
  preprovision: ...
  postprovision: ...
```

**Terraform-specific**: When using `infra.provider: terraform`, also generate
`main.tfvars.json` to map azd environment variables to Terraform variables:

```json
{
  "location": "${AZURE_LOCATION}",
  "environment_name": "${AZURE_ENV_NAME}"
}
```

> **Full schema**: [learn.microsoft.com/azure/developer/azure-developer-cli/azd-schema](https://learn.microsoft.com/azure/developer/azure-developer-cli/azd-schema)

---

## Detection Logic (for Deploy Agents)

Both deploy agents (07b, 07t) detect the deployment method at runtime:

```bash
cd infra/{iac}/{project}

if [ -f "azure.yaml" ]; then
  # azd path (preferred)
  azd env new {project}-{env}
  azd provision --preview
  azd provision
else
  # Fallback path
  # Bicep: pwsh deploy.ps1
  # Terraform: terraform plan + terraform apply
fi
```

---

## Troubleshooting

| Error                                        | Cause                    | Fix                                                                                                  |
| -------------------------------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------- |
| `azure.yaml not found`                       | Not in project directory | `cd infra/{iac}/{project}` first                                                                     |
| `missing required inputs`                    | Bicep params not mapped  | `azd env config set infra.parameters.<param> <value>`                                                |
| `main.tfvars.json not found`                 | TF param file missing    | Create `main.tfvars.json` with `${AZURE_*}` mappings                                                 |
| `environment not found`                      | No azd env created       | `azd env new {project}-{env}`                                                                        |
| `.azure/` at repo root                       | Breaks multi-project     | Move to `infra/{iac}/{project}/.azure/`                                                              |
| RBAC "already exists" in hooks               | Idempotent runs          | Add `\|\| true` to role assignment commands                                                          |
| `Logged in to Azure as...` but preview fails | az vs azd auth mismatch  | Both `az` and `azd` need separate auth — see [infra/bicep/AGENTS.md](../../../infra/bicep/AGENTS.md) |

> **Deep troubleshooting**: See recipe-specific error guides at
> `azure-deploy/references/recipes/{recipe}/errors.md`.

---

## Cross-References

| Topic                                 | Location                                                                         |
| ------------------------------------- | -------------------------------------------------------------------------------- |
| Recipe selection (AZD vs Bicep vs TF) | [recipe-selection.md](../../azure-prepare/references/recipe-selection.md)        |
| azd SDK quick reference               | [azd-deployment.md](../../azure-deploy/references/sdk/azd-deployment.md)         |
| Per-project convention                | [AGENTS.md](../../../../AGENTS.md) § azd Multi-Project Convention                |
| Bicep deploy commands                 | [infra/bicep/AGENTS.md](../../../../infra/bicep/AGENTS.md)                       |
| Terraform deploy commands             | [infra/terraform/AGENTS.md](../../../../infra/terraform/AGENTS.md)               |
| Pre-deploy checklist                  | [pre-deploy-checklist.md](../../azure-deploy/references/pre-deploy-checklist.md) |
| Circuit breaker                       | [circuit-breaker.md](circuit-breaker.md)                                         |
| azure.yaml creation guide             | [azure-yaml.md](../../azure-prepare/references/recipes/azd/azure-yaml.md)        |
| azd + Terraform guide                 | [terraform.md](../../azure-prepare/references/recipes/azd/terraform.md)          |
