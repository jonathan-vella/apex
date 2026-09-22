<!-- ref:skill-loading-protocol-v1 -->

# Skill Loading Protocol

Skills are single-tier: each skill has exactly one file, `SKILL.md`. There is
no digest or minimal variant. To stay under context budget:

1. **Reuse unchanged guidance available in context.** After compaction, edits,
   or a new chat, reload missing required guidance before acting. A read budget
   never permits guessing or skipping safety constraints.
2. **Read only the H2 sections needed.** Use `read_file` with a line range
   for known sections rather than loading the full body.
3. **Defer `references/*.md`** — load on demand only when the SKILL.md body
   explicitly points to one.

The runtime compression tier system (full / summarized / minimal) applies
to artifacts in `agent-output/`, not to skills. Skills are always loaded
in their canonical single-tier form.
