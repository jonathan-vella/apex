<!-- ref:git-commit-v1 -->
# Scoped Commit And Authorized Push

Use the caller's authorized tools and operator/runtime-selected model.
Commit, push and PR operations are independent. A local commit needs `git`,
not an authenticated GitHub session. Load [issues and PRs](issues-and-prs.md)
only when that operation is requested.

## Inputs And Authorization

Record the requested action, repository, branch, approved files/hunks and optional
commit subject. For push, also record the remote and outgoing commits.
An explicit combined request may authorize commit and push together; otherwise obtain
push authorization separately with `ask_user` before publishing.
Commit authorization never implies push authorization. Pushing updates any existing PR
for that branch; disclose that effect before obtaining push approval.

When delegated, return `USER_INPUT_REQUIRED` to the interactive parent for missing
scope or approvals. Decline does not approve; cancellation stops.

## Inspect Before Staging

1. Confirm the repository root, active branch and requested file scope.
   Refuse `main`, the repository default branch and detached HEAD.
   Follow [branch strategy](branch-strategy.md); do not rename implicitly.
2. Verify author and committer identity:

   ```bash
   git var GIT_AUTHOR_IDENT
   git var GIT_COMMITTER_IDENT
   ```

   If identity is missing, stop and report the configuration source; do not invent an
   author or repair dotfiles/configuration without approval.
3. Inspect worktree changes and the entire existing index, including staged deletions:

   ```bash
   git status --short
   git diff --cached --name-status
   git diff --name-status
   ```

4. Derive an explicit file/hunk list from the user's task, not from every modified file.
   Exclude `agent-output/` and `infra/` from inferred scope unless explicitly included
   by the user. Their existing governance/review rules remain mandatory.
   No branch name makes unrelated files eligible.
5. If the existing index contains unrelated or excluded changes, stop and report them.
   Do not unstage or overwrite the user's work. Preserve partially staged files:
   do not replace their staged content with all worktree changes.
6. For approved removal/exclusion edits, preserve unrelated hunks and other submodules.
   Mixed files require hunk edits; never restore a whole mixed file from a base revision.

## Stage And Validate

Stage only approved files; do not use whole-worktree staging or interactive staging.
For partial files, use an approved index patch without overwriting other staged hunks.

```bash
git add -- path/to/approved-file
git diff --cached --stat
git diff --cached --check
```

Recheck the full index against the approved list after staging. Read all relevant staged
hunks in bounded sections, including deletions and generated/lockfile changes when material;
the first page of a diff is not a complete review.
If the index is empty, report no commit was created and stop.
Run the smallest applicable repository checks and branch-scope validation.
Do not invoke artifact markdown lint directly; existing hooks/review own that contract.

## Create The Local Commit

Use the provided subject when valid, or derive a Conventional Commit from the scoped diff.
Follow [commit conventions](commit-conventions.md), including the required co-author trailer.
An explicit commit request authorizes composing and creating that scoped local commit;
do not demand a redundant message confirmation unless the meaning or scope is ambiguous.

```bash
git commit -m "<type>(<scope>): <subject>" \
  -m "<body>" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Omit the trailer only if the user explicitly requests it.
Normal pre-commit and commit-msg hooks must run. If any hook or commit fails, capture
the error and stop; do not retry automatically, amend an earlier commit or bypass checks.
After success, inspect the resulting commit and worktree:

```bash
git log -1 --format='%h %s'
git show --stat --oneline HEAD
git status --short
```

Hooks may generate or stage files. Verify the actual commit contains only approved changes.
Report unexpected scope without rewriting history or pushing it. Leave post-commit
generated work uncommitted unless separately included and authorized.
For commit-only requests, finish here; report that no push or PR action was performed.

## Push Only When Authorized

1. Verify `origin` or the explicitly requested remote targets the intended repository.
   Use existing credentials. Do not require remote access for a commit-only request.
2. Inspect the remote branch tip and all outgoing commits, not just the newest commit.
   Refresh the relevant remote ref when needed. If the remote branch is new, compare
   against the verified target base. Missing/stale comparison evidence blocks publication.
3. Confirm authorization covers this remote, branch and outgoing history, including the
   update to any existing PR. If it does not, use `ask_user` before push.
4. Recheck branch naming/scope and run the ordinary push with normal pre-push hooks:

   ```bash
   git push origin "<approved-feature-branch>"
   ```

   Replace `origin` only with the explicitly approved remote. Do not chain commit and
   push in a way that skips the intervening scope/authorization checks.
5. Verify the remote branch tip matches the intended local commit before reporting
   publication. If push fails, preserve the local commit, report the failed phase and stop.
   A rejection does not authorize pull/rebase, force-push or credential changes.

## Identity And Credential Failures

Git author identity and push credentials are separate. Only diagnose the failing layer:

- Identify whether the failure occurs on the host, WSL or container; their config differs.
- Use `git config --show-origin --get-regexp '^user\.(name|email)$'` when author identity fails.
- For an account mismatch, compare `gh api user --jq .login` with the account named
  in Git's denial. A successful CLI lookup does not prove Git write access.
- Never request tokens, print token values, run `gh auth` without an explicit authentication
  troubleshooting request, or change persistent Git credential configuration.
- Only with explicit authorization for a command-scoped credential-route change, use:

  ```bash
  git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin "<approved-feature-branch>"
  ```

After an approved repair, verify the original failing operation.
Read access is not proof of write permission. Never switch accounts or helpers implicitly.

## Result

Report included/excluded files, checks, local commit hash, push status and remote,
plus PR URL only if a separately authorized PR operation actually ran.
Distinguish not requested, awaiting approval, failed and verified success.
