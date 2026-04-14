<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Azure Deploy (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Triggers

Activate this skill when user wants to:

- Execute deployment of an already-prepared application (azure.yaml and infra/ exist)
- Push updates to an existing Azure deployment
- Run `azd up`, `azd deploy`, or `az deployment` on a prepared project
- Ship already-built code to production

> _See SKILL.md for full content._

## Rules

1. Run after azure-prepare and azure-validate
2. `infra/{iac}/{project}/.azure/plan.md` must exist with status `Validated`
3. **Pre-deploy checklist required** — [Pre-Deploy Checklist](references/pre-deploy-checklist.md)
4. ⛔ **Destructive actions require `ask_user`** — [global-rules](references/global-rules.md)
5. **Scope: deployment execution only** — This skill owns execution of `azd up`, `azd deploy`, `terraform apply`, and `az deployment` commands. These commands are run through this skill's error recovery and verification pipeline.

> _See SKILL.md for full content._

## Steps

| #   | Action                                                                                                                                                                                      | Reference                                                  |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| 0   | **Auto-Prepare Gate** — If `infra/{iac}/{project}/.azure/plan.md` is missing, invoke **azure-prepare** then **azure-validate** automatically                                                | —                                                          |
| 1   | **Check Plan** — Read `infra/{iac}/{project}/.azure/plan.md`, verify status = `Validated` AND **Validation Proof** section is populated. If not validated, invoke **azure-validate** first. | `infra/{iac}/{project}/.azure/plan.md`                     |
| 2   | **Pre-Deploy Checklist** — MUST complete ALL steps                                                                                                                                          | [Pre-Deploy Checklist](references/pre-deploy-checklist.md) |
| 3   | **Load Recipe** — Based on `recipe.type` in `infra/{iac}/{project}/.azure/plan.md`                                                                                                          | [recipes/README.md](references/recipes/README.md)          |
| 4   | **Execute Deploy** — Follow recipe steps                                                                                                                                                    | Recipe README                                              |

> _See SKILL.md for full content._

## SDK Quick References

- **Azure Developer CLI**: [azd](references/sdk/azd-deployment.md)
- **Azure Identity**: [Python](references/sdk/azure-identity-py.md) | [.NET](references/sdk/azure-identity-dotnet.md) | [TypeScript](references/sdk/azure-identity-ts.md) | [Java](references/sdk/azure-identity-java.md)

## MCP Tools

| Tool                              | Purpose                              |
| --------------------------------- | ------------------------------------ |
| `mcp_azure_mcp_subscription_list` | List available subscriptions         |
| `mcp_azure_mcp_group_list`        | List resource groups in subscription |
| `mcp_azure_mcp_azd`               | Execute AZD commands                 |

## References

- [Troubleshooting](references/troubleshooting.md) - Common issues and solutions
- [Post-Deployment Steps](references/recipes/azd/post-deployment.md) - SQL + EF Core setup
