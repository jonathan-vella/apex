---
name: github-operations
description: '**WORKFLOW SKILL** — Full GitHub contribution lifecycle: branches, conventional commits, issues, PRs, Actions, releases. gh CLI-first with MCP fallback. WHEN: "commit", "push", "open PR", "create branch", "create issue", "cut release", "GitHub operation". DO NOT USE FOR: Azure infrastructure, Bicep/Terraform code, architecture decisions. INVOKES: gh CLI (primary), GitHub MCP (fallback).'
license: MIT
metadata:
  author: apex
  version: "3.0"
  category: github
---

# GitHub Operations

Full contribution lifecycle — from branch creation to PR merge.
`gh` CLI preferred (always available in this dev container); MCP tools as
fallback for operations with no `gh` equivalent (rich PR review thread
management, bulk GraphQL queries).

## Steps

```text
1. Create branch (naming convention) →
2. Make changes →
3. Commit (conventional commits) →
4. Push (pre-push hooks validate branch + scope) →
5. Create PR (gh CLI) →
6. Review + Merge
```

## Rules

1. **Identify the operation** (issue, PR, search, Actions, release, etc.)
2. **Use `gh` CLI by default** — always available in this dev container; the more stable primitive
3. **Fall back to MCP only** when `gh` cannot satisfy the operation (rich PR review threads, bulk GraphQL, Copilot review requests)
4. **Validate branch name before any commit or PR** — `git rev-parse --abbrev-ref HEAD`; if invalid, stop and rename via `git branch -m`
5. **Conventional Commits are mandatory** — enforced by commitlint
6. **Devcontainer**: do not run `gh auth login`; `GH_TOKEN` is set via VS Code User Settings (`terminal.integrated.env.linux`)
7. **Never skip hooks** (`--no-verify`) unless the user explicitly asks

## Branch Naming Quick Reference

| Type          | Prefixes                                                                             | File Scope                 |
| ------------- | ------------------------------------------------------------------------------------ | -------------------------- |
| Domain-scoped | `docs/`, `agents/`, `skills/`, `infra/`, `scripts/`, `instructions/`                 | Restricted to domain paths |
| Cross-cutting | `feat/`, `fix/`, `chore/`, `ci/`, `refactor/`, `perf/`, `test/`, `build/`, `revert/` | Any files                  |

For scope tables, validation commands, and enforcement layers, read
[`references/branch-strategy.md`](references/branch-strategy.md).

## Conventional Commits Quick Reference

Format: `<type>[optional scope]: <description>`.

Types: `feat`, `fix`, `docs`, `refactor`, `perf`, `test`, `build`, `ci`,
`chore`, `revert`.

Scopes: `agents`, `skills`, `instructions`, `bicep`, `terraform`, `mcp`,
`docs`, `scripts`.

For staging, breaking changes, and safety protocol, read
[`references/commit-conventions.md`](references/commit-conventions.md).

## Issues & Pull Requests

`gh issue ...` and `gh pr ...` are the default for both. MCP tools are
available as a fallback for operations the CLI does not cover well (rich
PR review threads, Copilot review requests, bulk GraphQL).

> **Default merge method**: `squash` unless the user specifies otherwise.

For tool tables, creation pre-flight checks, and the gh-vs-MCP decision
lattice, read [`references/issues-and-prs.md`](references/issues-and-prs.md).
For PR lifecycle states, auto-labels, and auto-merge conditions, read
[`references/smart-pr-flow.md`](references/smart-pr-flow.md).

## CLI Commands

For complete `gh` CLI commands covering repos, Actions, releases, secrets,
API, and auth, read
[`references/detailed-commands.md`](references/detailed-commands.md).

> **IMPORTANT**: `gh api -f` does not support object values. Use multiple
> `-f` flags with hierarchical keys and string values instead.

### Global Flags

| Flag                | Description                |
| ------------------- | -------------------------- |
| `--repo OWNER/REPO` | Target specific repository |
| `--json FIELDS`     | Output JSON with fields    |
| `--jq EXPRESSION`   | Filter JSON output         |
| `--web`             | Open in browser            |
| `--paginate`        | Fetch all pages            |

## Smart PR Flow Quick Reference

| Condition                   | Label Applied        |
| --------------------------- | -------------------- |
| CI passes                   | `infraops-ci-pass`   |
| CI fails                    | `infraops-needs-fix` |
| Review approved             | `infraops-reviewed`  |
| Auto-merge (all gates pass) | PR merged via MCP    |

Full state machine, watchdog pattern, and auto-merge gates in
[`references/smart-pr-flow.md`](references/smart-pr-flow.md).

## Reference Index

| Reference          | File                               | Content                                             |
| ------------------ | ---------------------------------- | --------------------------------------------------- |
| Branch Strategy    | `references/branch-strategy.md`    | Naming convention, scope tables, enforcement layers |
| Commit Conventions | `references/commit-conventions.md` | Format, types, staging workflow, safety protocol    |
| Issues & PRs       | `references/issues-and-prs.md`     | gh-vs-MCP decision lattice, tool tables, pre-flight |
| Smart PR Flow      | `references/smart-pr-flow.md`      | PR lifecycle states, auto-labels, auto-merge        |
| CLI Commands       | `references/detailed-commands.md`  | Repos, Actions, Releases, Secrets, API, Auth        |
