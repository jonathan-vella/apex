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

## Repositories (gh CLI)

```bash
# Create
gh repo create my-project --public --clone --gitignore python --license mit

# Clone / Fork
gh repo clone owner/repo
gh repo fork owner/repo --clone

# View / Edit
gh repo view owner/repo --json name,description

> _See SKILL.md for full content._

## GitHub Actions (gh CLI)

### Workflows

```bash
gh workflow list
gh workflow run ci.yml --ref main
gh workflow enable ci.yml
gh workflow disable ci.yml
```

### Runs

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

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

> _See SKILL.md for full content._

## API Requests (gh CLI)

```bash
# GET
gh api /user
gh api /repos/owner/repo --jq '.stargazers_count'

# POST
gh api --method POST /repos/owner/repo/issues \
  --field title="Issue title" \
  --field body="Issue body"


> _See SKILL.md for full content._

## Auth & Search (gh CLI)

```bash
# Auth
gh auth login
gh auth status
gh auth token

# Labels
gh label create bug --color "d73a4a" --description "Bug report"
gh label list


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

| Reference     | File                          | Content                                      |
| ------------- | ----------------------------- | -------------------------------------------- |
| Smart PR Flow | `references/smart-pr-flow.md` | PR lifecycle states, auto-labels, auto-merge |

