---
name: github-operations
description: Handles GitHub issues, pull requests, repositories, Actions, releases, and API tasks using MCP-first workflows with gh CLI fallback for advanced operations.
license: MIT
metadata:
  author: azure-agentic-infraops
  version: "2.0"
  category: github
---

# GitHub Operations

Manage all GitHub operations using MCP tools (preferred) and GitHub CLI (fallback).

> **MCP-first**: Use MCP tools for issues and PRs — no extra auth, works everywhere.
> **CLI fallback**: Use `gh` CLI for Actions, releases, repos, secrets, and API calls.

## MCP Priority Protocol (Mandatory)

Follow this protocol for every GitHub task:

1. Identify required operation (issue, PR, search, Actions, release, repo admin, etc.)
2. Check whether an MCP tool exists for that exact operation
3. If MCP exists, use MCP only
4. Use `gh` CLI only when no equivalent MCP write tool is available

### Devcontainer Reliability Rule

- Do not run `gh auth login` or `gh auth status` in devcontainer workflows
  unless the user explicitly asks for CLI auth troubleshooting.
- `GH_TOKEN` must be set via VS Code User Settings (`terminal.integrated.env.linux`)
  — shell exports (`.bashrc`, `.profile`) do NOT propagate reliably into devcontainers.
- For PR/issue creation, rely on MCP tool authentication by default.
- If MCP write tools are missing in the current environment,
  report the limitation explicitly and provide a no-auth fallback path
  (for example, PR compare URL).

---

## Issues (MCP Tools)

### Available Tools

| Tool                           | Purpose                |
| ------------------------------ | ---------------------- |
| `mcp_github_list_issues`       | List repository issues |
| `mcp_github_issue_read`        | Fetch issue details    |
| `mcp_github_issue_write`       | Create/update issues   |
| `mcp_github_search_issues`     | Search issues          |
| `mcp_github_add_issue_comment` | Add comments           |

### Creating Issues

**Required**: `owner`, `repo`, `title`, `body`
**Optional**: `labels`, `assignees`, `milestone`

**Title guidelines**:

- Prefix with type: `[Bug]`, `[Feature]`, `[Docs]`
- Be specific and actionable
- Keep under 72 characters

**Body templates by type**:

| User says             | Template sections                                             |
| --------------------- | ------------------------------------------------------------- |
| Bug, error, broken    | Description, Steps to Reproduce, Expected/Actual, Environment |
| Feature, enhancement  | Summary, Motivation, Proposed Solution, Acceptance Criteria   |
| Task, chore, refactor | Description, Tasks checklist, Acceptance Criteria             |

### Common Labels

| Label           | Use For                    |
| --------------- | -------------------------- |
| `bug`           | Something isn't working    |
| `enhancement`   | New feature or improvement |
| `documentation` | Documentation updates      |
| `high-priority` | Urgent issues              |

---

## Pull Requests (MCP Tools)

### Available Tools

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
**Optional**: `body`, `draft`

**Title guidelines** (conventional commit):

- `feat:`, `fix:`, `docs:`, `refactor:`
- Be specific, under 72 characters

**Body sections**: Summary, Changes, Testing, Checklist

> **Before creating**: Search for PR templates in `.github/PULL_REQUEST_TEMPLATE/`
> or `pull_request_template.md` and use if found.

### Merging PRs

**Required**: `owner`, `repo`, `pullNumber`
**Optional**: `merge_method` (`squash` | `merge` | `rebase`), `commit_title`

**Default**: Use `squash` unless user specifies otherwise.

### Reviewing PRs

Use `mcp_github_pull_request_review_write` with `method: "create"`:

| Event             | Use When                  |
| ----------------- | ------------------------- |
| `APPROVE`         | Changes ready to merge    |
| `REQUEST_CHANGES` | Issues must be fixed      |
| `COMMENT`         | Feedback without blocking |

**Complex review workflow**:

1. `create` (pending review)
2. `add_comment_to_pending_review` (line comments)
3. `submit_pending` (finalize)

---

## CLI Commands (gh)

📋 **Reference**: Read `references/detailed-commands.md` for complete `gh` CLI commands covering:

- **Repositories** — create, clone, fork, view, edit, sync
- **GitHub Actions** — workflow list/run/enable, run watch/rerun/download
- **Releases** — create, list, view, download, delete
- **Secrets & Variables** — set, list, get, delete
- **API Requests** — GET, POST, pagination, GraphQL
- **Auth & Search** — login, labels, repo/code/issue search

> **IMPORTANT**: `gh api -f` does not support object values. Use multiple
> `-f` flags with hierarchical keys and string values instead.

---

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

- **DO**: Use MCP tools first for issues and PRs
- **DO**: Use `gh` CLI for Actions, releases, repos, secrets, API
- **DO**: Explain when MCP write tools are unavailable and why fallback is required
- **DO**: Confirm repository context before creating issues/PRs
- **DO**: Search for existing issues/PRs before creating duplicates
- **DO**: Check for PR templates before creating PRs
- **DO**: Ask for missing critical information rather than guessing
- **DON'T**: Create issues/PRs without confirming repo owner and name
- **DON'T**: Merge PRs without user confirmation
- **DON'T**: Use `gh` CLI for issues/PRs when MCP tools are available
- **DON'T**: Attempt `gh` auth flows in devcontainers unless explicitly requested

---

## References

- GitHub CLI Manual: https://cli.github.com/manual/
- REST API: https://docs.github.com/en/rest
- GraphQL API: https://docs.github.com/en/graphql
- Commit conventions: `.github/skills/git-commit/SKILL.md`

## Reference Index

| Reference     | File                              | Content                                      |
| ------------- | --------------------------------- | -------------------------------------------- |
| Smart PR Flow | `references/smart-pr-flow.md`     | PR lifecycle states, auto-labels, auto-merge |
| CLI Commands  | `references/detailed-commands.md` | Repos, Actions, Releases, Secrets, API, Auth |

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
