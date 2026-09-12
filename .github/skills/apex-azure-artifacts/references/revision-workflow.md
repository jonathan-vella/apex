<!-- ref:revision-workflow-v1 -->

# Revision Workflow (Targeted Edits)

> Detailed revision-tooling rules for `apex-azure-artifacts`. Loaded when an
> agent needs to revise an already-created artifact (challenger findings,
> per-finding user decisions, approval-gate fixes, structural rewrites).

First-time artifact creation uses an available file-creation capability. **All subsequent
revisions** — including challenger-finding fixes, per-finding user
decisions (Apply / Skip / Defer), and approval-gate revisions — MUST
use targeted edit tools.

| Situation                                   | Tool                             |
| ------------------------------------------- | -------------------------------- |
| Initial draft of the artifact               | File creation, only when absent |
| Single-spot fix                             | Targeted edit, including `apply_patch` |
| Multiple fixes (one or more files)          | Available batched edits or `apply_patch` |
| Restructuring ≥ 50 % of file or H2 ordering | Editing tool (rationale logged) |

Batch independent accepted fixes where practical; validate before dependent follow-up edits.
No particular tool name or single-call payload is required. Inspect existing content,
preserve user work, and edit only authorized artifacts. If a write is partial, inspect
and repair the confirmed partial content; do not overwrite unrelated changes.
If no suitable editing capability is available, stop and report the blocker.

Targeted edits avoid re-emitting unchanged content. Token or cost savings require
recorded usage evidence, not fixed line-count multipliers or model-name inference.
Follow the canonical [post-write checks](../SKILL.md#post-write-validation);
artifact Markdown validation remains delegated to the hook and Challenger.

**Exception**: structural rewrites (H2 reordering, template version
bump, > 50 % of lines changed). When taking the exception, log it:

```bash
apex-recall decide <project> \
  --decision "Full rewrite of <artifact-filename>" \
  --rationale "<H2 reorder | template bump | >50% lines changed>" \
  --step <N> --json
```
