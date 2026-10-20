---
name: apex-github-operations
user-invocable: true
disable-model-invocation: false
argument-hint: "Operation (commit, push, PR, issue, Actions, release) and explicit repository/file scope"
description: '**WORKFLOW SKILL** — Scoped Git/GitHub operations: branches, commits, push, issues, PRs, Actions, releases. WHEN: "commit", "push", "open PR", "create branch", "create issue", "cut release", "GitHub operation". Uses git/gh CLI first; discover MCP only for unavailable CLI capabilities. DO NOT USE FOR: Azure deployment or architecture. Loading never authorizes writes.'
license: MIT
metadata:
  author: apex
  version: "4.0"
  category: github
---

# GitHub Operations

Use this skill for Git and GitHub contribution work in the VS Code Copilot SDK harness.
Invoke `/apex-github-operations` with the operation and scope, or request it in natural language.

## Prerequisites

- Use the active caller's authorized tools and operator/runtime-selected model.
  This skill does not select an agent/model, grant permissions, or require model attestation.
- Require `git` for local operations and `gh` for GitHub operations; verify the repository,
  branch, remote and requested scope before writes. Local commits do not require GitHub authentication.
- Use existing CLI credentials. Do not run `gh auth` unless explicitly asked to troubleshoot
  authentication. Never print tokens, request secrets through chat, or switch identity implicitly.
- If required tools, scope or authorization are missing, stop and report the blocker.
  The interactive parent owns `ask_user`; a delegated worker returns `USER_INPUT_REQUIRED`.

## Operation And Authorization

Identify the requested operation before loading its reference. These are separate actions,
not an automatic contribution pipeline:

| Request | Authorized scope |
| --- | --- |
| Review, status, search or explain | Read-only; no staging, commit or remote writes |
| Commit | Stage only approved files/hunks and create a local commit |
| Push | Publish the approved branch and reviewed outgoing commits to the approved remote |
| Create/update a PR or issue | Only the requested repository and fields |
| Merge or enable auto-merge | Separate explicit authorization for that PR and method |
| Run/cancel Actions, release or change repository settings | Explicit authorization for that operation and target |

A user may explicitly authorize several actions together; record each action's scope.
A commit request alone never authorizes push, PR creation or merge. Skill invocation,
successful checks, deployment success and an existing PR do not supply authorization.
Decline does not approve; cancellation stops. Never infer approval from silence.

## Safety Rules

- Inspect the full existing index and preserve unrelated work and partially staged files.
  Never stage the entire worktree by default or unstage someone else's changes.
- Exclude `agent-output/` and `infra/` from inferred commit scope. Include them only when
  the user explicitly includes those paths; existing artifact, review and IaC rules still apply.
  There are no plugin-specific branch exceptions.
- Refuse commit/push from `main`, the repository default branch, or detached HEAD.
  Validate contributor branch naming and file scope before commit/push/PR operations.
  Propose a rename when needed; do not rename a branch without authorization.
- Use Conventional Commits and normal hooks. Do not bypass hooks, force-push, amend,
  reset, rebase, remove files or modify Git configuration implicitly.
- Inspect hook results and any generated changes; do not automatically publish or
  stage additional files. Report failures and the actual local/remote outcome.
- Prefer `git` and `gh`. `gh api`, including GraphQL, covers many operations beyond
  the high-level CLI. Discover actual MCP tools only when a required CLI capability is unavailable;
  never assume a server/tool name or treat MCP as an authentication bypass.
- Bound command output and inspect large diffs/logs in targeted sections.
  Use `ask_user`, not interactive shell prompts, for missing decisions.

## Reference Index

| Operation | Load only the relevant reference |
| --- | --- |
| Branch naming, creation or scope checks | [Branch strategy](references/branch-strategy.md) |
| Staging, local commit or authorized push | [Commit/push procedure](references/git-commit.md) |
| Commit format, trailers or failure recovery | [Commit conventions](references/commit-conventions.md) |
| Issues, PR creation/update, review or merge | [Issues and PRs](references/issues-and-prs.md) |
| Repositories, Actions, releases, API or search | [CLI commands](references/detailed-commands.md) |

## Output And Stop Rules

Report the operation, repository/branch, included and excluded scope, checks performed,
commit hash or GitHub URL when created, and any actions not performed.
Never report a failed push as publication or skipped/pending checks as success.
If a commit succeeds but a later authorized push fails, preserve the local commit and stop.
Missing authorization, ambiguous scope, unrelated staged changes, failed hooks/checks,
credential mismatch or stale approval require a blocker, not a success-shaped fallback.
