<!-- ref:orchestrator-handoff-guide-digest-v1 -->

# Orchestrator Handoff Guide — Digest

Compact reference for Orchestrator gate templates and IaC routing.
Default tier loaded by `01-orchestrator.agent.md`. For full prose,
Phase Handoff Document format, escalation paths, and the complete
gate templates with embedded examples, read the full
`orchestrator-handoff-guide.md`.

## IaC Routing (read `iac_tool` from `01-requirements.md`)

| `iac_tool`        | Step 4 (Plan)    | Step 5 (Code)           | Step 6 (Deploy)        |
| ----------------- | ---------------- | ----------------------- | ---------------------- |
| `Bicep` (default) | `05-IaC Planner` | `06b-Bicep CodeGen`     | `07b-Bicep Deploy`     |
| `Terraform`       | `05-IaC Planner` | `06t-Terraform CodeGen` | `07t-Terraform Deploy` |

If `01-requirements.md` does not exist (user enters at Step 4 directly),
ask once: _"Bicep or Terraform?"_ (default: Bicep). Normal flow captures
this in Requirements Phase 2.

## Complexity Routing

After Step 1, read `decisions.complexity` from
`apex-recall show <project> --json`. Default missing values to `"standard"`.

- `simple` / `standard`: present single-pass review result; do not prompt
  for additional passes.
- `complex`: ask _"Run additional adversarial review? (recommended)"_ —
  if yes, follow the full matrix in `adversarial-review-protocol.md`;
  otherwise proceed with single-pass.

If `complexity_matrix` in `workflow-graph.json` lacks an entry for the
current complexity, STOP and ask the user to classify the project.

## Gate Template Skeleton

Write `00-handoff.md` at **every** gate before presenting. This lets
the user resume in a fresh chat without context loss.

```text
{ICON} {PHASE NAME} COMPLETE
Artifact: agent-output/{project}/{filename}
[secondary artifacts on additional lines]
🔍 Challenger Review: {PASS | ⚠️ {N} must-fix / {N} should-fix findings}
   Findings: agent-output/{project}/challenge-findings-{type}.json
✅ Next: {Next Step Name}
[💡 SESSION BREAK RECOMMENDED: …  (only at heavy-context gates: 2, 3)]
❓ {Review prompt + confirm-to-proceed}
```

## Gate Identifiers (per workflow-graph.json)

| Gate | After               | Required content in chat                                 |
| ---- | ------------------- | -------------------------------------------------------- |
| 1    | Step 1 Requirements | Artifact + Challenger findings                           |
| 2    | Step 2 Architecture | Artifact + Cost Estimate + (optional) review summary     |
| 2.5  | Step 3.5 Governance | Artifact + Blockers/Warnings + Challenger findings       |
| 3    | Step 4 IaC Plan     | Plan + dependency/runtime diagrams + deployment strategy |
| 4    | Step 5 IaC Code     | Templates path + validation status + Challenger findings |
| 5    | Step 6 Deploy       | Deployment summary + what-if/plan preview                |
| 6    | Step 7 As-Built     | Documentation suite paths + cost delta                   |
| Post | Lessons             | `09-lessons-learned.json/.md` summary                    |

Heavy-context gates (where SESSION BREAK is recommended): **2** and **3**.
Other gates do not need the break recommendation.

## When to Escalate to Full Guide

Read `orchestrator-handoff-guide.md` (full) when:

- Drafting a new gate template not covered by the skeleton above.
- Investigating a Phase Handoff Document field you don't recognize.
- Debugging a routing decision that the digest doesn't explain.
- Authoring or editing the Orchestrator agent itself.
