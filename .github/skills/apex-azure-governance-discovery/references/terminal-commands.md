<!-- ref:terminal-commands-v1 -->

# Terminal Command Reference — Governance Phase

Pre-built terminal commands for each phase of the governance workflow.
Substitute the confirmed project and subscription. Call budgets are advisory;
required evidence recovery, validation and approval always take precedence.

## Cmd 1: Phase 1 — Run discovery

```bash
set +H && python .github/skills/apex-azure-governance-discovery/scripts/discover.py \
    --project {project} \
    --subscription {subscription-id} \
    --out agent-output/{project}/04-governance-constraints.json \
    --arch agent-output/{project}/02-architecture-assessment.md
```

Append `--refresh` for explicit refresh, stale/invalid evidence, signature drift,
or changed discovery inputs. Read the first stdout JSON line and exit status
for routing; capture diagnostics and inspect the envelope for decisions.
COMPLETE collection alone does not establish governance readiness or approval.

## Cmd 2: Phase 2 — Combined JSON verification + annotation data

Run after discovery. This is an index, not complete annotation evidence.
Read required sections and every blocker, including overflow beyond the first page.
Targeted follow-up queries are required when evidence is missing, stale or truncated.

> **Capture overflow**: redirect the jq output to `/tmp/{project}-gov-cmd2.json`
> and read it in bounded ranges until required evidence is complete. The combined query returns
> 2000+ lines on real subscriptions, which overflows VS Code's terminal
> capture buffer and silently truncates the model's view.

```bash
jq '{
  discovery_status,
  findings_count: (.findings | length),
  tags_required,
  allowed_locations,
  blockers: [.findings[] | select(.classification == "blocker") |
    {display_name, effect, resource_types, required_value,
     azurePropertyPath, bicepPropertyPath,
     assignment_parameters: (.assignment_parameters // {})}],
  auto_remediate: [.findings[] | select(.classification == "auto-remediate") |
    {display_name, effect, category, resource_types}],
  informational_count: ([.findings[] | select(.classification == "informational")] | length),
  categories: ([.findings[] | .category] | unique),
  assignment_count: (.assignment_inventory | length)
}' agent-output/{project}/04-governance-constraints.json > /tmp/{project}-gov-cmd2.json \
  && wc -l /tmp/{project}-gov-cmd2.json
```

Use the file-reading tool to recover all required ranges; never treat a preview
or truncated terminal response as the complete blocker set.

## Cmd 3: Phase 2 — Prepare The Governed Markdown

Read the current preview and existing destination before editing. Use file-editing
tools to create or update the final artifact, preserving user annotations and the
canonical H2 schema. A changed architecture can regenerate the preview even on
a collector cache hit; do not overwrite an existing final artifact blindly.

## Cmd 4: Phase 2 — Find annotation placeholders

Check the current artifact for annotation placeholders; propagate read errors.

```bash
grep -n 'AGENT: annotate\|<!-- annotate -->\|<!-- check applicability -->' \
  agent-output/{project}/04-governance-constraints.md
```

Interpret grep status explicitly: 0 means placeholders found, 1 means no matches,
and 2 means a read/command error that blocks validation. Do not hide errors with
`|| true` or claim missing files contain zero placeholders. Use targeted edits.

## Cmd 5: Phase 2 — Validate artifacts

Run **once** after all annotations are done. Validates JSON parse +
remaining-placeholder count. Artifact markdown lint (H2 order, etc.) is owned
by the lefthook `artifact-validation` pre-commit hook and the `10-Challenger`
review — do not run `npm run lint:artifact-templates` here (see
[`agent-authoring.instructions.md`](../../../instructions/agent-authoring.instructions.md#no-direct-markdownlint-on-agent-output-rule)).

```bash
python3 -m json.tool agent-output/{project}/04-governance-constraints.json > /dev/null
```

Then repeat Cmd 4 with explicit exit-status handling. JSON parsing alone is not
schema, signature, completeness, policy, confirmation, or review validation.
Missing files, invalid JSON, unresolved placeholders or blockers prevent progression.

## Cmd 6: Phase 3 — Gate summary

Run **once** to prepare the approval gate presentation.

> Resolve Phase 2.7 topics (new answers or proven-current reuse), validate edits,
> then run/revalidate Phase 2.5 review before this summary. Follow
> [inline-resolution-gate.md](inline-resolution-gate.md); unknown answers block.

```bash
jq '{
  discovery_status,
  subscription_id,
  total_assignments: .discovery_summary.assignment_kept,
  blockers: .discovery_summary.blocker_count,
  auto_remediate: .discovery_summary.auto_remediate_count,
  informational: .discovery_summary.informational_count,
  audit: .discovery_summary.audit_count,
  exempted: .discovery_summary.exempted_count,
  tags_required: [.tags_required[] | .name],
  allowed_locations,
  blocker_names: [.findings[] | select(.classification == "blocker") | .display_name]
}' agent-output/{project}/04-governance-constraints.json
```

## Cmd 7: Phase 3 — Update session state

Only after current required evidence/reviews, resolved blockers and explicit
human approval. A summary, file presence or zero blocker count is not completion.

```bash
apex-recall complete-step {project} 3_5 --json
```

## Cmd 8: Phase 1 — Bulk-record blocker findings (Phase 5 optimisation)

Replaces 10–30 per-finding `apex-recall finding --add` calls with a
single pipe. Use immediately after Cmd 1 (discovery) on subscriptions
with non-trivial Deny-policy counts.

```bash
# Substitute {project} with the actual project name.
# The literal '-' arg means "read from stdin"; the pipe is mandatory.
jq -c '[.findings[] | select(.classification=="blocker") | "Deny: " + .display_name]' \
  agent-output/{project}/04-governance-constraints.json \
  | apex-recall finding {project} --add-many - --json
```

Empty-blocker subscriptions are a no-op (`{"appended": 0}`). Findings
are append-only — no de-duplication against existing entries.

## Anti-patterns

- Reuse unchanged available query results, but recover missing required evidence
  after compaction, truncation or source changes.
- Do not suppress command failures or treat a zero-match query as proof of completeness.
- Do not overwrite user annotations or change governed H2 headings.
- Do not invoke artifact lint directly; hooks and Challenger own that check.
