# Vendor-Prompting Audit Report

> Template for audit reports produced by the
> [audit-procedure.md](../references/audit-procedure.md). Save filled
> reports to `tmp/vendor-prompting-audits/{name}-{YYYYMMDD}.md`.

## Target

- **File**: `<path/to/file.agent.md>`
- **Audit date**: `YYYY-MM-DD`
- **Auditor**: `<name or agent>`

## Frontmatter snapshot

| Field            | Value                      |
| ---------------- | -------------------------- |
| `name`           | `<value>`                  |
| `model`          | `<raw value>`              |
| `user-invocable` | `<true / false / default>` |
| `agents`         | `<count or list>`          |
| `tools`          | `<count>`                  |
| `handoffs`       | `<count>`                  |

## Classification

- **Family**: `<claude-opus | claude-sonnet | gpt-5.5 | ...>`
- **Status (per family-support.md)**: `<enforced | warn-only | reviewer-only>`
- **Reasoning**: `<which substring matched>`

## Automated findings

| Rule ID     | Severity | Message     | Source         |
| ----------- | -------- | ----------- | -------------- |
| `<rule-id>` | error    | `<message>` | `<source_url>` |
| `<rule-id>` | warn     | `<message>` | `<source_url>` |

## Manual findings

| Checklist item              | Rule ID     | Result | Notes                              |
| --------------------------- | ----------- | ------ | ---------------------------------- |
| `<item from checklists.md>` | `<rule-id>` | YES    | `<observation>`                    |
| `<item from checklists.md>` | `<rule-id>` | NO     | `<observation + remediation hint>` |

## Severity summary

| Severity | Count |
| -------- | ----- |
| error    | `<n>` |
| warn     | `<n>` |
| info     | `<n>` |

## Recommended fixes

For each NO / non-clean finding, list the smallest change that
brings the agent into compliance:

1. **Rule `<id>`**: `<one-line fix>`. Diff:

   ```diff
   - <old>
   + <new>
   ```

## Verdict

`APPROVED | NEEDS_REVISION | REJECTED`

**Justification**: 1-2 sentence rationale referencing the gate
applied.

**Gate applied**:

- APPROVED if `errors == 0` AND `warnings ≤ 5`.
- NEEDS_REVISION otherwise (per-rule remediation above).
- REJECTED if any violation will break runtime (frontmatter parsing,
  prefill on Claude 4.6+, deprecated model).
