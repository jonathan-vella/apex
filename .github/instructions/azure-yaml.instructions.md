---
description: "Azure Developer CLI (azd) manifest conventions for multi-project co-location. Enforces infra.path, environment naming, and repo-root prohibition."
applyTo: "**/azure.yaml"
---

# azure.yaml Conventions

Rules for `azure.yaml` manifests in this multi-project repository.

## Co-Location Pattern (Mandatory)

Each project is a self-contained `azd` project inside its IaC directory:

```text
infra/{iac}/{project}/azure.yaml    ← manifest lives here
infra/{iac}/{project}/.azure/       ← azd state (git-ignored)
```

### Required Fields

- `infra.path: .` — always relative to the manifest location
- `infra.provider: bicep` or `infra.provider: terraform` — must match the parent directory

### Prohibited

- **Never** place `azure.yaml` at the repository root — breaks multi-project isolation
- **Never** use absolute paths or `../` in `infra.path`

## Environment Naming

Use `{project}-{env}` pattern to avoid collisions across projects:

```yaml
# Good: hub-spoke-dev, webapp-prod
# Bad: dev, production (ambiguous across projects)
```

## Running azd

```bash
cd infra/{iac}/{project} && azd up        # preferred
azd -C infra/{iac}/{project} up           # alternative from repo root
```

## Bicep Projects

```yaml
name: { project }
infra:
  provider: bicep
  path: .
```

## Terraform Projects

```yaml
name: { project }
infra:
  provider: terraform
  path: .
```
