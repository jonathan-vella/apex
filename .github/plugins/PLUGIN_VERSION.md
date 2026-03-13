# Azure Skills Plugin — Version Pin

| Field        | Value                                                        |
| ------------ | ------------------------------------------------------------ |
| Source       | <https://github.com/microsoft/azure-skills>                  |
| Commit       | `90fcf6d` (2026-03-12)                                       |
| Skills count | 21                                                           |
| License      | MIT                                                          |
| Maintainer   | Microsoft (synced from `microsoft/GitHub-Copilot-for-Azure`) |

## Installed Skills

Skills are copied from the plugin into `.github/skills/{name}/` so they are
discoverable by the workspace index (`scripts/_lib/workspace-index.mjs`) and
VS Code skill loading (`chat.agentSkillsLocations`).

| Plugin Skill                  | Status                                                                       |
| ----------------------------- | ---------------------------------------------------------------------------- |
| `appinsights-instrumentation` | Active (secondary)                                                           |
| `azure-ai`                    | Active (secondary)                                                           |
| `azure-aigateway`             | Active (secondary)                                                           |
| `azure-cloud-migrate`         | Active (secondary)                                                           |
| `azure-compliance`            | Active (secondary)                                                           |
| `azure-compute`               | Active (secondary)                                                           |
| `azure-cost-optimization`     | Active (secondary)                                                           |
| `azure-deploy`                | Active (secondary for deploy agents) — azd-first, deploy.ps1 fallback        |
| `azure-diagnostics`           | Active — merged with former `azure-troubleshooting`                          |
| `azure-hosted-copilot-sdk`    | Active (secondary)                                                           |
| `azure-kusto`                 | Active (secondary)                                                           |
| `azure-messaging`             | Active (secondary)                                                           |
| `azure-prepare`               | Active (secondary)                                                           |
| `azure-quotas`                | Active (secondary)                                                           |
| `azure-rbac`                  | Active (secondary)                                                           |
| `azure-resource-lookup`       | Active (secondary)                                                           |
| `azure-resource-visualizer`   | Active (secondary)                                                           |
| `azure-storage`               | Active (secondary)                                                           |
| `azure-validate`              | Active (primary for deploy agents) — merged with preflight from `iac-common` |
| `entra-app-registration`      | Active (secondary)                                                           |
| `microsoft-foundry`           | Active (secondary)                                                           |

## Upgrade Procedure

1. Check latest commit at <https://github.com/microsoft/azure-skills>
2. Clone: `git clone --depth 1 https://github.com/microsoft/azure-skills.git /tmp/azure-skills-plugin`
3. Diff each skill: `diff -r /tmp/azure-skills-plugin/.github/plugins/azure-skills/skills/{name}/ .github/skills/{name}/`
4. Review diffs — our merged content (KQL templates, preflight checks) must be preserved
5. Update this file with the new commit hash
6. Run `npm run validate:all`
