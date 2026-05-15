---
description: "Open a sensei-free PR from feat/skills-sensei (or any sensei-bearing branch) into main. Dynamically discovers sensei-coupled files, classifies them into tiers, asks for approval, then creates a clean chore/merge-{source}-to-{target} branch and PR."
agent: agent
model: "Claude Sonnet 4.6"
tools: [vscode, execute, read, edit, search, terminal, todo]
argument-hint: "[source-branch] [target-branch] — defaults: feat/skills-sensei to main"
---

# Merge Sensei-Free PR

Prepare and open a pull request that ships the **work product** of a sensei-bearing
feature branch (skill content, scripts, tests, infra changes) while **excluding all
sensei plugin tooling and shim artifacts** that are not yet ready for `main`.

<investigate_before_answering>

- Confirm the source branch exists locally and is checked out or fetchable.
  Do not guess the branch name; if `${input:sourceBranch}` is missing, fall
  back to the active branch when it matches `feat/skills-sensei*`, otherwise
  ask.
- Confirm `gh` CLI is authenticated (`gh auth status`). Do not run `gh auth`
  yourself in a devcontainer; ask the user if auth is missing.
- Confirm working tree is clean OR all changes are committed on the source
  branch. Refuse to proceed if uncommitted edits exist outside `agent-output/`.
  </investigate_before_answering>

<context>
- House convention: sensei is in-flight tooling pinned as a git submodule at
  `.github/skills/sensei`. The plugin itself, its bootstrap, wrappers, and
  shim outputs must not land on `main` until the plugin is upstreamed.
- Sensei coupling appears in three tiers; this prompt classifies and excludes
  Tier 1 + Tier 2 by default. See the Tier Reference below.
- Reusable in the future for any sensei-bearing branch — exclusion patterns
  are matched dynamically, not hard-coded.
- Pre-push lefthook validators (`diff-based-check`) run automatically on push;
  this prompt also runs them explicitly before push so failures surface
  during the prompt's flow, not later.
</context>

<task>
Execute the seven steps in Workflow, in order. Stop and ask before any
destructive git or `gh` operation. Produce the outputs listed in Output
Expectations.
</task>

<rules>
- Do NOT use `git push --no-verify`. Resolve validator failures inside the
  flow; if a failure cannot be resolved without leaving the exclusion
  contract, stop and ask.
- Do NOT alter files in `agent-output/`. Treat the directory as untracked
  noise.
- Do NOT modify the source branch (`${input:sourceBranch}`). All work
  happens on the new `chore/merge-{source}-to-{target}` branch.
- Always show the full Tier 1/2/3 file classification to the user and wait
  for approval before running `git rm`.
- Always require user approval before `git push` and before `gh pr create`.
  Other reversible actions (branch creation, `git checkout origin/{target} -- <file>`)
  may proceed without prompting.
- Sensei coupling is detected dynamically by path patterns AND content scan
  for the literal string `sensei` (case-insensitive). Do not rely on a
  static exclusion list.
</rules>

## Inputs

| Variable                   | Default                            | Purpose                            |
| -------------------------- | ---------------------------------- | ---------------------------------- |
| `${input:sourceBranch}`    | `feat/skills-sensei`               | Branch containing the work product |
| `${input:targetBranch}`    | `main`                             | Branch to merge into               |
| `${input:mergeBranchName}` | `chore/merge-{source}-to-{target}` | Working branch for the PR          |

## Tier Reference

The discovery step (Workflow §3) classifies every changed path into one tier:

| Tier   | What it is                                             | Action      |
| ------ | ------------------------------------------------------ | ----------- |
| Tier 1 | Sensei plugin tooling proper (submodule, bootstrap,    | **Exclude** |
|        | sensei wrapper scripts, package.json sensei script     |             |
|        | entries, devcontainer sensei bootstrap)                |             |
| Tier 2 | Sensei work-product shims that are inert without the   | **Exclude** |
|        | plugin (trigger test files, `_audits/` reports, token- |             |
|        | budget config, audit-programme prompts)                |             |
| Tier 3 | Skill content + unrelated features (SKILL.md edits,    | **Include** |
|        | archive renames, MCP code, agent refinements)          |             |

A file is **Tier 1** if its path contains `sensei` OR it is the sensei
submodule pointer / `.gitmodules` / sensei npm script entries / sensei
devcontainer bootstrap lines.

A file is **Tier 2** if it does not match Tier 1 but its diff against
`origin/${input:targetBranch}` contains the literal string `sensei`
case-insensitive AND its purpose is documented as supporting sensei
(trigger-test shims, audit-programme outputs, token-budget config). When
ambiguous, list the file under "needs human decision" and ask.

A file is **Tier 3** otherwise.

## Workflow

### 1. Pre-flight

- Run `git fetch origin ${input:targetBranch} --quiet`.
- Run `git status --short`. Confirm clean (or only `agent-output/`).
- Run `git log --oneline origin/${input:targetBranch}..${input:sourceBranch} | wc -l`
  and report commit count.
- Run `gh auth status 2>&1 | head -5`. If unauthenticated in a devcontainer,
  stop and ask the user — do not run `gh auth login` yourself.

### 2. Create the merge branch

- `git checkout -b ${input:mergeBranchName} ${input:sourceBranch}`
- Confirm branch creation; report current branch.

### 3. Discover and classify sensei coupling

Produce a table of every changed path vs `origin/${input:targetBranch}`,
classified by tier. Use this exact command pattern:

```bash
# Path-based Tier 1 candidates
git diff --name-only origin/${input:targetBranch}..HEAD | \
  grep -E '(^|/)sensei(/|$)|^\.gitmodules$'

# Content-based Tier 2 candidates (excluding Tier 1)
git diff --name-only origin/${input:targetBranch}..HEAD | \
  grep -vE '(^|/)sensei(/|$)|^\.gitmodules$' | \
  while read f; do
    if git diff origin/${input:targetBranch}..HEAD -- "$f" 2>/dev/null | \
       grep -qi "sensei"; then
      echo "$f"
    fi
  done
```

Also check:

- `package.json` for `audit:skills*` or any script entry whose value
  contains `sensei` → Tier 1 (the lines, not the file).
- `.devcontainer/post-create.sh` for sensei bootstrap blocks → Tier 1
  (revert to `origin/${input:targetBranch}` version).
- `.gitignore` for negations of paths under `_audits/` → Tier 2.

### 4. Present the classification and ask for approval

Show three tables to the user:

- **Tier 1** with file paths and one-line reasons.
- **Tier 2** with file paths and one-line reasons.
- **Needs human decision** (any file the rules cannot classify
  deterministically).

Stop and ask: "Proceed with the exclusion plan? (yes / adjust / abort)".

Only proceed when the answer is `yes` or after the user has resolved
ambiguous entries.

### 5. Apply exclusions

Sequence matters; follow this order:

1. Restore Tier 1 modified files to their `origin/${input:targetBranch}` state:
   ```bash
   git checkout origin/${input:targetBranch} -- <file>
   ```
   Targets typically include `package.json`, `.devcontainer/post-create.sh`,
   `.gitignore`.
2. Drop the sensei submodule cleanly:
   ```bash
   git rm --cached .github/skills/sensei
   rm -rf .github/skills/sensei
   git rm .gitmodules
   ```
3. `git rm` every other Tier 1 path.
4. `git rm` every Tier 2 path (use `git rm -r` for directories).
5. Run a final sweep to confirm zero sensei residue:
   ```bash
   git diff origin/${input:targetBranch} --name-only | \
     xargs -I{} sh -c 'grep -l -i "sensei" "{}" 2>/dev/null' | head -10
   ```
   Output must be empty. If not, classify the survivors and re-ask the
   user (back to §4).

### 6. Validate, commit, push

Run, in order:

```bash
npm run validate:skills
cd tools/mcp-servers/azure-pricing && python -m pytest -q && \
  python -m ruff check src/ tests/ && \
  python -m ruff format --check src/ tests/ && cd -
```

If any validator fails:

- If the failure is from a **legitimate** orphan reference left by the
  exclusion (e.g. another SKILL.md citing the now-removed sensei skill),
  fix it inline as part of the exclusion commit. Document the fix in the
  commit body.
- If the failure is unrelated to the exclusion, stop and report.

Commit with the message template:

```text
chore(merge): exclude sensei tooling and shim files from ${input:targetBranch}-bound diff

This commit removes all sensei-coupled files from the ${input:sourceBranch}
branch so the work can be merged into ${input:targetBranch} without
dragging in the in-flight sensei plugin or its shim artifacts.

Excluded (Tier 1):
- <list>

Excluded (Tier 2):
- <list>

Kept:
- <one-line summary of the work product>
```

**Ask the user before** `git push -u origin ${input:mergeBranchName}`.

On push, confirm all lefthook `diff-based-check` validators pass. If the
push is blocked, do not bypass; diagnose, fix, ask, repeat.

### 7. Open the PR

**Ask the user before** running `gh pr create`. Use:

```bash
gh pr create \
  --base ${input:targetBranch} \
  --head ${input:mergeBranchName} \
  --title "<title>" \
  --body-file /tmp/pr-body.md
```

The PR body must include:

- A "What's included" table grouped by top-level area with file counts.
- A "What's excluded (and why)" list with Tier 1 + Tier 2 paths.
- A "Validation" section listing the validator commands that passed.
- A **merge strategy recommendation**: squash-merge (the source branch's
  intermediate commits still contain the now-excluded sensei files; only
  squash gives a clean linear history on `main`).

## Output Expectations

- A new branch `chore/merge-${input:sourceBranch}-to-${input:targetBranch}`
  pushed to `origin`.
- A single squash-recommended PR against `${input:targetBranch}`.
- Final report in chat: PR URL, file-count delta vs `${input:targetBranch}`,
  top-level area breakdown, validator results, and a final confirmation
  that `grep -i sensei` against the diff is empty.

## Quality Assurance

- [ ] No file in the final diff contains the literal `sensei` (case-insensitive).
- [ ] `.gitmodules` and `.github/skills/sensei` are absent.
- [ ] `package.json` and `.devcontainer/post-create.sh` match
      `origin/${input:targetBranch}` (or carry only non-sensei changes).
- [ ] `npm run validate:skills` passes with 0 errors, 0 warnings.
- [ ] Azure Pricing MCP tests + ruff pass (when MCP changes are in scope).
- [ ] Lefthook pre-push `diff-based-check` shows all validators green.
- [ ] PR body lists every excluded path and recommends squash-merge.

## Failure Modes and Recovery

| Failure                                                | Recovery                                                                                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Pre-push validator catches an orphan reference         | Edit the offending file in the exclusion commit; do not bypass with `--no-verify`.                                                         |
| Discovery flags a file the user wants to keep          | Re-classify as Tier 3 manually; document the override in the commit body.                                                                  |
| `gh auth status` fails inside the devcontainer         | Stop. Ask the user to set `GH_TOKEN` in VS Code User Settings → `terminal.integrated.env.linux`. Do not run `gh auth login` automatically. |
| Source branch is not fetchable                         | Stop. Ask the user to push or rename the branch.                                                                                           |
| Working tree has uncommitted non-`agent-output/` edits | Stop. Ask whether to stash, commit on source branch, or abort.                                                                             |

## Related References

- House prompt conventions: [.github/instructions/prompt.instructions.md](../instructions/prompt.instructions.md)
- House shell hygiene: [.github/instructions/no-interactive-shell.instructions.md](../instructions/no-interactive-shell.instructions.md)
- GitHub operations skill: [.github/skills/github-operations/SKILL.md](../skills/github-operations/SKILL.md)
