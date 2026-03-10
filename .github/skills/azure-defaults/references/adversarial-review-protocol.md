<!-- ref:adversarial-review-protocol-v2 -->

# Adversarial Review Protocol

Standard protocol for invoking `challenger-review-subagent` across
all agents. Each agent specifies its own `artifact_path`,
`artifact_type`, pass count, and review focus — this reference
defines the shared mechanics.

## 3-Pass Rotating Lenses

Used for critical artifacts (architecture, implementation plan, code).

| Pass | `review_focus`             | Lens Description                                            |
| ---- | -------------------------- | ----------------------------------------------------------- |
| 1    | `security-governance`      | Policy compliance, identity, network isolation, encryption  |
| 2    | `architecture-reliability` | WAF balance, SLA feasibility, failure modes, dependencies   |
| 3    | `cost-feasibility`         | SKU sizing, pricing realism, budget alignment, reservations |

> **Pass 2 is conditional**: Only invoke pass 2 if pass 1 returned ≥1 `must_fix` OR ≥2 `should_fix`.
> If pass 1 returns 0 `must_fix` and <2 `should_fix`, skip pass 2 and proceed to approval gate.
>
> **Pass 3 is conditional**: Only invoke pass 3 if pass 2 returned ≥1 `must_fix` item.
> If pass 2 returns zero `must_fix`, skip pass 3 and proceed. This saves ~4 min per review cycle.

### Early Exit

Passes cascade — each gate checks the previous pass's severity:

1. **After pass 1**: If 0 `must_fix` AND <2 `should_fix` → skip passes 2 and 3. Approve.
2. **After pass 2**: If 0 `must_fix` → skip pass 3. Approve with pass 1+2 findings.
3. **After pass 3**: Full 3-pass review complete. Approve with all findings.

Log skipped passes and reasons in `00-session-state.json` `review_audit` (when available).

## 1-Pass Comprehensive

Used for supporting artifacts (governance, cost estimate, deployment).

- `review_focus` = `comprehensive`
- `pass_number` = `1`
- `prior_findings` = `null`

## Conditional Governance Review (Step 4)

Governance review is conditional on project complexity:

- **`simple` projects**: Skip standalone governance review entirely (no custom policies expected).
  Pass 1 of the plan review (security-governance lens) covers governance basics.
- **`standard`/`complex` projects**: Keep 1-pass governance review as Phase 4.3.
  Pass 1 of the plan review (security-governance lens) MUST also check the
  `04-governance-constraints.md` artifact for completeness.

## Complexity Classification Criteria

Read `decisions.complexity` from `00-session-state.json`. The Requirements agent classifies;
the Conductor validates. If missing from old sessions, default to `"standard"`.

| Tier         | Criteria                                                                             |
| ------------ | ------------------------------------------------------------------------------------ |
| **Simple**   | ≤3 resource types, single region, no custom Azure Policy, single environment         |
| **Standard** | 4–8 resource types, multi-region OR multi-env (not both extreme), ≤3 custom policies |
| **Complex**  | >8 resource types, multi-region + multi-env, >3 custom policies, hub-spoke topology  |

## Review Matrix (Complexity-Based Pass Counts)

| Complexity | Step 1 (Req)     | Step 2 (Arch)                    | Step 4 (Plan)                             | Step 5 (Code)                    | Step 6 (Deploy)                     |
| ---------- | ---------------- | -------------------------------- | ----------------------------------------- | -------------------------------- | ----------------------------------- |
| simple     | 1× comprehensive | 1× comprehensive                 | 1× comprehensive (no gov)                 | 1× comprehensive                 | Skip                                |
| standard   | 1× comprehensive | 2× rotating (pass 3 conditional) | 1× gov + 2× rotating (pass 3 conditional) | 2× rotating (pass 3 conditional) | 1× (conditional on Step 5 findings) |
| complex    | 1× comprehensive | 3× rotating                      | 1× gov + 3× rotating                      | 3× rotating                      | 1×                                  |

## Subagent Invocation Template

For each pass, invoke `challenger-review-subagent` via `#runSubagent`:

- `artifact_path` = `agent-output/{project}/{artifact-filename}`
- `project_name` = `{project}`
- `artifact_type` = per-artifact value
- `review_focus` = per-pass value from table above
- `pass_number` = `1` / `2` / `3`
- `prior_findings` = `null` for pass 1; compact string for 2-3

Write each result to
`agent-output/{project}/challenge-findings-{artifact_type}-pass{N}.json`.

## Model Routing

Use the right model for each review lens:

| Pass                   | Lens                                | Subagent                           | Model         | Rationale                                                                                    |
| ---------------------- | ----------------------------------- | ---------------------------------- | ------------- | -------------------------------------------------------------------------------------------- |
| Pass 1 / Comprehensive | security-governance / comprehensive | `challenger-review-subagent`       | GPT-5.4       | Deep logical reasoning for policy cross-reference, finding inconsistencies                   |
| Pass 2                 | architecture-reliability            | `challenger-review-codex-subagent` | GPT-5.3-Codex | WAF/failure mode analysis is structured and checklist-driven. Fast execution.                |
| Pass 3                 | cost-feasibility                    | `challenger-review-codex-subagent` | GPT-5.3-Codex | Quantitative SKU analysis. Structured output strength. Matches cost-estimate-subagent model. |

## Batch Invocation (Complex Projects Only)

When `decisions.complexity == "complex"` AND pass 1 returns ≥1 `must_fix`
(guaranteeing all 3 passes), **batch passes 2+3** into a single subagent call:

1. Invoke `challenger-review-batch-subagent` with:
   - `batch_lenses`: `[{pass 2: architecture-reliability}, {pass 3: cost-feasibility}]`
   - `prior_findings`: compact string from pass 1
2. The batch subagent runs lenses internally in sequence (pass 3 sees pass 2 findings)
3. Returns `{ "batch_results": [{pass2_json}, {pass3_json}] }`
4. Parent writes each result to its own `challenge-findings-*-pass{N}.json` file
5. Extract both `compact_for_parent` strings for the approval gate summary

**When NOT to batch**: For `standard` projects, continue with sequential
single-pass invocations — conditional gating (skip pass 3 if pass 2 has
0 must_fix) is more valuable than batching at that tier.

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
(from the `context-shredding` skill) based on current context usage:

- **< 60% context**: Pass full artifact
- **60–80% context**: Pass only key H2 sections (resource list, SKU decisions,
  WAF scores, compliance requirements, budget). Drop detailed prose.
- **> 80% context**: Pass only the decision summary from `00-session-state.json`
  `decisions` field plus the resource list.

This reduces challenger input by 40–70% and cuts turn latency proportionally.

## Approval Gate Summary Template

After all passes, present a merged summary:

```text
⚠️ Adversarial Review Summary ({N} passes)
  must_fix: {total} | should_fix: {total} | suggestions: {total}
  Key concerns: {top 2-3 must_fix titles across all passes}
  Findings:
    - agent-output/{project}/challenge-findings-{type}-pass1.json
    - ...
```
