# GitHub Actions Workflows

> High-level reference for every workflow in `.github/workflows/`.
> For implementation details and individual triggers, open the YAML file directly.

## At a glance

| Workflow                                                           | Trigger                       | Purpose                                                                                                                    | Side effects                                                         |
| ------------------------------------------------------------------ | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| [`ci.yml`](ci.yml)                                                 | PR + push to `main`           | Single required status check: markdown lint, every `validate:*` script, handoff/contract checks.                           | None — fails the PR on regression.                                   |
| [`branch-enforcement.yml`](branch-enforcement.yml)                 | PR to `main`                  | Enforces branch naming + file-scope rules so PRs stay reviewable.                                                          | None — fails the PR on violation.                                    |
| [`docs.yml`](docs.yml)                                             | Push to `main` (site paths)   | Build Astro Starlight site → publish to GitHub Pages.                                                                      | Updates the public docs site.                                        |
| [`e2e-validation.yml`](e2e-validation.yml)                         | Weekly Mon 09:00 UTC + manual | Validate Ralph Loop E2E artifacts (required) + run benchmark scoring (informational).                                      | Uploads benchmark report artifact.                                   |
| [`governance-policy-baseline.yml`](governance-policy-baseline.yml) | Weekly Mon 05:00 UTC + manual | Refresh `.github/data/governance-policy-baseline.json` from a live subscription.                                           | Opens a PR (manual review + merge required) when baseline drifts.    |
| [`link-check.yml`](link-check.yml)                                 | PR + push (docs paths)        | Markdown link liveness in `site/src/content/docs/**`. Weekly safety net runs inside `weekly-maintenance.yml`.              | Surfaces broken links on the PR.                                     |
| [`sensei-branch-maintenance.yml`](sensei-branch-maintenance.yml)   | Weekly Mon 08:00 UTC + manual | Keep `feat/skills-sensei` long-lived branch healthy: merge `main` weekly, run validators, file issue if branch is missing. | Pushes merge commit to `feat/skills-sensei`; may open issue.         |
| [`weekly-maintenance.yml`](weekly-maintenance.yml)                 | Weekly Mon 06:00 UTC + manual | Consolidated data-refresh + audit umbrella — see [Weekly Maintenance](#weekly-maintenance) below.                          | Opens PRs (refresh jobs, manual merge) + GitHub issues (audit jobs). |

## Weekly Maintenance

`weekly-maintenance.yml` is the umbrella workflow for low-frequency
maintenance tasks. It folds in the retired `azure-deprecation-tracker.yml`
(Aug 2025), the legacy grep-based AVM version check (replaced by the
PR-driven `refresh-avm-module-index` job), and the standalone weekly
link-check cron (folded May 2026).

| Job                           | What it does                                                                                                                             | Output                                                                                                                                                                                        |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `refresh-avm-module-index`    | Fetches canonical AVM module indexes (Bicep + Terraform), pre-warms the per-module version cache used by `validate:avm-versions:freeze`. | PR (manual merge) updating `.github/data/avm-bicep-modules.csv`, `.github/data/avm-terraform-modules.csv`, `.github/data/avm-module-index.json`, `tools/scripts/_data/avm-module-cache.json`. |
| `track-deprecations`          | Pulls Azure Updates RSS for deprecation notices; merges with the curated `KNOWN_DEPRECATIONS` allowlist.                                 | PR (manual merge) updating `.github/data/azure-deprecations.json`.                                                                                                                            |
| `docs-freshness`              | Runs `npm run audit:quarterly` (glob-audit + orphan-content + docs-freshness).                                                           | Opens or updates a GitHub issue on regression.                                                                                                                                                |
| `drawio-mcp-tests`            | Deno test suite for the draw.io MCP integration.                                                                                         | Fails the workflow run on regression.                                                                                                                                                         |
| `drawio-icon-converter-tests` | Python `pytest` suite for the draw.io icon converter.                                                                                    | Fails the workflow run on regression.                                                                                                                                                         |
| `link-check`                  | Runs `lint:links:docs` against `site/src/content/docs/**` (safety net between PR-path link-check runs).                                  | Fails the workflow run on broken links.                                                                                                                                                       |

### Permissions model

The workflow declares minimal top-level permissions
(`contents: read`, `issues: write`) and elevates per-job for the two
PR-creating refresh jobs (`contents: write`, `pull-requests: write`).
This keeps the blast radius small if any other job is later added.

### Manual dispatch inputs

- `create_issue` — set `false` to suppress GitHub-issue creation in the
  audit jobs (`docs-freshness`).
- `force_update` — set `true` to force the refresh jobs to open a PR
  even when no upstream change is detected (smoke-test the PR path).

## Adding a new workflow

1. Place the YAML under `.github/workflows/`.
2. Add a row to the **At a glance** table above. Keep it terse — one
   line, link the filename, name the trigger + purpose + side effect.
3. Prefer per-job `permissions:` blocks over wide top-level grants.
4. Use the [`./.github/actions/setup-node-repo`](../actions/setup-node-repo/action.yml)
   composite action for the standard checkout + Node + `npm ci` prelude.
   Override `fetch-depth`, `submodules`, `ref`, or `install-deps` via
   `with:` only when the defaults don't fit.
5. Stagger weekly crons across the Monday 05:00–09:00 UTC window so
   no two big jobs fight for the runner pool. See [Weekly cron schedule](#weekly-cron-schedule)
   below.
6. Do **not** add `gh pr merge --auto` / `enable-auto-merge` steps —
   GitHub Free private repos do not support auto-merge. Open the PR
   and let a human merge it after review.
7. Run `node tools/scripts/generate-explorer-graph.mjs` so the
   architecture explorer picks up the new node, then commit the
   regenerated `site/public/architecture-explorer-graph.json` in the
   same PR.

## Weekly cron schedule

The weekly cron window is staggered so concurrent runs do not queue
behind each other on the free-tier runner pool. All times UTC.

| Day    | UTC   | Workflow                         |
| ------ | ----- | -------------------------------- |
| Monday | 05:00 | `governance-policy-baseline.yml` |
| Monday | 06:00 | `weekly-maintenance.yml`         |
| Monday | 08:00 | `sensei-branch-maintenance.yml`  |
| Monday | 09:00 | `e2e-validation.yml`             |

`link-check.yml` no longer carries its own cron — the weekly safety-net
run lives in `weekly-maintenance.yml` as the `link-check` job.

## See also

- [`AGENTS.md`](../../AGENTS.md) — repository conventions, build commands, code style.
- [`copilot-instructions.md`](../copilot-instructions.md) — agent orchestration policies.
- [`tools/scripts/`](../../tools/scripts) — every validator and refresh script referenced above.
