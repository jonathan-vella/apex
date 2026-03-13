# Migration Guide: Azure Skills Plugin (Issue #240)

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

| Skill                         | Status                                                        | Domain          |
| ----------------------------- | ------------------------------------------------------------- | --------------- |
| `azure-diagnostics`           | Active (merged with our troubleshooting content)              | Operations      |
| `azure-validate`              | Active (primary for deploy agents, merged with our preflight) | Deployment      |
| `azure-prepare`               | Active (secondary)                                            | Build & Deploy  |
| `azure-cost-optimization`     | Active (secondary)                                            | Cost Management |
| `azure-deploy`                | **NOT ACTIVE** — requires azd CLI (future enhancement)        | Deployment      |
| `azure-compute`               | Active (secondary)                                            | Compute         |
| `azure-compliance`            | Active (secondary)                                            | Governance      |
| `azure-rbac`                  | Active (secondary)                                            | Security        |
| `azure-storage`               | Active (secondary)                                            | Storage         |
| `azure-messaging`             | Active (secondary)                                            | Messaging       |
| `azure-kusto`                 | Active (secondary)                                            | Data            |
| `azure-ai`                    | Active (secondary)                                            | AI/ML           |
| `azure-aigateway`             | Active (secondary)                                            | AI/ML           |
| `azure-quotas`                | Active (secondary)                                            | Operations      |
| `azure-resource-lookup`       | Active (secondary)                                            | Operations      |
| `azure-resource-visualizer`   | Active (secondary)                                            | Visualization   |
| `azure-cloud-migrate`         | Active (secondary)                                            | Migration       |
| `azure-hosted-copilot-sdk`    | Active (secondary)                                            | AI/ML           |
| `appinsights-instrumentation` | Active (secondary)                                            | Observability   |
| `entra-app-registration`      | Active (secondary)                                            | Identity        |
| `microsoft-foundry`           | Active (secondary)                                            | AI Platform     |

## Plugin Versioning

The plugin version is tracked in `.github/plugins/PLUGIN_VERSION.md`.
See that file for the upgrade procedure.

## Governance Compliance

Plugin skills operate alongside our governance layer:

- `azure-defaults` remains the authority for regions, tags, naming, security
- `azure-validate` includes our governance-to-code property mapping
- Plugin skills do not override Azure Policy constraints from `04-governance-constraints.md`

## Future: azure-deploy Activation

`azure-deploy` is imported but not wired to any agent. To activate it:

1. Install `azd` CLI in the devcontainer
2. Add `azure-deploy` to deploy agent skill lists in `agent-registry.json`
3. Move from "never" to appropriate affinity tier in `skill-affinity.json`
4. Update deploy agent `.agent.md` files with read directives
5. Test E2E deployment workflow
