---
description: 'JSON and JSONC formatting conventions for configuration and data files'
applyTo: '**/*.{json,jsonc}'
---

# JSON Guidelines

Instructions for writing consistent JSON and JSONC files in this repository.

## Formatting

- **Formatter**: Prettier (configured in devcontainer)
- **Indentation**: 2 spaces
- **Trailing commas**: not allowed in `.json` files (invalid JSON)
- **Line endings**: LF (`\n`) — enforced by `.editorconfig` / VS Code settings
- **Final newline**: always include a trailing newline

## JSONC (JSON with Comments)

Files like `.vscode/mcp.json`, `devcontainer.json`, and `.markdownlint-cli2.jsonc`
use JSONC format:

- Use `//` for single-line comments explaining non-obvious configuration
- Group related settings with section comments
- Do not use `/* */` block comments

## Key Ordering

For configuration files, follow a logical grouping:

- **`package.json`**: `name`, `version`, `description`, `private`, `scripts`,
  `devDependencies`, `repository`, `keywords`, `author`, `license`
- **`mcp.json`**: group servers by type (HTTP first, then stdio)
- **`devcontainer.json`**: `name`, `image`, `features`, lifecycle commands,
  `containerEnv`, `customizations`, `mounts`, `remoteUser`

## Governance Constraint Files

Files like `04-governance-constraints.json` in `agent-output/` are generated
by the governance-discovery-subagent:

- Always use an array of policy objects at the root
- Include `displayName`, `policyDefinitionId`, `effect`, and `scope` per policy
- Do not manually edit — regenerate via the governance discovery workflow
