---
agent: agent
model: "MAI-Code-1-Flash"
description: "Stage everything except agent-output/, infra/, and .github/skills/sensei/ (unless on feat/skills-sensei), auto-generate a conventional commit, push, then prompt to open or update a PR. CLI-only (git + gh)."
argument-hint: "Optional commit subject. Leave blank to auto-generate from the diff."
tools: [vscode/askQuestions, execute/runInTerminal, read, todo]
---

# Git Commit, Push & PR (CLI-only)

Stage all changes **except** anything under `agent-output/`, `infra/`, or
`.github/skills/sensei/` (the sensei exclusion is lifted only when the
current branch is `feat/skills-sensei`), auto-generate a conventional
commit, push to the current branch, then ask whether to open a new PR or
update an existing one. Uses `git` and `gh` only — no MCP tools.

## Scope

- Workspace must be a git repository with `origin` configured.
- `gh` CLI must be authenticated (`GH_TOKEN` is set in the devcontainer).
- Excluded paths (always): `agent-output/`, `infra/`.
- Excluded path (conditional): `.github/skills/sensei/` — included only
  when `git branch --show-current` returns `feat/skills-sensei`.
- Never commit to `main`. Never force-push.

## Inputs

| Variable | Source                                  | Default        |
| -------- | --------------------------------------- | -------------- |
| subject  | argument-hint or generated from diff    | auto           |
| branch   | `git branch --show-current`             | current branch |
| sensei   | derived: `branch == feat/skills-sensei` | exclude sensei |
| pr_mode  | user choice (new / update / skip)       | ask            |
| pr_base  | user choice                             | `main`         |

## Workflow

### Step 0 — Compute the exclusion pathspec

Resolve the active branch and build the pathspec used by every subsequent
`git` command:

```bash
BRANCH="$(git branch --show-current)"
if [[ "$BRANCH" == "feat/skills-sensei" ]]; then
  EXCLUDES=(':!agent-output' ':!infra')
else
  EXCLUDES=(':!agent-output' ':!infra' ':!.github/skills/sensei')
fi
```

Every `git add`/`git status`/`git diff` command below uses
`-- . "${EXCLUDES[@]}"` to apply the exclusion list consistently. If the
user is on `feat/skills-sensei` the sensei skill files are eligible for
staging; on every other branch they are skipped.

### Step 1 — Inspect

Run these in parallel and show the output:

```bash
echo "$BRANCH"
git status --short -- . "${EXCLUDES[@]}"
git diff --stat HEAD -- . "${EXCLUDES[@]}"
```

Stop if:

- branch is `main` (refuse to commit).
- the scoped status is empty (working tree clean within scope).

Show a one-line note of any changes under the excluded folders so the user
knows they were intentionally skipped:

```bash
if [[ "$BRANCH" == "feat/skills-sensei" ]]; then
  git status --short -- agent-output infra
else
  git status --short -- agent-output infra .github/skills/sensei
fi
```

### Step 2 — Stage scoped files

Stage every change **outside** the excluded folders:

```bash
git add -A -- . "${EXCLUDES[@]}"
git diff --cached --stat
```

### Step 3 — Compose conventional commit (auto)

If the user passed a subject via the argument-hint, use it (wrap it in
`<type>(<scope>): <subject>` if missing the prefix).

Otherwise, read `.github/skills/github-operations/references/commit-conventions.md`,
inspect the staged diff:

```bash
git diff --cached -- . ':(exclude)*.lock' ':(exclude)package-lock.json' | head -200
```

…and compose a message in this shape:

```text
<type>(<scope>): <short sentence-case subject>

- <bullet 1>
- <bullet 2>
```

**Do not ask for confirmation.** Commit the auto-generated message
immediately in Step 4. The user reviews the result via the commit hash +
summary table at the end and can amend if needed. The only remaining
confirmation gate is the PR decision in Step 5.

### Step 4 — Commit and push

```bash
git commit -m "<auto subject>" -m "<auto body>"
git push origin "$BRANCH"
```

If a pre-commit hook fails, print its full output and stop. Do not retry.
If push is rejected, print the error and suggest `git pull --rebase` — do
not force-push.

Show the resulting commit hash:

```bash
git log -1 --pretty=format:'%h %s'
```

### Step 5 — PR decision

Detect any open PR for this branch:

```bash
gh pr list --head "$BRANCH" --state open --json number,url,title
```

Call `vscode/askQuestions` with one question:

- header: `pr-action`
- question: `What do you want to do with a pull request?`
- options:
  - If an existing PR was found: `Update existing PR #<number>` (recommended)
  - `Create a new PR to main`
  - `Skip — no PR right now`

Branch on the answer:

**Update existing PR** — the push in Step 4 already updated the branch.
Optionally refresh the PR body or title:

```bash
gh pr view <number> --json url,title,state
# If user supplied a new title/body in their reply:
# gh pr edit <number> --title "<title>" --body "<body>"
```

Print the PR URL.

**Create a new PR** — auto-fill from the commit:

```bash
gh pr create --base main --head "$BRANCH" \
  --title "<commit subject>" \
  --body "$(git log origin/main..HEAD --pretty=format:'- %s')"
```

If `gh pr create` fails because the branch is not pushed or base is missing,
print the error verbatim. Provide the compare URL as fallback:
`https://github.com/<owner>/<repo>/compare/main...<branch>`.

**Skip** — print "PR step skipped." and finish.

## Output

Print this summary table at the end:

| Step         | Result                                                            |
| ------------ | ----------------------------------------------------------------- |
| Excluded     | `agent-output/`, `infra/` (+ `.github/skills/sensei/` off-branch) |
| Files staged | N files                                                           |
| Commit       | `<hash>` `<subject>`                                              |
| Push         | `origin/<branch>` — pushed                                        |
| Pull request | `<URL>` (created / updated) or `skipped`                          |

## Rules

- Never `git add` paths under `agent-output/` or `infra/`. Use the pathspec
  exclude (`':!agent-output' ':!infra'`) on every staging command.
- Always exclude `.github/skills/sensei/` **unless** the current branch is
  `feat/skills-sensei`. The exclusion is computed once in Step 0 and reused
  by every git command in the workflow.
- Never commit to `main`. Stop with a warning if the current branch is `main`.
- Never use `git push --force` or `--force-with-lease` unless the user
  explicitly types "force push".
- Step 3 is **non-interactive** — the prompt auto-generates the commit
  message and commits without asking. The only remaining confirmation gate
  is the PR action in Step 5.
- Use `git` and `gh` exclusively — do not call any GitHub MCP tool.
- Do not use interactive flags (`-i`) on `mv`/`rm`/`cp` or `read -p`. Pipe
  long output (>50 lines) into a file under `tmp/` if needed.
