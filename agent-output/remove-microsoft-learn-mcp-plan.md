# Plan: Remove Microsoft Learn MCP Server

## TL;DR

Remove the `microsoft-learn` MCP server and its 3 dependent skills from the project — they are now bundled with the `ms-azuretools.vscode-azure-github-copilot` extension. Update all references across config, agents, docs, skills, and validation scripts (31 files total). Leave agent-output URLs untouched.

**Branch**: `chore/remove-microsoft-learn-mcp` (create before any changes)

---

## Phase 1: MCP Server Removal (2 files)

1. Remove `microsoft-learn` server entry from `.vscode/mcp.json` (lines 7-10)
2. Remove `default_microsoft_learn` definition and `servers.setdefault("microsoft-learn", ...)` from `.devcontainer/post-create.sh` (lines 250-270)

## Phase 2: Delete 3 Skills (3 directories)

3. Delete directory `.github/skills/microsoft-docs/` (SKILL.md only)
4. Delete directory `.github/skills/microsoft-code-reference/` (SKILL.md only)
5. Delete directory `.github/skills/microsoft-skill-creator/` (SKILL.md only)

## Phase 3: Registry & Affinity Cleanup (2 files)

6. Remove `microsoft-docs` entries from `.github/agent-registry.json` (lines 43, 65, 76)
7. Remove `microsoft-docs` and `microsoft-code-reference` from `.github/skill-affinity.json` (7 entries across lines 23, 37, 59, 69, 79, 89, 124) — ensure arrays stay valid after entry removal

## Phase 4: Agent Definition Updates (4 files)

8. `.github/agents/03-architect.agent.md` line 162 — remove instruction to read `microsoft-docs` SKILL.md
9. `.github/agents/06b-bicep-codegen.agent.md` line 104 — remove reference to `microsoft-code-reference` SKILL.md
10. `.github/agents/06t-terraform-codegen.agent.md` line 114 — remove reference to `microsoft-code-reference` SKILL.md
11. `.github/agents/09-diagnose.agent.md` line 139 — remove instruction to read `microsoft-docs` SKILL.md

## Phase 5: Prompt File Fix (1 file) — from Review CRITICAL-4

12. `.github/prompts/plan-docsPeerReview.prompt.md` line 5 — remove `'microsoft-learn/*'` from tools list

## Phase 6: Documentation Updates (11 files)

13. `.github/copilot-instructions.md` lines 41-43 — remove 3 skill rows from Skills table
14. `AGENTS.md` line 192 — update MCP server list from `(github, microsoft-learn, azure-pricing, terraform)` to `(github, azure-pricing, terraform)`
15. `.github/skills/README.md` lines 35, 40-42 — remove Learn MCP callout + 3 skill rows
16. `docs/how-it-works/mcp-integration.md`:
    - Line 9: change "five MCP servers" → "four MCP servers"
    - Line 43: remove `A --> M2["Learn MCP"]:::mcp` from Mermaid diagram
    - Line 48: remove `M2 --> L["learn.microsoft.com"]` edge
    - Lines 68-83: remove entire "Microsoft Learn MCP Server" section
17. `docs/prompt-guide/reference.md` lines 101-131 — remove 3 skill subsections
18. `docs/prompt-guide/index.md` lines 86-88 — remove 3 skill rows from table
19. `docs/how-it-works/agents.md` line 44 — remove `microsoft-docs` from Architect skills column
20. `docs/how-it-works/skills-and-instructions.md` line 45 — remove 3 skills from Documentation category
21. `.devcontainer/README.md` line 37 — remove Microsoft Learn MCP bullet
22. `docs/faq.md` line 83 — remove "Microsoft Learn" from MCP server list
23. `.github/instructions/docs.instructions.md` lines 88-90 — remove 3 skill rows from integration table

## Phase 7: Skill Cross-References (3 files)

24. `.github/skills/copilot-customization/references/mcp-servers.md` line 143 — remove `microsoft-learn` row
25. `.github/skills/copilot-customization/references/custom-instructions.md` line 115 — remove Learn MCP query reference
26. `.github/skills/copilot-customization/SKILL.md` line 120 — remove Learn MCP freshness check reference

## Phase 8: Validation Script Updates (2 files)

27. `scripts/validate-mcp-config.mjs` line 28 — remove `microsoft-learn` from `requiredServers` (keep `["github"]`)
28. `scripts/validate-skill-size.mjs` line 26 — remove `microsoft-skill-creator` from `KNOWN_OVERSIZED`

## Phase 9: Changelog (1 file)

29. `CHANGELOG.md` — add removal entry under appropriate version

## Phase 10: Verification

30. Run `npm run validate:all`
31. Run `grep -rn "microsoft-learn" --include="*.{json,md,mjs,sh}" . --exclude-dir=agent-output --exclude-dir=node_modules` — expect 0 hits
32. Run `grep -rn "microsoft-docs\|microsoft-code-reference\|microsoft-skill-creator" .github/ scripts/ docs/ .vscode/ .devcontainer/` — expect 0 hits

---

## Relevant Files (31 files)

### Config (2)

- `.vscode/mcp.json` — remove microsoft-learn server entry
- `.devcontainer/post-create.sh` — remove default_microsoft_learn setup block

### Skills to Delete (3)

- `.github/skills/microsoft-docs/SKILL.md`
- `.github/skills/microsoft-code-reference/SKILL.md`
- `.github/skills/microsoft-skill-creator/SKILL.md`

### Registry/Affinity (2)

- `.github/agent-registry.json` — remove microsoft-docs from 3 agents
- `.github/skill-affinity.json` — remove microsoft-docs (5) + microsoft-code-reference (2)

### Agent Definitions (4)

- `.github/agents/03-architect.agent.md` — line 162
- `.github/agents/06b-bicep-codegen.agent.md` — line 104
- `.github/agents/06t-terraform-codegen.agent.md` — line 114
- `.github/agents/09-diagnose.agent.md` — line 139

### Prompt Files (1)

- `.github/prompts/plan-docsPeerReview.prompt.md` — line 5, remove microsoft-learn/* tool

### Documentation (11)

- `.github/copilot-instructions.md` — remove 3 skill rows
- `AGENTS.md` — update MCP server list
- `.github/skills/README.md` — remove Learn MCP callout + 3 rows
- `docs/how-it-works/mcp-integration.md` — Mermaid diagram, "five"→"four", remove section
- `docs/prompt-guide/reference.md` — remove 3 subsections
- `docs/prompt-guide/index.md` — remove 3 table rows
- `docs/how-it-works/agents.md` — update Architect skills column
- `docs/how-it-works/skills-and-instructions.md` — update Documentation category
- `.devcontainer/README.md` — remove Learn MCP bullet
- `docs/faq.md` — remove "Microsoft Learn" from MCP list
- `.github/instructions/docs.instructions.md` — remove 3 integration table rows

### Skill Cross-References (3)

- `.github/skills/copilot-customization/references/mcp-servers.md`
- `.github/skills/copilot-customization/references/custom-instructions.md`
- `.github/skills/copilot-customization/SKILL.md`

### Validation Scripts (2)

- `scripts/validate-mcp-config.mjs` — remove from requiredServers
- `scripts/validate-skill-size.mjs` — remove from KNOWN_OVERSIZED

### Changelog (1)

- `CHANGELOG.md`

---

## Decisions

- **Skills removed entirely**: The extension provides Learn MCP tools natively — agents get them automatically without explicit skill instructions
- **Agent-output untouched**: 100+ learn.microsoft.com URLs are content hyperlinks, not MCP references
- **Validation simplified**: validate-mcp-config.mjs keeps `["github"]` only
- **No version bump in this PR**: Just add CHANGELOG entry
- **Empty arrays are fine**: If removing a skill leaves `secondary: []`, that's valid — means no secondary skills for that agent

## Scope Boundary

- **IN**: All microsoft-learn MCP config, 3 skills, all references in agents/registry/affinity/docs/instructions/validation/prompts
- **OUT**: agent-output/ content, learn.microsoft.com hyperlinks in docs, ms-azuretools extension tool references

## Adversarial Review Findings Addressed

| Finding | Source | Resolution |
|---------|--------|------------|
| Prompt file `microsoft-learn/*` tool ref | Review 1, CRITICAL-4 | Added Phase 5 (step 12) |
| `docs/prompt-guide/index.md` skill rows | Review 1 | Added step 18 |
| `docs/how-it-works/skills-and-instructions.md` | Review 2 | Added step 20 |
| `docs/faq.md` MCP server list | Review 2 | Added step 22 |
| "five MCP servers" → "four" | Review 1, WARNING-1 | Included in step 16 |
| CHANGELOG entry missing | Both reviews | Added Phase 9 |
| JSON validity after array cleanup | Review 1, CRITICAL-5 | Noted in Phase 3 |

## Review Findings Not Actioned (with rationale)

- **"Verify extension bundles Learn MCP"** — the user stated this as a given; we trust the premise
- **"Add extension to extensions.json"** — out of scope (extension already in devcontainer.json)
- **"Add extension validation to CI"** — over-engineering for this PR
