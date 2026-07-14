---
description: "Resume and execute the next bounded APEX vNext project slice with durable checkpoints and integration safeguards."
agent: agent
model: "Claude Opus 4.7"
argument-hint: "Optional: issue number or approved roadmap slice. Leave blank to resume from the durable checkpoint."
tools: [vscode/askQuestions, execute/runInTerminal, read, search, edit, todo, agent]
---

# Continue APEX vNext Execution

<investigate_before_answering>
Treat repository files and current GitHub state as authoritative, not this chat or an earlier checkpoint.
Resolve the active branch, exact heads, worktrees, dirty files, draft PR state, checks, and active issue before editing.
Read only the governing files needed for the next slice, then execute that slice instead of producing another plan.
If evidence conflicts, reconcile it in the register and checkpoint before continuing.
</investigate_before_answering>

<output_contract>
Complete one dependency-complete slice and leave it resumable from repository and GitHub state alone.
Update the durable checkpoint and active issue before pausing, with exact head and validation evidence.
Report changed files, GitHub resources, checks run, blockers, and the next executable issue.
Do not claim completion when required automated or manual evidence is unavailable.
</output_contract>

<scope_fencing>
Follow the approved plan in `.github/prompts/plan-governAndCompleteApexVnext.prompt.md`.
Do not expand a slice into unrelated cleanup, a mass rewrite, or autonomous self-modification.
Keep `main` on v1 and PR #533 draft until exact-head acceptance and explicit maintainer approval.
Stop before any merge, auto-merge, release, tag, publication, deployment, or cutover action.
</scope_fencing>

This prompt is safe to use in a fresh chat. Do not depend on chat memory or `/memories/**` for authoritative state.

## Invocation Approval

By invoking this prompt, the user approves these operating decisions:

- Use the existing `jonathan-vella/apex` repository, not a temporary vNext repository.
- Keep `feat/apex-vnext-rewrite` as the durable integration branch.
- Use short-lived issue branches in isolated worktrees and target their pull requests to the integration branch.
- Use GitHub Issues for executable work state, repository documents for durable intent and governance, and the
  `APEX vNext` GitHub Project only as a planning view.
- Use the small document set defined by the governing plan.
- Modernize through dependency-complete vertical slices.
- Keep self-improvement limited to observe-and-propose.
- After repository controls are established, create or update the approved GitHub Project, labels, milestones, issues,
  fields, and views needed by the plan.
- Commit and push validated work on the issue branch and open or update a pull request targeting
  `feat/apex-vnext-rewrite`.

This invocation does not authorize merge, auto-merge, release tags, package publication, deployment, destructive cloud
operations, or cutover to `main`.

## Canonical Inputs

Read these first, without re-reading a file already loaded in the current session:

1. `AGENTS.md` and `.github/copilot-instructions.md`.
2. `.github/prompts/plan-governAndCompleteApexVnext.prompt.md` as the governing execution plan.
3. `docs/vnext/PROJECT.md`, `PRD.md`, `ROADMAP.md`, `REGISTER.md`, and `DECISIONS.md` when they exist.
4. `.github/prompts/plan-buildApexVnext.prompt.md` only when reconciling historical commitments.
5. Applicable path-scoped instruction files for files that the selected slice will change.
6. The active GitHub issue and its latest resumable checkpoint comment, when one exists.

Treat `docs/vnext/phase-0a/**` as immutable evidence. Treat `.apex/**` as product-run state, never as vNext engineering
project state.

## Fresh-State Verification

Before selecting work:

1. Run `git status --short --branch`, `git worktree list --porcelain`, and inspect configured remotes.
2. Fetch `origin` without changing local branches.
3. Use `gh` CLI to verify repository access and inspect PR #533, including draft state, base, head branch, head SHA,
   and current checks. Do not run `gh auth` commands.
4. Confirm `main` remains the v1 line and `feat/apex-vnext-rewrite` remains the PR head branch.
5. Inventory dirty and untracked files in every relevant worktree. Preserve all changes that were not created by this
   execution.
6. Record material differences from the latest `PROJECT.md` checkpoint instead of silently correcting history.

The previously observed SHA `7fc27966f38a17e65d7c172fccc65451c2f46c9b` is evidence, not a permanent base. Always
use the currently verified PR head when creating a new slice branch.

## Worktree Routing

For the project-controls bootstrap, use:

- Worktree: `/workspaces/apex-vnext-controls`
- Branch: `feat/vnext-project-controls`
- Base: the verified current head of `origin/feat/apex-vnext-rewrite`

Apply these rules:

1. If the worktree and branch already exist, inspect and resume them. Do not recreate, reset, or rewrite them.
2. If neither exists, create the branch and worktree from the verified integration head.
3. If only one exists, diagnose the mismatch and recover without deleting work or rewriting history.
4. Never check out `feat/apex-vnext-rewrite` in a second worktree; the original worktree owns that branch.
5. Do not modify the dirty files in `/workspaces/apex` while executing the isolated slice.
6. If the governing plan is untracked only in `/workspaces/apex`, reproduce its exact content in the execution
   worktree using file-editing tools, verify the two file hashes match, and retain the original copy. Do not use shell
   redirection or `cp` to create tracked content.
7. If VS Code file-editing tools cannot access the new worktree, stop after creating it and tell the user to open
   `/workspaces/apex-vnext-controls` in a new VS Code window, then invoke this prompt again.

For later slices, derive a cross-cutting branch name from the active issue and create a dedicated worktree. Reuse an
existing issue worktree when resuming.

## Work Selection

If the project-control documents do not exist, execute Phase 1 of the governing plan. Begin with baseline reconciliation
and continue through the project-control validation gate unless a concrete blocker requires a checkpoint.

If the project controls exist:

1. Read `docs/vnext/PROJECT.md` for the resume pointer, not granular status.
2. Query GitHub Issues and the `APEX vNext` Project for the authoritative active item.
3. If an issue number was supplied, verify that it is open, approved, dependency-ready, and consistent with the roadmap.
4. Otherwise, select the first dependency-ready issue in the current milestone and workstream.
5. Execute only that issue's dependency-complete slice during this invocation.
6. Do not begin a later phase while an earlier release gate is unresolved.

Ask one concise question only when multiple equally valid items require a product decision. Do not ask the user to
repeat information already available in repository or GitHub state.

## Phase 1 Bootstrap

When project controls are absent, complete the governing plan's Phase 1 in dependency order:

1. Reconcile the current baseline, including branch and PR heads, local changes, current checks, known security
   findings, and every older pending item's disposition.
2. Create the internal vNext hub, checkpoint, PRD, roadmap, register, and decision index under `docs/vnext/`.
3. Reconcile every still-valid commitment from `plan-buildApexVnext.prompt.md` into the PRD or roadmap. Mark the old
   plan superseded only when that mapping is complete and reviewable.
4. Add the vNext work-item issue form. Reuse existing defect intake unless evidence proves a separate regression form is
   necessary.
5. Inventory existing labels, milestones, projects, and issue conventions before creating anything on GitHub.
6. Create the approved `APEX vNext` Project and only the minimal missing taxonomy, fields, and views required by the
   governing plan.
7. Seed dependency-ready issues from the approved roadmap and reconciled pending work. Do not duplicate mutable status
   in `PROJECT.md`.
8. Validate all controls and prove that each concern has one mutable source of truth.

Do not add a network-dependent CI validator for mutable GitHub state. Add a repository validator only when an invariant
cannot be enforced by existing Markdown, link, JSON, YAML, issue-form, or docs checks.

## Slice Execution Protocol

For every slice:

1. State one falsifiable local hypothesis, the controlling path, and the cheapest check that could disprove it.
2. Make the smallest grounded edit that advances the issue.
3. Immediately run the narrowest executable validation for the touched behavior.
4. Repair locally and rerun the same check when a failure supports the hypothesis.
5. Preserve compatibility aliases until their documented removal gates pass.
6. Do not weaken tests, checks, diagnostics, permissions, or release gates to obtain a green result.
7. Keep secrets, raw chat history, credentials, and unredacted command output out of tracked files and GitHub comments.
8. Update affected documentation, the register, and the decision index as part of the same slice.
9. Run broader relevant validation before commit, then inspect the final diff for unrelated changes.
10. Use a conventional commit, push without bypassing hooks, and open or update a PR whose base is
    `feat/apex-vnext-rewrite`.

Use `gh` CLI for GitHub operations. Do not enable auto-merge and do not target `main` from an issue branch.

## Checkpoint Contract

Before pausing for any reason:

1. Update `docs/vnext/PROJECT.md` with the UTC timestamp, milestone, integration PR and head, active blockers, validation
   state, and next issue links.
2. Add or update the active issue checkpoint comment with worktree, branch, head, completed work, next action, blockers,
   tests run, and uncommitted changes.
3. Update `REGISTER.md` for unresolved risks, defects, regressions, dependencies, or external failures.
4. Update `DECISIONS.md` when a consequential choice was made or a viable alternative was rejected.
5. Ensure issue state and assignee remain the authority for daily status.

## Validation

Select the narrowest relevant commands first, then run the broader gate required by the slice. For the project-controls
bootstrap, include:

- `npm run lint:md`
- `npm run lint:links`
- Repository JSON and YAML validation
- Issue-form validation
- `npm run validate:agents` when prompts or agent-facing metadata changed
- Applicable docs checks

Record exact commands and results. Classify failures as product regressions, pre-existing failures, or external/platform
failures with evidence and ownership. Never describe an unrun check as passing.

## Final Response

Return a concise, self-contained status containing:

- Slice or issue completed
- Worktree, branch, commit, and pull request
- Files and GitHub resources changed
- Validation results and exact-head status
- Open blockers or unavailable evidence
- Durable checkpoint location
- Next dependency-ready issue

## Stop Rules

Stop and checkpoint when:

- Continuing would overwrite or discard changes not created by this execution.
- The verified GitHub or repository state conflicts with a consequential plan assumption that requires maintainer choice.
- Required credentials or permissions are unavailable.
- A destructive, deployment, publication, merge, release, or cutover action would be next.
- A blocking metric or critical/high risk remains unresolved at a release gate.
- The current dependency-complete issue is finished and its durable checkpoint is written.

Do not stop at a proposal when the selected slice can be implemented and validated safely.
