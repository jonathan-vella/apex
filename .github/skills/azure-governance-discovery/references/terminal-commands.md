<!-- ref:terminal-commands-v1 -->

# Terminal Command Reference — Governance Phase

Pre-built terminal commands for each phase of the governance workflow.
Copy-paste with `{project}` substituted. Target: **≤8 terminal calls total**.

## Cmd 1: Phase 1 — Run discovery

```bash
set +H && python .github/skills/azure-governance-discovery/scripts/discover.py \
    --project {project} \
    --out agent-output/{project}/04-governance-constraints.json \
    --arch agent-output/{project}/02-architecture-assessment.md
```

Append `--refresh` only if user requested re-discovery.
Read **only the first stdout line** (JSON status). Ignore the rest.

## Cmd 2: Phase 2 — Combined JSON verification + annotation data

Run **once** after discover.py completes. Returns everything needed for
annotation decisions in a single query — do NOT issue follow-up jq queries.

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
}' agent-output/{project}/04-governance-constraints.json
```

## Cmd 3: Phase 2 — Copy preview.md (do NOT read it first)

```bash
cp agent-output/{project}/04-governance-constraints.preview.md \
   agent-output/{project}/04-governance-constraints.md
```

## Cmd 4: Phase 2 — Find annotation placeholders

Run **once** after cp. Shows exactly which lines need annotation.

```bash
grep -n 'AGENT: annotate\|<!-- annotate -->\|<!-- check applicability -->' \
  agent-output/{project}/04-governance-constraints.md || echo "No placeholders found"
```

Use the output to plan your `apply_patch` calls (max 3 patches total).

## Cmd 5: Phase 2 — Validate artifacts

Run **once** after all annotations are done. Combines JSON validation + lint.

```bash
python3 -m json.tool agent-output/{project}/04-governance-constraints.json > /dev/null \
  && npm run lint:artifact-templates \
  && echo "=== Remaining placeholders ===" \
  && grep -c 'AGENT: annotate\|<!-- annotate -->' \
       agent-output/{project}/04-governance-constraints.md 2>/dev/null || echo "0"
```

If lint fails, fix and re-run this command (count as cmd 6).

## Cmd 6: Phase 3 — Gate summary

Run **once** to prepare the approval gate presentation.

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

```bash
jq '.steps["3_5"].status = "complete" | .steps["3_5"].completed = (now | strftime("%Y-%m-%dT%H:%M:%SZ"))' \
  agent-output/{project}/00-session-state.json > /tmp/ss.json \
  && mv /tmp/ss.json agent-output/{project}/00-session-state.json
```

Note: if `jq` `now` is unavailable, use `apply_patch` on the session state instead.

## Anti-patterns

- Do NOT run `jq '.tags_required'` and `jq '.allowed_locations'` as separate
  commands — they are both in Cmd 2.
- Do NOT query individual blockers one at a time (`jq '.findings[] | select(.display_name=="X")'`).
  Cmd 2 already returns all blockers.
- Do NOT `sed` or `grep` the preview.md before copying — just run Cmd 3.
- Do NOT run lint more than once unless the first run failed and you fixed something.
- Do NOT run the JSON summary query (Cmd 2) more than once — cache the output mentally.
