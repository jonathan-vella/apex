---
name: github-operations
description: >
  Manage GitHub issues and pull requests using MCP tools. Use this skill for
  creating/updating issues, filing bugs, feature requests, creating PRs,
  merging branches, requesting reviews, or any GitHub issue/PR lifecycle task.
  Triggers: "create issue", "file bug", "feature request", "create PR",
  "merge branch", "request review", "update PR", "check PR status".
license: MIT
metadata:
  author: azure-agentic-infraops
  version: "1.0"
  category: github
---

# GitHub Operations

Manage GitHub issues and pull requests using MCP tools.

> **Prefer MCP tools** over `gh` CLI for all GitHub operations — no extra
> auth required, more reliable, and works in all environments.

---

## Issues

### MCP Tools

| Tool | Purpose |
| --- | --- |
| `mcp_github_list_issues` | List repository issues |
| `mcp_github_issue_read` | Fetch issue details |
| `mcp_github_issue_write` | Create/update issues |
| `mcp_github_search_issues` | Search issues |
| `mcp_github_add_issue_comment` | Add comments |

### Creating Issues

**Required**: `owner`, `repo`, `title`, `body`
**Optional**: `labels`, `assignees`, `milestone`

**Title guidelines**:
- Prefix with type: `[Bug]`, `[Feature]`, `[Docs]`
- Be specific and actionable
- Keep under 72 characters

**Body templates by type**:

| User says | Template sections |
| --- | --- |
| Bug, error, broken | Description, Steps to Reproduce, Expected/Actual, Environment |
| Feature, enhancement | Summary, Motivation, Proposed Solution, Acceptance Criteria |
| Task, chore, refactor | Description, Tasks checklist, Acceptance Criteria |

### Common Labels

| Label | Use For |
| --- | --- |
| `bug` | Something isn't working |
| `enhancement` | New feature or improvement |
| `documentation` | Documentation updates |
| `high-priority` | Urgent issues |

---

## Pull Requests

### MCP Tools

| Tool | Purpose |
| --- | --- |
| `mcp_github_create_pull_request` | Create new PRs |
| `mcp_github_merge_pull_request` | Merge PRs |
| `mcp_github_update_pull_request` | Update PR details |
| `mcp_github_pull_request_review_write` | Create/submit reviews |
| `mcp_github_request_copilot_review` | Copilot code review |
| `mcp_github_search_pull_requests` | Search PRs |
| `mcp_github_list_pull_requests` | List PRs |

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

| Event | Use When |
| --- | --- |
| `APPROVE` | Changes ready to merge |
| `REQUEST_CHANGES` | Issues must be fixed |
| `COMMENT` | Feedback without blocking |

**Complex review workflow**:
1. `create` (pending review)
2. `add_comment_to_pending_review` (line comments)
3. `submit_pending` (finalize)

---

## DO / DON'T

- **DO**: Use MCP tools first, `gh` CLI as fallback only
- **DO**: Confirm repository context before creating issues/PRs
- **DO**: Search for existing issues/PRs before creating duplicates
- **DO**: Check for PR templates before creating PRs
- **DO**: Ask for missing critical information rather than guessing
- **DON'T**: Create issues/PRs without confirming repo owner and name
- **DON'T**: Merge PRs without user confirmation
- **DON'T**: Use `gh` CLI when MCP tools are available
