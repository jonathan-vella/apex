---
name: github-operations
description: "Full contribution lifecycle: branch naming, conventional commits, GitHub issues, PRs, Actions, and releases. MCP-first with gh CLI fallback. USE FOR: commit, push, PR, branch, issue, release, GitHub operations. DO NOT USE FOR: Azure infrastructure, Bicep/Terraform code, architecture decisions."
license: MIT
metadata:
  author: apex
  version: "3.0"
  category: github
---

# GitHub Operations

Full contribution lifecycle — from branch creation to PR merge.
MCP tools preferred; `gh` CLI as fallback.

## Contribution Lifecycle

```text
1. Create branch (naming convention) →
2. Make changes →
3. Commit (conventional commits) →
4. Push (pre-push hooks validate branch + scope) →
5. Create PR (MCP tools) →
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

## MCP Priority Protocol (Mandatory)

1. Identify required operation (issue, PR, search, Actions, release, etc.)
2. Check whether an MCP tool exists for that operation
3. If MCP exists, use MCP only
4. Use `gh` CLI only when no equivalent MCP tool is available

### Devcontainer Reliability Rule

- Do not run `gh auth login` in devcontainer workflows
- `GH_TOKEN` must be set via VS Code User Settings (`terminal.integrated.env.linux`)
- For PR/issue creation, rely on MCP tool authentication by default
- If MCP write tools are missing, report explicitly and provide fallback

---

## Issues (MCP Tools)

| Tool                           | Purpose                |
| ------------------------------ | ---------------------- |
| `mcp_github_list_issues`       | List repository issues |
| `mcp_github_issue_read`        | Fetch issue details    |
| `mcp_github_issue_write`       | Create/update issues   |
| `mcp_github_search_issues`     | Search issues          |
| `mcp_github_add_issue_comment` | Add comments           |

**Creating issues** — Required: `owner`, `repo`, `title`, `body`.
Title guidelines: prefix with `[Bug]`, `[Feature]`, `[Docs]`; keep under 72 chars.

---

## Pull Requests (MCP Tools)

| Tool                                   | Purpose               |
| -------------------------------------- | --------------------- |
| `mcp_github_create_pull_request`       | Create new PRs        |
| `mcp_github_merge_pull_request`        | Merge PRs             |
| `mcp_github_update_pull_request`       | Update PR details     |
| `mcp_github_pull_request_review_write` | Create/submit reviews |
| `mcp_github_request_copilot_review`    | Copilot code review   |
| `mcp_github_search_pull_requests`      | Search PRs            |
| `mcp_github_list_pull_requests`        | List PRs              |

### Creating PRs

**Required**: `owner`, `repo`, `title`, `head` (source branch), `base` (target branch)

**Pre-flight checks** (mandatory before creating):

1. Validate branch name (see Branch Naming above)
2. For domain branches, verify files are in scope
3. Search for PR templates in `.github/PULL_REQUEST_TEMPLATE/`
4. Title must follow conventional commit format

**Default merge method**: `squash` unless user specifies otherwise.

📋 **Smart PR Flow**: Read `references/smart-pr-flow.md` for PR lifecycle
states, auto-labels, and auto-merge conditions.

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
- **DO**: Use MCP tools first for issues and PRs
- **DO**: Use `gh` CLI for Actions, releases, repos, secrets, API
- **DO**: Confirm repository context before creating issues/PRs
- **DO**: Search for existing issues/PRs before creating duplicates
- **DO**: Check for PR templates before creating PRs
- **DON'T**: Commit on a branch with an invalid name
- **DON'T**: Create issues/PRs without confirming repo owner and name
- **DON'T**: Merge PRs without user confirmation
- **DON'T**: Use `gh` CLI for issues/PRs when MCP tools are available
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
