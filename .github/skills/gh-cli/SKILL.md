---
name: gh-cli
description: >
  GitHub CLI (gh) quick reference for operations not covered by MCP tools.
  Use for Actions workflows, repository management, releases, API calls,
  and fallback GitHub operations. Prefer MCP tools (github-operations skill)
  for issues and PRs. Triggers: "gh cli", "workflow run", "gh api",
  "gh release", "gh repo".
license: MIT
metadata:
  author: azure-agentic-infraops
  version: "2.0"
  category: github
---

# GitHub CLI (gh) Quick Reference

> **Prefer MCP tools** for issues and PRs — see `github-operations` skill.
> Use `gh` CLI for operations MCP doesn't cover (Actions, releases, API, repos).

---

## Auth Basics

```bash
gh auth login                    # Interactive login
gh auth status                   # Check auth
gh auth token                    # Get token
gh auth setup-git                # Configure git credential helper
```

---

## Repositories (gh repo)

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

## GitHub Actions (gh run / gh workflow)

### Workflows

```bash
# List workflows
gh workflow list

# Run workflow
gh workflow run ci.yml --ref main

# Enable/disable
gh workflow enable ci.yml
gh workflow disable ci.yml
```

### Runs

```bash
# List runs
gh run list --workflow ci.yml --limit 5

# Watch a run
gh run watch <run-id>

# View logs
gh run view <run-id> --log

# Re-run
gh run rerun <run-id>
gh run rerun <run-id> --failed    # Only failed jobs

# Download artifacts
gh run download <run-id> --dir ./artifacts

# Cancel
gh run cancel <run-id>
```

### CI/CD Workflow

```bash
# Run and watch
gh workflow run ci.yml --ref main
RUN_ID=$(gh run list --workflow ci.yml --limit 1 --json databaseId --jq '.[0].databaseId')
gh run watch "$RUN_ID"
gh run download "$RUN_ID" --dir ./artifacts
```

---

## Releases (gh release)

```bash
# Create release
gh release create v1.0.0 --title "v1.0.0" --notes "Release notes"
gh release create v1.0.0 --generate-notes    # Auto-generate notes
gh release create v1.0.0 ./dist/*.tar.gz     # With assets

# List / View
gh release list
gh release view v1.0.0

# Download assets
gh release download v1.0.0 --dir ./download

# Delete
gh release delete v1.0.0 --yes
```

---

## Secrets & Variables

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

## API Requests (gh api)

```bash
# GET request
gh api /user
gh api /repos/owner/repo --jq '.stargazers_count'

# POST request
gh api --method POST /repos/owner/repo/issues \
  --field title="Issue title" \
  --field body="Issue body"

# Pagination
gh api /user/repos --paginate

# GraphQL
gh api graphql -f query='{
  viewer { login repositories(first: 5) { nodes { name } } }
}'

# JSON + jq filtering
gh repo view --json name,description
gh pr list --json number,title --jq '.[] | select(.number > 100)'
```

> **IMPORTANT**: `gh api -f` does not support object values. Use multiple
> `-f` flags with hierarchical keys and string values instead.

---

## Labels & Search

```bash
# Labels
gh label create bug --color "d73a4a" --description "Bug report"
gh label list

# Search
gh search repos "azure bicep" --language hcl
gh search code "uniqueString" --repo owner/repo
gh search issues "label:bug is:open" --repo owner/repo
```

---

## Common Patterns

### Create PR from Issue

```bash
gh issue develop 123 --branch feature/issue-123
git add . && git commit -m "Fix #123" && git push
gh pr create --title "Fix #123" --body "Closes #123"
```

### Bulk Operations

```bash
# Close stale issues
gh issue list --search "label:stale" --json number --jq '.[].number' | \
  xargs -I {} gh issue close {} --comment "Closing as stale"
```

---

## Global Flags

| Flag | Description |
| --- | --- |
| `--repo OWNER/REPO` | Target specific repository |
| `--json FIELDS` | Output JSON with fields |
| `--jq EXPRESSION` | Filter JSON output |
| `--web` | Open in browser |
| `--paginate` | Fetch all pages |

---

## References

- Manual: https://cli.github.com/manual/
- REST API: https://docs.github.com/en/rest
- GraphQL API: https://docs.github.com/en/graphql
