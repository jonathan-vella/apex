---
description: Required documentation updates for product changes; published documentation belongs to apex-docs.
applyTo: "**/*.agent.md, **/*.instructions.md, **/.github/skills/**/SKILL.md, tools/scripts/**/*.{mjs,sh,ps1,psm1}, tools/powershell/*.psd1, infra/**/*.{bicep,tf}, .devcontainer/**, .vscode/*.{json,jsonc}, .github/copilot/*.json, .github/workflows/*.{yml,yaml}, package.json, package-lock.json, requirements.txt, pyproject.toml, lefthook.yml, .markdownlint-cli2.jsonc"
---

# Update Documentation on Code Change

Required documentation updates do not depend on loading a skill. Apply these triggers during
routine code work; formatting follows `markdown.instructions.md`. Published documentation is
maintained in `jonathan-vella/apex-docs` (`src/content/docs/` in a separate checkout) — do not
create or edit a local `site/` directory in APEX.

## Trigger Conditions

- New features or capabilities, breaking changes, setup or install changes
- CLI commands or scripts added/modified; dependencies or requirements changed
- Configuration options or environment variables modified; doc code examples outdated
- Agent or skill definitions are added, renamed, or removed
- Invocation permissions, supported Copilot entry points or runtime selection policy change
- Bicep/Terraform module structure changes (new modules, renamed parameters)

## What to Update

| Target | Update when | Notes |
| ------ | ----------- | ----- |
| [README.md (root)](../../README.md) | Agent/skill inventory, project structure or capabilities change | Derive counts from `count-manifest.json` |
| Release notes | Any user-facing change | Record in the PR and apex-docs; section by conventional-commit type |
| apex-docs | Agents or skills added, renamed, removed or significantly changed; new doc files | Separate repository |
| Runtime references | Instructions, inventory, entry points or harness behavior change | Update callers and tests; regenerate the Explorer registry when its inputs change |

Preserve historical evidence when retiring entry points. The sole supported runtime is
the Copilot SDK harness inside VS Code; model labels do not prove cost tiers or permissions.
Keep published-documentation changes in the separate docs repository; if unavailable,
report the exact follow-up rather than creating a duplicate site here.

## Verification

After updating documentation:

1. Run `npm run lint:md` — zero errors required
2. Run `npm run lint:docs-freshness` — zero findings required
3. Verify all relative links resolve to existing files
