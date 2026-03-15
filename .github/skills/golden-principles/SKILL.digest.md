<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Golden Principles (Digest)

Compact reference for agent startup. Read full `SKILL.md` for details.

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

> _See SKILL.md for full content._

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
