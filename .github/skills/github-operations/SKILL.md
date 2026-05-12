---
name: github-operations
description: '**WORKFLOW SKILL** — Full GitHub contribution lifecycle: branch naming, conventional commits, issues, PRs, Actions, and releases. gh CLI-first with MCP fallback. WHEN: "commit", "push", "open PR", "create branch", "create issue", "cut release", "GitHub operation". USE FOR: commit/push, PR creation, branch lifecycle, issues, releases, Actions config. DO NOT USE FOR: Azure infrastructure, Bicep/Terraform code, architecture decisions. INVOKES: gh CLI (primary), GitHub MCP (fallback).'
license: MIT
metadata:
  author: apex
  version: "3.0"
  category: github
---

# GitHub Operations

Full contribution lifecycle — from branch creation to PR merge.
`gh` CLI preferred (always available in this dev container); MCP tools as fallback
for operations with no `gh` equivalent (e.g., rich PR review thread management,
bulk GraphQL queries).

## Steps

```text
1. Create branch (naming convention) →
2. Make changes →
3. Commit (conventional commits) →
4. Push (pre-push hooks validate branch + scope) →
5. Create PR (gh CLI) →
6. Review + Merge
```

## Contribution Lifecycle Detail

```text
1. Create branch (naming convention) →
2. Make changes →
3. Commit (conventional commits) →
4. Push (pre-push hooks validate branch + scope) →
5. Create PR (gh CLI) →
6. Review + Merge
```

## Branch Naming (Mandatory)

Before any commit or PR, validate the branch name:

```bash
git rev-parse --abbrev-ref HEAD
```

| Type          | Prefixes                                                                             | File Scope                 |
| ------------- | ------------------------------------------------------------------------------------ | -------------------------- |
| Domain-scoped | `docs/`, `agents/`, `skills/`, `infra/`, `scripts/`, `instructions/`                 | Restricted to domain paths |
| Cross-cutting | `feat/`, `fix/`, `chore/`, `ci/`, `refactor/`, `perf/`, `test/`, `build/`, `revert/` | Any files                  |

If the branch name is invalid, **stop** and suggest renaming:
`git branch -m <old-name> feat/<descriptive-name>`

For domain-scoped branches, verify changed files are within scope.
If files are out of scope, suggest `feat/` or `fix/` instead.

📋 **Full rules**: Read `references/branch-strategy.md` for scope tables,
validation commands, and enforcement layers.

## Conventional Commits (Mandatory)

Commit messages **must** follow Conventional Commits format (enforced by commitlint):

```text
<type>[optional scope]: <description>
```

| Type       | Purpose       | Type     | Purpose      |
| ---------- | ------------- | -------- | ------------ |
| `feat`     | New feature   | `test`   | Tests        |
| `fix`      | Bug fix       | `build`  | Build system |
| `docs`     | Documentation | `ci`     | CI/CD config |
| `refactor` | Refactor      | `chore`  | Maintenance  |
| `perf`     | Performance   | `revert` | Revert       |

Scopes: `agents`, `skills`, `instructions`, `bicep`, `terraform`, `mcp`, `docs`, `scripts`

📋 **Full workflow**: Read `references/commit-conventions.md` for staging,
breaking changes, best practices, and safety protocol.

## Rules

1. **Identify the operation** (issue, PR, search, Actions, release, etc.)
2. **Use `gh` CLI by default** — always available in this dev container; the more stable primitive
3. **Fall back to MCP only** when `gh` cannot satisfy the operation (rich PR review threads, bulk GraphQL, Copilot review requests)

### Devcontainer Reliability Rule

- Do not run `gh auth login` in devcontainer workflows
- `GH_TOKEN` must be set via VS Code User Settings (`terminal.integrated.env.linux`)
- `gh` CLI authenticates automatically via `GH_TOKEN`; prefer it for issue/PR creation by default
- If a fallback to MCP is required and MCP write tools are missing, report explicitly

## Tool Priority Protocol (Mandatory)

See the [Rules](#rules) section above for the priority order. Detailed CLI/MCP fallback tables below.

---

## Issues & Pull Requests

`gh issue ...` and `gh pr ...` are the default for both. MCP tools are available as a
fallback for operations the CLI does not cover well (rich PR review threads, Copilot review
requests, bulk GraphQL). Full tool tables, creation pre-flight checks, and the
gh-vs-MCP decision lattice live in
[`references/issues-and-prs.md`](references/issues-and-prs.md).

> **Default merge method**: `squash` unless the user specifies otherwise. Read
> [`references/smart-pr-flow.md`](references/smart-pr-flow.md) for PR lifecycle states,
> auto-labels, and auto-merge conditions.

---

## CLI Commands (gh)

📋 **Reference**: Read `references/detailed-commands.md` for complete `gh` CLI
commands covering repos, Actions, releases, secrets, API, and auth.

> **IMPORTANT**: `gh api -f` does not support object values. Use multiple
> `-f` flags with hierarchical keys and string values instead.

## Global Flags

| Flag                | Description                |
| ------------------- | -------------------------- |
| `--repo OWNER/REPO` | Target specific repository |
| `--json FIELDS`     | Output JSON with fields    |
| `--jq EXPRESSION`   | Filter JSON output         |
| `--web`             | Open in browser            |
| `--paginate`        | Fetch all pages            |

---

## DO / DON'T

- **DO**: Validate branch name before committing or creating PRs
- **DO**: Use `gh` CLI by default for issues, PRs, Actions, releases, repos, secrets, API
- **DO**: Fall back to MCP tools when `gh` CLI lacks an equivalent (e.g., review threads, GraphQL bulk queries)
- **DO**: Confirm repository context before creating issues/PRs
- **DO**: Search for existing issues/PRs before creating duplicates
- **DO**: Check for PR templates before creating PRs
- **DON'T**: Commit on a branch with an invalid name
- **DON'T**: Create issues/PRs without confirming repo owner and name
- **DON'T**: Merge PRs without user confirmation
- **DON'T**: Reach for MCP first when `gh` CLI can do the job — MCP availability is not guaranteed
- **DON'T**: Skip hooks (--no-verify) unless user explicitly asks

---

## Reference Index

| Reference          | File                               | Content                                             |
| ------------------ | ---------------------------------- | --------------------------------------------------- |
| Branch Strategy    | `references/branch-strategy.md`    | Naming convention, scope tables, enforcement layers |
| Commit Conventions | `references/commit-conventions.md` | Format, types, staging workflow, safety protocol    |
| Smart PR Flow      | `references/smart-pr-flow.md`      | PR lifecycle states, auto-labels, auto-merge        |
| CLI Commands       | `references/detailed-commands.md`  | Repos, Actions, Releases, Secrets, API, Auth        |

## Smart PR Flow

Automated PR lifecycle for infrastructure deployments. Defines label-based
state tracking, auto-label rules on CI pass/fail, and a watchdog pattern
for the deploy agent.

For full details: **Read** `references/smart-pr-flow.md`

### Quick Reference

| Condition                   | Label Applied        |
| --------------------------- | -------------------- |
| CI passes                   | `infraops-ci-pass`   |
| CI fails                    | `infraops-needs-fix` |
| Review approved             | `infraops-reviewed`  |
| Auto-merge (all gates pass) | PR merged via MCP    |
