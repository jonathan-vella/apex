<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# GitHub Operations (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

## Contribution Lifecycle
> _See SKILL.md for full content._

## Branch Naming (Mandatory)

Before any commit or PR, validate the branch name:

```bash
git rev-parse --abbrev-ref HEAD
```
> _See SKILL.md for full content._

## Conventional Commits (Mandatory)

Commit messages **must** follow Conventional Commits format (enforced by commitlint):

```text
<type>[optional scope]: <description>
```
> _See SKILL.md for full content._

## Tool Priority Protocol (Mandatory)

1. Identify required operation (issue, PR, search, Actions, release, etc.)
2. Use `gh` CLI by default — it is always available in this dev container and
   is the more stable primitive
3. Fall back to MCP tools only when the operation has no `gh` CLI equivalent
   (e.g., rich PR review thread management, bulk GraphQL queries, Copilot
   code review requests)
> _See SKILL.md for full content._

## Issues (gh CLI primary, MCP fallback)

Use `gh issue ...` by default. MCP tools are available as a fallback when
`gh` cannot satisfy the operation (e.g., bulk GraphQL queries).

| Tool                           | Purpose                |
| ------------------------------ | ---------------------- |
| `mcp_github_list_issues`       | List repository issues |
> _See SKILL.md for full content._

## Pull Requests (gh CLI primary, MCP fallback)

Use `gh pr ...` by default (`gh pr create`, `gh pr merge`, `gh pr edit`,
`gh pr review`, `gh pr list`). The MCP tools below are reserved as a fallback
for operations the CLI does not cover well — notably rich PR review thread
management and Copilot review requests.

| Tool                                   | Purpose               |
> _See SKILL.md for full content._

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
> _See SKILL.md for full content._

## DO / DON'T

- **DO**: Validate branch name before committing or creating PRs
- **DO**: Use `gh` CLI by default for issues, PRs, Actions, releases, repos, secrets, API
- **DO**: Fall back to MCP tools when `gh` CLI lacks an equivalent (e.g., review threads, GraphQL bulk queries)
- **DO**: Confirm repository context before creating issues/PRs
- **DO**: Search for existing issues/PRs before creating duplicates
- **DO**: Check for PR templates before creating PRs
> _See SKILL.md for full content._

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
> _See SKILL.md for full content._
