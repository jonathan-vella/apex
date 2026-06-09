# Agent Adversarial Checklist (L4)

Red-team lenses for `.agent.md` definitions, subagents, and prompt files. The
`challenger-review-subagent` is artifact-type scoped to `agent-output/` infrastructure artifacts and
**cannot target `.agent.md`** — so the Layer 4 pass in
`tools/apex-prompts/utility-prompts/assess-agents.prompt.md` uses a generic adversarial Explore
subagent against this checklist instead.

Each lens lists what to probe and how to rate severity. Record findings as
`{ lens, severity, evidence, recommendation }`. The worst finding drives the dimension-8 score per
`agent-scorecard-rubric.md`. Severity ladder: `blocker` > `high` > `medium` > `low`.

> Read-only. Cite a concrete line, field, or handoff — no speculation. A lens with nothing to flag is
> a clean pass, not an invitation to invent a finding.

## Lens 1 — Role overlap & boundary

- Does another agent claim the same responsibility or routing keywords? Compare the `description` and
  body against workflow neighbors and same-track siblings (e.g. 06b/06t, 07b/07t).
- Is the does / doesn't-do explicit, or could a router send the wrong work here?
- Severity: `high` if two agents would both match a common request; `medium` for thin anti-scope;
  `low` for cosmetic phrasing overlap.

## Lens 2 — Missing guardrails (destructive actions without a gate)

- Does the body invoke or describe a hard-to-reverse action (`az ... delete`, `rm -rf`,
  `terraform apply`/`destroy`, `git push --force`, resource deletion) without an explicit approval
  gate or human-in-the-loop?
- Are deploy/apply steps gated behind a what-if / plan preview and an approval checkpoint?
- Severity: `blocker` for an ungated destructive action; `high` for a gate that is implied but not
  enforced; `medium` for a reversible action missing a confirmation note.

## Lens 3 — Prompt-injection surface

- Does the agent ingest untrusted content (tool output, fetched web pages, file contents, issue/PR
  bodies, deployment logs) and then act on it without a trust boundary?
- Could injected text in that content redirect the agent (e.g. "ignore previous instructions",
  fake handoff directives, forged approvals)?
- Is there an instruction to treat tool/file output as data, not commands?
- Severity: `high` when untrusted output can trigger a state-changing action; `medium` when it can
  only steer narrative output; `low` when the surface exists but is read-only and bounded.

## Lens 4 — Instruction conflicts

- Do two parts of the body contradict (e.g. "always ask" vs "never prompt"; "edit in place" vs
  "read-only")?
- Does the body conflict with an applicable instruction file or the operating frame (edits an
  upstream artifact it should treat as read-only)?
- Severity: `high` for a conflict that changes whether a destructive/irreversible step runs;
  `medium` for an ambiguous ordering; `low` for redundant restatement.

## Lens 5 — Handoff integrity

- Does every handoff target an agent that actually exists (cross-check the registry and
  `agents:` frontmatter)?
- Is there a silent model downgrade (handoff overrides the target to a weaker model) or a redundant
  override that masks the target's own model?
- Do handoffs carry the input artifact and the expected output path (handoff enrichment)?
- Severity: `blocker` for a handoff to a non-existent target; `high` for a silent downgrade on a
  safety-critical step; `medium` for missing input/output enrichment.

## Lens 6 — Tool over-grant

- Does the `tools` list grant capabilities the role never uses (e.g. `execute`/terminal on a
  read-only analysis agent, write tools on a reviewer)?
- Does a subagent hold broader tools than its single-purpose contract needs?
- Severity: `high` for write/execute on an agent that should be read-only; `medium` for an unused
  broad grant; `low` for a marginally wide but plausible list.

## Lens 7 — Failure modes

- What happens when a delegated subagent fails, a validation step fails, or a review ceiling is hit?
  Is there an explicit recovery, escalation, or stop path?
- Does the agent loop (retry the same failing approach) instead of escalating?
- For subagents: is the structured return shape defined for the failure case, not just success?
- Severity: `high` for no failure path on a step that can block the workflow; `medium` for an
  underspecified retry budget; `low` for missing cosmetic error messaging.

## Lens 8 — Stop-rule completeness

- Are the stopping conditions explicit and reachable (especially GPT-5.5 `# Stop rules`, which must
  be non-empty)?
- Could the agent run past its mandate (e.g. start editing during a read-only planning pass, proceed
  past an approval gate)?
- Is "done" defined by a concrete artifact / state, not a vibe?
- Severity: `high` for a missing or empty stop rule on an agent that can take irreversible action;
  `medium` for vague completion criteria; `low` for stylistic gaps.

## Recording template

```json
{
  "agent_id": "07b-bicep-deploy",
  "lens": "missing-guardrails",
  "severity": "high",
  "evidence": "Body runs `azd provision` without an explicit approval gate before apply.",
  "recommendation": "Require a what-if preview + human approval checkpoint before provisioning."
}
```

Map the worst severity to the dimension-8 band: `blocker`/`high` → 0–1, `medium` → 3, none → 5.
