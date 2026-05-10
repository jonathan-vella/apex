---
name: azure-prepare
description: '**WORKFLOW SKILL** — Prepare applications for Azure deployment by planning and generating infrastructure-as-code and app config (Bicep/Terraform, azd azure.yaml, Dockerfiles). WHEN: "create API", "create app", "build web app", "scaffold project", "containerize app", "containerize Node.js", "Dockerfile", "function app", "APIM", "add authentication", "managed identity", "add caching/Redis", "generate Bicep", "generate Terraform", "provision infrastructure", "prepare for Azure", "deploy to Azure using Terraform (prepare)", "modernize/migrate to Azure". USE FOR: planning/scaffolding and producing IaC + azure.yaml for new or existing apps. DO NOT USE FOR: cross-/multi‑cloud migration (use azure-cloud-migrate), deployment execution (use azure-deploy), or pre‑deployment validation (use azure-validate).'
license: MIT
metadata:
  author: Microsoft
  version: "1.1.0"
---

# Azure Prepare

Authoritative guidance — follow exactly. This skill prepares apps for Azure by producing a reviewed plan and generating IaC and configuration artifacts. Deployment and validation are delegated to other skills.

## Rules

- Scope: preparation only. Do not run azd up/deploy or terraform apply here; hand off to azure-validate then azure-deploy.
- Plan-first: create infra/{iac}/{project}/.azure/plan.md before generating any code/config.
- Approval gate: present the plan to the user and obtain approval before execution.
- Least surprise: any destructive/refactor actions require explicit user confirmation (ask_user).
- Confirm Azure context: subscription, location, environment name; record in plan.
- Security baseline by default: managed identity over secrets, Key Vault for secrets, private networking when feasible, tags and policies.
- Keep changes reproducible: use IaC modules, parameters, and clear outputs. Update the plan as the source of truth.

## Steps

Phase 1 — Planning (blocking)
1) Discover:
   - Inspect repo structure and languages.
   - Identify app type(s): API, web, function, worker, containers.
   - Inventory existing infra/config (Dockerfiles, IaC, CI files).
2) Choose approach:
   - Select IaC path: azd+Bicep (preferred), Bicep-only, or Terraform (if requested/standardized).
   - Pick compute target: App Service, Container Apps, Functions, AKS (only if needed).
3) Design:
   - Enumerate resources: compute, APIM, Key Vault, Storage, DB (Cosmos/Postgres/SQL), Redis, Eventing, Observability.
   - Authentication/authorization: Entra ID, managed identity, app registrations, audience/scopes.
   - Networking: vnets, ingress, endpoints, DNS/certs.
   - Config strategy: App Configuration/Key Vault references, environment variables.
4) Plan document:
   - Write infra/{iac}/{project}/.azure/plan.md containing goals, chosen stack, resource list, naming/locations, security decisions, file layout, and execution checklist (with status fields).
5) Review:
   - Present the plan and request approval. Do not proceed without approval.

Phase 2 — Execution (post-approval)
1) Prepare workspace:
   - Create infra/{iac}/{project}/ directories; add README and templates folder as needed.
   - Add azure.yaml (for azd) with services, hooks, and environments.
2) Generate IaC:
   - Bicep: modules per resource, main.bicep, parameters files per environment.
   - Terraform: modules, variables/outputs, providers/backend, tfvars per environment.
   - Apply naming conventions, tags, RBAC, diagnostics, and policies in IaC.
3) App artifacts:
   - Create/adjust Dockerfiles for each service; multi-stage builds, non-root user, health checks.
   - Add infra wiring: connection strings via managed identity; no secrets in code.
4) Hardening and quality:
   - Add lint/format configs (bicepconfig.json, .tflint.hcl), and basic pre-commit tooling if present.
   - Build-only checks: bicep build; terraform fmt & validate (no apply).
5) Finalize:
   - Update plan.md with generated artifacts and paths; set status to "Ready for Validation".

Handoff
- Invoke azure-validate using the plan as input. After successful validation, invoke azure-deploy.

## MCP Tools

- filesystem: read/write project files and directories
- command_runner/shell: run local build-only commands (bicep build, terraform validate, azd pipeline config generation if needed)
- docker: verify Dockerfile build contexts (no push)
- ask_user: confirm subscription, location, environment names, and any destructive refactors
- azd CLI (if selected): generate azure.yaml and service entries
- bicep CLI or Terraform CLI: author/format/validate IaC
- yaml/json editors: modify azure.yaml and config files

## Outputs

- Plan: infra/{iac}/{project}/.azure/plan.md (authoritative)
- IaC: infra/{iac}/{project}/ (Bicep or Terraform modules, parameters/vars)
- AZD config (if used): infra/{iac}/{project}/azure.yaml
- App containers: src/<component>/Dockerfile and related assets

## Next

Set plan status to "Ready for Validation", then run azure-validate. Upon success, proceed with azure-deploy.