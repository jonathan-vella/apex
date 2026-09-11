# Context Window Optimization Report

**Generated**: {timestamp}
**Project**: {project_name}
**Sessions Analyzed**: {session_count}
**Total Requests**: {total_requests}

---

## Executive Summary

| Metric                          | Current        | Target        | Impact   |
| ------------------------------- | -------------- | ------------- | -------- |
| Avg turns per task              | {current}      | {target}      | {impact} |
| Avg latency (primary model)     | {current_ms}ms | {target_ms}ms | {impact} |
| Long turns (>15s)               | {count}        | {target}      | {impact} |
| Estimated wasted tokens/session | {estimate}     | {target}      | {impact} |
| Latency trend                   | {trend}        | stable        | {impact} |

## Session Profiles

| Session      | Requests | Avg Latency | Max Latency | Long Turns | Bursts | Trend   |
| ------------ | -------- | ----------- | ----------- | ---------- | ------ | ------- |
| {session_id} | {count}  | {avg}ms     | {max}ms     | {count}    | {n}    | {trend} |

---

## Findings

### Critical — Context Overflow Risk

| #   | Agent/File | Issue | Evidence | Recommendation |
| --- | ---------- | ----- | -------- | -------------- |
|     |            |       |          |                |

### High — Significant Token Waste

| #   | Agent/File | Issue | Evidence | Recommendation |
| --- | ---------- | ----- | -------- | -------------- |
|     |            |       |          |                |

### Medium — Optimization Opportunity

| #   | Agent/File | Issue | Evidence | Recommendation |
| --- | ---------- | ----- | -------- | -------------- |
|     |            |       |          |                |

### Low — Minor Improvements

| #   | Agent/File | Issue | Evidence | Recommendation |
| --- | ---------- | ----- | -------- | -------------- |
|     |            |       |          |                |

---

## Recommended Hand-Off Points

| Current Agent | Breakpoint | New Subagent Proposal | Est. Context Saved |
| ------------- | ---------- | --------------------- | ------------------ |
|               |            |                       |                    |

## Instruction Consolidation

| Action                      | Files Affected | Est. Token Savings |
| --------------------------- | -------------- | ------------------ |
| Narrow `applyTo` glob       |                |                    |
| Move to skill `references/` |                |                    |
| Deduplicate content         |                |                    |

---

## Agent-Specific Recommendations

### {Agent Name}

- **Issue**: {description}
- **Evidence**: {log data or file metrics}
- **Recommendation**: {specific actionable fix}
- **Estimated Impact**: {token savings or latency improvement}

---

## Implementation Priority

| Priority | Action | Effort | Impact |
| -------- | ------ | ------ | ------ |
| P0       |        |        |        |
| P1       |        |        |        |
| P2       |        |        |        |
| P3       |        |        |        |

---

## Methodology Notes

- Latency-to-token estimates are heuristic (see SKILL.md § Latency Heuristics)
- Token counts for files use ~1 token per 4 characters approximation
- Tool schema costs estimated at ~75 tokens per tool definition
- Analysis covers debug logs only — does not access model-level usage APIs
