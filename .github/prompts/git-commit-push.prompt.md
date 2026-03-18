---
agent: agent
model: "Claude Haiku 4.5"
description: "Stage changes, create a conventional commit, push to the current branch, and optionally open a pull request to main using the GitHub MCP server."
argument-hint: "Provide a commit message or leave blank to auto-generate from the diff."
tools:
  [
    vscode/askQuestions,
    execute/runInTerminal,
    read,
    search/codebase,
    github/add_reply_to_pull_request_comment,
    github/create_branch,
    github/create_pull_request,
    github/create_pull_request_with_copilot,
    github/get_commit,
    github/get_copilot_job_status,
    github/get_file_contents,
    github/get_label,
    github/get_latest_release,
    github/get_me,
    github/issue_read,
    github/issue_write,
    github/list_branches,
    github/list_commits,
    github/list_issue_types,
    github/list_issues,
    github/list_pull_requests,
    github/pull_request_read,
    github/pull_request_review_write,
    github/push_files,
    github/request_copilot_review,
    github/search_code,
    github/search_pull_requests,
    github/sub_issue_write,
    github/update_pull_request,
    github/update_pull_request_branch,
    todo,
  ]
---

# Git Commit, Push & PR

Stage all changes, create a conventional commit, and push to the current branch.
Optionally open a pull request to `main` only if the user explicitly requests one.

## Scope & Preconditions

- Workspace must be a git repository with a configured `origin` remote.
- GitHub MCP tools must be available in the current session (no `gh auth` needed).
- The `github-operations` skill at `.github/skills/github-operations/SKILL.md` defines the
  full contribution lifecycle: branch naming, commit format, and PR creation.
- Branch naming and scope rules are in
  `.github/skills/github-operations/references/branch-strategy.md`.
- Minimise round-trips: the only user confirmation is the commit message review.

## Defaults (applied automatically — no questions asked)

| Behaviour    | Default                   | Override                                      |
| ------------ | ------------------------- | --------------------------------------------- |
| Staging      | All changed files (`-A`)  | User can specify files in the argument-hint   |
| Push         | Yes, to `origin/<branch>` | User can say "no push" in the argument-hint   |
| Pull request | No                        | Only created if user explicitly asks for a PR |

## Inputs

| Variable    | Source                                    | Default                          |
| ----------- | ----------------------------------------- | -------------------------------- |
| `message`   | argument-hint or user reply               | Auto-generated from diff         |
| `branch`    | detected from `git branch --show-current` | Current branch                   |
| `create_pr` | user explicitly requests a PR             | No                               |
| `pr_base`   | user choice                               | `main`                           |
| `pr_title`  | user choice or auto-generated             | Derived from commit message      |
| `pr_body`   | user choice or auto-generated             | Summary of commits ahead of base |
| `pr_draft`  | user choice                               | No                               |

## Workflow

### Step 1 — Inspect the working tree and validate branch

Run the following commands simultaneously and show the output:

```bash
git status --short
git branch --show-current
git diff --stat HEAD
git log --oneline origin/$(git branch --show-current)..HEAD 2>/dev/null || git log --oneline -5
```

If `git status --short` returns nothing, stop and tell the user: "Working tree is clean."

If the current branch is `main`, warn and stop.

**Branch naming check**: The branch must start with an approved prefix:
`docs/`, `agents/`, `skills/`, `infra/`, `scripts/`, `instructions/`,
`feat/`, `fix/`, `chore/`, `ci/`, `refactor/`, `perf/`, `test/`, `build/`, `revert/`.

If the branch name is invalid, warn the user and suggest renaming:
`git branch -m <current-name> feat/<descriptive-name>`

For domain-scoped branches (`docs/`, `agents/`, `skills/`, `infra/`,
`scripts/`, `instructions/`), check that changed files are within scope.
If files are out of scope, warn and suggest using `feat/` or `fix/` instead.

Read `.github/skills/github-operations/references/branch-strategy.md` for
the full scope rules if needed.

### Step 2 — Stage all changes and generate commit message

Stage everything:

```bash
git add -A
```

Read `.github/skills/github-operations/references/commit-conventions.md` to load the conventional commit
format rules for this repository.

If the user provided a message via the argument-hint, use it as the subject
line (wrapping it in the conventional format if needed).

Otherwise, run:

```bash
git diff --cached --stat
git diff --cached -- . ':(exclude)*.lock' ':(exclude)package-lock.json' | head -200
```

Use the output to generate a conventional commit message following the format:

```text
<type>(<scope>): <short description in sentence case>

- <bullet summarising change 1>
- <bullet summarising change 2>
```

Present the proposed message and ask:

> **Commit message — does this look right?**
>
> A) Yes, use it as-is
> B) Paste revised message below

Wait for confirmation before continuing. This is the **only** user confirmation gate.

### Step 3 — Execute pipeline

Run the following in sequence:

**Commit:**

```bash
git commit -m "<confirmed message>"
```

If the pre-commit hook fails, show the full error output and stop. Do not retry.

Show the resulting commit hash and subject line.

**Push:**

```bash
git push origin $(git branch --show-current)
```

If the push fails, display the error and stop. Suggest `git pull --rebase` if
the branch is behind.

**Pull request** (only if the user explicitly requested one):

Check for an existing open PR using `github/search_pull_requests` with query:
`is:open head:<branch> base:<base>`.

- If one exists, tell the user and skip creation.
- If none exists, call `github/create_pull_request` with:
  - `owner`: repository owner
  - `repo`: repository name
  - `head`: current branch
  - `base`: target branch (default `main`)
  - `title`: confirmed PR title (or commit subject if blank)
  - `body`: confirmed PR body (or auto-generated from commit list if blank)
  - `draft`: user's choice (default: No)

Show the PR URL returned by the MCP tool.

## Output Expectations

At the end of the workflow, print a summary table:

| Step         | Result                               |
| ------------ | ------------------------------------ |
| Files staged | N files                              |
| Commit       | `<hash>` `<subject>`                 |
| Push         | `origin/<branch>` — pushed / skipped |
| Pull request | `<URL>` / not created                |

## Error Handling

- **Nothing to commit**: Stop at Step 1 and say "Working tree is clean."
- **Pre-commit hook failure**: Display full hook output. Do not retry automatically.
- **Push rejected**: Show the error. Suggest `git pull --rebase` if behind.
- **MCP PR creation fails**: Display the error. Provide the compare URL as fallback:
  `https://github.com/<owner>/<repo>/compare/<base>...<head>`

## Quality Assurance

- Never force-push (`--force`) unless the user explicitly asks.
- Never commit directly to `main` — warn and stop if the current branch is `main`.
- Always show the commit hash after a successful commit.
- Always show the PR URL after a successful PR creation.
- The only confirmation gate is the commit message review (Step 2).
- Do not add extra round-trips beyond this one gate.
