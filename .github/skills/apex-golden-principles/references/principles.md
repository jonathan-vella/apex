<!-- ref:principles-v1 -->

# Golden Principles

> Loaded by `apex-golden-principles` SKILL.md. Each principle has a one-line
> rule and a quick test. The SKILL.md keeps a one-line summary table; the
> full rationale and per-principle test live here.

## 1. Repository Is the System of Record

Persist reconstructable project context in the repository rather than relying
on chat history. Current uncommitted user work remains valid and must be preserved;
do not commit without authorization or store secrets in repository files.
Agent outputs go to `agent-output/`, decisions go to ADRs, conventions go to
skills and instructions.

**Test**: Can a new agent session reconstruct full project context from repo files alone?

## 2. Map, Not Manual

Instructions point to deeper sources; never dump everything into context.
`AGENTS.md` is the table of contents. Skills hold deep knowledge. Instructions
enforce rules. No single file should try to be comprehensive.

**Test**: Does each file meet its applicable authoring budget and point to deeper
sources while retaining essential runtime role, safety, approval and stop rules?

## 3. Enforce Invariants, Not Implementations

Set strict boundaries but allow autonomous expression within them. Enforce WHAT must be
true (TLS 1.2, AVM-first, governance compliance), not HOW to achieve it. Agents choose
their implementation path within the invariant envelope.

**Test**: Are rules expressed as constraints ("MUST use managed identity") rather than
scripts ("first create identity, then assign role...")?

## 4. Parse at Boundaries

Validate inputs and outputs at module edges, not in the middle. Each workflow step
validates its prerequisites exist and its outputs conform to templates. Internal logic is
the agent's domain.

**Test**: Does each agent check for required input artifacts before starting? Does each
output pass artifact template validation?

## 5. AVM-First, Security Baseline Always

Prefer Azure Verified Modules for Bicep and Terraform. Apply the security baseline (TLS 1.2,
HTTPS-only, managed identity, no public blob access) to every resource without exception.
These are non-negotiable invariants, not suggestions.

**Test**: Is every resource checked against AVM availability before coding? Does every
resource include the security baseline properties?

## 6. Golden Path Pattern

Prefer shared utilities over hand-rolled helpers. Use the `apex-azure-defaults` skill's
workflow and canonical links: Copilot instructions own fallback defaults and live
governance owns the effective policy contract. Use
`apex-azure-artifacts` templates as the single source of truth for output structure. Don't
reinvent.

**Test**: Are there duplicate conventions across agents? If yes, consolidate into the
appropriate skill.

## 7. Human Taste Gets Encoded

Review feedback becomes documentation, linter rules, or skill updates — not ad-hoc fixes.
When a reviewer catches a pattern issue, the fix is to update the instruction or skill that
should have prevented it.

**Test**: After receiving feedback, was the lesson encoded into a rule (instruction, skill,
or validator) rather than just applied once?

## 8. Context Is Scarce

Every token in the agent's context window must earn its keep. Load required skills
for the current phase, not a universal startup chain. Don't load the full artifact
template reference when you only need one template. Use pointers over inline content.
Reuse unchanged content still available; after compaction or edits, recover missing
required guidance and safety evidence. Never infer tokens from latency.

**Test**: Are skills loaded on demand and measured usage distinguished from estimates?
Does missing context trigger recovery rather than guessed constraints?

## 9. Progressive Disclosure

Start small, point to deeper docs when needed. `AGENTS.md` gives the overview. Skills give
deep knowledge. Instructions give enforcement rules. Templates give exact structure. Each
layer adds detail when the agent needs it.

**Test**: Can an agent complete a basic task by reading only `AGENTS.md` and one skill?
Does it only load more when needed?

## 10. Mechanical Enforcement Over Documentation

If a rule can be a linter check, CI validation, or pre-commit hook, make it one.
Deterministic checks complement runtime role and approval rules; they do not prove
harness attachment, model eligibility, semantic correctness, or human approval.
Artifact hooks and Challenger own artifact lint; agents do not invoke it directly.

**Test**: For each documented rule, is there a corresponding validator in `scripts/` or
`package.json`? If not, should there be?

## 11. Composable Workflows

Keep steps bounded, with explicit inputs, outputs, owner and return paths. The
workflow graph owns routing and review requirements; templates own structure.
Do not mark a step complete merely because an artifact exists or is numbered.

**Test**: Can a partial or resumed step recover its prerequisites and return to
the owning agent without mutating upstream artifacts or skipping reviews?

## 12. Human Approval at Critical Gates

Preserve human-controlled production handoffs and evidence-bound approval gates.
Environment variables, previous unrelated approval, and ADRs cannot authorize
new deployment, destructive work, substitutions, or safety bypasses.

**Test**: Do missing, stale or changed inputs block advancement until the relevant
review and approval are current? Does an unresolved blocker stop in every mode?

## 13. Adversarial Review

Use independent reviewers under the current graph and explicit caller contracts.
Main agents, including `10-Challenger`, are human-selected, never nested workers.
Keep both Step 2 architecture and cost-feasibility reviews; deep review is opt-in.
Unavailable reviewers require a human handoff to `10-Challenger`; missing or empty
output permits exactly one identical-input retry, then human escalation.

**Test**: Are required reviews current, independent and complete with blockers
resolved, without automatic main-agent invocation or invented inline findings?

## 14. Continuous Lessons

Capture process observations during production work and preserve historical
lessons and schema compatibility. Feed confirmed lessons into reviewed guidance
or deterministic checks; do not reinstate retired E2E execution or auto-approval.

**Test**: Are failures and recoveries recorded as evidence, not silently discarded,
and are guidance changes reviewed separately from project completion?

## Canonical Selection And Preservation Map

SK-34 decision: retain the union under this reference, with current production
contracts and strict safety taking precedence. No unique principle is dropped.

| Previous source | Canonical destination | Reason |
| --- | --- | --- |
| Body 1 / reference 1 | 1 | Shared system-of-record rule; preserve user work and secret boundaries |
| Body 2 / reference 2 | 2 | Shared map rule; actual budgets and essential runtime anchors prevail |
| Body 3 / reference 3 | 3 | Preserve invariant-driven autonomy within authorized scope |
| Body 4 / reference 4 | 4 | Preserve prerequisite and output validation |
| Body 5 / reference 5 | 5 | Preserve AVM and security for both IaC tracks |
| Body 6 / reference 6 | 6 | Preserve reuse with correct canonical defaults ownership |
| Reference 7 | 7 | Feedback encoding is distinct from collecting process observations |
| Reference 8 | 8 | Preserve context discipline without suppressing required recovery |
| Reference 9 | 9 | Preserve layered disclosure without assuming runtime attachment |
| Reference 10 | 10 | Preserve mechanical checks without substituting them for approvals |
| Body 7 | 11 | Preserve composability and graph-owned routing |
| Body 8 | 12 | Preserve explicit human approval and strict blocker handling |
| Body 9 | 13 | Preserve independent reviews under current invocation boundaries |
| Body 10 | 14 | Preserve continuous observations and historical compatibility |

## How to Apply These Principles

### For Agents

1. Load this reference when applying the principles; phase-required guidance still governs execution
2. Use the principles as a decision framework when uncertain
3. When two approaches are equally valid, choose the one that better aligns with these principles

### For Contributors

1. When adding a new instruction, check if it could be a linter rule instead (Principle 10)
2. When adding content to an instruction, check its applicable authoring budget (Principle 2)
3. When fixing a bug, encode the lesson into a rule (Principle 7)

### For Code Review

1. Does the change follow the golden path or create a new one? (Principle 6)
2. Does it add context load or reduce it? (Principle 8)
3. Does it enforce invariants or prescribe implementation? (Principle 3)
