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

Parse actual YAML with the shared parser. Agent array and prompt string model
forms are APEX conventions, not YAML parser limitations. Check every exact catalog
label; documented platform-qualified handoff overrides are allowed. Missing
prompt models may inherit a known custom agent or the Local picker. Unknown
custom targets and malformed explicit labels fail; do not invent a model to pass.

### Step 2 — Classify model family

Use `classifyModel()` from `tools/scripts/validate-agents.mjs` on every label in
order, including custom-agent inheritance. Do not duplicate a first-entry-only
classifier or add fallbacks. Sol/Terra/Luna use the APEX Markdown convention;
the pinned generic advice is not model-specific vendor evidence. Preserve exact
`gpt-5.6-sol` and unknown metadata.

Cross-check the family's `status` from
[family-support.md](family-support.md). If `out-of-scope`, stop and
record "skipped — out of scope family".

### Step 3 — Load matching checklist

Open [checklists.md](checklists.md). Use:

- Agent column for `.agent.md`, prompt column for `.prompt.md`.
- The cross-vendor section ALWAYS.
- Every applicable family-specific section from step 2. For workers use a bounded
  role contract rather than mandatory personality or main-agent body sections.

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

During concurrent agent edits, use isolated fixture tests instead of treating a
whole-tree scan as stable evidence. Offline review does not refresh vendor
sources, probe models, or certify native Local/Host behavior.

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
