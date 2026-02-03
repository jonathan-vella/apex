# Skills

This directory contains Agent Skills for GitHub Copilot.

## Available Skills

| Skill                      | Description                           |
| -------------------------- | ------------------------------------- |
| `azure-deployment-preflight` | Azure deployment validation         |
| `azure-diagrams`           | Generate architecture diagrams        |
| `gh-cli`                   | GitHub CLI usage                      |
| `git-commit`               | Conventional commit messages          |
| `github-issues`            | Manage GitHub issues via MCP          |
| `github-pull-requests`     | Manage GitHub pull requests via MCP   |
| `make-skill-template`      | Create new skills from template       |

## Usage

Skills are automatically activated when your prompt matches the skill's description.
You can also explicitly reference a skill folder for Copilot to load.

## Creating New Skills

Use the `make-skill-template` skill or follow the structure in
[agent-skills.instructions.md](../instructions/agent-skills.instructions.md).
