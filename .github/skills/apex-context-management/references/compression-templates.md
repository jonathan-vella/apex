<!-- ref:compression-templates-v1 -->

# Compression Templates

Per-artifact compression rules at each tier. H2 sections to keep/drop
and character budget targets.

## 01-requirements.md

| Tier       | Keep H2 Sections                                                                              | Budget      |
| ---------- | --------------------------------------------------------------------------------------------- | ----------- |
| full       | All                                                                                           | No limit    |
| summarized | Project Overview, Functional Requirements, Non-Functional Requirements, Technical Constraints | ~3000 chars |
| minimal    | Project Overview (first paragraph only), Key Decisions table                                  | ~500 chars  |

## 02-architecture-assessment.md

| Tier       | Keep H2 Sections                                                      | Budget      |
| ---------- | --------------------------------------------------------------------- | ----------- |
| full       | All                                                                   | No limit    |
| summarized | Architecture Pattern, WAF Assessment, Key Decisions, Resource Summary | ~4000 chars |
| minimal    | Architecture Pattern (first paragraph), Key Decisions table           | ~500 chars  |

## 03-des-cost-estimate.md

| Tier       | Keep H2 Sections                             | Budget      |
| ---------- | -------------------------------------------- | ----------- |
| full       | All                                          | No limit    |
| summarized | Cost Summary, Monthly Total, Key Assumptions | ~2000 chars |
| minimal    | Monthly Total line only                      | ~200 chars  |

## 04-implementation-plan.md

| Tier       | Keep H2 Sections                                                       | Budget      |
| ---------- | ---------------------------------------------------------------------- | ----------- |
| full       | All                                                                    | No limit    |
| summarized | Module Inventory, Deployment Strategy, Parameter Summary, Dependencies | ~5000 chars |
| minimal    | Module Inventory table, Deployment Strategy (first paragraph)          | ~800 chars  |

## 04-governance-constraints.md

| Tier       | Keep H2 Sections                                    | Budget      |
| ---------- | --------------------------------------------------- | ----------- |
| full       | All                                                 | No limit    |
| summarized | Deny Policies, Mandatory Tags, Network Restrictions | ~3000 chars |
| minimal    | Deny Policies table only                            | ~500 chars  |

## 05-implementation-reference.md

| Tier       | Keep H2 Sections                                        | Budget      |
| ---------- | ------------------------------------------------------- | ----------- |
| full       | All                                                     | No limit    |
| summarized | Files Generated, Validation Results, Key Configurations | ~3000 chars |
| minimal    | Files Generated list only                               | ~400 chars  |

## 06-deployment-summary.md

| Tier       | Keep H2 Sections                                     | Budget      |
| ---------- | ---------------------------------------------------- | ----------- |
| full       | All                                                  | No limit    |
| summarized | Deployment Result, Resources Deployed, Configuration | ~3000 chars |
| minimal    | Deployment Result (status + resource count)          | ~300 chars  |

## 07-\* (As-Built Documents)

As-built documents are terminal — they are not loaded by downstream agents.
Compression is only needed when the As-Built agent loads predecessor artifacts.

## General Rules

- When compressing, preserve all **tables** within kept sections (tables are dense)
- Drop **code blocks** first (they are verbose)
- Keep **decision rationale** over implementation details
- Keep **resource names and SKUs** over configuration details
- Always preserve the document title (H1) and first paragraph
- At the `minimal` tier, prefer reading `decision_log` from `apex-recall show <project> --json`
  over loading full artifact prose for rationale behind prior choices

## Gate-Boundary `/clear` Handoff Contract

VS Code Copilot Chat owns its own conversation history — no agent API
can evict prior turns. The only realistic main-agent input-token
saving comes from a user-driven `/clear` at every Gate boundary,
resumed via `apex-recall`. This contract is the headline mechanism for
Plan 01 (token-reduction).

### Required end-of-gate line

When `01-Orchestrator` finishes presenting an **accepted** Gate
(Requirements / Architecture / Governance / Plan / Code / Deploy), the
final assistant message **MUST** end with this line, verbatim — no
paraphrase, no extra punctuation:

```text
Run `/clear`, then switch the chat agent picker to `01-Orchestrator` and send `resume <project>` to continue Step N+1.
```

Substitute the real project name and step number. Place the line as
the very last line of the message, on its own line, after the gate
summary and the handoff button.

> VS Code custom agents activate via the agent picker, not via `@name`
> chat-participant syntax. See
> <https://code.visualstudio.com/docs/copilot/customization/custom-agents>.

### Required precondition: durable checkpoint

The orchestrator **MUST** run
`apex-recall checkpoint <project> <step> <phase> --json` (and any
remaining `apex-recall decide` / `complete-step` calls) **before**
emitting the resume line. The user's `/clear` is destructive — any
state not in `apex-recall` is lost.

### Required resume path

In the new chat the user picks `01-Orchestrator` from the agent picker
and sends `resume <project>`:

1. First tool call: `apex-recall show <project> --json`.
2. Loads only the compact handoff JSON (~1–2 KB).
3. Reads `00-handoff.md` only if a gate-specific artifact path is needed.
4. Skips re-reading completed-step artifacts unless the user explicitly
   asks to revisit them.

### Validator

`tools/scripts/validate_orchestrator_handoff.py` parses
`.github/agents/01-orchestrator.agent.md` and asserts the verbatim
resume line is documented in at least one Gate-acceptance context.
Wired into `npm run validate:agents` (hard fail).

### Tradeoff

The user clicks `/clear` and pastes the resume line 3–4 times per
workflow project (once per Gate). Acceptable per the captured user
decision (Plan 01, May 2026). Smoke-run target: post-`/clear` session
begins at ≤45 K input tokens on its first call (per Plan 01 Phase 2a
verification).
