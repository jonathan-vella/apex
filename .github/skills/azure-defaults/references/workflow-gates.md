<!-- ref:workflow-gates-v1 -->

# Workflow Gates (cross-agent reference)

Canonical specification for the user-facing gates introduced by the
nordic-foods lessons plan. Agent files cite this document with a
short pointer rather than inlining the protocols, keeping each agent
body within the 500-line budget. **Always-read** when an agent
implements one of the gates below.

## Architect (Step 2) — Phase 6a: SKU confirmation gate

Run before any `cost-estimate-subagent` invocation. Read
`agent-output/{project}/sku-manifest.json`. Build a read-only chat
context block listing user-pinned rows (`source: "user-pin"`) — they
are locked and must never appear as answer options. Call
`vscode_askQuestions` exactly once with ONLY architect-derived rows
and three options: `Approve all` / `Revise SKUs` / `Discuss`. Wait for
the user; do not auto-default.

- **Approve**: `apex-recall decide <project> --key sku_confirmation_status --value approved --step 2 --json`, continue to pricing delegation.
- **Revise / Discuss**: record `--value revising`, loop back to
  candidate-set authoring. Do **not** invoke `cost-estimate-subagent`
  while status is `revising`.

The pricing step's precondition guard refuses to invoke the subagent
unless `sku_confirmation_status == "approved"`.

## Architect (Step 2) — Phase 9a: Budget gate

Run after pricing receive. Skip silently when `decisions.budget_cap_known == false`
or `monthly_total <= budget_cap`. Otherwise call
`vscode_askQuestions` with three options:

1. `Approve overage` — record and continue to charts/artifact write.
2. `Revise SKUs (loop to 6a)` — record, increment
   `decisions.budget_revise_count`, loop back to candidate-set authoring.
3. `Revise requirements (return to 02-Requirements)` — record, emit a
   handoff to 02-Requirements and stop.

Record via `apex-recall decide --key budget_decision --value <approve_overage|revise_sku|revise_reqs> --step 2 --json`.

**Loop cap**: the `revise_sku` branch may iterate at most **3 times**.
Track via `decisions.budget_revise_count`. After the 3rd `revise_sku`
decision, hard-stop and surface to the user — do not re-prompt.

## Architect (Step 2) — Per-finding askMe (Approval Gate)

In the Approval Gate, after presenting the WAF + cost summary and the
challenger findings table, run **one** `vscode_askQuestions` call **per
finding** with three options each: `Accept` / `Skip` / `Defer`, plus a
free-form rationale field. Process findings in the order: must_fix →
should_fix → suggestion. **MUST NOT** batch findings into a single
question with `multiSelect`. Worked example: 5 findings → 5 sequential
questions.

## Architect (Step 2) — Cost-feasibility review gate

The architecture comprehensive review always runs. The cost-feasibility
lens is gated. Run iff:

```text
run = (decisions.budget_cap_known AND monthly_total > 0.8 * budget_cap)
   OR decisions.review_depth == "deep"
   OR NOT decisions.budget_cap_known
```

Record `apex-recall decide --key cost_feasibility_review --value <run|skip>`.

## Architect (Step 2) — Approval gate handoff template

On Proceed, emit one of these two templates verbatim, routed by
`decisions.skip_design`:

- `skip_design == true`: "Reply **approve** and I'll run
  `apex-recall complete-step <project> 2` and hand off to
  **04g-Governance Discovery (Step 3.5)**."
- `skip_design == false` (default): "Reply **approve** and I'll run
  `apex-recall complete-step <project> 2` and hand off to **04-Design
  (Step 3)** for diagrams/ADRs, then continue to Governance Discovery
  (Step 3.5)."

The literal strings `"IaC Planner"` and `"Step 4"` MUST NOT appear in
this approval gate output. Next-step routing is **always** Design or
Governance — never Planner directly. Enforced by
`tools/scripts/validate-banned-phrases.mjs`.

## Challenger empty-output diagnostic + bounded retry

Applies to every `challenger-review-subagent` invocation. When the
subagent returns successfully but the expected `output_path` JSON is
missing or empty (zero bytes):

1. **Before any retry**, append a structured failure entry to
   `agent-output/{project}/_meta/challenger-failures.json` with
   `timestamp`, `review_focus`, `output_path`,
   `return_summary_verbatim`, `output_file_size_bytes`,
   `last_error_message`.
2. **Retry exactly once** with identical inputs.
3. **After the second failure**: STOP, surface the failure log to the
   user inline. Do NOT advance to the Approval Gate. Do NOT invent
   findings. Do NOT call the subagent a third time.

## Design (Step 3) — Phase 00: Artifact scope (one-time gate)

Runs **before** Phase 0. Read `decisions.design_scope`. If set, skip
silently. If absent, raise a single `vscode_askQuestions` with three
options:

- **Diagrams only** — produce `03-des-diagram.{drawio|py}` (+ `.png`);
  skip ADR generation.
- **ADRs only** — produce `03-des-adr-NNNN-{slug}.md` for each
  non-trivial decision; skip Phase 0 and diagram generation entirely.
- **Both (diagrams + ADRs)** — full Step 3 output.

Record `apex-recall decide --key design_scope --value <diagrams|adrs|both> --step 3 --json`.

Routing rules after the gate:

- `design_scope == "adrs"` → skip Phase 0 and Section 1 (Diagram
  generation); run Section 2 (ADRs) only.
- `design_scope == "diagrams"` → run Phase 0 + Section 1; skip
  Section 2 (ADRs).
- `design_scope == "both"` → run Phase 0 + Section 1 + Section 2.

## Design (Step 3) — Phase 0: Diagram tool choice (one-time gate)

Skipped when `decisions.design_scope == "adrs"`. Otherwise read
`decisions.diagram_tool`. If set, skip silently. If absent, raise a
single `vscode_askQuestions` with two options:

- **Draw.io** (Azure-brand icons, higher visual quality) — recommended;
  every existing artifact in `agent-output/*/` uses Draw.io.
- **Python diagrams** (faster, lower fidelity, generic icons).

Record `apex-recall decide --key diagram_tool --value <drawio|python> --step 3 --json`.

## Design (Step 3) — Drawio contract guards

- **Timing budget**: a typical 12-resource diagram completes in ≤ 3 min.
  If exceeded, abort, run `clear-diagram`, rebuild from clean base.
- **`import-diagram` input contract**: the `xml` field accepts XML
  **content as a string**, NOT a file path. Pass `read_file(<path>)`
  content. Same warning in `drawio/SKILL.md`.

## Governance (Step 3.5) — Phase 2.7: Inline Resolution Gate

Two inherited policy parameters require user confirmation in the same
chat session: required RG tag keys + casing, and allowed locations
(`swedencentral` allow-list status). These are unreliable in REST
output for inherited MG assignments. The only valid bypass is the
Phase 0.4 short-circuit when prior resolutions are already in
`governance_gate_status.resolved_confirmations`.

- **Same-region (silent default)**: `location_constraints.same_region`
  set to `true` by `discover.py` with `same_region_source: "default-assumption"`
  and `auditable: true`. NOT in the panel. Raise only when discovery
  finds a policy that explicitly **allows cross-region** AND the
  assessment includes multi-region resources.
- **Tag schema (policy-only)**: `tag_contract.source` is **always**
  `"policy"`. Empty tag policy → `tags: []` with `source: "policy"`.
  Greenfield lowercase fallback lives in
  [`tag-strategy.md`](./tag-strategy.md); it is guidance, not a silent
  default.

Anti-patterns (banned by
`tools/scripts/validate-banned-phrases.mjs`): the legacy same-region
question text in the panel; `Minimum baseline (PascalCase, exact
casing)` in copilot-instructions.

## SKU Manifest MD ↔ JSON sync (Steps 2, 4, 6, 7)

After any rev-N JSON mutation, run
`node tools/scripts/render-sku-manifest-md.mjs <project>`. The renderer
is the only legitimate writer of `sku-manifest.md` and fails hard on
`current_revision` mismatch. Lefthook pre-commit auto-re-renders and
re-stages when JSON is staged; CI runs the renderer + `git diff
--exit-code`. Agents MUST NOT hand-edit the MD.

## Decision-key registry

Every `apex-recall decide --key <name>` reference in an agent file
MUST appear in
[`tools/apex-recall/docs/decision-keys.md`](../../../tools/apex-recall/docs/decision-keys.md).
Validator: `node tools/scripts/validate-decision-keys.mjs`. Add new
keys to the registry before using them in an agent file.
