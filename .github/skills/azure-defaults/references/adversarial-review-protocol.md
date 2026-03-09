<!-- ref:adversarial-review-protocol-v1 -->

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

> **Pass 3 is conditional**: Only invoke pass 3 if pass 2 returned ≥1 `must_fix` item.
> If pass 2 returns zero `must_fix`, skip pass 3 and proceed. This saves ~4 min per review cycle.

## 1-Pass Comprehensive

Used for supporting artifacts (governance, cost estimate, deployment).

- `review_focus` = `comprehensive`
- `pass_number` = `1`
- `prior_findings` = `null`

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
