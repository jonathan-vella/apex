<!-- ref:audit-procedure-v1 -->

# Audit Procedure

End-to-end protocol for auditing a single `.agent.md` or `.prompt.md`
against vendor prompting best practices. ~10-15 minutes per agent.

## Inputs

- Path to one `.agent.md` or `.prompt.md` file.
- Working copy of this repo with `node`, `gh`, and `git` available.

## Outputs

- A filled-in audit report (template:
  [assets/audit-template.md](../assets/audit-template.md)) saved to
  `tmp/vendor-prompting-audits/{agent-name}-{YYYYMMDD}.md`.
- A verdict: APPROVED, NEEDS_REVISION, or REJECTED.

## Procedure

### Step 1 — Read frontmatter

Open the target file. Capture:

- `name`
- `model` (raw value, including any quoting)
- `user-invocable` (default `true` if missing)
- `agents` (subagent list)
- `tools[]` count
- `handoffs[]` count

If `model:` is missing or in bareword form (`model: Claude Opus 4.7
(High reasoning)` without quotes/array), STOP — verdict is REJECTED.
Frontmatter parsing is broken.

### Step 2 — Classify model family

Apply the algorithm from [SKILL.md](../SKILL.md) "Model-Family
Detection":

```python
m = model.lower() if isinstance(model, str) else model[0].lower()
if "claude opus" in m: family = "claude-opus"
elif "claude sonnet" in m: family = "claude-sonnet"
elif "claude haiku" in m: family = "claude-haiku"
elif "claude" in m: family = "claude"
elif "gpt-5.5" in m: family = "gpt-5.5"
elif "gpt-5.4" in m: family = "gpt-5.4"
elif "gpt-5.3" in m or "codex" in m: family = "gpt-codex"
elif "gpt-4o" in m: family = "gpt-4o"
else: family = "unknown"
```

Cross-check the family's `status` from
[family-support.md](family-support.md). If `out-of-scope`, stop and
record "skipped — out of scope family".

### Step 3 — Load matching checklist

Open [checklists.md](checklists.md). Use:

- Agent column for `.agent.md`, prompt column for `.prompt.md`.
- The cross-vendor section ALWAYS.
- The family-specific section matching step 2.

### Step 4 — Run the validator

```bash
node tools/scripts/validate-agents.mjs \
  --only=vendor-prompting \
  --format=json \
  > /tmp/lint-out.json

# Filter for the target file
jq '.findings[] | select(.file == "<path>")' /tmp/lint-out.json
```

Capture each finding's `ruleId`, `severity`, `message`, `sourceUrl`.

### Step 5 — Manual pass

For every checklist item from step 3:

- If the validator already covered it (rule ID present in step 4
  output), copy the finding.
- If not, perform the verification hint manually and record YES/NO
  - 1-line note.

Reviewer-only rules (no validator binding) MUST be assessed
manually.

### Step 6 — Produce the report

Open [assets/audit-template.md](../assets/audit-template.md).
Fill in:

1. File path, model family, classification reasoning.
2. Automated findings table (from step 4).
3. Manual findings table (from step 5).
4. Severity summary (counts of error / warn / info).
5. Verdict per gate:
   - **APPROVED** if `errors == 0` AND `warnings ≤ 5`.
   - **NEEDS_REVISION** otherwise (with per-rule remediation).
   - **REJECTED** if any rule violation will break runtime
     (frontmatter parsing, prefill on Claude 4.6+, deprecated model).

Save to `tmp/vendor-prompting-audits/{name}-{YYYYMMDD}.md`.

## Bulk audit (all agents)

```bash
mkdir -p tmp/vendor-prompting-audits
node tools/scripts/validate-agents.mjs \
  --only=vendor-prompting \
  --format=json \
  > tmp/vendor-prompting-audits/_bulk.json

# Per-agent breakdown
jq -r '.findings | group_by(.file) | .[] | {
  file: .[0].file,
  errors: ([.[] | select(.severity=="error")] | length),
  warns: ([.[] | select(.severity=="warn")] | length),
  rules: [.[].ruleId] | unique
}' tmp/vendor-prompting-audits/_bulk.json
```

For the live-audit gate (Phase 8 of the implementation plan, item #50),
reject the release if:

- Any agent has `errors > 0`, OR
- Average `warns` across all agents > 5.
