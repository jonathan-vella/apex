# Terraform Support — Contributor Guide

> **Branch**: `tf-dev` | **Plan**: `tf-support-plan.prompt.md` | **Tracking**: `PROGRESS.md`

This guide is for contributors working on adding Terraform support to the Agentic InfraOps
project. Work happens across multiple sessions, multiple contributors, and multiple days —
everything here is designed for that reality.

## Quick Start

```bash
git checkout tf-dev
git pull origin tf-dev
cat docs/tf-support/PROGRESS.md      # what's done, what's next, any blockers
```

Then open GitHub Copilot Chat and paste the session-start prompt:

```
/prompt docs/tf-support/prompts/00-session-start.prompt.md
```

Copilot will orient itself automatically.

## Repository Layout (tf-dev additions)

```
docs/tf-support/
├── README.md                         ← this file
├── PROGRESS.md                       ← single source of truth for progress
├── BACKLOG.md                        ← all 34 items with status, size, owner
├── tf-support-plan.prompt.md         ← full implementation plan (read-only ref)
├── github-issues/                    ← issue templates + creation script
│   ├── create-issues.sh
│   ├── issue-85-parent.md
│   └── issue-child-*.md
├── prompts/
│   ├── 00-session-start.prompt.md    ← START HERE every session
│   ├── phase-0-foundation.prompt.md
│   ├── phase-1-instructions-skills.prompt.md
│   ├── phase-2-agents-core.prompt.md
│   ├── phase-3-subagents.prompt.md
│   ├── phase-4-conductor.prompt.md
│   ├── phase-5-quality-gates.prompt.md
│   ├── phase-6-governance-migration.prompt.md
│   ├── phase-7-documentation.prompt.md
│   └── regression-check.prompt.md    ← run after every phase
└── SKILL.md / *.agent.md / *.png     ← research references (read-only)
```

## Workflow for Every Session

### Step 1 — Orient

Always start with the session-start prompt. It reads `PROGRESS.md`,
determines the active phase, and gives Copilot the right context without
loading the entire plan.

```
/prompt docs/tf-support/prompts/00-session-start.prompt.md
```

### Step 2 — Pick up where you left off

Check `PROGRESS.md` → find the first unchecked item in the active phase →
use the corresponding phase prompt:

```
/prompt docs/tf-support/prompts/phase-0-foundation.prompt.md
```

### Step 3 — Work items

The phase prompt tells Copilot exactly which files to create/edit and in what
order. You can stop mid-phase — Copilot will update `PROGRESS.md` before
committing so the next session knows exactly where to resume.

### Step 4 — Validate

After completing any item, run:

```bash
npm run validate:all
```

After completing a full phase, also run the regression check:

```
/prompt docs/tf-support/prompts/regression-check.prompt.md
```

### Step 5 — Commit

Copilot commits completed work using conventional commits. Each phase should
be one logical PR or a series of small commits — **do not batch multiple
phases into one commit**.

### Step 6 — Update progress

Copilot updates `PROGRESS.md` automatically. You can also update it manually:

1. Check off completed items (`- [x]`)
2. Update the status table at the top
3. Add a row to the Blockers & Notes table if anything unexpected happened

## Merge to Main Gate

> **`tf-dev` is blocked from merging into `main` until all 8 phases are complete.**

This is enforced automatically. When a PR from `tf-dev` targets `main`, the
`tf-dev-merge-gate.yml` workflow runs the `Terraform Support Complete` status
check. It parses the YAML frontmatter in `PROGRESS.md` and fails unless every
`phase_X_complete` flag is `true`.

GitHub branch protection on `main` requires this check to pass — the PR cannot
be merged while any phase remains incomplete.

### Completion Criteria

The check passes only when `PROGRESS.md` frontmatter contains all of:

```yaml
phase_0_complete: true
phase_1_complete: true
phase_2_complete: true
phase_3_complete: true
phase_4_complete: true
phase_5_complete: true
phase_6_complete: true # or explicitly deferred + documented
phase_7_complete: true
```

In addition to the automated gate, a manual pre-merge checklist must be satisfied:

- [ ] `npm run validate:all` passes with zero errors
- [ ] `bicep build infra/bicep/**/*.bicep` passes (regression: existing Bicep unbroken)
- [ ] `terraform validate` passes on all modules in `infra/terraform/`
- [ ] GitHub issue #85 is fully closed with all child issues resolved
- [ ] `PROGRESS.md` Blockers & Notes table has no open blockers

Only after all of the above should Phase 6 be deferred (if applicable) and
the PR be opened.

## Phase Ordering Rules

> Phases MUST be completed and merged in order. The CI `agent-validation.yml`
> enforces referential integrity between agents and their handoffs.

| Must merge first | Before starting                           |
| ---------------- | ----------------------------------------- |
| Phase 0          | Phase 1                                   |
| Phase 1          | Phase 2                                   |
| Phase 2          | Phase 3                                   |
| Phase 2          | Phase 4 (Conductor needs agents to exist) |
| Phase 3          | Phase 5 (validators check subagent files) |

**Shortcut**: You can batch Phase 2 + Phase 4 into a single PR to avoid CI
failures when the Conductor references agents that don't exist yet.

## Regression Rules

These must pass at **all times** — never break existing Bicep functionality:

| Check             | Command                              | When                          |
| ----------------- | ------------------------------------ | ----------------------------- |
| All validators    | `npm run validate:all`               | Before every commit           |
| Agent frontmatter | `npm run lint:agent-frontmatter`     | After editing any `.agent.md` |
| Governance refs   | `npm run lint:governance-refs`       | After Phase 1, 5              |
| H2 sync           | `npm run lint:h2-sync`               | After Phase 5 item 5.29       |
| Bicep build       | `bicep build infra/bicep/**/*.bicep` | After Phase 1, 6              |

## Context Window Strategy

Each phase prompt is self-contained and loads only what's needed:

- **Session start** (~2K tokens): reads `PROGRESS.md` only
- **Phase prompts** (~5-10K tokens): reads the relevant plan section and target files
- **Never load** the full plan unless explicitly debugging

If Copilot seems confused or is re-doing completed work, run the session-start
prompt again to re-anchor it.

## GitHub Issues

The parent issue is **#85** (`Terraform Support for Azure Agentic InfraOps`) on
`jonathan-vella/azure-agentic-infraops`. Each phase has a child issue (titles below).
Issue templates are in `docs/tf-support/github-issues/`.

### Phase → Issue Title Mapping

| Phase | Child Issue Title                                 |
| ----- | ------------------------------------------------- |
| 0     | `[tf-dev] Phase 0 — Foundation & Validation`      |
| 1     | `[tf-dev] Phase 1 — Instructions & Skills`        |
| 2     | `[tf-dev] Phase 2 — Agents: Core Terraform`       |
| 3     | `[tf-dev] Phase 3 — Agents: Subagents`            |
| 4     | `[tf-dev] Phase 4 — Conductor Integration`        |
| 5     | `[tf-dev] Phase 5 — Quality Gates`                |
| 6     | `[tf-dev] Phase 6 — Governance & Migration`       |
| 7     | `[tf-dev] Phase 7 — Documentation & Housekeeping` |

### Automated Issue Updates — Native MCP Protocol

Copilot **must** update GitHub issues automatically using MCP tools at the triggers
below. No GitHub Actions workflow, no `gh` CLI auth required.

#### MCP Tools Used

| Tool                           | Purpose                              |
| ------------------------------ | ------------------------------------ |
| `mcp_github_search_issues`     | Resolve phase title → issue number   |
| `mcp_github_issue_read`        | Fetch current issue body/state       |
| `mcp_github_add_issue_comment` | Post progress or regression note     |
| `mcp_github_issue_write`       | Update issue body checklist or close |

#### How to Resolve an Issue Number (Always Do This First)

Never hardcode issue numbers. Always resolve dynamically:

1. Call `mcp_github_search_issues` with `repo: jonathan-vella/azure-agentic-infraops`
   and `query: "[tf-dev] Phase N"` (substitute the phase number)
2. Use the returned issue number for all subsequent MCP calls on that issue

#### Trigger 1 — Item Completed

**When**: Any item transitions from `[ ]` to `[x]` in `PROGRESS.md`.

**Actions** (in order):

1. Resolve the child issue number for the current phase (see above)
2. Call `mcp_github_add_issue_comment` on the child issue:

   ```
   ✅ Item X.Y complete — {item description}

   Validator: `npm run validate:all` passed
   Commit: {short commit SHA if available}
   ```

3. If the item is the **last unchecked item in the phase**, also run Trigger 2.

#### Trigger 2 — Phase Complete

**When**: All items in a phase are checked `[x]` in `PROGRESS.md` and
`PROGRESS.md` status table row is updated to `✅ Complete`.

**Actions** (in order):

1. Resolve the child issue number for that phase
2. Call `mcp_github_add_issue_comment` on the child issue:

   ```
   🎉 Phase N complete — all items done, validators pass.

   Regression check: passed
   Next phase: Phase N+1
   ```

3. Call `mcp_github_issue_write` on the child issue to set `state: closed`
4. Resolve issue #85 (parent) — call `mcp_github_issue_read` to get current body
5. Call `mcp_github_issue_write` on #85 to update its body:
   change `- [ ] Phase N —` to `- [x] Phase N —`

#### Trigger 3 — Regression Detected

**When**: `npm run validate:all` exits non-zero after a code change, OR a phase
prompt's regression check step reports a failure.

**Actions** (in order):

1. Resolve the child issue number for the currently active phase
2. Call `mcp_github_add_issue_comment` on the child issue:

   ```
   ⚠️ Regression detected — validator failures

   Failed checks:
   {paste the failing validator names and error lines}

   Phase N item Y was in progress when this occurred.
   Status: blocked — must fix before continuing.
   ```

3. Call `mcp_github_add_issue_comment` on issue #85:
   ```
   ⚠️ Regression in Phase N — see child issue for details.
   ```
4. Update `PROGRESS.md` Blockers & Notes table with the failure summary.
5. Do **not** close or check off any items until validators pass again.

#### Where Issue Updates Fit in the Session Workflow

| Step                     | Action                | Issue update?             |
| ------------------------ | --------------------- | ------------------------- |
| Step 3 — Work items      | Item completed        | ✅ Trigger 1              |
| Step 4 — Validate        | `validate:all` fails  | ✅ Trigger 3              |
| Step 4 — Phase done      | All items checked     | ✅ Trigger 2              |
| Step 5 — Commit          | Commit made           | No separate update needed |
| Step 6 — Update progress | `PROGRESS.md` updated | Already covered above     |

### Creating Issues (First Time Only)

If child issues for phases don't yet exist, create them once:

```bash
# Requires gh CLI to be authenticated
bash docs/tf-support/github-issues/create-issues.sh
```

After creation, all subsequent updates use MCP tools automatically — no CLI needed.

## Frequently Asked Questions

**Q: I finished part of a phase. Where exactly do I continue next session?**
A: Check `PROGRESS.md` — find the first `- [ ]` in your phase. Run the
session-start prompt first so Copilot knows the context.

**Q: Something broke in Bicep after my Terraform changes. What do I check?**
A: Run `docs/tf-support/prompts/regression-check.prompt.md`. It covers all
files that could affect existing Bicep functionality.

**Q: Can I skip Phase 6?**
A: Yes — it is explicitly deferred. Items 0-5 and 7 give you a fully working
Terraform pipeline. Phase 6 is cleanup for the long term.

**Q: How do I know which phase to work on?**
A: `PROGRESS.md` has the status table. Active phase is in the YAML frontmatter
(`active_phase`). Start there.

**Q: The MCP server tool names are different from what the plan assumes. What do I do?**
A: Complete Phase 0 item 0.8 first — it gates all agent authoring. Document
the real tool names in `docs/tf-support/mcp-tools.md`, then continue. Phase 2
prompts will read that file.

**Q: Can I work on multiple phases at once?**
A: Only if they have no dependencies between them (see Phase Ordering Rules
above). When in doubt, go sequential.

## Key Decisions (quick reference)

| Decision        | Choice                                                   | Why                                           |
| --------------- | -------------------------------------------------------- | --------------------------------------------- |
| Agent numbering | `11-` / `12-` / `13-`                                    | Avoids collision with Bicep `05-` `06-` `07-` |
| IaC selection   | Captured once in `01-requirements.md` (`iac_tool` field) | No re-asking                                  |
| Governance      | Dual-field: `bicepPropertyPath` + `azurePropertyPath`    | Backward-compatible                           |
| State backend   | Azure Storage Account only                               | No HCP Terraform Cloud                        |
| MCP server      | npx + devDependency in package.json                      | Zero startup latency                          |
| Phased deploy   | `var.deployment_phase` + `count` conditionals            | Not `-target`                                 |
| Lock file       | `.terraform.lock.hcl` committed                          | Reproducible provider versions                |

Full decision rationale: `tf-support-plan.prompt.md` → **Decisions** section.
