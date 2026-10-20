<!-- ref:detailed-commands-v1 -->

# GitHub CLI — Detailed Command Reference

Complete `gh` CLI commands for repositories, Actions, releases, secrets, API requests,
and authentication diagnostics. Use the CLI first, not only when MCP is unavailable.
These are command examples, not authorization. Verify repository/operation scope before
any write, including workflow dispatch, releases, secrets and repository settings.
Pass `--repo <owner/repo>` where supported; use an explicit repository endpoint otherwise.

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
gh workflow run <dispatch-enabled-workflow> --ref <approved-ref>
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

### Dispatch And Run Identity

Dispatch only a workflow that supports `workflow_dispatch`, with approved ref/inputs.
Correlate the resulting run with repository, workflow, branch, event and head SHA.
Do not assume the latest run belongs to your dispatch; concurrent runs can race.
If identity is ambiguous, stop before watching, downloading, cancelling or rerunning it.
Capture verbose logs to a file and inspect bounded sections.

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
# Secrets (metadata only in agent output)
gh secret list

# Variables
gh variable set MY_VAR --body "value"
gh variable list
gh variable get MY_VAR
```

Secret creation/rotation is a separately authorized, user-run private-terminal operation
using the CLI's secure input facility. Never place secret values in chat, command
arguments, repository files or logs. Stop when no private handoff is available.
Deleting secrets or variables also requires explicit target-specific authorization.

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

`-f` supplies string fields; `-F` supports typed/file values. Nested keys use bracket
notation. For a complex request use `--input <approved-json-file>`; never include
secrets in an agent-visible payload file. GraphQL is supported through `gh api graphql`
and is not, by itself, a reason to select MCP.

---

## Auth & Search (gh CLI)

```bash
# Labels
gh label create bug --color "d73a4a" --description "Bug report"
gh label list

# Search
gh search repos "azure bicep" --language hcl
gh search code "uniqueString" --repo owner/repo
gh search issues "label:bug is:open" --repo owner/repo
```

Use existing CLI credentials. Do not execute `gh auth` commands unless the user
explicitly requests authentication troubleshooting, and never print token values.
On a failure, report the failing layer without account switching or persistent
credential changes. See [identity and credential failures](git-commit.md#identity-and-credential-failures).
