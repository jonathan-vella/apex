<!-- ref:commit-conventions-v1 -->

# Conventional Commit Conventions

Full commit workflow: staging, message format, breaking changes, and safety rules.
Enforced by `commitlint` via the commit-msg lefthook hook.

## Format

```text
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

## Types

| Type       | Purpose                        |
| ---------- | ------------------------------ |
| `feat`     | New feature                    |
| `fix`      | Bug fix                        |
| `docs`     | Documentation only             |
| `style`    | Formatting/style (no logic)    |
| `refactor` | Code refactor (no feature/fix) |
| `perf`     | Performance improvement        |
| `test`     | Add/update tests               |
| `build`    | Build system/dependencies      |
| `ci`       | CI/config changes              |
| `chore`    | Maintenance/misc               |
| `revert`   | Revert commit                  |

## Scopes

Common scopes for this repository:

`agents`, `skills`, `instructions`, `bicep`, `terraform`, `mcp`, `docs`, `scripts`

## Breaking Changes

```text
# Exclamation mark after type/scope
feat!: remove deprecated endpoint

# BREAKING CHANGE footer
feat: allow config to extend other configs

BREAKING CHANGE: `extends` key behavior changed
```

## Commit Workflow

### 1. Analyze Diff

```bash
# If files are staged, use staged diff
git diff --staged

# If nothing staged, use working tree diff
git diff

# Also check status
git status --porcelain
```

### 2. Stage Files

```bash
# Stage specific files
git add path/to/file1 path/to/file2

# Stage by pattern
git add *.test.*
git add src/components/*

# Review exactly what is staged
git diff --cached --check
git diff --cached --stat
```

**Never commit secrets** (.env, credentials.json, private keys).
Stage only explicitly approved files/hunks; preserve partially staged files and unrelated index entries.
For partial staging use an approved index patch, not an interactive shell prompt.
The complete safety and authorization procedure lives in [scoped commit and push](git-commit.md).

### 3. Generate Commit Message

Analyze the diff to determine:

- **Type**: What kind of change is this?
- **Scope**: What area/module is affected?
- **Description**: One-line summary (present tense, imperative mood, <72 chars)

### 4. Execute Commit

```bash
git commit -m "<type>(<scope>): <description>" \
  -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Omit the co-author trailer only when the user explicitly requests it.
A local commit does not authorize push, PR creation, merge or auto-merge.

## Best Practices

- One logical change per commit
- Present tense: "add" not "added"
- Imperative mood: "fix bug" not "fixes bug"
- Reference issues: `Closes #123`, `Refs #456`
- Prefer a header under 72 characters; commitlint enforces a 100-character maximum

## Safety Protocol

- Do not change Git configuration or credentials implicitly.
- Do not bypass hooks, force-push, reset, rebase or amend in this procedure.
- Do not commit/push from `main`, the repository default branch or detached HEAD.
- If a hook or commit fails, report the error and stop without automatic retry.
  An authorized repair is followed by a new commit attempt, not an amend of an earlier commit.
- Preserve unrelated hunks and other submodules during approved exclusions.
  Mixed files require hunk edits, never whole-file restoration from a base revision.
