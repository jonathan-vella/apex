<!-- ref:smart-pr-flow-v1 -->

# Smart PR Flow

Automated PR lifecycle pattern for infrastructure deployments.

## PR Lifecycle States

```text
draft → ready → ci-pending → ci-pass / ci-fail → reviewed → merged
```

| State        | Trigger                      | Action                       |
| ------------ | ---------------------------- | ---------------------------- |
| `draft`      | Agent creates PR             | Label: `infraops-draft`      |
| `ready`      | Agent marks ready for review | Remove `infraops-draft`      |
| `ci-pending` | CI workflow starts           | Label: `infraops-ci-pending` |
| `ci-pass`    | All CI checks pass           | Label: `infraops-ci-pass`    |
| `ci-fail`    | Any CI check fails           | Label: `infraops-needs-fix`  |
| `reviewed`   | Approved review received     | Label: `infraops-reviewed`   |
| `merged`     | Auto-merge conditions met    | Merge PR                     |

## Auto-Label Rules

| Event             | Add Label            | Remove Label         |
| ----------------- | -------------------- | -------------------- |
| CI failure        | `infraops-needs-fix` | `infraops-ci-pass`   |
| CI pass           | `infraops-ci-pass`   | `infraops-needs-fix` |
| Review approved   | `infraops-reviewed`  | —                    |
| Changes requested | `infraops-needs-fix` | `infraops-reviewed`  |

## Auto-Merge Conditions

Auto-merge is triggered when ALL of these are true:

1. CI status: all checks pass (`infraops-ci-pass` label present)
2. Review status: at least 1 approved review (`infraops-reviewed` label present)
3. No open `must_fix` findings in session state
4. No `infraops-needs-fix` label present
5. Mandatory review gate: human has explicitly approved

> **Safety**: Auto-merge NEVER bypasses the human review requirement.
> The deploy agent checks CI status but does not merge without approval.

## Deploy Agent Integration

After a successful deployment (`az deployment` / `terraform apply`):

1. Check if running in PR context (`git rev-parse --abbrev-ref HEAD` ≠ `main`)
2. Query CI status via `gh pr checks` or MCP tools
3. Apply appropriate label:
   - All checks pass → `infraops-ci-pass`
   - Any check fails → `infraops-needs-fix`
4. If all auto-merge conditions are met AND review is approved:
   - Execute auto-merge via MCP `mcp_github_merge_pull_request`
5. If conditions not met:
   - Comment on PR with status summary

## Watchdog Pattern

The deploy agent polls PR status after deployment:

```text
1. Deploy completes
2. Wait for CI checks (poll every 30s, max 5 min)
3. Check results:
   - All pass → apply ci-pass label
   - Any fail → apply needs-fix label, comment with failure details
4. Check auto-merge conditions
5. If met → merge (with approval gate)
6. If not → summarize status in PR comment
```

## CLI Commands Reference

```bash
# Label management
gh pr edit {number} --add-label "infraops-ci-pass"
gh pr edit {number} --remove-label "infraops-needs-fix"

# Check CI status
gh pr checks {number}

# Auto-merge (requires prior approval)
gh pr merge {number} --auto --squash

# PR status query
gh pr view {number} --json state,labels,reviews,statusCheckRollup
```
