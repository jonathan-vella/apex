<!-- ref:deployment-strategies-v1 -->

# IaC Deployment Strategies

> Loaded by `iac-common` SKILL.md. Covers the default `azd` deployment
> path, the deprecated `deploy.ps1` phased path (legacy projects only),
> and the decision matrix between the two.

## azd Deployment (default for all projects)

Use `azd` for all projects. Each project is a self-contained azd project with `azure.yaml`
and `.azure/` inside `infra/{iac}/{project}/`.

```bash
# Navigate to the project directory (azure.yaml must be here)
cd infra/{iac}/{project}

# Or use -C flag from repo root
azd -C infra/{iac}/{project} env list

# Create/select environment (use {project}-{env} naming to avoid collisions)
azd env new {project}-{env}
azd env set AZURE_LOCATION swedencentral

# Preview changes (replaces what-if)
azd provision --preview

# Deploy infrastructure
azd provision

# Full provision + deploy in one step
azd up
```

**azd hooks** replace the deprecated deploy.ps1 pre/post steps:

- `preprovision` — auth validation, banner, prerequisite checks
- `postprovision` — resource verification, diagnostic setup

**Environment management** replaces manual parameterization:

- `azd env new prod` / `azd env new dev`
- `azd env set AZURE_LOCATION swedencentral`

## azd Environment Preflight (MANDATORY for --no-prompt Deploys)

Before `azd provision --no-prompt`, verify these environment values are set:

- `AZURE_SUBSCRIPTION_ID` — from `az account show --query id -o tsv`
- `AZURE_RESOURCE_GROUP` — target resource group name
- `AZURE_ENV_NAME` — environment name
- `AZURE_LOCATION` — target region

Run `azd env get-values` and check for missing values. If any are empty, set them via
`azd env set {KEY} {VALUE}` before attempting `--no-prompt`.

## Phased Deployment via deploy.ps1 (deprecated)

> **⚠️ Deprecated.** Use azd hooks (`preprovision`/`postprovision`) for phased deployment
> workflows instead. `deploy.ps1` is retained only for backward compatibility with projects
> that predate `azure.yaml` adoption.

| Phase      | Resources                             | Gate          |
| ---------- | ------------------------------------- | ------------- |
| Foundation | Resource group, networking, Key Vault | User approval |
| Security   | Identity, RBAC, certificates          | User approval |
| Data       | Storage, databases, messaging         | User approval |
| Compute    | App Service, Functions, containers    | User approval |
| Edge       | CDN, Front Door, DNS                  | User approval |

- **Bicep**: Pass `-Phase {name}` to `deploy.ps1`
- **Terraform**: Pass `-var deployment_phase={name}` to plan/apply

## Single Deployment (only for <5 resources, dev/test)

Deploy everything in one operation. Still requires user approval.

## Decision: azd vs deploy.ps1

> **Full guide**: [azd-vs-deploy-guide.md](./azd-vs-deploy-guide.md) — comparison,
> per-project conventions, workflow, hooks, troubleshooting.

| Factor                 | azd                                                         | deploy.ps1                                      |
| ---------------------- | ----------------------------------------------------------- | ----------------------------------------------- |
| Cross-platform         | Yes                                                         | PowerShell only                                 |
| Environment management | Built-in (`azd env`)                                        | Manual parameters                               |
| Hooks (pre/post)       | `azure.yaml` hooks                                          | Custom script logic                             |
| Phased deployment      | Use hooks (`preprovision`/`postprovision`)                  | Fine-grained phases _(deprecated)_              |
| New projects           | **Use azd**                                                 | **Deprecated — do not use for new projects**    |
| Existing projects      | Use azd (generate `azure.yaml` if missing)                  | Deprecated fallback if no `azure.yaml`          |
| Project isolation      | Per-project: `infra/{iac}/{project}/azure.yaml` + `.azure/` | Per-project: `infra/{iac}/{project}/deploy.ps1` |
| Env naming             | `{project}-{env}` (e.g., `hub-spoke-dev`)                   | Manual parameter per invocation                 |
