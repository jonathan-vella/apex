---
name: golden-principles
description: Agent-first operating principles adapted from Harness Engineering philosophy. The 10 invariants that govern how agents work in this repository.
---

# Golden Principles

These 10 principles govern how every agent operates in this repository.
They are adapted from the Harness Engineering philosophy for agent-driven
infrastructure development.

---

## The 10 Principles

### 1. Repository Is the System of Record

All context must live in-repo, not in external docs or chat history.
If knowledge isn't committed to the repository, it doesn't exist for agents.
Agent outputs go to `agent-output/`, decisions go to ADRs, conventions go to
skills and instructions.

**Test**: Can a new agent session reconstruct full project context from repo files alone?

---

### 2. Map, Not Manual

Instructions point to deeper sources; never dump everything into context.
`AGENTS.md` is the table of contents. Skills hold deep knowledge. Instructions
enforce rules. No single file should try to be comprehensive.

**Test**: Does each context-loaded file stay under 200 lines? Does it point to
deeper sources rather than inline them?

---

### 3. Enforce Invariants, Not Implementations

Set strict boundaries but allow autonomous expression within them.
Enforce WHAT must be true (TLS 1.2, AVM-first, governance compliance),
not HOW to achieve it. Agents choose their implementation path within
the invariant envelope.

**Test**: Are rules expressed as constraints ("MUST use managed identity")
rather than scripts ("first create identity, then assign role...")?

---

### 4. Parse at Boundaries

Validate inputs and outputs at module edges, not in the middle.
Each workflow step validates its prerequisites exist and its outputs
conform to templates. Internal logic is the agent's domain.

**Test**: Does each agent check for required input artifacts before starting?
Does each output pass artifact template validation?

---

### 5. AVM-First, Security Baseline Always

Prefer Azure Verified Modules over hand-rolled Bicep.
Apply the security baseline (TLS 1.2, HTTPS-only, managed identity,
no public blob access) to every resource without exception.
These are non-negotiable invariants, not suggestions.

**Test**: Is every resource checked against AVM availability before coding?
Does every resource include the security baseline properties?

---

### 6. Golden Path Pattern

Prefer shared utilities over hand-rolled helpers.
Use the `azure-defaults` skill as the single source of truth for naming,
regions, tags, and service matrices. Use `azure-artifacts` templates as
the single source of truth for output structure. Don't reinvent.

**Test**: Are there duplicate conventions across agents? If yes, consolidate
into the appropriate skill.

---

### 7. Human Taste Gets Encoded

Review feedback becomes documentation, linter rules, or skill updates —
not ad-hoc fixes. When a reviewer catches a pattern issue, the fix is
to update the instruction or skill that should have prevented it.

**Test**: After receiving feedback, was the lesson encoded into a rule
(instruction, skill, or validator) rather than just applied once?

---

### 8. Context Is Scarce

Every token in the agent's context window must earn its keep.
Load skills progressively: `golden-principles` → `azure-defaults` →
task-specific skills. Don't load the full artifact template reference
when you only need one template. Use pointers over inline content.

**Test**: Does each agent load ≤ 5 instruction files? Are skills loaded
on-demand rather than all at once?

---

### 9. Progressive Disclosure

Start small, point to deeper docs when needed.
`AGENTS.md` gives the overview. Skills give deep knowledge.
Instructions give enforcement rules. Templates give exact structure.
Each layer adds detail when the agent needs it.

**Test**: Can an agent complete a basic task by reading only `AGENTS.md`
and one skill? Does it only load more when needed?

---

### 10. Mechanical Enforcement Over Documentation

If a rule can be a linter check, CI validation, or pre-commit hook,
make it one. Documentation is for humans; machines enforce rules.
The `validate-artifact-templates.mjs` script is more reliable than
a paragraph saying "use the correct H2 headings."

**Test**: For each documented rule, is there a corresponding validator
in `scripts/` or `package.json`? If not, should there be?

---

## How to Apply These Principles

### For Agents

1. Read this skill FIRST, before `azure-defaults`
2. Use the principles as a decision framework when uncertain
3. When two approaches are equally valid, choose the one that better
   aligns with these principles

### For Contributors

1. When adding a new instruction, check if it could be a linter rule instead (Principle 10)
2. When adding content to an instruction, check if it exceeds 200 lines (Principle 2)
3. When fixing a bug, encode the lesson into a rule (Principle 7)

### For Code Review

1. Does the change follow the golden path or create a new one? (Principle 6)
2. Does it add context load or reduce it? (Principle 8)
3. Does it enforce invariants or prescribe implementation? (Principle 3)
