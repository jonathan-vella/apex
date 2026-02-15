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

## Repositories (gh CLI)

```bash
# Create
gh repo create my-project --public --clone --gitignore python --license mit

# Clone / Fork
gh repo clone owner/repo
gh repo fork owner/repo --clone

# View / Edit
gh repo view owner/repo --json name,description
gh repo edit --default-branch main --delete-branch-on-merge

# Sync fork
gh repo sync

# Set default repo (avoid --repo flag)
gh repo set-default owner/repo
```

---

## GitHub Actions (gh CLI)

### Workflows

```bash
gh workflow list
gh workflow run ci.yml --ref main
gh workflow enable ci.yml
gh workflow disable ci.yml
```

### Runs

```bash
gh run list --workflow ci.yml --limit 5
gh run watch <run-id>
gh run view <run-id> --log
gh run rerun <run-id>
gh run rerun <run-id> --failed    # Only failed jobs
gh run download <run-id> --dir ./artifacts
gh run cancel <run-id>
```

### CI/CD Pattern

```bash
gh workflow run ci.yml --ref main
RUN_ID=$(gh run list --workflow ci.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID"
gh run download "$RUN_ID" --dir ./artifacts
```

---

## Releases (gh CLI)

```bash
# Create
gh release create v1.0.0 --title "v1.0.0" --notes "Release notes"
gh release create v1.0.0 --generate-notes    # Auto-generate notes
gh release create v1.0.0 ./dist/*.tar.gz     # With assets

# List / View / Download
gh release list
gh release view v1.0.0
gh release download v1.0.0 --dir ./download

# Delete
gh release delete v1.0.0 --yes
```

---

## Secrets & Variables (gh CLI)

```bash
# Secrets
gh secret set MY_SECRET --body "secret_value"
gh secret list
gh secret delete MY_SECRET

# Variables
gh variable set MY_VAR --body "value"
gh variable list
gh variable get MY_VAR
```

---

## API Requests (gh CLI)

```bash
# GET
gh api /user
gh api /repos/owner/repo --jq '.stargazers_count'

# POST
gh api --method POST /repos/owner/repo/issues \
  --field title="Issue title" \
  --field body="Issue body"

# Pagination
gh api /user/repos --paginate

# GraphQL
gh api graphql -f query='{
  viewer { login repositories(first: 5) { nodes { name } } }
}'
```

> **IMPORTANT**: `gh api -f` does not support object values. Use multiple
> `-f` flags with hierarchical keys and string values instead.

---

## Auth & Search (gh CLI)

```bash
# Auth
gh auth login
gh auth status
gh auth token

# Labels
gh label create bug --color "d73a4a" --description "Bug report"
gh label list

# Search
gh search repos "azure bicep" --language hcl
gh search code "uniqueString" --repo owner/repo
gh search issues "label:bug is:open" --repo owner/repo
```

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
