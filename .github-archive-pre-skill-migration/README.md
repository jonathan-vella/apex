# Pre-Skill Migration Archive

> **Created**: 2026-02-03
> **Retention**: 90 days (delete after 2026-05-04)
> **Purpose**: Backup of agents and skills before agent-to-skill migration

## Contents

- `agents/` - All 9 agent definitions before migration
- `skills/` - All 7 skill definitions before migration

## Migration Summary

| Agent | Action | New Location |
|-------|--------|--------------|
| diagram.agent.md | → Skill | `.github/skills/azure-diagrams/` (enhanced) |
| adr.agent.md | → Skill | `.github/skills/azure-adr/` (new) |
| docs.agent.md | → Skill | `.github/skills/azure-workload-docs/` (new) |
| requirements.agent.md | Keep | `.github/agents/` |
| architect.agent.md | Keep | `.github/agents/` |
| bicep-plan.agent.md | Keep | `.github/agents/` |
| bicep-code.agent.md | Keep | `.github/agents/` |
| deploy.agent.md | Keep | `.github/agents/` |
| diagnose.agent.md | Keep | `.github/agents/` |

## Rollback Instructions

If rollback is needed before 2026-05-04:

```bash
# Restore agents
cp -r .github-archive-pre-skill-migration/agents/* .github/agents/

# Restore skills
cp -r .github-archive-pre-skill-migration/skills/* .github/skills/
```

## Deletion Notice

This archive may be deleted after **2026-05-04** if migration is successful.
