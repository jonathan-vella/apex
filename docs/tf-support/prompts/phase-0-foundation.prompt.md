---
mode: agent
description: Implements Phase 0 — Branch & Foundation. Sets up devcontainer, git config, MCP server for Terraform support.
---

# Phase 0 — Branch & Foundation

## Context Load

Read these files before starting:

1. `docs/tf-support/PROGRESS.md` — verify Phase 0 is active and which items remain
2. `.devcontainer/devcontainer.json` — current state (understand before editing)
3. `.gitignore` — current state
4. `.gitattributes` — current state (if it exists)
5. `.vscode/mcp.json` — current MCP server config
6. `package.json` — current devDependencies and scripts

## Phase 0 Deliverables

Work through unchecked items in order. Skip already-checked items.

### Item 0.1 — `tf-dev` branch

Check: `git branch --show-current`. If already on `tf-dev`, mark done and skip.

### Item 0.2 — devcontainer Terraform + Go features

Edit `.devcontainer/devcontainer.json` — add to the `features` block:

```json
"ghcr.io/devcontainers/features/terraform:1": {
  "installTFsec": true
},
"ghcr.io/devcontainers/features/go:1": {}
```

Add to `containerEnv`:
```json
"TF_PLUGIN_CACHE_DIR": "/home/vscode/.terraform.d/plugin-cache"
```

Add to `customizations.vscode.settings`:
```json
"[terraform]": {
  "editor.tabSize": 2,
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "hashicorp.terraform"
}
```

### Item 0.3 — devcontainer extensions

Add to `customizations.vscode.extensions`:
```json
"HashiCorp.terraform",
"ms-azuretools.vscode-azureterraform"
```

### Item 0.4 — `.gitignore`

Add after existing cloud/IDE ignores:

```gitignore
# Terraform
*.tfstate
*.tfstate.backup
.terraform/
*.tfvars
!terraform.tfvars.example
crash.log
crash.*.log
.infracost/
# DO NOT ignore .terraform.lock.hcl — it must be committed for reproducible provider versions
```

### Item 0.5 — `.gitattributes`

If `.gitattributes` does not exist, create it. Add:

```gitattributes
*.tf      linguist-language=HCL
*.tfvars  linguist-language=HCL
*.hcl     linguist-language=HCL
```

### Item 0.6 — MCP server + devDependency

Edit `.vscode/mcp.json` — add a new server entry:

```json
"terraform": {
  "type": "stdio",
  "command": "npx",
  "args": ["-y", "@hashicorp/terraform-mcp-server"],
  "env": {}
}
```

Edit `package.json` — add to `devDependencies`:
```json
"@hashicorp/terraform-mcp-server": "latest"
```

Then run: `npm install` to install the new devDependency.

### Item 0.7 — `infra/terraform/`

```bash
mkdir -p infra/terraform
touch infra/terraform/.gitkeep
```

### Item 0.8 — MCP Tool Verification (GATE)

This item blocks Phase 2. After restarting VS Code and reloading MCP servers:

1. Use `tool_search_tool_regex` with pattern `terraform|hashicorp` to enumerate
   the actual tool names exposed by the HashiCorp MCP server.
2. Create `docs/tf-support/mcp-tools.md` with the verified tool names.
   Format: table with `Tool Name`, `Purpose`, `Equivalent` (if any).
3. If no module lookup tools exist, document the fallback:
   Terraform Registry API at `registry.terraform.io/v1/modules/Azure/{module}/azurerm/versions`

> **Note**: Items 2.15, 2.16, 2.17 (agent frontmatter `tools:` lists) cannot be
> finalized until this gate is complete. Continue with Phase 1 while waiting
> if VS Code cannot be restarted now.

## Validation

```bash
npm run validate:all
```

Expected: all existing validators pass. No Terraform-specific validators yet.

## Commit

```bash
git add .devcontainer/ .gitignore .gitattributes .vscode/mcp.json package.json package-lock.json infra/terraform/.gitkeep docs/tf-support/mcp-tools.md
git commit -m "feat(devcontainer): add Terraform toolchain, MCP server, and git config

- Add Terraform + tfsec devcontainer feature
- Add Go feature for future Terratest
- Add HashiCorp.terraform and vscode-azureterraform extensions
- Add Terraform gitignore entries (commit .terraform.lock.hcl)
- Add HCL linguist attributes
- Add @hashicorp/terraform-mcp-server to mcp.json (npx)
- Pre-install @hashicorp/terraform-mcp-server as devDependency
- Scaffold infra/terraform/ directory"
```

## Update PROGRESS.md

After committing, update `docs/tf-support/PROGRESS.md`:

1. Check off each completed item (`- [x]`)
2. Update Phase 0 row in the status table: Done count + Status → `✅ Complete` or `🔄 In Progress`
3. If 0.8 is pending (VS Code restart needed), set Status = `🔄 In Progress` and add a Blockers row
4. Update frontmatter: `active_phase: 1` if all 8 items done; `last_session` = today's date
5. Add a row to Blockers & Notes: date, your name, items completed
6. Commit: `git add docs/tf-support/PROGRESS.md && git commit -m "chore(progress): complete Phase 0"`
