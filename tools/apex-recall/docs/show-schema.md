# `apex-recall show --json` Output Schema

Canonical shape of the JSON document emitted by `apex-recall show <project> --json`.
This file is the source of truth for downstream `jq` queries and tooling.

`show` reads authoritative primary state and local artifact inventory without rebuilding SQLite or restoring backups.
Missing primary state reports `state_status: "missing"` and an empty session; corrupt state returns recovery-required,
not cached success. The search/files/decisions index commands keep their existing indexing behavior. Explicit `reindex`
repairs an index after a committed write; it is not a state rollback.

> **Scope**: This documents the **stable contract** that callers may rely on.
> Internal fields not listed here may change without notice; do not depend on
> them.

## Top-level shape

### Practical project decisions and views

New `init` projects use `decisions.workflow_contract: "practical-v1"`. Legacy absence
keeps the old workflow. `decide --adopt-workflow practical-v1 --dry-run` reports the
proposed adoption without writes; actual adoption requires explicit owner rationale.
It preserves historical approvals and consumed attempts, never backfills them.

`decide --input-record <JSON>` records a scoped material answer and append-only
supersession history. `--phase-scope <JSON> --step <step>` records actual bounded
phase scope; neither proves independent human authority or Azure permission.
`checkpoint ... --sync-assessment` generates consumed-input views. `complete-step`
and `transition --complete` reject stale/inconsistent views and concurrent edits.
Completed practical steps expose `completed_environments`; it is not an all-environment approval.

`show.session.material_inputs`, `assessment_readiness`, `environment_readiness`
and `policy_feasibility` distinguish current decisions, views, scoped holds and
preliminary discovery. A no-target provisional architecture is not tenant-verified.
`review-audit --review-request <JSON>` derives identity/cycle from the exact preflighted
request. Initial/closure attempts share a bounded lineage; `--closure-of` identifies
the original. `--review-result` selects only an attributed current published result.
An explicit `decide --review-extension <JSON>` appends a bounded increase without
erasing consumed calls. Every actual dispatch, including empty/failed output, counts.
See the [practical contract](../../../.github/skills/apex-workflow-engine/references/practical-workflow.md)
for record shapes, commands, authority and migration examples.

```jsonc
{
  "project": "<project-name>",
  "session": {/* see below */},
  "artifacts": [/* array of artifact records */],
  "artifact_count": 0,
}
```

### `session`

Always present. When no `00-session-state.json` exists, `session` is `{}`
(empty object) — callers must guard for empty.

| Field                 | Type    | Notes                                                                                       |
| --------------------- | ------- | ------------------------------------------------------------------------------------------- |
| `current_step`        | integer | 0–7 (3_5 maps to 3 for `current_step`; use `steps` for sub-step status).                    |
| `iac_tool`            | string  | `"Bicep"`, `"Terraform"`, or empty.                                                         |
| `region`              | string  | Azure region key (e.g. `"swedencentral"`).                                                  |
| `updated`             | string  | ISO-8601 timestamp (UTC).                                                                   |
| `decisions`           | object  | Free-form decision-key map. See `decision-keys.md` for canonical keys.                      |
| `open_findings`       | array   | Live findings recorded via `apex-recall finding`.                                           |
| `decision_log`        | array   | Append-only decision history.                                                               |
| `steps`               | object  | **Per-step status map keyed by string IDs**. Defaults to `{}` when absent.                  |
| `metadata`            | object  | Existing metadata, including plan locks; absent defaults to `{}`.                           |
| `review_selections`   | object  | Optional step-keyed `review-selection-v1` records for Governance/default Plan.              |
| `effective_reviews`   | object  | Current review integrity, original verdicts, unresolved findings and separate gate status.  |
| `risk_authorizations` | object  | Optional action-keyed signed evidence references; not cached permission.                    |
| `gate_readiness`      | object  | Fresh per-action current/exception-authorized/blocked evaluation, never automatic approval. |
| `review_attempts`     | array   | Append-only attempt lifecycle events, not a reviewer scheduler or authorization.            |

For ordinary projects, `effective_reviews` also evaluates canonical required reviews for produced artifacts
in completed, in-progress or stale steps. It does not infer future review requirements from filenames alone.
Historical `steps[step].completed` remains unchanged when current guidance or supporting inputs become stale.
An invalid review includes the strict validator's error; a current review can expose original `review_verdicts`
and exact `reviews[]` paths/artifacts/supporting inputs for bounded recovery rather than newest-file inference.

`gate_readiness["step-<step>-complete"]` reports current or blocked review readiness with
`permission_granted: false`. This is not human approval. Existing action-specific risk evaluations remain
separate: a blocked historical Plan authorization does not revoke a valid current CodeGen authorization.
Handoff consumers check the requested action, not every historical authorization.

An ordinary completed step with a persisted `challenger_skip` missing-review exception exposes
`review_skip: true`, `skip_reasons` and `input_coverage: "audited-missing-review-skip"` in its effective view.
Its completion readiness also exposes the skip. This is an intentional exception, not independent review
evidence or a fabricated approval: an entirely missing review has no verdicts. Present invalid/stale evidence
still blocks, and explicit replacement-review selections do not inherit the missing-review bypass.
Handoffs identify the skipped review and recorded reason instead of claiming review coverage.

### Review Selection And Compatibility

Each optional selection records `schema_version`, `path`, `sha256`, `pass_number`, `review_focus`, `selected_at`
and `input_coverage: "primary-and-review-guidance"`. The existing public `--governance-review`/`--plan-review`
flags and audit reasons remain supported. Successful selection stores a structured record plus the existing audit.
Completion and resume revalidate it; missing/invalid stored entries fail closed. Legacy absence uses established
defaults or an explicit owner selection, never parsing old free-text rationale. Old reviewed files are not modified.

Coverage labels are conservative. New findings can additionally declare `supporting_inputs` with exact file/directory
hashes generated by `validate-challenger-findings.mjs --metadata <primary> --supporting-input <path>`; strict verification
checks those declarations. Legacy reviews without the array have no such coverage. Callers still own completeness
of the consumed set and service-specific freshness/scope requirements; a current primary hash does not prove them.

### Mutation Outcomes And Recovery

`start-step`, `complete-step` and `transition` check that the previous step is complete (or skipped) before moving on,
and refuse with `step_out_of_order` otherwise. A human can proceed with `--allow-out-of-order "<reason>"`; the reason is
logged in `decisions.order_overrides`. Optional Design (Step 3) never blocks Governance. A step that is already
in progress, or already complete, is never blocked by this check.

For explicit lab risk acceptance, see [risk-authorizations.md](risk-authorizations.md). `effective_reviews.status`
describes review integrity independently of authorization. `gate_status`, `gate_error`, `review_verdicts` and
`unresolved_findings` retain original NEEDS_REVISION evidence. A revoked historical Plan authorization does not
invalidate unchanged review bytes or an independently valid newer CodeGen action authorization; it prevents replay
of the revoked action. Resume and handoffs check `gate_readiness` for the actual requested next action.
CI checks the current phase/action using the same evaluator, not every superseded historical grant. All evidence
records remain history; revocation never silently restores a previous authorization.

Reviewers persist counts, not `overall_assessment`. A persisted review with unresolved `must_fix` findings is
`NEEDS_REVISION` by definition, so the risk-acceptance path and `review_verdicts` derive that verdict when the field is
absent. An explicit verdict is still checked: anything other than `NEEDS_REVISION` on such a review is refused, and
`BLOCKED`/`FAILED` are refused everywhere. `review_verdicts` is always an array with one entry per review; the entry is
`null` (for example `[null]` for one review) when the review has neither the field nor must-fix findings.
The verdict is never invented.

Participating state writers use a project lock, revision checks and unique temporary files. This detects competing
writers and changed watched inputs; it does not lock arbitrary editors or provide a multi-file/power-loss transaction.
Primary replacement and index update are separate. On index failure the CLI returns exit 3 with
`outcome: "committed_but_index_stale"`, a committed `revision` hash and explicit reindex recovery instructions.
Do not repeat the mutation as if no write occurred. Conflicts return exit 2 without primary replacement.

Identical validated completion or transition retries return `already_applied`, preserving completion timestamps and
destination progress. A conflicting replay against a started destination fails rather than reopening it. Starting
the next step without `--complete` revalidates stored selection but does not renew completion or selection history.

`apex-recall recover-state <project> --reason "<explicit owner authorization>" --json` is the only backup restore
path. It refuses healthy primary state, validates backup identity/shape, preserves damaged bytes and the good backup,
and appends a recovery audit. It grants no project/review approval. A handoff renderer lock left by a crashed process
requires explicit owner investigation before removal; it is never silently treated as stale.

Rollback must use a reader/writer version supporting these additive contracts. Do not run old writers against newly
selected projects: older releases do not enforce the new selection and conflict rules. Preserve all evidence and
revert source through reviewed changes, not destructive resets or automatic project-state migration.

### Durable Attempts

`review-audit` accepts `--attempt-id`, `--attempt-kind`, `--input-digest`, `--attempt-outcome`,
optional `--review-output` and `--retry-of`.
Record `started` before the operation and then its actual outcome. IDs cannot change step, kind or input digest;
unknown and terminal outcomes cannot be rewritten. Duplicate identical records are idempotent. Empty-output retries
must reference a terminal original invocation in the same step with confirmed empty reviewer output,
never another retry, and cannot be duplicated. `--review-output empty|nonempty|unknown` records observed output
separately on `completed` or `failed` native review attempts; it is not valid on `started`, `unknown` or repairs.
Successful native execution with empty output remains `completed` and is retry-eligible only with
`review_output: "empty"`. Nonempty/unknown output or task success alone is not eligible.
Legacy failed records without this field retain compatibility, but the caller must still establish
actual empty output and authorization; the audit does not confer permission. Terminal output evidence cannot
be added or rewritten later. Legacy executed totals cannot decrease; filenames do not establish attempt totals.

Instead of `--input-digest`, pass each frozen input with `--attempt-input <path>` (repeatable; files or directories inside
the workspace, no symlinks). The digest is the SHA-256 of the compact JSON array of sorted
`[workspace-relative POSIX path, file SHA-256]` pairs, so the start and the outcome records use the same value and a
changed input is rejected as a reused identity. The command prints `input_digest` and
`permission_granted_by_this_record: false`; the older `authorization: not_granted` field remains for existing readers.
The record is evidence only.

Before dispatch, preflight the exact request with
`node tools/scripts/record-review.mjs --preflight --request <review-request.json>`.
Use its `attempt_inputs` paths for `review-audit --attempt-input`, record `started`, retain the
emitted digest and then record the actual outcome with that same digest. Completion of an invocation
does not establish successful publication or approval; recording failure remains a separate blocker.

`review-audit <project> <step> --reconcile-events <authorized-events.jsonl> --json` compares a supplied
native capture with the ledger without writing state. It reports native request/call identity, task outcome,
recorded outcome, gaps and unmatched ledger entries. It cannot prove input equivalence, successful review
publication or new retry allowance, and cannot combine with mutation flags.
Unmatched ledger entries include both invocations and empty-output retries, not repair-only operations.
Missing historical starts are not backfilled. Owner-authorized recovery must preserve the original history.

### Reopening a step

`start-step <project> <step> --force` on a completed step marks every dependent step that is `complete` or `in_progress`
`stale` (clearing `started`, `completed` and `sub_step`, and adding `stale_since`, `stale_because` and
`previous_completed`). It sets `decisions.plan_status` to `SUPERSEDED` when it was `APPROVED` or `EXCEPTION_AUTHORIZED`
and the reopened step is 1, 2, 3_5 or 4, and appends a `decision_log` entry. Artifacts and risk authorizations are kept
as history. A stale step is not complete, so the next step cannot start until it is re-completed in order. Starting or
transitioning into a stale step clears the stale markers. Readers that do not know `stale` see an unfinished step.

### Step 2 completion check

`complete-step` and `transition --complete` for Step 2 exit with code 2 and `step2_residue` while the project folder
contains `*.tmp.md` files or `02-cost-estimate*.json`, `02-cost-candidates*.json` or `03-des-cost-estimate*.json` with
`"status": "FAILED"`. Only the top level is checked; move superseded files to `_meta/`. The check is separate from the
challenger gate and `--allow-missing-challenger` does not bypass it.

### `session.steps`

Keys are **strings** (`"1"`, `"2"`, `"3"`, `"3_5"`, `"4"`, `"5"`, `"6"`, `"7"`).
Each value is an object describing the step's lifecycle:

```jsonc
{
  "name": "IaC Code",
  "agent": "06b-Bicep CodeGen",
  "status": "complete", // pending | in_progress | complete | skipped | stale
  "sub_step": "phase_4_validation",
  "started": "2026-05-12T11:00:00Z",
  "completed": "2026-05-12T11:30:00Z",
  "artifacts": ["infra/bicep/<project>/main.bicep"],
  "context_files_used": ["01-requirements.md"],
}
```

## Canonical `jq` queries

> **Important**: keys are strings, not numbers. Use string comparisons
> (`.key == "5"`) — do **not** call `tonumber`.

### Status of Steps 5 and 6

```bash
apex-recall show <project> --json \
  | jq '.session.steps
        | to_entries[]
        | select(.key == "5" or .key == "6")
        | {step: .key, status: .value.status, sub_step: .value.sub_step}'
```

Returns 0 entries when neither step has been started — the query is
safe on an empty session because `steps` defaults to `{}`.

### Verify a step is complete (for skip-validation shortcuts)

```bash
apex-recall show <project> --json \
  | jq -r '.session.steps["5"].status // "missing"'
```

Emits `"complete"`, `"pending"`, or `"missing"` — never errors on absent step.

### List artifacts produced at a specific step

```bash
apex-recall show <project> --json \
  | jq -r '.session.steps["6"].artifacts[]?'
```

## History

- **2026-05-13**: Added `steps` to the contract (Phase G3 / F1a of the
  nordic-foods lessons plan). Previously `show.py` omitted `steps`,
  causing `jq '.session.steps | to_entries[]'` to iterate over null.
