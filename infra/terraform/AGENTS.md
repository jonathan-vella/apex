# Terraform Infrastructure

Agent instructions specific to the `infra/terraform/` subtree.

## SKU Source of Truth

Read `agent-output/{project}/sku-manifest.json` first. Never re-derive
creative SKUs (App Service plan, VM, SQL, Cosmos, AKS pool, Redis, APIM,
App Gateway, Storage replication) from `04-implementation-plan.md`
prose. Each Terraform resource maps to a
`services[].iac_logical_names.terraform` entry; per-environment overrides
come from `services[].environment_overrides.{env}`. See
[`.github/instructions/sku-manifest.instructions.md`](../../.github/instructions/sku-manifest.instructions.md).

## Build Commands

```bash
# Format check
terraform fmt -check -recursive infra/terraform/

# Per-project validation
cd infra/terraform/{project}
terraform init -backend=false
terraform validate

# Full suite (all projects)
npm run validate:terraform

# Deploy with azd (preferred — when azure.yaml exists)
cd infra/terraform/{project}
azd env new {project}-{env}           # Create environment (e.g., hub-spoke-dev)
azd env set AZURE_LOCATION swedencentral
azd provision --preview                # Preview
azd provision                          # Deploy

# Deploy with pure Terraform (DEPRECATED fallback — use azd instead)
cd infra/terraform/{project}
terraform plan -out=tfplan
terraform apply tfplan
```

## Module Structure

Each project follows this layout:

```text
infra/terraform/{project}/
  main.tf              # Root module — providers, module calls
  variables.tf         # Input variables with descriptions and validations
  outputs.tf           # Output values
  terraform.tf         # Required providers and backend configuration
  locals.tf            # Local values (naming, tags, computed values)
  terraform.tfvars     # Variable values (not committed for sensitive data)
  azure.yaml           # azd project manifest (infra.provider: terraform, infra.path: .)
  .azure/              # azd environment state (git-ignored)
    plan.md            # azure-prepare output — source of truth for validate/deploy
    {project}-{env}/   # Per-environment azd state (e.g., hub-spoke-dev/)
      .env             # azd environment variables
  modules/
    */                 # One module per resource or logical group
      main.tf
      variables.tf
      outputs.tf
```

## Conventions

- **AVM-first**: Use AVM-TF modules from `registry.terraform.io/Azure/avm-res-{provider}-{resource}/azurerm`
- **Provider pin**: `~> 4.0` for AzureRM
- **Backend**: Azure Storage Account
- **Unique suffix**: `random_string` resource (4 chars, lowercase, `special = false`, `upper = false`)
- **Tags**: Every resource gets the 9 required tags (lowercase: `environment`,
  `owner`, `costcenter`, `application`, `workload`, `sla`, `backup-policy`,
  `maint-window`, `technical-contact`) — discovered policy wins.
  `ManagedBy = "Terraform"` is an optional deploy-provenance marker.
- **Variables**: Every variable must have a `description` and a `type`; use `validation` blocks where appropriate
- **Security**: TLS 1.2, HTTPS-only, managed identity, no public blob access, Azure AD-only SQL auth
- **No hardcoded secrets**: Use Key Vault data sources or `sensitive = true` variables
- **State**: Never commit `.tfstate` files; use remote backend

## Governance

Before generating configurations, always check `agent-output/{project}/04-governance-constraints.md`
for subscription-level Azure Policy requirements that may impose additional rules.
