# Issues & Pull Requests — gh CLI + MCP Fallback

> Loaded by `github-operations` SKILL.md. Tool tables and creation
> guides for issues and pull requests. Both flows are gh-CLI-first; the
> MCP tools are reserved for operations the CLI does not cover well
> (rich PR review threads, Copilot review requests, bulk GraphQL).

## Issues

Use `gh issue ...` by default. MCP tools are available as a fallback when `gh` cannot
satisfy the operation (e.g., bulk GraphQL queries).

| Tool                           | Purpose                |
| ------------------------------ | ---------------------- |
| `mcp_github_list_issues`       | List repository issues |
| `mcp_github_issue_read`        | Fetch issue details    |
| `mcp_github_issue_write`       | Create/update issues   |
| `mcp_github_search_issues`     | Search issues          |
| `mcp_github_add_issue_comment` | Add comments           |

**Creating issues** — Required: `owner`, `repo`, `title`, `body`. Title guidelines: prefix
with `[Bug]`, `[Feature]`, `[Docs]`; keep under 72 chars.

## Pull Requests

Use `gh pr ...` by default (`gh pr create`, `gh pr merge`, `gh pr edit`, `gh pr review`,
`gh pr list`). The MCP tools below are reserved as a fallback for operations the CLI does
not cover well — notably rich PR review thread management and Copilot review requests.

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

1. Validate branch name (see [Branch Naming](./branch-strategy.md))
2. For domain branches, verify files are in scope
3. Search for PR templates in `.github/PULL_REQUEST_TEMPLATE/`
4. Title must follow conventional commit format

**Default merge method**: `squash` unless user specifies otherwise.

📋 **Smart PR Flow**: Read [`smart-pr-flow.md`](./smart-pr-flow.md) for PR lifecycle
states, auto-labels, and auto-merge conditions.
