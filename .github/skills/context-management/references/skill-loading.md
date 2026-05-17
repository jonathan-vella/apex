<!-- ref:skill-loading-protocol-v1 -->

# Skill Loading Protocol

Skills are single-tier: each skill has exactly one file, `SKILL.md`. There is
no digest or minimal variant. To stay under context budget:

1. **Load each `SKILL.md` only once per session.** Do not re-read a skill
   that is already in context.
2. **Read only the H2 sections needed.** Use `read_file` with a line range
   for known sections rather than loading the full body.
3. **Defer `references/*.md`** — load on demand only when the SKILL.md body
   explicitly points to one.

The runtime compression tier system (full / summarized / minimal) applies
to artifacts in `agent-output/`, not to skills. Skills are always loaded
in their canonical single-tier form.
