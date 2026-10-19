<!-- ref:subagent-integration-v1 -->

# Subagent Integration Matrix

The [workflow graph](../templates/workflow-graph.json) owns review requirements;
current parent frontmatter and worker bodies own permitted calls and outputs.
Discovery does not wire or authorize a call. Read the
[execution contract](execution-subagent.md) before delegating.

- Step 1 requires comprehensive review.
- Step 2 requires architecture review plus separate independent cost-feasibility review in every mode.
- Step 3 ADR review is opt-in; Step 3.5 governance reconciliation is required unless there are no constraints.
- Step 4 requires plan review. Deep review at Steps 2 and 4 requires explicit opt-in, never complexity alone.
- Step 5 code review is opt-in; Step 6 has no Challenger review over deployment tool output.
- Cost workers serve Architect and As-Built; validation and preview workers serve their authorized IaC parents.

> [!NOTE]
> **Pricing Accuracy Gate (Steps 2 & 7)**: No agent writes dollar figures from
> parametric knowledge. All prices must originate from `cost-estimate-subagent`
> (Azure MCP `pricing_get`). This policy applies to both the Architect
> (Step 2, `03-des-cost-estimate.md`) and As-Built (Step 7, `07-ab-cost-estimate.md`)
> agents. Established after model evaluation found pricing hallucinations
> (see `agent-output/model-eval-scoring.md`).

Extra validation requests still require an authorized caller, suitable phase,
available tools, and all preview/approval gates. Models and effort are diagnostic
only; leave caller routing overrides unset.

## Interactive vs Autonomous Delegation

> [!CAUTION]
> Leaf workers cannot ask user questions, manage todos, or call nested agents.
> Return missing-input diagnostics to the parent; never fabricate defaults.

`01-Orchestrator` remains human-selected and alone dispatches approved,
allowlisted main workers through the [native task lifecycle](worker-readiness.md).
Direct main-agent selection retains native questions. Delegated steps return
`USER_INPUT_REQUIRED` forms to the interactive parent, which owns `ask_user`;
cancel stops and decline never approves. Steps call only their authorized leaves.
An allowlist or invocation flag is not runtime routing or approval evidence.

Automatic and optional manual reviews use `challenger-review-subagent` through
[shared structured review](../../apex-azure-defaults/references/one-shot-review.md),
with its own actual-result receipt/freshness contract. If a required reviewer is unavailable,
STOP and return its failure to the interactive parent; never nest a main-agent
wrapper or fabricate inline review. `10-Challenger` remains optional manual recovery.
Missing or empty output permits exactly one identical-input retry, then human
escalation under the [review protocol](../../apex-azure-defaults/references/adversarial-review-protocol.md).
When the delegated owner cannot call nested tasks, return `REVIEW_REQUIRED` instead:
the allowlisted interactive Orchestrator runs the same native reviewer as a sibling automatically.
This is not a manual-wrapper fallback or review exemption. Preserve budget, actual inputs and recorder identity.

## Output ownership

The shared review leaf returns raw structured JSON once, without writes.
The parent runs `record-review.mjs` against the exact attributed runtime response,
which validates and atomically persists it. The parent must not reconstruct or
repair the independently returned findings. Summaries and downstream handoffs
use the recorded paths, not repeated full JSON dumps.

`cost-estimate-subagent` retains a **file-mode contract**: it writes its structured output to a parent-supplied
path on disk and returns only a compact summary (≤15 lines, ≤2 KB) to the
parent's chat context. This keeps parent agents' context windows small and
prevents repeated JSON dumps from bloating the conversation.

### Path convention

The parent agent **always** supplies `output_path` explicitly. The subagent
never invents or guesses a path.

| Subagent                     | Caller (step)                 | Canonical `output_path`                                                       |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `challenger-review-subagent` | Requirements (1)              | `agent-output/{project}/challenge-findings-requirements.json`                 |
| `challenger-review-subagent` | Architect (2) — architecture  | `agent-output/{project}/challenge-findings-architecture.json` (default); `architecture-pass{N}` stem for deep |
| `challenger-review-subagent` | Architect (2) — cost          | `agent-output/{project}/challenge-findings-cost-estimate.json`                |
| `challenger-review-subagent` | Governance (3.5)              | `agent-output/{project}/challenge-findings-governance-constraints-pass1.json` |
| `challenger-review-subagent` | IaC Planner (4)               | `agent-output/{project}/challenge-findings-plan.json` (default); `plan-pass{N}` stem for deep |
| `challenger-review-subagent` | Bicep / Terraform CodeGen (5) | `agent-output/{project}/challenge-findings-iac-code-pass{N}.json`             |
| `cost-estimate-subagent`     | Architect (2)                 | `agent-output/{project}/02-cost-estimate.json`                                |
| `cost-estimate-subagent`     | As-Built (7)                  | `agent-output/{project}/07-ab-cost-estimate.json`                             |

Resolve exact filenames through the current reviewer contract and requested mode;
Governance retains its explicit `-pass1` filename. Preserve historical evidence
but never treat a legacy filename alone as proof of a current valid review.

### Atomic write + refuse-on-exists

For file-mode workers, the subagent performs these operations. For all structured
reviews, the provenance-aware recorder owns the writes and actual no-overwrite checks:

1. Writes to `{output_path}.tmp` first.
2. Renames `{output_path}.tmp` → `{output_path}` only after a successful
   complete write. Partial writes never appear under the canonical name.
3. Refuses to overwrite an existing file unless the parent explicitly passes
   `overwrite: true`. This protects against silent loss on retries or
   parallel runs.

### Parent responsibilities

After recording and strict freshness validation (or receiving a file-mode
worker's compact summary), the parent agent MUST:

1. Avoid pasting the full JSON inline in chat. Read `output_path` from disk
   only when full finding details are needed (e.g., Gate presentation, fix
   triage).
2. Record the artifact in session state via:

   ```bash
   apex-recall checkpoint <project> <step> <phase-tag> --json
   ```

   `apex-recall` has no dedicated `artifact` subcommand; the existing
   `checkpoint` subcommand stamps the new file in session state, and the
   file index picks the new file up on the next `reindex`.

3. Preserve attempt accounting and history on revisions. Set `overwrite: true` only for an explicitly
   authorized bounded replacement; a new pass uses its own canonical output path.

### Historical file-output reviews

Earlier manual reviewers wrote their own JSON and returned a compact file pointer.
Those receipts remain readable history. New automatic/manual reviews share one read-only leaf
and actual-event recorder; neither parent-authored reconstruction nor a file-pointer-only result
satisfies the current contract. Keep downstream context compact through recorded paths and summaries.
