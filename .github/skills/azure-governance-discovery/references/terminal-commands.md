<!-- ref:terminal-commands-v1 -->

# Terminal Command Reference — Governance Phase

Pre-built terminal commands for each phase of the governance workflow.
Copy-paste with `{project}` substituted. Target: **≤8 terminal calls total**
(Phase 2.7 inline confirmations add 3 `apex-recall decide` calls).

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

> **Capture overflow**: redirect the jq output to `/tmp/{project}-gov-cmd2.json`
> and read the first ~120 lines with `sed`. The combined query returns
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
  && sed -n '1,120p' /tmp/{project}-gov-cmd2.json
```

## Cmd 3: Phase 2 — Copy preview.md (do NOT read it first)

```bash
\cp -f agent-output/{project}/04-governance-constraints.preview.md \
       agent-output/{project}/04-governance-constraints.md
```

> **Why `\cp -f`**: the dev container ships a `cp -i` shell alias that
> still prompts even when `-f` is passed (the alias adds `-i` after your
> flags). The leading backslash bypasses the alias entirely so the
> command is non-interactive. Apply the same `\mv` pattern wherever
> `mv` appears.

## Cmd 4: Phase 2 — Find annotation placeholders

Run **once** after cp. Shows exactly which lines need annotation.

```bash
grep -n 'AGENT: annotate\|<!-- annotate -->\|<!-- check applicability -->' \
  agent-output/{project}/04-governance-constraints.md || echo "No placeholders found"
```

> **Why the `|| echo ...` suffix is mandatory**: `grep` returns exit code
> `1` on "no match", which under `set -e` aborts the entire batch.
> The `|| echo "No placeholders found"` clause turns the no-match exit
> into a successful zero exit so the runbook continues. See the
> Anti-patterns section below.

Use the output to plan your `apply_patch` calls (max 3 patches total).

## Cmd 5: Phase 2 — Validate artifacts

Run **once** after all annotations are done. Validates JSON parse +
remaining-placeholder count. Artifact markdown lint (H2 order, etc.) is owned
by the lefthook `artifact-validation` pre-commit hook and the `10-Challenger`
review — do not run `npm run lint:artifact-templates` here (see
[`agent-authoring.instructions.md`](../../../instructions/agent-authoring.instructions.md#no-direct-markdownlint-on-agent-output-rule)).

```bash
python3 -m json.tool agent-output/{project}/04-governance-constraints.json > /dev/null \
  && echo "=== Remaining placeholders ===" \
  && (grep -c 'AGENT: annotate\|<!-- annotate -->' \
       agent-output/{project}/04-governance-constraints.md 2>/dev/null || echo 0)
```

The `2>/dev/null || echo 0` suffix protects against a missing artifact
file or zero matches (both would otherwise exit 1 and abort `set -e`
batches). If the JSON parse fails or placeholders remain, fix and re-run
this command (count as cmd 6).

## Cmd 6: Phase 3 — Gate summary

Run **once** to prepare the approval gate presentation.

> Phase 2.7 (Inline Resolution Gate) must run before this command. The
> three required confirmations (RG tag keys + casing, allowed
> locations, RG/resource same-region) are asked via
> `vscode_askQuestions` in a single call and the answers are written
> back to the JSON before this summary is read. The agent records each
> decision with `apex-recall decide --key … --value …` (3 calls), then
> runs this `jq` summary to drive the Approval Gate presentation.

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

- Do NOT run `jq '.tags_required'` and `jq '.allowed_locations'` as separate
  commands — they are both in Cmd 2.
- Do NOT query individual blockers one at a time (`jq '.findings[] | select(.display_name=="X")'`).
  Cmd 2 already returns all blockers.
- Do NOT `sed` or `grep` the preview.md before copying — just run Cmd 3.
- Do NOT run lint more than once unless the first run failed and you fixed something.
- Do NOT run the JSON summary query (Cmd 2) more than once — cache the output mentally.
- Do NOT use bare `grep` at the end of a `set -e` bash block — grep returns
  exit 1 on no-match, which under `set -e` aborts the entire batch. Always
  append `|| true`, `|| echo "<fallback>"`, or pipe to another command.
- Do NOT use bare `cp` / `mv` in dev container runbooks — the `cp -i` /
  `mv -i` shell aliases will prompt for overwrite even with `-f`. Use
  `\cp -f` and `\mv -f` (leading backslash) to bypass aliases.
