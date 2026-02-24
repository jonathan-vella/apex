# Terraform MCP Server — Verified Tool Names

> **Gate item**: 0.8 — Agent authors (`2.15`, `2.16`, `2.17`) must use these exact tool names
> in `tools:` frontmatter lists.
>
> **Source**: [Official HashiCorp Terraform MCP Server](https://github.com/hashicorp/terraform-mcp-server)
> v0.4.0 — verified 2026-02-24 against
> [reference docs](https://developer.hashicorp.com/terraform/mcp-server/reference).

## MCP Server Configuration

The official HashiCorp Terraform MCP server is a Go binary installed via `go install`.
**Docker is NOT used** — running `docker run` inside a devcontainer requires Docker-in-Docker
or Docker-outside-of-Docker, adding unnecessary complexity. Since the devcontainer already
includes the Go feature (`ghcr.io/devcontainers/features/go:1`), the binary approach is simpler.

### Installation (handled by `post-create.sh` step 7)

```bash
go install github.com/hashicorp/terraform-mcp-server/cmd/terraform-mcp-server@latest
# Binary lands at: /go/bin/terraform-mcp-server (GOPATH=/go via devcontainer Go feature)
```

### `.vscode/mcp.json` entry

```json
{
  "terraform": {
    "type": "stdio",
    "command": "/go/bin/terraform-mcp-server",
    "args": ["stdio"],
    "env": {
      "TFE_TOKEN": "${env:TFE_TOKEN}"
    }
  }
}
```

`TFE_TOKEN` is optional — only needed for HCP Terraform / TFE workspace tools.
Without it, all `registry` toolset tools work (provider docs, module lookup, policies).

## Toolsets

| Toolset            | Description                                              | Activation           |
| ------------------ | -------------------------------------------------------- | -------------------- |
| `registry`         | Public Terraform Registry (providers, modules, policies) | Default              |
| `registry-private` | Private registry in HCP Terraform / TFE                  | Requires `TFE_TOKEN` |
| `terraform`        | HCP Terraform / TFE workspace management                 | Requires `TFE_TOKEN` |

Filter tools at startup: `terraform-mcp-server stdio --toolsets=registry,terraform`

## Registry Tools (toolset: `registry`)

### Provider Tools

| Tool Name                     | Purpose                                     | Equivalent (community pkg) |
| ----------------------------- | ------------------------------------------- | -------------------------- |
| `search_providers`            | Find provider docs by service name          | `providerDetails`          |
| `get_provider_details`        | Full docs for a specific provider component | `resourceUsage`            |
| `get_latest_provider_version` | Latest version of a provider                | —                          |

### Module Tools

| Tool Name                   | Purpose                                               | Equivalent (community pkg) |
| --------------------------- | ----------------------------------------------------- | -------------------------- |
| `search_modules`            | Find modules by name/functionality                    | `moduleSearch`             |
| `get_module_details`        | Comprehensive module info (inputs, outputs, examples) | `moduleDetails`            |
| `get_latest_module_version` | Latest version of a module                            | —                          |

### Policy Tools

| Tool Name            | Purpose                       | Equivalent (community pkg) |
| -------------------- | ----------------------------- | -------------------------- |
| `search_policies`    | Find Sentinel policies        | `policySearch`             |
| `get_policy_details` | Policy implementation details | `policyDetails`            |

## HCP Terraform / TFE Tools (toolset: `terraform`)

> Requires `TFE_TOKEN` environment variable. Destructive operations also require
> `ENABLE_TF_OPERATIONS=true`.

### Workspace Management

| Tool Name                 | Purpose                                     | Destructive                  |
| ------------------------- | ------------------------------------------- | ---------------------------- |
| `list_terraform_orgs`     | List all Terraform organizations            | No                           |
| `list_terraform_projects` | List all Terraform projects                 | No                           |
| `list_workspaces`         | Search and list workspaces                  | No                           |
| `get_workspace_details`   | Full workspace config, variables, state     | No                           |
| `create_workspace`        | Create a new workspace                      | Yes                          |
| `update_workspace`        | Update workspace configuration              | Yes                          |
| `delete_workspace_safely` | Delete workspace if it manages no resources | Yes (`ENABLE_TF_OPERATIONS`) |

### Run Management

| Tool Name         | Purpose                          | Destructive                  |
| ----------------- | -------------------------------- | ---------------------------- |
| `list_runs`       | List runs in a workspace         | No                           |
| `get_run_details` | Detailed run info including logs | No                           |
| `create_run`      | Create a new Terraform run       | No                           |
| `action_run`      | Apply, discard, or cancel a run  | Yes (`ENABLE_TF_OPERATIONS`) |

### Variable Management

| Tool Name                             | Purpose                               |
| ------------------------------------- | ------------------------------------- |
| `list_variable_sets`                  | List variable sets in an org          |
| `create_variable_set`                 | Create a variable set                 |
| `create_variable_in_variable_set`     | Add a variable to a set               |
| `delete_variable_in_variable_set`     | Remove a variable from a set          |
| `attach_variable_set_to_workspaces`   | Attach a variable set to workspaces   |
| `detach_variable_set_from_workspaces` | Detach a variable set from workspaces |
| `list_workspace_variables`            | List all variables in a workspace     |
| `create_workspace_variable`           | Create a workspace variable           |
| `update_workspace_variable`           | Update an existing workspace variable |

### Private Registry

| Tool Name                      | Purpose                           |
| ------------------------------ | --------------------------------- |
| `search_private_modules`       | Find private modules in an org    |
| `get_private_module_details`   | Full private module details       |
| `search_private_providers`     | Find private providers            |
| `get_private_provider_details` | Provider details and version info |

### Workspace Tags & Policy

| Tool Name                        | Purpose                             |
| -------------------------------- | ----------------------------------- |
| `create_workspace_tags`          | Add tags to a workspace             |
| `read_workspace_tags`            | List workspace tags                 |
| `get_workspace_policy_sets`      | Policy sets attached to a workspace |
| `attach_policy_set_to_workspace` | Attach a policy set to a workspace  |
| `get_token_permissions`          | Permissions for the `TFE_TOKEN`     |

### Stacks

| Tool Name           | Purpose                          |
| ------------------- | -------------------------------- |
| `list_stacks`       | List stacks in an org            |
| `get_stack_details` | Full stack configuration details |

## Available Resources (Static Guides)

| URI                                                              | Type     | Description                             |
| ---------------------------------------------------------------- | -------- | --------------------------------------- |
| `/terraform/style-guide`                                         | Resource | Official Terraform style guide          |
| `/terraform/module-development`                                  | Resource | Module composition and structure guide  |
| `/terraform/providers/{namespace}/name/{name}/version/{version}` | Template | Provider docs by namespace/name/version |

## Tool Fallback (if MCP server unavailable)

When the Terraform MCP server is unavailable (e.g., Docker not present), agents
can fall back to the Terraform Registry REST API directly:

```
# Provider versions
https://registry.terraform.io/v1/providers/{namespace}/{provider}/versions

# Module versions
https://registry.terraform.io/v1/modules/{namespace}/{module}/{provider}/versions

# Module details
https://registry.terraform.io/v1/modules/{namespace}/{module}/{provider}
```

The `azurerm` provider namespace is `hashicorp/azurerm`.
AVM Terraform modules use the `Azure` namespace, e.g., `Azure/avm-res-compute-virtualmachine/azurerm`.

## Notes for Agent Authors (Items 2.15, 2.16, 2.17)

- Use `search_modules` + `get_module_details` for AVM module lookups (replaces manual registry browsing)
- Use `search_providers` + `get_provider_details` to look up `azurerm` resource arguments
- The `terraform` toolset workspace tools are NOT needed for the Planner/Code Generator agents;
  they are needed only for the Deploy agent (`13-terraform-deploy.agent.md`)
- Do NOT use community package tool names (`providerDetails`, `moduleSearch`, etc.) — that package is archived
