<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# GitHub Operations (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## MCP Priority Protocol (Mandatory)

Follow this protocol for every GitHub task:

1. Identify required operation (issue, PR, search, Actions, release, repo admin, etc.)
2. Check whether an MCP tool exists for that exact operation
3. If MCP exists, use MCP only
4. Use `gh` CLI only when no equivalent MCP write tool is available

### Devcontainer Reliability Rule

- Do not run `gh auth login` or `gh auth status` in devcontainer workflows

> _See SKILL.md for full content._

## Issues (MCP Tools)

### Available Tools

| Tool                           | Purpose                |
| ------------------------------ | ---------------------- |
| `mcp_github_list_issues`       | List repository issues |
| `mcp_github_issue_read`        | Fetch issue details    |
| `mcp_github_issue_write`       | Create/update issues   |
| `mcp_github_search_issues`     | Search issues          |
| `mcp_github_add_issue_comment` | Add comments           |


> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._
