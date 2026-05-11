# Revision Workflow (Targeted Edits)

> Detailed revision-tooling rules for `azure-artifacts`. Loaded when an
> agent needs to revise an already-created artifact (challenger findings,
> per-finding user decisions, approval-gate fixes, structural rewrites).

First-time artifact creation uses `create_file`. **All subsequent
revisions** — including challenger-finding fixes, per-finding user
decisions (Apply / Skip / Defer), and approval-gate revisions — MUST
use targeted edit tools.

| Situation                                   | Tool                             |
| ------------------------------------------- | -------------------------------- |
| Initial draft of the artifact               | `create_file`                    |
| Single-spot fix                             | `replace_string_in_file`         |
| Multiple fixes (one or more files)          | `multi_replace_string_in_file`   |
| Restructuring ≥ 50 % of file or H2 ordering | `create_file` (rationale logged) |

**One pass, one tool call**: bundle every accepted fix from a review
pass into a single `multi_replace_string_in_file` call. A 24-finding
revision is one tool call, not 24.

**Why**: a full rewrite of a 200-line markdown artifact emits 8–18 K
output tokens that re-enter the context on every subsequent turn; a
multi-edit patch list emits 200–800 tokens. Empirically, a single
rev-2 full rewrite of `02-architecture-assessment.md` plus
`03-des-cost-estimate.md` consumed > 40 K output tokens of permanent
conversation history and was the dominant cause of one Step-2 session
breaching the 200 K context window. Targeted edits eliminate this
bloat.

**Exception**: structural rewrites (H2 reordering, template version
bump, > 50 % of lines changed). When taking the exception, log it:

```bash
apex-recall decide <project> \
  --decision "Full rewrite of <artifact-filename>" \
  --rationale "<H2 reorder | template bump | >50% lines changed>" \
  --step <N> --json
```
