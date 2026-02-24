---
mode: agent
description: Standalone regression check — run after every phase to verify existing Bicep flow is unbroken.
---

# Regression Check

Run after completing any phase to confirm the pre-Terraform Bicep workflow is unbroken.

## 1. Automated Validators

```bash
npm run validate:all
```

All checks must pass. If any fail, stop and fix before proceeding.

Key validators and what they guard:

| Validator | Guards |
| --------- | ------ |
| `validate-agent-frontmatter` | All agent `.md` files have required YAML fields |
| `validate-skills-format` | All SKILL.md files match canonical structure |
| `validate-instruction-frontmatter` | All instruction files have `applyTo` |
| `validate-instruction-references` | Instructions reference existing files |
| `validate-artifact-templates` | H2 structures in artifact-templates match canonical keys |
| `validate-h2-sync` | Artifact-template H2s in sync with artifact-templates.instructions.md |
| `validate-governance-refs` | Governance-discovery references valid check groups |
| `validate-mcp-config` | `.vscode/mcp.json` has required MCP servers |
| `validate-vscode-config` | `.vscode/settings.json` has custom agents enabled |
| `validate-no-deprecated-refs` | No stale agent name references across all files |

## 2. Bicep Workflow Spot Check

Run the conductor agent with a known-good prompt to verify the Bicep path routes correctly.

Use this minimal prompt in GitHub Copilot Chat (select **InfraOps Conductor**):
```
Deploy a simple Azure Storage Account in swedencentral for regression testing.
Project name: regression-check.
Stop after Step 2 (Architecture). Do not provision anything.
```

Expected: Conductor routes to `02-Requirements` then `03-Architect`. No error, no Terraform path.

## 3. Governance-Discovery Subagent Check

Verify the governance subagent still produces the `bicepPropertyPath` field.

Check `agent-output/regression-check/04-governance-constraints.json` (if generated).
The JSON must contain entries with the keys: `id`, `displayName`, `category`, `effect`, `bicepPropertyPath`.

If `bicepPropertyPath` is absent, the governance-discovery-subagent has regressed. Fix in Phase 4 items.

## 4. Bicep Lint Check

If any Bicep templates exist in `infra/bicep/`, run:
```bash
find infra/bicep -name "*.bicep" | head -5 | xargs -I{} bicep lint {}
```

All files must lint clean.

## 5. Markdown Lint Check

```bash
npm run lint:md
```

## 6. Version Sync Check

```bash
npm run validate:version-sync
```

`VERSION.md`, `package.json`, and `CHANGELOG.md` must agree on the current version.

## Passing Criteria

All 6 sections must be green with no errors or warnings before the phase is considered done.

## If a Regression Is Found

1. Do not commit the phase work.
2. Open a GitHub issue with label `bug` and link it to the relevant phase issue.
3. Fix the regression before committing the phase.
4. Re-run this check to confirm it passes.
5. Note the finding in `docs/tf-support/PROGRESS.md` Blockers & Notes.
