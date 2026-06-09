<!-- ref:cross-model-rules-v1 -->

# Cross-Model Rules

Rules that apply regardless of model family — handoff design,
prompt↔agent sync, language calibration, decision logging.

## Rule R-X-1 — Prompt model must match target agent model

> Source: [openai/skills upgrade-guide.md](.snapshots/openai-upgrade-guide.md)
> "Pair each model usage with its prompt surface."

**Rule** (`legacy-001` / `prompt-model-sync-001`): a `.prompt.md`
file's `model:` value must equal the target agent's `model:` value.

```yaml
# .prompt.md
---
agent: 03-Architect
model: "Claude Opus 4.8" # MUST match agent's model:
---
```

**Verification**: `node tools/scripts/validate-agents.mjs --only=vendor-prompting`
emits `legacy-001` warning on mismatch.

## Rule R-X-2 — No redundant handoff model overrides

> Source: same upgrade-guide; "do not automatically upgrade older or
> ambiguous model usages that may be intentionally pinned."

**Rule** (`legacy-002`): `handoffs[].model` should NOT be set when it
matches the target agent's own `model:`. Redundant overrides become
stale during model rollouts.

```yaml
# Bad
handoffs:
  - agent: 03-Architect
    model: "Claude Opus 4.8"   # redundant — matches Architect's own
    prompt: "..."

# Good
handoffs:
  - agent: 03-Architect
    prompt: "..."
```

## Rule R-X-3 — Frontmatter model style

> Source: [agent-authoring.instructions.md](../../../instructions/agent-authoring.instructions.md#L113-L120)
> (existing repo convention).

**Rule** (`frontmatter-model-style-001`):

- `.agent.md` files: array form — `model: ["Claude Opus 4.7"]`
- `.prompt.md` files: string form — `model: "Claude Opus 4.7"`
- Bareword form for labels with parenthetical qualifiers (e.g.,
  `model: Claude Foo (suffix)`) is **forbidden** — YAML misparses parens.

**Severity**: error. This breaks frontmatter loading entirely.

## Rule R-X-4 — Handoff prompt enrichment

> Source: [agent-authoring.instructions.md](../../../instructions/agent-authoring.instructions.md#L471-L478)
> (existing repo convention).

**Rule** (`handoff-enrichment-001`): every `handoffs[].prompt` must
contain BOTH:

1. An **input reference** — regex `agent-output/.+\.md` OR the
   literal `Input:` (case-insensitive).
2. An **output reference** — regex `Output:` OR an explicit save
   path.

**Example (good)**:

```yaml
handoffs:
  - agent: 03-Architect
    prompt: "Create a WAF assessment based on agent-output/{project}/01-requirements.md.
      Output: 02-architecture-assessment.md and 03-des-cost-estimate.md."
```

**Example (bad — missing input)**:

```yaml
handoffs:
  - agent: 03-Architect
    prompt: "Begin architecture review."
```

## Rule R-X-5 — Decision logging

> Source: [agent-authoring.instructions.md](../../../instructions/agent-authoring.instructions.md)
> "Decision Logging" section.

**Rule** (reviewer-only): when an agent makes a significant choice
(architecture pattern, SKU/tier selection, deployment strategy, IaC
tool choice, security approach, networking topology, rejected
viable alternative), append an entry to `decision_log` in
`00-session-state.json`. Format:

```json
{
  "id": "D001",
  "step": 2,
  "agent": "03-Architect",
  "timestamp": "2026-05-04T15:10:00Z",
  "title": "B1 App Service over Container Apps",
  "choice": "App Service Plan B1 (Linux)",
  "alternatives": ["Container Apps Consumption", "AKS"],
  "rationale": "Budget < EUR1000/mo; no container expertise.",
  "impact": "No container registry needed; simplifies deployment"
}
```

Not auto-validated (no per-step inspector). Reviewer checklist item
in [checklists.md](checklists.md).

## Rule R-X-6 — Few-shot example placement

> Source: Anthropic "Use examples effectively" + OpenAI guide
> on prompt examples.

**Reviewer hint**: examples should appear at the END of the agent
body (both vendors agree). Claude wraps in `<example>` /
`<examples>`; GPT-5.5 uses fenced code blocks. Keep examples under
12 lines.

## Rule R-X-7 — Language calibration

> Source: [Anthropic doc](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices)
> "Tell Claude what to do instead of what not to do."
> Plus [OpenAI guide](.snapshots/openai-prompting-guide.md)
> "Avoid unnecessary absolute rules."

**Rule** (`cross-language-density-001`, both vendors): density of
absolute words ("ALWAYS", "NEVER", "MUST", "HARD RULE") must not
exceed 0.05 outside permitted contexts (security baseline,
governance, approval gate, non-negotiable).

**Permitted prose contexts** (detected by paragraph keywords):

- `security baseline` paragraphs (e.g., TLS 1.2, HTTPS-only)
- `governance` paragraphs (Azure Policy compliance)
- `approval gate` paragraphs (workflow checkpoints)
- `non-negotiable` paragraphs (explicit invariants)

Outside these, prefer decision rules over absolutes.

## Rule R-X-8 — Model deprecation

> Source: [validate-models.mjs](../../../../tools/scripts/validate-models.mjs) (`--only=deprecated`).

**Rule** (`model-deprecation-001`): agents/prompts using a deprecated
model label get warned. Cross-references the existing deprecation
list. New deprecations land in
[validate-models.mjs](../../../../tools/scripts/validate-models.mjs) (`--only=deprecated`);
this rule re-emits them as `vendor-prompting` findings for unified
audit reports.
