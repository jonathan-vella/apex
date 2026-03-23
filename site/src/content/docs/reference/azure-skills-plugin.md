---
title: "Migration Guide: Azure Skills Plugin (Issue #240)"
description: "Migration guide for the Azure Skills Plugin"
---

This guide covers the integration of the Azure Skills Plugin into Agentic InfraOps.

## Skill Renames

| Old Name                | New Name            | Notes                                                                                                                        |
| ----------------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `azure-troubleshooting` | `azure-diagnostics` | Plugin name adopted. Our KQL templates, health checks, and remediation playbooks merged as `references/infraops-*.md` files. |

## Skill Extractions

| Source                            | New Skill        | Content Moved                                                                                                                      |
| --------------------------------- | ---------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `iac-common` (preflight sections) | `azure-validate` | CLI auth checks, known issues, governance-to-code mapping, stop rules. `iac-common` retains deploy strategies and circuit breaker. |

## New Plugin Skills (21 total)

All skills from the Azure Skills Plugin (`microsoft/azure-skills`, commit `90fcf6d`)
are copied into `.github/skills/` using their canonical plugin names.

| Skill                         | Status                                                                | Domain          |
| ----------------------------- | --------------------------------------------------------------------- | --------------- |
| `azure-diagnostics`           | Active (merged with our troubleshooting content)                      | Operations      |
| `azure-validate`              | Active (primary for deploy agents, merged with our preflight)         | Deployment      |
| `azure-prepare`               | Active (secondary)                                                    | Build & Deploy  |
| `azure-cost-optimization`     | Active (secondary)                                                    | Cost Management |
| `azure-deploy`                | Active (secondary for deploy agents) — azd-first, deploy.ps1 fallback | Deployment      |
| `azure-compute`               | Active (secondary)                                                    | Compute         |
| `azure-compliance`            | Active (secondary)                                                    | Governance      |
| `azure-rbac`                  | Active (secondary)                                                    | Security        |
| `azure-storage`               | Active (secondary)                                                    | Storage         |
| `azure-messaging`             | Active (secondary)                                                    | Messaging       |
| `azure-kusto`                 | Active (secondary)                                                    | Data            |
| `azure-ai`                    | Active (secondary)                                                    | AI/ML           |
| `azure-aigateway`             | Active (secondary)                                                    | AI/ML           |
| `azure-quotas`                | Active (secondary)                                                    | Operations      |
| `azure-resource-lookup`       | Active (secondary)                                                    | Operations      |
| `azure-resource-visualizer`   | Active (secondary)                                                    | Visualization   |
| `azure-cloud-migrate`         | Active (secondary)                                                    | Migration       |
| `azure-hosted-copilot-sdk`    | Active (secondary)                                                    | AI/ML           |
| `appinsights-instrumentation` | Active (secondary)                                                    | Observability   |
| `entra-app-registration`      | Active (secondary)                                                    | Identity        |
| `microsoft-foundry`           | Active (secondary)                                                    | AI Platform     |

## Plugin Versioning

The plugin version is tracked in `.github/plugins/PLUGIN_VERSION.md`.
See that file for the upgrade procedure.

## Governance Compliance

Plugin skills operate alongside our governance layer:

- `azure-defaults` remains the authority for regions, tags, naming, security
- `azure-validate` includes our governance-to-code property mapping
- Plugin skills do not override Azure Policy constraints from `04-governance-constraints.md`

## azure-deploy Activation (Issue #245)

`azure-deploy` has been activated. The following was completed:

1. ~~Install `azd` CLI in the devcontainer~~ — added `ghcr.io/azure/azure-dev/azd:latest` feature
2. ~~Add `azure-deploy` to deploy agent skill lists in `agent-registry.json`~~ — done
3. ~~Move from "never" to "secondary" affinity for deploy agents~~ — done
4. ~~Update deploy agent `.agent.md` files~~ — azd-first workflow with deploy.ps1 fallback
5. `azure.yaml` generated for `nordic-fresh-foods` project
6. `06b-Bicep CodeGen` agent updated to generate `azure.yaml` for new projects
