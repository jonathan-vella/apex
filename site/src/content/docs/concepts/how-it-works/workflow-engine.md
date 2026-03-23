---
title: "Workflow Engine and Quality Systems"
description: "Workflow DAG, quality gates, and review cycles"
---

## Workflow Engine

<img src="https://images.unsplash.com/photo-1504384308090-c894fdcc538d?q=80&w=1200&auto=format&fit=crop"
  height="250" style="object-fit: cover; border-radius: 8px;"
  alt="Technology workflow visualization representing the workflow engine"><br/>

### The DAG Model

The workflow is encoded as a machine-readable directed acyclic graph in
`workflow-graph.json`:

```mermaid
flowchart TD



    S1["step-1: Requirements"]
    G1{{"gate-1: Approval"}}:::gate
    S2["step-2: Architecture"]
    G2{{"gate-2: Approval"}}:::gate
    S3["step-3: Design"]
    S35["step-3.5: Governance"]
    G25{{"gate-2.5: Approval"}}:::gate
    S4B["step-4b: Bicep Plan"]
    S4T["step-4t: TF Plan"]
    G3{{"gate-3: Approval"}}:::gate
    S5B["step-5b: Bicep Code"]
    S5T["step-5t: TF Code"]
    G4{{"gate-4: Validation"}}:::gate
    S6B["step-6b: Bicep Deploy"]
    S6T["step-6t: TF Deploy"]
    G5{{"gate-5: Approval"}}:::gate
    S7["step-7: As-Built"]:::endNode

    S1 --> G1 --> S2 --> G2
    G2 --> S3
    S3 --> S35
    S35 --> G25
    G25 --> S4B & S4T
    S4B & S4T --> G3
    G3 --> S5B & S5T
    S5B & S5T --> G4
    G4 --> S6B & S6T
    S6B & S6T --> G5
    G5 --> S7
```

Each node has a type (`agent-step`, `gate`, `subagent-fan-out`, `validation`), and each
edge has a condition (`on_complete`, `on_skip`, `on_fail`). Conditional routing at IaC
nodes is governed by the `decisions.iac_tool` field.

:::note[Read-only workflow graph]
The workflow DAG is auto-loaded by the Conductor. Users do not edit
`workflow-graph.json` directly. To customise the workflow, modify agent
definitions or skills instead.
:::

### Gates and Approval Points

Five mandatory gates require explicit human confirmation before the workflow advances:

| Gate | After  | Blocks Until                                      |
| ---- | ------ | ------------------------------------------------- |
| 1    | Step 1 | User approves requirements                        |
| 2    | Step 2 | User approves architecture and cost estimate      |
| 3    | Step 4 | User approves implementation plan                 |
| 4    | Step 5 | Automated validation passes (lint, build, review) |
| 5    | Step 6 | User approves deployment and verifies resources   |

### IaC Routing

The `iac_tool` field in `01-requirements.md` determines which track is activated.
Steps 4b, 5b, 6b form the Bicep track; steps 4t, 5t, 6t form the Terraform track.
Only one track is active for a given project.

### Session State and Resume

The `00-session-state.json` file (schema v2.0) provides atomic state tracking:

```json
{
  "schema_version": "2.0",
  "project": "my-project",
  "current_step": 2, // (1)!
  "lock": {
    "owner_id": "copilot-session-abc123", // (2)!
    "heartbeat": "2026-03-04T10:15:00Z",
    "attempt_token": "550e8400-e29b-41d4-a716-446655440000" // (3)!
  },
  "steps": {
    "2": {
      "status": "in_progress",
      "sub_step": "phase_2_waf",
      "claim": {
        "owner_id": "copilot-session-abc123",
        "heartbeat": "2026-03-04T10:15:00Z",
        "attempt_token": "550e8400-e29b-41d4-a716-446655440000",
        "retry_count": 0,
        "event_log": []
      }
    }
  }
}
```

1. Tracks which step is active — the Conductor uses this for resume
2. Claim-based locking prevents concurrent sessions from corrupting state
3. Unique token per attempt — stale heartbeats are auto-recovered

The claim model prevents concurrent sessions from corrupting state. Stale heartbeats
(older than `stale_threshold_ms`, default 5 minutes) are automatically recovered.

### Session Break Protocol

At Gates 2 and 3, the Conductor recommends starting a fresh VS Code Copilot Chat
session. Long-running sessions (3+ hours) experience forced context summarisations
that lose critical decision context. The Session Break Protocol:

1. Conductor writes current state to `00-session-state.json`
2. Conductor writes `00-handoff.md` with human-readable summary
3. Conductor prints a "SESSION BREAK RECOMMENDED" message
4. User starts a new chat, invokes Conductor again
5. Conductor reads `00-session-state.json`, finds the next pending step, and resumes

This was driven by real-world observation: the nordic-fresh-foods end-to-end test
experienced 5 forced context summarisations in a single 3h39m session.

## Quality and Safety Systems

### Validation Scripts

Every convention is backed by a machine-enforceable check. The validation suite runs
via two parallel groups: `validate:_node` (Node.js
validators) and `validate:_external` (external tool validators):

| Category            | Validators                                                                                |
| ------------------- | ----------------------------------------------------------------------------------------- |
| Markdown            | `lint:md`, `lint:links:docs`                                                              |
| Artefact format     | `lint:artifact-templates`, `lint:h2-sync`, `fix:artifact-h2`                              |
| Agent quality       | `lint:agent-frontmatter`, `lint:agent-body-size`                                          |
| Skill quality       | `lint:skills-format`, `lint:skill-size`, `lint:skill-references`, `lint:orphaned-content` |
| Instruction quality | `lint:instruction-frontmatter`, `validate:instruction-refs`                               |
| Governance          | `lint:governance-refs`, `lint:mcp-config`                                                 |
| Infrastructure      | `lint:terraform-fmt`, `validate:terraform`                                                |
| Session state       | `validate:session-state`, `validate:session-lock`                                         |
| Registry/config     | `validate:workflow-graph`, `validate:agent-registry`, `validate:skill-affinity`           |
| Code quality        | `lint:json`, `lint:python`, `lint:yaml`                                                   |
| VS Code config      | `validate:vscode`                                                                         |
| Meta                | `lint:version-sync`, `lint:deprecated-refs`, `lint:docs-freshness`, `lint:glob-audit`     |

All validators run via `npm run validate:all`.

### Git Hooks (Pre-Commit and Pre-Push)

**Pre-commit** (sequential, via lefthook): Validates staged files only — markdown lint,
link checks, H2 sync, artefact templates, agent frontmatter, instruction frontmatter,
Python lint, Terraform format and validate.

**Pre-push** (parallel, via lefthook): Diff-based domain routing. The `diff-based-push-check.sh`
script categorises changed files and runs only matching validators:

- `*.bicep` → Bicep build + lint
- `*.tf` → Terraform fmt + validate
- `*.agent.md` → Agent frontmatter + body size
- `*.instructions.md` → Instruction frontmatter
- `SKILL.md` → Skills format + skill size
- `*.json` → JSON syntax
- `*.py` → Ruff lint

### Circuit Breaker

:::danger[Automatic Safety Net]
The circuit breaker halts runaway agent loops before they cause damage.
If you see a `blocked` finding, investigate before retrying.
:::

The circuit breaker pattern protects against runaway agent loops during deployment:

| Anomaly Pattern     | Detection Threshold | Action                         |
| ------------------- | ------------------- | ------------------------------ |
| Error repetition    | 3 consecutive       | Halt, write `blocked` finding  |
| Empty response loop | 3 consecutive       | Halt, escalate to human        |
| Timeout cascade     | 3 consecutive       | Halt, check auth               |
| What-if oscillation | 2 cycles            | Halt, flag resource conflict   |
| Auth failure loop   | 2 consecutive       | Halt, prompt re-authentication |

### Context Compression

The context-shredding system defines three compression tiers for artifact loading:

| Tier         | Trigger    | Strategy                                   |
| ------------ | ---------- | ------------------------------------------ |
| `full`       | < 60% used | Load entire artefact                       |
| `summarized` | 60–80%     | Key H2 sections only (tables preserved)    |
| `minimal`    | > 80%      | Decision summaries only (< 500 characters) |

:::caution[Partially implemented — know the limits]
**What works today:**

- **Pre-built skill variants** — `SKILL.digest.md` and `SKILL.minimal.md` files
  exist on disk for key skills, generated and validated by scripts
  (`generate-skill-digests.mjs`, `validate-skill-digests.mjs`).
- **Hardcoded compaction checkpoints** — agents like the Architect (Phase 2.5)
  and Terraform Planner (Phase 3.6) have fixed points in their bodies where they
  write a summary and switch to minimal skill loading. These are positional, not
  dynamic.
- **`compact_for_parent` carry-forward** — the challenger subagent's JSON output
  contract limits inter-pass data to a ~200-character string, preventing context
  bloat across multi-pass reviews.

**What does not work today:**

- **Dynamic tier selection** — the 60%/80% thresholds rely on the LLM estimating
  its own context consumption. VS Code Copilot provides no API for agents to
  query actual token usage. The LLM has no reliable way to know whether it is at
  55% or 75% of its context window, so tier triggers are effectively best-effort.
- **Automatic artifact compression** — the per-artifact compression templates
  (`compression-templates.md`) describe which H2 sections to keep per tier, but
  no code enforces this. Compression depends on the LLM reading the template,
  deciding its tier, and selectively extracting sections. In practice, LLMs tend
  to read entire files.

The hardcoded compaction checkpoints in agent bodies are the most reliable
mechanism. The dynamic tier system is a design intent that nudges LLM behaviour
but is not deterministic.
:::

When the `challenger-review-subagent` loads predecessor artefacts for review, it is
instructed to apply the same 3-tier compression: at the `summarized` tier, preserving
only resource list, SKUs, WAF scores, compliance matrix, and budget sections; at
`minimal`, using only the `decisions` field from `00-session-state.json` plus the
resource list. Whether the LLM follows these instructions consistently varies —
the `compact_for_parent` carry-forward between passes is the part that reliably works.

### Copilot Hooks

The project uses 3 Copilot hooks (`.github/hooks/`) that intercept agent actions
at runtime:

| Hook                       | Trigger        | Purpose                                                              |
| -------------------------- | -------------- | -------------------------------------------------------------------- |
| `block-dangerous-commands` | `PreToolUse`   | Blocks destructive terminal commands (`rm -rf`, `git push --force`)  |
| `post-edit-format`         | `PostToolUse`  | Auto-formats files after agent edits (whitespace, trailing newlines) |
| `session-start-audit`      | `SessionStart` | Audits session context at startup (environment, auth status)         |

Hooks are defined in `hooks.json` files with type (`command`), path to shell script,
and timeout. They run automatically — agents do not invoke them explicitly.

---

:::tip[Further Reading]

- [System Architecture](architecture.md) — the multi-step workflow, Conductor pattern, dual IaC tracks
- [Core Concepts](four-pillars.md) — agents, skills, instructions, and configuration registries
- [Agent Architecture](agents.md) — handoffs, the Challenger pattern, context shredding
- [MCP Integration](mcp-integration.md) — MCP servers and how agents invoke tools
  :::
