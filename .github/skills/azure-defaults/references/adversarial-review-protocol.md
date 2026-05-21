<!-- ref:adversarial-review-protocol-v3 -->

# Adversarial Review Protocol

Standard protocol for invoking `challenger-review-subagent` across
all agents. Each agent specifies its own `artifact_path`,
`artifact_type`, pass count, and review focus — this reference
defines the shared mechanics.

## Lenses

Single source of truth for adversarial review lenses. Agents and the
`workflow-graph.json` MUST reference lens names from this table only;
new lenses are added here first and registered in
`tools/scripts/validate-workflow-graph.mjs` (`VALID_LENSES`) and the
`review_focus` enum of
`.github/agents/_subagents/challenger-review-subagent.agent.md`.

| Lens                        | Applies to (`artifact_type`)                                                         | Description                                                                            | Checklist anchor                                                                                        |
| --------------------------- | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `comprehensive`             | requirements, architecture, cost-estimate, implementation-plan, iac-code, design-adr | Single-pass merged lens. Used by the **default flow** at every mandatory step.         | [Lens: comprehensive](adversarial-checklists.md#lens-comprehensive-single-pass-default)                 |
| `security-governance`       | architecture, implementation-plan, iac-code                                          | Policy compliance, identity, network isolation, encryption. Opt-in deep-review pass 1. | [Per-Category Checklists → Governance & Compliance](adversarial-checklists.md#governance--compliance)   |
| `architecture-reliability`  | architecture, implementation-plan, iac-code                                          | WAF balance, SLA feasibility, failure modes, dependencies. Opt-in deep-review pass 2.  | [Per-Category Checklists → Architecture & WAF](adversarial-checklists.md#architecture--waf)             |
| `cost-feasibility`          | architecture, cost-estimate, implementation-plan                                     | SKU sizing, pricing realism, RI / Savings-Plan math, budget alignment. Opt-in pass 3.  | [Cost-Estimate-Specific](adversarial-checklists.md#cost-estimate-specific-artifact_type--cost-estimate) |
| `governance-reconciliation` | governance-constraints                                                               | Drift between approved architecture and discovered constraints. Mandatory at Step 3.5. | [Lens: governance-reconciliation](adversarial-checklists.md#lens-governance-reconciliation)             |

## Default flow: 1-pass comprehensive

By default, every step that runs adversarial review runs **one
comprehensive pass**. No early-exit logic. No complexity-tier routing.

- `review_focus` = `comprehensive` (or `governance-reconciliation` at Step 3.5)
- `pass_number` = `1`
- `prior_findings` = `null`
- Subagent writes one sidecar JSON file (`challenge-findings-{artifact_type}.json`).
- Parent agent presents the per-finding decision panel (see
  `## Per-Finding Decision Protocol`) and then the aggregated proceed /
  revise gate.

### Subagent-discovery fallback (default + deep)

`runSubagent { agentName: "challenger-review-subagent" }` has been
observed to fail at runtime with `Error invoking subagent: Requested
agent 'challenger-review-subagent' not found.` even when the parent +
subagent config matches the VS Code subagent docs
(<https://code.visualstudio.com/docs/copilot/agents/subagents>) and
`npm run validate:agents` Part 2 passes. Root cause uncertain (likely
session-cache staleness or an edge case in the experimental
`chat.customAgentInSubagent.enabled` feature).

When you see that runtime error:

1. Retry once via the `10-Challenger` user-invocable wrapper agent
   instead of calling the subagent directly. `10-Challenger` is the
   documented standalone path-to-artifact entry point and is the
   pre-declared auto-handoff target in every parent agent's frontmatter
   (`agent: 10-Challenger`, `send: true`), so it uses a different
   resolution code path than direct `runSubagent { agentName }`.
2. If `10-Challenger` also fails, surface the verbatim runtime error
   to the user and **stop**. Do **not** improvise an inline
   "autonomous review pass" — it runs the review in the parent's
   context window (doubles input-token cost) and produces findings
   indistinguishable from a real subagent result. Forbidden by
   [`agent-authoring.instructions.md#challenger-subagent-fallback-rule`](../../../instructions/agent-authoring.instructions.md#challenger-subagent-fallback-rule).

Tier annotations in `workflow-graph.json` (`opt_in_matrix`) are
**recommendations only** — they never auto-fire. The Orchestrator never
auto-triggers a multi-pass run based on `decisions.complexity`. The user
opts in explicitly (`decisions.review_depth = "deep"`, see "Project-scoped
opt-in" below) or via an ad-hoc handoff to `10-Challenger`.

### Mandatory floor

| Step | Default review                                                              | Skip condition                |
| ---- | --------------------------------------------------------------------------- | ----------------------------- |
| 1    | 1× `comprehensive`                                                          | —                             |
| 2    | 1× `comprehensive` + 1 cost audit (`cost-feasibility` lens on the estimate) | —                             |
| 3    | none (Step 3 is optional)                                                   | (skipped when Step 3 skipped) |
| 3.5  | 1× `governance-reconciliation`                                              | `constraints.count == 0`      |
| 4    | 1× `comprehensive`                                                          | —                             |
| 5    | none (default-skip)                                                         | always                        |
| 6    | none (`## Policy precheck summary` folded into deployment artifact)         | always                        |
| 7    | none                                                                        | always                        |

> **Step 2 cost audit** is produced by the **existing**
> `cost-feasibility` lens of `challenger-review-subagent` against the
> `02-cost-estimate.json` / `03-des-cost-estimate.md` artifacts.
> `cost-estimate-subagent` is **not** modified — it remains the
> cost-breakdown emitter consumed by 03-Architect.

### Project-scoped opt-in

01-Orchestrator captures `decisions.review_depth` once at boot via
`apex-recall decide <project> --key review_depth --value default|deep`.
Every parent agent reads this on each invocation (survives resumed
sessions) and enters the opt-in deep-review path below when the value is
`deep`. Default value: `default`.

## Opt-in: Deep adversarial review

Multi-pass cascade rules (rotating lenses, recommended tier shape, batch
invocation, subagent invocation template) live in the sibling reference
[`adversarial-review-deep.md`](./adversarial-review-deep.md). Load that
file **only** when `decisions.review_depth == "deep"`, the user invokes
`10-Challenger` with multi-pass arguments, or the user picks the deep
option at a gate prompt (Steps 2 / 4 / 5b/5t).

## Severity Guardrails

Challengers MUST apply strict severity definitions:

| Severity     | Definition                                                                                                                                         | Examples                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `must_fix`   | **Deployment failure** (Policy Deny block, missing config, broken dependency) or **security breach** (public exposure, no auth, plaintext secrets) | Missing PE for locked-down KV, no MI user for AAD-only SQL       |
| `should_fix` | **WAF violation** or **operational risk** that won't block deploy but degrades production quality                                                  | Missing alerts, SPOF, incomplete diagnostics                     |
| `suggestion` | Nice-to-have, belongs in Step 7 (as-built), or "v2" item                                                                                           | Failover-region design, cert lifecycle, post-launch right-sizing |

> If a finding describes content that belongs in Step 7 (ops runbook, DR plan,
> documentation), classify as `suggestion`, not `should_fix`.

## Complexity Classification Criteria

`decisions.complexity` is a **deep-review shape hint only** (see
"Recommended tier shape" above). The Orchestrator does not use it to
auto-trigger reviews. The Requirements agent classifies; if missing from
old sessions, default to `"standard"`.

| Tier         | Criteria                                                                             |
| ------------ | ------------------------------------------------------------------------------------ |
| **Simple**   | ≤3 resource types, single region, no custom Azure Policy, single environment         |
| **Standard** | 4–8 resource types, multi-region OR multi-env (not both extreme), ≤3 custom policies |
| **Complex**  | >8 resource types, multi-region + multi-env, >3 custom policies, hub-spoke topology  |

## Model Routing

The model used for each review lens is determined by the
`challenger-review-subagent` frontmatter (source of truth). All lenses
share the same subagent; the `review_focus` field rotates per pass.

## Parallel Invocation (Cross-Artifact Reviews)

When a step reviews **multiple independent artifacts**, run their first passes
in parallel via simultaneous `#runSubagent` calls. Two reviews are independent
when they target different artifacts AND both use `prior_findings = null`.

| Step               | Parallel Pair                              | Why Safe                                                     |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------ |
| Step 2 (Architect) | Architecture pass 1 ‖ Cost Estimate review | Different artifacts, both `prior_findings=null`              |
| Step 5 (CodeGen)   | Lint subagent ‖ Review subagent            | Independent checkers (syntax vs standards) on identical code |

**Rules**:

1. Both calls MUST use `prior_findings = null` (no inter-dependency)
2. Await both results before proceeding to conditional pass 2
3. If either returns a blocking failure, halt before subsequent passes
4. For Step 4: if governance review returns `must_fix` items that affect
   the plan, feed the compact governance findings into plan pass 2's
   `prior_findings` alongside plan pass 1's compact string

> **Do NOT parallelize** rotating-lens passes (1→2→3) within the same
> artifact — each pass depends on `prior_findings` from the previous pass.

## Context Efficiency — Compact prior_findings

> [!IMPORTANT]
> After writing each pass result to disk, **do NOT keep the full JSON
> in working context**. Extract only the `compact_for_parent` string
> from the subagent response and discard the rest.
>
> For passes 2 and 3, set `prior_findings` to a compact multi-line
> string built from previous `compact_for_parent` values — **not the
> full JSON objects**:
>
> ```text
> prior_findings: "Pass 1: <compact_for_parent>\nPass 2: <compact_for_parent>"
> ```
>
> This prevents each subagent call from re-injecting thousands of
> tokens of prior findings into the parent context. Full detail is
> already saved to disk.

## Context Shredding for Challenger Inputs

When passing predecessor artifacts to the challenger, apply context shredding
(from the `context-management` skill, Mode A: Runtime Compression) based on current context usage:

- **< 60% context**: Pass full artifact
- **60–80% context**: Pass only key H2 sections (resource list, SKU decisions,
  WAF scores, compliance requirements, budget). Drop detailed prose.
- **> 80% context**: Pass only the decision summary from `apex-recall show <project> --json`
  `decisions` field plus `decision_log` entries plus the resource list.
  The `decision_log` provides rationale for prior choices without loading full artifacts.

This reduces challenger input by 40–70% and cuts turn latency proportionally.

## Approval Gate Summary Template

After all passes, present a merged summary:

```text
⚠️ Adversarial Review Summary ({N} passes)
  must_fix: {total} | should_fix: {total} | suggestions: {total}
  Key concerns: {top 2-3 must_fix titles across all passes}
  Findings:
    - agent-output/{project}/challenge-findings-{type}.json (single-pass) or
    - agent-output/{project}/challenge-findings-{type}-pass1.json … (deep-review)
```

For per-finding decisions before the summary, follow `## Per-Finding Decision Protocol`.

## Findings Table Rendering Format

Every agent that presents challenger findings in chat MUST print a
**multi-line markdown table** — never a single-line string with escaped
`\n` characters. Leave blank lines before and after the table so
markdown renderers parse it correctly.

Canonical layout:

```markdown
**Challenger Findings**

| ID | Severity | Title | WAF Pillar | Recommendation |
| --- | --- | --- | --- | --- |
| {id} | {severity} | {title} | {waf_pillar} | {recommendation} |

**Totals:** N must-fix, N should-fix, N suggestions.
Machine-readable detail is in `challenge-findings-{type}.json`.
```

- Order rows: all `must_fix` first, then `should_fix`, then `suggestion`.
- `{id}` = first 8 hex chars of the stable issue hash (section 2b).
- Column values map directly to the JSON `findings[]` fields.

## Findings Cache (REVISE-loop optimization)

Subagent output includes a `cache_inputs` block:

```json
{
  "cache_inputs": {
    "artifact_sha": "<sha256 of challenged artifact bytes>",
    "checklists_sha": "<sha256 of adversarial-checklists.md bytes>",
    "protocol_sha": "<sha256 of this file bytes>",
    "subagent_sha": "<sha256 of challenger-review-subagent.agent.md bytes>",
    "model": "<challenger-review-subagent.frontmatter.model[0]>",
    "artifact_hash": "<sha256 of artifact_sha ‖ \"\\n---\\n\" ‖ checklists_sha ‖ \"\\n---\\n\" ‖ protocol_sha ‖ \"\\n---\\n\" ‖ subagent_sha ‖ \"\\n---\\n\" ‖ model>"
  }
}
```

**Cache lookup on REVISE / retry**: before invoking the subagent again,
the parent computes the current `cache_inputs` and compares **every
component** to the cached value. **All five** must match for a cache
hit. Any single component mismatch invalidates the cache and forces a
fresh invocation:

| Mismatch trigger                                     | Result                |
| ---------------------------------------------------- | --------------------- |
| Artifact bytes changed (the common case)             | Re-invoke             |
| `adversarial-checklists.md` updated                  | Re-invoke             |
| This protocol doc updated                            | Re-invoke             |
| `challenger-review-subagent.agent.md` prompt updated | Re-invoke             |
| `challenger-review-subagent` model rolled            | Re-invoke             |
| **All five match** (rare on real REVISE loops)       | Reuse cached findings |

The cache protects against three classes of staleness: prompt drift
(checklist or protocol or subagent edits), model drift, and downstream
revisions that did not actually touch the challenged artifact.

> **Decisions sidecars are never cached.** Cache only applies to the
> findings JSON. The `challenge-findings-{type}-decisions.json` sidecar
> is owned by the parent agent and always rewritten on REVISE.

## Per-Finding Decision Protocol

Replaces the legacy single-binary "Approve / Revise" gate with a per-finding
interactive flow. After all challenger passes for an artifact complete, the
parent agent presents one batched `askQuestions` call where each in-scope
finding (`must_fix` + `should_fix`) is its own question with four action
options. Decisions are persisted in a sidecar JSON file and via
`apex-recall finding`. A final aggregated proceed/revise gate follows.

### 2a. Sidecar file location

Decisions are written to:

```text
agent-output/{project}/challenge-findings-{artifact-type}-decisions.json
```

The challenger subagent **never reads or writes this file** — it is owned
by the parent agent. Schema:

```json
{
  "challenged_artifact": "agent-output/{project}/{artifact}.md",
  "artifact_type": "requirements|architecture|cost-estimate|governance|plan",
  "decisions": [
    {
      "issue_id": "<8-char hash>",
      "source_file": "challenge-findings-{type}-pass{N}.json",
      "pass_number": 1,
      "issue_index": 3,
      "severity": "must_fix",
      "title": "...",
      "action": "accept|reject|defer|edit",
      "note": "free text or null",
      "decided_at": "<ISO-8601>"
    }
  ]
}
```

**Atomic write**: write to `{path}.tmp`, then `os.rename` over the target.
**Append on Revise re-runs**: never overwrite. Existing entries with a
matching `issue_id` are kept and skipped on the next panel build.

### 2b. Stable issue identity

```text
issue_id = sha256(category + "|" + title + "|" + artifact_section).hexdigest()[0:8]
```

Computed by the parent agent at panel-build time. The challenger
subagent's JSON schema is **not** modified — `issue_id` is a parent-side
derivation. Re-running against the same finding produces the same hash,
which makes Resume / Revise idempotent.

### 2c. Auto-load existing decisions on Resume / Revise

Before building the panel:

1. If `challenge-findings-{type}-decisions.json` exists, read it.
2. Compute `issue_id` for every finding in the merged source set (2e).
3. Skip any issue whose `issue_id` is already present in
   `decisions[].issue_id`.

If the sidecar is absent, treat as "no prior decisions" — legacy
artifacts that pre-date this protocol work unchanged.

### 2d. Unattended mode

If the environment variable `APEX_UNATTENDED=1` is set, the protocol
**bypasses `askQuestions` entirely**:

- All `must_fix` → `action: "defer"`,
  `note: "auto-deferred (unattended)"`.
- All `should_fix` → `action: "defer"`, same note.
- All `suggestion` → unchanged (auto-deferred as in attended mode).
- Final aggregated gate auto-proceeds.
- Agent emits a chat warning listing every deferred `must_fix` title so
  the user can audit the run later.

This unblocks `e2e-orchestrator.agent.md` and `npm run e2e:benchmark`.

### 2e. Multi-source merge order

When an agent has multiple `challenge-findings-*.json` sources (Architect
merges cost-estimate + arch pass 1/2/3; Planner merges arch pass 1/2/3),
build one batched panel using this order:

1. All `must_fix` first, sorted by `(source-order, original-index)`.
2. All `should_fix` next, same sort.

Source order for Architect:
`cost-estimate → architecture pass 1 → pass 2 → pass 3`.
Source order for Planner: `pass 1 → pass 2 → pass 3`.

**No dedup logic** — the challenger subagent's existing `prior_findings`
contract already prevents cross-pass duplicates.

### 2f. Soft cap on panel size

Default cap: **12 questions**. If `must_fix + should_fix > 12`:

1. Render the full summary table in chat (unchanged).
2. Build the panel from the top 12 by severity (must_fix first, sorted
   per 2e).
3. Auto-defer the rest with
   `note: "auto-deferred (panel cap; re-run gate after revising must_fix)"`.
4. Emit a chat warning:
   `Panel capped at 12 of {N} findings; {M} auto-deferred.`

The cap is a constant. Agents do not override it.

### 2g. `askQuestions` payload shape

Per finding:

| Field                | Value                                                                                                                                                                  |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `header`             | `{artifact-type}-pass{N}-{idx}` (≤50 chars). Examples: `architecture-pass1-3`, `cost-estimate-pass1-0`. **Hard rule** — must be unique across the merged batched call. |
| `question`           | `title` (≤200 chars; truncate with `…`).                                                                                                                               |
| `message`            | Markdown block with severity badge + `category` + `description` + `failure_scenario` + `artifact_section` + `suggested_mitigation`.                                    |
| `options`            | Four fixed labels (in this order): `Accept (apply mitigation)`, `Reject (accept risk)`, `Defer (carry to handoff)`, `Edit (custom guidance)`.                          |
| `recommended`        | `Accept` for `must_fix`; `Defer` for `should_fix`.                                                                                                                     |
| `allowFreeformInput` | `true` (enables Edit + per-finding notes).                                                                                                                             |

### 2h. Edit / freeText / skipped semantics

Deterministic — no agent-level interpretation:

| User input                                                          | Resulting `action` | Resulting `note`                                    |
| ------------------------------------------------------------------- | ------------------ | --------------------------------------------------- |
| `Edit` selected + non-empty `freeText`                              | `edit`             | `<freeText>`                                        |
| `Edit` selected + empty `freeText`                                  | `defer`            | `"Edit selected without guidance — auto-deferred."` |
| `Accept` / `Reject` / `Defer` selected (with or without `freeText`) | matches selection  | `<freeText>` if present, else `null`                |
| `skipped: true`                                                     | `defer`            | `"User skipped — auto-deferred."`                   |

### 2i. Persist decisions (sidecar + apex-recall)

For each answered question:

1. Append a `decisions[]` entry to the sidecar JSON (atomic write per 2a).
2. Run:

   ```bash
   apex-recall finding <project> --add "{severity}|{action}|{issue_id}|{title}|{note}" --json
   ```

   Pipe-delimited single-line format (Sg2). Consumers split on `|` with
   **max 4 splits** so titles or notes that contain `|` remain intact.
   Use the literal string `null` (no quotes) when `note` is null.

### 2j. No-op gate clarification

If `must_fix + should_fix == 0`:

- **Skip the per-finding panel only.**
- Agents still render their summary blocks (WAF scores, governance
  summary, plan summary, etc.).
- The final aggregated gate becomes a trivial Proceed confirmation.

### 2k. Revise behavior matrix

| Agent           | On user `Revise` final-gate choice                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| 02-Requirements | Apply Accepted fixes → re-run challenger (`overwrite: true`) → re-build panel (skipping issues with prior decisions per 2c) → re-present gate. |
| 03-Architect    | Same as Requirements; re-run all relevant passes per the configured pass count.                                                                |
| 04g-Governance  | Apply Accepted fixes → **DO NOT re-run challenger** (cap = 1 pass) → re-present final aggregated gate only with the existing decision sidecar. |
| 05-IaC Planner  | Same as Requirements.                                                                                                                          |

### 2l. Final aggregated gate

After the per-finding panel completes (or is skipped per 2j / 2d):

1. Render a decisions table in chat:

   ```text
   ID       Severity    Title                                  Action   Note
   a1b2c3d4 must_fix    Missing private endpoint on storage    accept   Adopt PE in Phase 2
   e5f6g7h8 should_fix  Cosmos DB region pair                  defer    —
   ```

2. Present a single `askQuestions` with options:
   - `Revise (apply Accepted findings)` —
     `recommended: true` if any `must_fix` had `action == "accept"`;
     otherwise not recommended.
   - `Proceed (handoff next step)` — recommended otherwise.
   - **Governance only**: also `Refresh governance` (preserved from the
     existing 04g Phase 3 gate).

### 2m. Payload example

Two-finding panel for an Architect gate. Source files merged per 2e
(`challenge-findings-cost-estimate.json` first, then
`challenge-findings-architecture-pass1.json`).

```json
{
  "questions": [
    {
      "header": "cost-estimate-pass1-0",
      "question": "Cosmos DB autoscale max RU/s exceeds budget by 38%",
      "message": "**must_fix** · cost-feasibility\n\n**Description**: Configured 4000 RU/s autoscale max but plan caps at 2900.\n\n**Failure scenario**: Burst traffic triggers autoscale to ceiling, monthly bill overruns committed budget.\n\n**Artifact section**: §4 Cost — Cosmos DB row.\n\n**Suggested mitigation**: Lower max_throughput to 2900 or split workload across two containers.",
      "options": [
        { "label": "Accept (apply mitigation)", "recommended": true },
        { "label": "Reject (accept risk)" },
        { "label": "Defer (carry to handoff)" },
        { "label": "Edit (custom guidance)" }
      ],
      "allowFreeformInput": true
    },
    {
      "header": "architecture-pass1-2",
      "question": "Storage account allows public blob access",
      "message": "**must_fix** · security-governance\n\n**Description**: …",
      "options": [
        { "label": "Accept (apply mitigation)", "recommended": true },
        { "label": "Reject (accept risk)" },
        { "label": "Defer (carry to handoff)" },
        { "label": "Edit (custom guidance)" }
      ],
      "allowFreeformInput": true
    }
  ]
}
```

Resulting sidecar entry for the first answered question (user picked
`Accept` with note "Lower to 2500"):

```json
{
  "issue_id": "a1b2c3d4",
  "source_file": "challenge-findings-cost-estimate.json",
  "pass_number": 1,
  "issue_index": 0,
  "severity": "must_fix",
  "title": "Cosmos DB autoscale max RU/s exceeds budget by 38%",
  "action": "accept",
  "note": "Lower to 2500",
  "decided_at": "2026-05-09T14:32:11Z"
}
```

Corresponding `apex-recall` call:

```bash
apex-recall finding my-project --add "must_fix|accept|a1b2c3d4|Cosmos DB autoscale max RU/s exceeds budget by 38%|Lower to 2500" --json
```
