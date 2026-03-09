<!-- ref:agent-plugins-v1 -->
# Agent Plugins Reference (Preview)

> Source: https://code.visualstudio.com/docs/copilot/customization/agent-plugins
> Last verified: 2026-03-08

> [!WARNING]
> Agent plugins are a **Preview** feature. Enable with the `chat.plugins.enabled` setting.
> The plugin format and marketplace API may change. **Always query live docs before working with plugins.**

## What Plugins Do

Agent plugins are prepackaged bundles of chat customizations distributed via Git-based
marketplaces. A single plugin can provide slash commands, agent skills, custom agents,
hooks, and MCP servers.

## Stable Invariants

These aspects are unlikely to change significantly:

- **Enable**: `chat.plugins.enabled` setting
- **Discovery**: Extensions view → `@agentPlugins` search
- **Marketplaces**: Git repositories configured via `chat.plugins.marketplaces`
- **Default marketplaces**: `github/copilot-plugins`, `github/awesome-copilot`
- **Local plugins**: `chat.plugins.paths` setting maps local directories to enabled/disabled state
- **Marketplace formats**: `owner/repo` (shorthand), HTTPS `.git` URL, SCP-style, or `file:///` URI

## What Plugins Bundle

A plugin can contain any combination of:

- Slash commands
- Agent skills (`SKILL.md` folders)
- Custom agents (`.agent.md` files)
- Hooks (lifecycle automation)
- MCP servers (external tool connections)

Installed plugin customizations appear alongside locally defined ones.

## This Repo

No plugins are currently consumed or published by this repository.

## Get Current Specification

For the full plugin format, marketplace configuration, and installation details,
query the live documentation:

```text
microsoft_docs_fetch("https://code.visualstudio.com/docs/copilot/customization/agent-plugins")
```

This ensures you work with the current Preview API, not a potentially stale cached version.
