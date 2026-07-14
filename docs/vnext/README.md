## APEX vNext Project

This directory is the durable project hub for completing and releasing APEX vNext. Start with
[PROJECT.md](PROJECT.md) to resume work from the latest verified checkpoint.

## Sources Of Truth

| Concern | Authority | Update rule |
| --- | --- | --- |
| Product scope and acceptance | [PRD.md](PRD.md) | Requirement changes need a decision entry. |
| Architecture and delivery order | [ROADMAP.md](ROADMAP.md) | Update at approved dependency or milestone changes. |
| Daily work state | GitHub Issues | Issue state and assignee are authoritative. |
| Prioritization and views | GitHub Project `APEX vNext` | The project is a view, never a second backlog. |
| Risks and delivery concerns | [REGISTER.md](REGISTER.md) | Link actionable entries to an issue. |
| Decisions | [DECISIONS.md](DECISIONS.md) | Append entries; use an ADR for consequential design choices. |
| Resume state | [PROJECT.md](PROJECT.md) | Update at checkpoints and milestone transitions. |
| Historical product baseline | [phase-0a/](phase-0a/) | Frozen evidence; do not edit or repurpose. |

The product runtime stores project-run state under `.apex/`. It does not track vNext engineering work. Chat memory is a
convenience and is never authoritative.

## Contribution Flow

1. Read [PROJECT.md](PROJECT.md), then open the linked active GitHub issue.
2. Verify PR #533, the integration head, required checks, and all local worktrees before editing.
3. Create or resume a short-lived issue branch in an isolated worktree.
4. Characterize the selected behavior and define the cheapest falsifying check.
5. Implement one dependency-complete slice and run focused validation immediately after the first edit.
6. Update affected requirements, roadmap, register, decisions, and user documentation in the same slice.
7. Add a resumable issue comment with the branch, head, completed work, next action, blockers, checks, and dirty files.
8. Open the issue branch pull request against `feat/apex-vnext-rewrite`, never `main`.

## Integration Boundary

- `main` remains the v1 maintenance line during vNext development.
- `feat/apex-vnext-rewrite` is the durable integration branch.
- PR #533 remains draft until exact-head end-to-end acceptance and explicit maintainer approval.
- Issue branches target the integration branch.
- Merge, auto-merge, release tags, publication, deployment, and cutover require separate authorization.

## Validation

Run `npm run validate:vnext-project-controls` after changing this document set or either vNext issue form. The offline
validator enforces required documents and form fields, unique requirement and decision IDs, valid requirement references,
local links, and the frozen Phase 0A evidence digest. It deliberately does not query mutable GitHub state.

## Historical Plans

The approved Phase 0A evidence under [phase-0a/](phase-0a/) is immutable. The historical
[`plan-buildApexVnext.prompt.md`](../../.github/prompts/plan-buildApexVnext.prompt.md) records design input; its binding
product commitments are represented in [PRD.md](PRD.md), and its remaining delivery order is represented in
[ROADMAP.md](ROADMAP.md). The governing execution prompt is
[`plan-governAndCompleteApexVnext.prompt.md`](../../.github/prompts/plan-governAndCompleteApexVnext.prompt.md).

## Resume Protocol

Use `/apex-vnext-continue` in a fresh VS Code Copilot chat. The prompt re-verifies repository and GitHub state before it
selects work. If that prompt is unavailable, read [PROJECT.md](PROJECT.md), the active issue checkpoint, and the latest
integration PR state directly.
