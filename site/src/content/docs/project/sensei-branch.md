---
title: "Sensei Branch"
description: "Why sensei lives on its own branch, what it is, and how to merge sensei-bearing work into main without dragging the plugin along."
---

This page is for **contributors** working with the `feat/skills-sensei`
branch and the skills audit programme. End users do not need to read it.

## What sensei is

Sensei is an upstream skill-quality plugin
([spboyer/sensei](https://github.com/spboyer/sensei)) pinned in this
repository as a **git submodule** at `.github/skills/sensei`. The submodule
is declared in `.gitmodules`. Sensei provides:

- A standard scoring CLI for skill frontmatter quality.
- A GEPA (Generative-Evaluator-Per-Anchor) auto-evaluator for cross-skill
  comparison and optimisation candidates.
- A regex-based trigger-array scanner used to validate skill trigger phrases.

Sensei is **wrapped**, not embedded. The repo provides thin wrappers under
`tools/scripts/` (`run-sensei-audit.mjs`, `audit-gepa-candidate.mjs`,
`run-stage5-audit.mjs`, `scaffold-trigger-tests.mjs`) and npm script
entries (`audit:skills`, `audit:skills:gepa`) that drive the upstream tools
against this repo's skills tree.

## Why sensei lives on `feat/skills-sensei` only

Sensei is **in-flight tooling**. Until the plugin is upstreamed and the
audit programme is hardened, sensei artefacts must not land on `main`. The
reasons:

| Concern                  | Why it matters                                                                                                                                                                                                                       |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Submodule churn          | The plugin moves fast; pinning a submodule on `main` creates a moving target for every clone of the accelerator template.                                                                                                            |
| Dev container bootstrap  | `.devcontainer/post-create.sh` on the sensei branch performs `git submodule update --init` and `npm install` inside the submodule. On `main`, that's unnecessary work and a potential failure point for users who do not run audits. |
| Shim artefacts are inert | Files like `tests/{skill}/triggers.test.ts` exist so sensei's regex parser can discover trigger arrays. They are not executed by any test runner. On `main`, they are dead code.                                                     |
| Audit-programme outputs  | `.github/skills/_audits/` holds historical batch reports, GEPA snapshots, and a TODO tracker for a programme that has already completed. They belong to the sensei branch as workspace state, not to `main` as documentation.        |
| Token-budget config      | `.token-limits.json` is read by `npm run tokens check`, which is only installed via the sensei submodule. Shipping it without sensei breaks the implied command.                                                                     |

The **work product** of sensei-driven audits — skill frontmatter rewrites,
body-section additions, token squeezes, archive cleanup — ships to `main`
normally. The plugin and its shims do not.

## What ships to `main` from a sensei branch

Three tiers, classified by tooling vs. work product:

| Tier                               | Path patterns                                                                                                                                                                                                                                                                                                                | Action                          |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- |
| Tier 1 — sensei tooling            | `.github/skills/sensei`, `.gitmodules`, `.github/prompts/sensei/`, `tools/scripts/run-sensei-audit.mjs`, `tools/scripts/scaffold-trigger-tests.mjs`, `tools/scripts/audit-gepa-candidate.mjs`, `tools/scripts/run-stage5-audit.mjs`, `package.json` `audit:skills*` entries, `.devcontainer/post-create.sh` sensei bootstrap | **Exclude** from main-bound PRs |
| Tier 2 — sensei work-product shims | `tests/{skill}/triggers.test.ts`, `tests/{skill}/trigger_tests.yaml`, `.github/skills/_audits/`, `.token-limits.json`, `.github/prompts/plan-skillsAuditOptimize.prompt.md`                                                                                                                                                  | **Exclude** from main-bound PRs |
| Tier 3 — skill content + features  | `.github/skills/{skill}/SKILL.md` edits, `.archive/_archived_skills/` renames, unrelated MCP / agent / instruction changes                                                                                                                                                                                                   | **Include** in main-bound PRs   |

## Merging sensei-bearing work into `main`

The repo ships a reusable prompt that automates the exclusion, validation,
and PR-creation flow:

- **Prompt file**: `.github/prompts/merge-sensei-free-pr.prompt.md`
- **VS Code invocation**: type `/merge-sensei-free-pr` in Copilot Chat.
- **Inputs**: source branch (default `feat/skills-sensei`), target branch
  (default `main`).

The prompt drives a seven-step flow:

1. Pre-flight (branch fetch, `gh` auth check, clean working tree).
2. Create a working branch named `chore/merge-{source}-to-{target}`.
3. **Discover and classify** every changed file dynamically by path
   pattern and content scan for the literal string `sensei`.
4. **Present** the Tier 1/2/3 classification and ask for approval.
5. Apply the exclusions (`git checkout origin/{target} -- <file>` for
   modified Tier 1 paths, `git rm` for the rest).
6. Validate (`npm run validate:skills`, Azure Pricing MCP pytest, ruff)
   and commit with an exclusion-receipt body.
7. Push and open the PR via `gh pr create` with a body that lists every
   excluded path and recommends squash-merge.

User approval is required before any `git rm`, `git push`, or
`gh pr create`. The prompt refuses to bypass pre-push validators with
`--no-verify`.

### Why squash-merge

The intermediate commits on a sensei branch contain the now-excluded
sensei files. Only **squash-merge** gives `main` a clean linear history
without those files appearing in any reachable commit on the default
branch.

### Common failure modes

| Failure                                                                                                        | Recovery                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Pre-push validator catches an orphan reference (e.g. another `SKILL.md` describing a now-removed sensei skill) | Edit the offending file as part of the exclusion commit. Do **not** push with `--no-verify`.                                       |
| Discovery flags a file you want to keep                                                                        | Manually reclassify as Tier 3 and document the override in the commit body.                                                        |
| `gh auth status` fails inside the dev container                                                                | Set `GH_TOKEN` via VS Code User Settings → `terminal.integrated.env.linux`. The prompt will not run `gh auth login` automatically. |
| Source branch unfetchable                                                                                      | Push or rename the branch on the source machine first.                                                                             |
| Uncommitted edits outside `agent-output/`                                                                      | Stash, commit on the source branch, or abort. The prompt will not silently include or discard them.                                |

## Running sensei audits locally

The audit programme is currently **complete** (all in-scope skills at GEPA
`quality_score: 1.00` as of 2026-05-10). If you need to re-run audits
because you added or substantially edited a skill:

1. Check out `feat/skills-sensei`. The submodule will be cloned and
   `npm install` will run inside `.github/skills/sensei/scripts/` during
   dev container post-create.
2. Run `npm run audit:skills` to score a batch or single skill.
3. Run `npm run audit:skills:gepa` for a global cross-skill GEPA report.
4. Apply the suggested frontmatter changes manually, then re-validate
   with `npm run validate:skills`.
5. Use `/merge-sensei-free-pr` to ship the **skill content** changes to
   `main` without dragging the submodule along.

Do not run sensei tooling on `main` or on any branch that does not
declare the sensei submodule in `.gitmodules`. The wrapper scripts and
npm script entries assume the submodule is present and will fail in
non-obvious ways otherwise.

## Related references

- Contributor guide: [Contributing](../contributing/)
- Branch naming and PR flow: `.github/skills/github-operations/SKILL.md`
- Prompt file conventions: `.github/instructions/prompt.instructions.md`
- Sensei upstream: [spboyer/sensei](https://github.com/spboyer/sensei)
