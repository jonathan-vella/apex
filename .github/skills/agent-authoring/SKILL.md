---
name: agent-authoring
description: '**WORKFLOW SKILL** — Creates, restructures, and audits GitHub Copilot `.agent.md` and `.prompt.md` files with correct frontmatter, handoffs, model policy, context budgets, and validation. WHEN: "create agent", "author custom agent", "edit agent definition", "agent architecture", "reduce agent tokens", "agent prompt audit". DO NOT USE FOR: routine edits covered by auto-loaded instructions.'
license: MIT
metadata:
  author: jonathan-vella
  version: "1.0"
  category: agent-development
---

# Agent Authoring

Create and restructure Copilot agents without loading extended authoring guidance
into every ordinary agent turn. The thin enforcement layer remains in
[`agent-authoring.instructions.md`](../../instructions/agent-authoring.instructions.md).

## When To Use This Skill

- Create a new `.agent.md` or `.prompt.md`.
- Restructure an oversized or duplicated agent definition.
- Design handoffs or subagent boundaries.
- Select or upgrade an agent model.
- Audit fixed context cost, tool scope, or prompting structure.
- Investigate an agent validation failure requiring more than a local fix.

Do not load this skill for a routine edit where the thin instruction already
states the applicable rule.

## Prerequisites

- Read the target file and its nearest analogous agent once.
- Check `.github/skills/workflow-engine/templates/workflow-graph.json` before
  changing workflow topology.
- Check `.github/model-catalog.json` before changing model labels.
- Preserve user changes and existing runtime contracts.

## Workflow

### 1. Classify The Change

Choose the smallest applicable path:

| Change | Load |
| --- | --- |
| Frontmatter field or handoff correction | [Agent file structure](references/agent-file-structure.md) |
| New agent or major body restructure | [Authoring workflow](references/authoring-workflow.md) |
| Model assignment or effort policy | [Model policy](references/model-policy.md) |
| Tool-heavy runtime or fallback behavior | [Runtime guardrails](references/runtime-guardrails.md) |
| Decision capture behavior | [Decision logging](references/decision-logging.md) |
| Vendor-specific prompt audit | `../vendor-prompting/SKILL.md` |

Load only the references needed for the selected path.

### 2. Establish Ownership

Keep each concern in one place:

- Agent body: role, goal, workflow-specific constraints, output, stop rules.
- Instruction: enforceable rules that apply automatically by file type.
- Skill: on-demand domain workflow and decision guidance.
- Reference: detailed examples, rationale, matrices, and troubleshooting.
- Registry or graph: machine-readable inventory and topology.

Do not copy canonical tables or templates into an agent body.

### 3. Budget Context

- Apply the limits and hand-off framework in
  [`context-optimization.instructions.md`](../../instructions/context-optimization.instructions.md).
- Keep tool lists minimal and handoffs intentional.
- Move long templates to references or templates.
- Prefer one compact structured example.
- Remove prose already supplied by an auto-loaded instruction.
- Estimate fixed cost using body bytes, matched instruction bytes, tool schemas,
  and mandatory skill reads.

Use the `context-management` skill for runtime compression or debug-log audits.

### 4. Implement Incrementally

1. Update frontmatter and the smallest body section first.
2. Run the focused agent validator.
3. Move optional detail into references only after behavior remains valid.
4. Update model registry or workflow graph mirrors when their canonical source
   changes.
5. Update documentation when an agent or skill is added, renamed, or removed.

### 5. Validate

Run:

```bash
npm run validate:agents
npm run lint:vendor-prompting
npm run validate:model-consistency
npm run validate:skills
npm run lint:md
```

For model changes also run `npm run validate:model-catalog` and
`npm run validate:deprecated-models`.

## Output Expectations

Return:

- Files changed and ownership rationale
- Fixed-context reduction when slimming an agent
- Preserved runtime contracts and anchors
- Validation commands and results
- Any documentation or generated inventory updated

## Troubleshooting

| Symptom | Action |
| --- | --- |
| Agent is not discovered | Validate frontmatter, filename, description form, and model syntax |
| Handoff fails validation | Verify target name, allowed fields, and input/output enrichment |
| Skill is reported orphaned | Reference `.github/skills/agent-authoring/SKILL.md` canonically |
| Model consistency fails | Treat agent frontmatter as canonical, then update registry mirrors |
| Context remains large | Remove duplicated instruction prose and move phase-specific detail to references |

## Reference Index

- [Agent file structure](references/agent-file-structure.md)
- [Authoring workflow](references/authoring-workflow.md)
- [Model policy](references/model-policy.md)
- [Runtime guardrails](references/runtime-guardrails.md)
- [Decision logging](references/decision-logging.md)
