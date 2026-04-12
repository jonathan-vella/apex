<!-- ref:adversarial-review-protocol-v2 -->

# Adversarial Review Protocol

Standard protocol for invoking `challenger-review-subagent` across
all agents. Each agent specifies its own `artifact_path`,
`artifact_type`, pass count, and review focus — this reference
defines the shared mechanics.

## Multi-Model Convention

Agent `agents:` arrays list the `challenger-review-subagent`.
All review passes use the same subagent — the selection rules in
`challenger-selection-rules.md` determine which pass runs
based on the lens type and complexity tier.

## Review Default: Single-Pass Comprehensive

By default, all steps use a **1-pass comprehensive review**. Multi-pass rotating
lens reviews are **opt-in** — recommended for complex projects but not required.

At each gate, the Orchestrator checks `decisions.complexity`:

- **simple/standard**: Present single-pass result directly
- **complex**: Ask: "Run additional adversarial review? (recommended for complex projects)"

If the user opts in, the full complexity matrix applies (see below).

## Multi-Pass Rotating Lenses (Opt-In)

Available for critical artifacts (architecture, implementation plan, code)
when explicitly requested or when the Orchestrator recommends it for complex projects.

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

Used for requirements (Step 1). Always runs, regardless of complexity.

- `review_focus` = `comprehensive`
- `pass_number` = `1`
- `prior_findings` = `null`

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

Read `decisions.complexity` from `00-session-state.json`. The Requirements agent classifies;
the Orchestrator validates. If missing from old sessions, default to `"standard"`.

| Tier         | Criteria                                                                             |
| ------------ | ------------------------------------------------------------------------------------ |
| **Simple**   | ≤3 resource types, single region, no custom Azure Policy, single environment         |
| **Standard** | 4–8 resource types, multi-region OR multi-env (not both extreme), ≤3 custom policies |
| **Complex**  | >8 resource types, multi-region + multi-env, >3 custom policies, hub-spoke topology  |

## Review Matrix (Complexity-Based Pass Counts)

**Default**: All steps use 1-pass comprehensive review. Multi-pass is opt-in.

| Complexity | Step 1 (Req)     | Step 2 (Arch)                                   | Step 4 (Plan)                   | Step 5 (Code)                   |
| ---------- | ---------------- | ----------------------------------------------- | ------------------------------- | ------------------------------- |
| simple     | 1× comprehensive | 1× comprehensive + 1 cost                       | skip (opt-in: 1× comprehensive) | skip (opt-in: 1× comprehensive) |
| standard   | 1× comprehensive | 1× comprehensive + 1 cost (opt-in: 2× rotating) | skip (opt-in: 2× rotating)      | skip (opt-in: 2× rotating)      |
| complex    | 1× comprehensive | 1× comprehensive + 1 cost (opt-in: 3× rotating) | ask user (opt-in: 2× rotating)  | ask user (opt-in: 3× rotating)  |

> **Opt-in prompt**: At Steps 4 and 5 for complex projects, the Orchestrator asks:
> "Run additional adversarial review? (recommended for complex projects)"
> For simple/standard projects, challenger review at Steps 4 and 5 is skipped by default.

> **Steps without adversarial review**: Step 3 (Design), Step 3.5 (Governance),
> Step 6 (Deploy), Step 7 (As-Built). Governance is machine-discovered data;
> deploy previews are validated by Azure tooling (what-if / terraform plan);
> the human approves at each gate.

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

The model used for each review lens is determined by the `challenger-review-subagent` frontmatter (source of truth):

| Pass                   | Lens                                | Subagent                     | Rationale                                                                  |
| ---------------------- | ----------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| Pass 1 / Comprehensive | security-governance / comprehensive | `challenger-review-subagent` | Deep logical reasoning for policy cross-reference, finding inconsistencies |
| Pass 2                 | architecture-reliability            | `challenger-review-subagent` | WAF/failure mode analysis. Structured checklist-driven.                    |
| Pass 3                 | cost-feasibility                    | `challenger-review-subagent` | Quantitative SKU analysis. Matches cost-estimate-subagent model.           |

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

## Batch Invocation (Complex Projects Only)

When `decisions.complexity == "complex"` AND pass 1 returns ≥1 `must_fix`
(guaranteeing all 3 passes), **batch passes 2+3** into a single subagent call:

1. Invoke `challenger-review-subagent` with:
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
    - agent-output/{project}/challenge-findings-{type}-pass1.json
    - ...
```
