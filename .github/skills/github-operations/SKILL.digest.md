<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# GitHub Operations (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Contribution Lifecycle

```text
1. Create branch (naming convention) →
2. Make changes →
3. Commit (conventional commits) →
4. Push (pre-push hooks validate) →
5. Create PR (MCP tools) →
6. Review + Merge
```

## Branch Naming (Mandatory)

Validate branch: `git rev-parse --abbrev-ref HEAD`

| Type          | Prefixes                                                                             | File Scope                          |
| ------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| Domain-scoped | `docs/`, `agents/`, `skills/`, `infra/`, `scripts/`, `instructions/`                 | Restricted (see branch-strategy.md) |
| Cross-cutting | `feat/`, `fix/`, `chore/`, `ci/`, `refactor/`, `perf/`, `test/`, `build/`, `revert/` | Any files                           |

📋 Full rules: `references/branch-strategy.md`

## Conventional Commits (Mandatory)

Format: `<type>[scope]: <description>`
Enforced by commitlint hook.

📋 Full workflow: `references/commit-conventions.md`

## MCP Priority Protocol (Mandatory)

1. Check whether an MCP tool exists for the operation
2. If MCP exists, use MCP only
3. Use `gh` CLI only when no equivalent MCP tool is available

> _See SKILL.md for full content._

## Issues (MCP Tools)

`mcp_github_list_issues`, `mcp_github_issue_read`, `mcp_github_issue_write`, `mcp_github_search_issues`, `mcp_github_add_issue_comment`.

## Pull Requests (MCP Tools)

`mcp_github_create_pull_request`, `mcp_github_merge_pull_request`, `mcp_github_update_pull_request`, `mcp_github_pull_request_review_write`, `mcp_github_request_copilot_review`, `mcp_github_search_pull_requests`.

> _See SKILL.md for full content._

## CLI Commands (gh)

📋 **Reference**: Read `references/detailed-commands.md` for complete `gh` CLI commands covering:

- **Repositories** — create, clone, fork, view, edit, sync
- **GitHub Actions** — workflow list/run/enable, run watch/rerun/download
- **Releases** — create, list, view, download, delete
- **Secrets & Variables** — set, list, get, delete
- **API Requests** — GET, POST, pagination, GraphQL
- **Auth & Search** — login, labels, repo/code/issue search

> **IMPORTANT**: `gh api -f` does not support object values. Use multiple

> _See SKILL.md for full content._

Global flags: `--repo OWNER/REPO`, `--json FIELDS`, `--jq EXPRESSION`, `--web`, `--paginate`.

## DO / DON'T

- **DO**: Use MCP tools first for issues and PRs; `gh` CLI for Actions, releases, repos, secrets, API
- **DON'T**: Create issues/PRs without confirming repo; merge without user confirmation

> _See SKILL.md for full content._

## Reference Index

| Reference          | File                               | Content                                      |
| ------------------ | ---------------------------------- | -------------------------------------------- |
| Branch Strategy    | `references/branch-strategy.md`    | Naming convention, scope tables, enforcement |
| Commit Conventions | `references/commit-conventions.md` | Format, types, staging, safety protocol      |
| Smart PR Flow      | `references/smart-pr-flow.md`      | PR lifecycle states, auto-labels, auto-merge |
| CLI Commands       | `references/detailed-commands.md`  | Repos, Actions, Releases, Secrets, API, Auth |

## Smart PR Flow

Automated PR lifecycle for infrastructure deployments. Label-based state tracking,
auto-label rules, watchdog pattern. **Read** `references/smart-pr-flow.md` for details.
