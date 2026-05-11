<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# IaC Common Skill (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Rules

- **Preflight first** — always run `azure-validate` before invoking any deploy strategy in this skill
- **azd by default** — use `azd provision` / `azd up` for all new projects; `deploy.ps1` is deprecated and retained only for legacy projects without `azure.yaml`
- **Phased deployment for high-risk changes** — split into Foundation → Security → Data → Compute → Edge with user approval at each gate
- **Circuit breaker** — stop deployment automatically when policy violations, governance failures, or budget breaches are detected; surface to user before retrying
- **Set environment values before `--no-prompt`** — `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_ENV_NAME`, `AZURE_LOCATION` must all be present (`azd env get-values`)
> _See SKILL.md for full content._

## Steps

Standard deploy flow used by `07b-Bicep Deploy` and `07t-Terraform Deploy`:

1. **Preflight** — run `azure-validate` (auth, governance, plan, what-if review)
2. **Set environment** — `azd env set AZURE_SUBSCRIPTION_ID/RESOURCE_GROUP/LOCATION` + verify via `azd env get-values`
3. **Preview** — `azd provision --preview` (Bicep) or `terraform plan` (Terraform); user reviews destructive operations
> _See SKILL.md for full content._

## Deployment Strategies

**Default**: use `azd` for every project. Each project is a self-contained azd project
(`azure.yaml` + `.azure/` inside `infra/{iac}/{project}/`). Phased deployment is now done
via azd hooks (`preprovision` / `postprovision`); the legacy `deploy.ps1` phased path is
deprecated and retained only for projects that predate `azure.yaml` adoption.
> _See SKILL.md for full content._

## Reference Index

| Reference                     | Location                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Deployment strategies**     | `references/deployment-strategies.md`                                                                                                 |
| **azd vs deploy.ps1 guide**   | `references/azd-vs-deploy-guide.md`                                                                                                   |
| Preflight validation          | `azure-validate/references/infraops-preflight.md`                                                                                     |
> _See SKILL.md for full content._
