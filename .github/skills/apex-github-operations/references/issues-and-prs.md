<!-- ref:issues-and-prs-v1 -->
# Issues And Pull Requests

Use `gh issue` and `gh pr` first, then `gh api` for REST/GraphQL capabilities not
exposed by a high-level command. Discover actual MCP tools only for a required
capability unavailable through the CLI. Do not hard-code server/tool identifiers.
Neither fallback nor an existing PR grants write or merge authorization.

## Repository And Issue Scope

Verify the intended `owner/repo` against the Git remote. Pass `--repo <owner/repo>`
to avoid a configured CLI default targeting another repository.
For issues, identify the number and requested fields, or title/body/template for creation.
Use the repository's issue templates and conventions; do not impose generic title prefixes.
List/search/view is read-only. Creating, editing, commenting, closing and assigning require
the corresponding explicit user request. Read-only review does not authorize posting it.

```bash
gh issue view <number> --repo <owner/repo>
gh issue create --repo <owner/repo> --title "<title>" --body-file <approved-body-file>
```

## PR Creation And Update

Before a write:

1. Verify repository, head branch, base branch and all commits in the proposed PR.
   Resolve the default base from the target repository unless the user specified another;
   do not assume `main` for every repository.
2. Run [branch naming and scope checks](branch-strategy.md).
   Do not commit/push from a protected/default branch or rename implicitly.
3. Inspect `.github/PULL_REQUEST_TEMPLATE.md`, root `PULL_REQUEST_TEMPLATE.md`,
   templates under `docs/`, and `.github/PULL_REQUEST_TEMPLATE/` as applicable.
   Use the matching template; do not replace it with an auto-generated commit list.
4. Verify the remote head contains the reviewed commits. If publication is needed,
   follow [authorized push](git-commit.md#push-only-when-authorized); a PR request
   alone does not supply missing push authorization.
5. Look for an existing open PR with this head and base. Report it instead of creating
   a duplicate; edit its title/body only when requested.
6. Use a Conventional Commit title and a truthful body with scope, validation results,
   unperformed checks and related issues. Avoid empty issue-closing placeholders.
7. Confirm authorization covers creation or the exact update fields; then execute only
   that action. Decline/cancellation never approves.

```bash
gh pr list --repo <owner/repo> --head "<head>" --base "<base>" \
  --state open --json number,url,title
gh pr create --repo <owner/repo> --base "<base>" --head "<head>" \
  --title "<type>(<scope>): <subject>" --body-file <approved-body-file>
```

Verify and report the actual PR URL/state. If creation fails, report failure.
A compare URL is a navigation aid, not evidence that a PR was created.
Pushing to an existing PR already changes its contents; do not describe a later
title/body decision as the approval for that earlier publication.

## Checks, Reviews And Merge

Query actual GitHub state, not local labels or deployment success:

```bash
gh pr checks <number> --repo <owner/repo>
gh pr view <number> --repo <owner/repo> \
  --json url,state,isDraft,headRefOid,reviewDecision,mergeStateStatus,statusCheckRollup
```

Pending, skipped, unavailable and failed checks are not verified success.
Do not infer live branch protection, required approvals or auto-merge availability
from workflow YAML or labels. Observe applicable GitHub requirements and unresolved
review conversations. Do not approve your own work on behalf of a human.

Merge and enabling auto-merge each require an explicit request for the target PR and
method. Default to squash only when no method was specified. Recheck current head SHA,
checks and reviews immediately before acting; changed head/scope requires renewed approval.
Use the reviewed head SHA to prevent merging a concurrently changed PR:

```bash
gh pr merge <number> --repo <owner/repo> --squash --match-head-commit "<reviewed-head-sha>"
```

Use `--auto` only if explicitly authorized and supported by the target repository.
Never use admin/bypass options to override requirements. Branch deletion is a separate action.
Afterward verify whether the PR is actually merged or merely has auto-merge enabled;
do not report a scheduled merge as completed.

## Post-Deployment Boundary

APEX does not implement an automatic PR label/watchdog/merge lifecycle.
Deployment completion neither authorizes GitHub writes nor supplies PR review approval.
Only perform a requested PR status lookup, comment, label edit or merge under its own
operation scope. Do not create workflow labels, polling loops or external automation implicitly.
