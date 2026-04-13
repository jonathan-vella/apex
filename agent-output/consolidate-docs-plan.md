# Plan: Consolidate Docs To Published Site

Make the published Astro site under `site/src/content/docs/` the only
project-documentation source, retire the legacy top-level `docs/` tree,
and preserve root GitHub-facing repo docs (`README.md`, `CONTRIBUTING.md`,
`CHANGELOG.md`) as intentionally separate entry-point files rather than
as a second documentation tree.

---

## Phase 1 — Freeze Target Architecture and Migration Rules

**Goal:** Establish the canonical source and migration policy before any
file changes.

### Steps

1. Adopt `site/src/content/docs/` as the canonical source for all project
   and user documentation pages. Keep `site/public/` as the canonical
   location for site-served static assets.

2. Keep `README.md`, `CONTRIBUTING.md`, and `CHANGELOG.md` at repo root
   for GitHub/repository UX, but stop treating them as members of a
   mirrored `docs/` tree.
   - `README.md` remains a root-specific repo overview.
   - `CONTRIBUTING.md` becomes a concise GitHub entry-point doc that links
     to the full site page at `site/src/content/docs/project/contributing.md`.
   - `CHANGELOG.md` becomes a concise current-release summary that links
     to the full site changelog and GitHub Releases.

3. Define the migration rule for historical content: references to `docs/`
   inside changelogs, resolved tech-debt entries, quality-score logs, and
   archival records may remain when they describe past paths. Active
   guidance, validators, prompts, and contributor workflows must not
   depend on `docs/`.

4. Keep the `docs/` **branch prefix** as a semantic label for
   documentation-domain work in branch naming enforcement. Update its
   allowed-paths pattern to `site/`, `README.md`, `CONTRIBUTING.md`,
   `CHANGELOG.md`, and `GLOSSARY.md` — removing the `docs/` directory
   from the path list.

---

## Phase 2 — Build the File-by-File Migration Inventory

**Goal:** Map every legacy file to a disposition. This phase blocks all
deletion work.

### Steps

5. Map each legacy `docs/` file into one of four buckets:
   - **Direct equivalent already present in site** — site copy is
     authoritative; legacy copy is a duplicate.
   - **Asset/static file with site replacement** — verify the site copy
     exists, then delete the legacy copy.
   - **Orphaned/obsolete** — safe to delete outright.
   - **Needs content merge** — merge into site copy, then delete.

6. Complete equivalence table (site copy is the source of truth):

   | Legacy file                                    | Site equivalent                                                          | Notes          |
   | ---------------------------------------------- | ------------------------------------------------------------------------ | -------------- |
   | `docs/quickstart.md`                           | `site/src/content/docs/getting-started/quickstart.md`                    |                |
   | `docs/dev-containers.md`                       | `site/src/content/docs/getting-started/dev-containers.md`                |                |
   | `docs/how-it-works/index.md`                   | `site/src/content/docs/concepts/how-it-works/index.mdx`                  | `.md` → `.mdx` |
   | `docs/how-it-works/architecture.md`            | `site/src/content/docs/concepts/how-it-works/architecture.md`            |                |
   | `docs/how-it-works/four-pillars.md`            | `site/src/content/docs/concepts/how-it-works/four-pillars.md`            |                |
   | `docs/how-it-works/agents.md`                  | `site/src/content/docs/concepts/how-it-works/agents.md`                  |                |
   | `docs/how-it-works/skills-and-instructions.md` | `site/src/content/docs/concepts/how-it-works/skills-and-instructions.md` |                |
   | `docs/how-it-works/workflow-engine.md`         | `site/src/content/docs/concepts/how-it-works/workflow-engine.md`         |                |
   | `docs/how-it-works/mcp-integration.md`         | `site/src/content/docs/concepts/how-it-works/mcp-integration.md`         |                |
   | `docs/workflow.md`                             | `site/src/content/docs/concepts/workflow.md`                             |                |
   | `docs/prompt-guide/index.md`                   | `site/src/content/docs/guides/prompt-guide/index.mdx`                    | `.md` → `.mdx` |
   | `docs/prompt-guide/best-practices.md`          | `site/src/content/docs/guides/prompt-guide/best-practices.md`            |                |
   | `docs/prompt-guide/workflow-prompts.md`        | `site/src/content/docs/guides/prompt-guide/workflow-prompts.md`          |                |
   | `docs/prompt-guide/reference.md`               | `site/src/content/docs/guides/prompt-guide/reference.md`                 |                |
   | `docs/troubleshooting.md`                      | `site/src/content/docs/guides/troubleshooting.md`                        |                |
   | `docs/session-debugging.md`                    | `site/src/content/docs/guides/session-debugging.md`                      |                |
   | `docs/security-baseline.md`                    | `site/src/content/docs/guides/security-baseline.md`                      |                |
   | `docs/cost-governance.md`                      | `site/src/content/docs/guides/cost-governance.md`                        |                |
   | `docs/hooks.md`                                | `site/src/content/docs/guides/hooks.md`                                  |                |
   | `docs/e2e-testing.md`                          | `site/src/content/docs/guides/e2e-testing.md`                            |                |
   | `docs/faq.md`                                  | `site/src/content/docs/reference/faq.md`                                 |                |
   | `docs/GLOSSARY.md`                             | `site/src/content/docs/reference/glossary.md`                            |                |
   | `docs/validation-reference.md`                 | `site/src/content/docs/reference/validation-reference.md`                |                |
   | `docs/CONTRIBUTING.md`                         | `site/src/content/docs/project/contributing.md`                          |                |
   | `docs/CHANGELOG.md`                            | `site/src/content/docs/project/changelog.md`                             |                |

7. Files with no site equivalent — delete outright:

   | Legacy file                             | Reason                                                                 |
   | --------------------------------------- | ---------------------------------------------------------------------- |
   | `docs/index.md`                         | MkDocs-era landing page; replaced by `site/src/content/docs/index.mdx` |
   | `docs/migration/azure-skills-plugin.md` | Completed migration guide for issue #240; orphaned, no inbound links   |
   | `docs/architecture-explorer.html`       | Already published at `site/public/architecture-explorer.html`          |

8. Also delete the orphaned site copy
   `site/src/content/docs/reference/azure-skills-plugin.md` — it is not
   in the Astro sidebar, has no inbound links, and documents a completed
   migration.

9. Legacy static assets with site replacements — verify then delete:

   | Legacy asset                                  | Site replacement                              |
   | --------------------------------------------- | --------------------------------------------- |
   | `docs/presenter/apex.PPTX`                    | `site/public/downloads/apex.PPTX`             |
   | `docs/assets/downloads/agentic-infraops.PPTX` | `site/public/downloads/agentic-infraops.PPTX` |
   | `docs/assets/images/hero-*.jpg`               | `site/public/images/hero-*.jpg`               |
   | `docs/assets/favicon.svg`                     | `site/public/images/favicon.svg`              |
   | `docs/assets/logo.svg`                        | `site/src/assets/images/logo.svg`             |

10. Site-only content that must remain untouched by the consolidation:
    `site/src/content/docs/demo/`,
    `site/src/content/docs/reference/resources.md`,
    `site/src/content/docs/reference/architecture-explorer.mdx`,
    `site/src/content/docs/index.mdx`, and
    `site/src/content/docs/404.mdx`.

---

## Phase 3 — Remove Repo and Tooling Dependencies on `docs/`

**Goal:** Eliminate every script, workflow, and validator that reads from
or validates against `docs/`. This is the main technical blocker and must
complete before deleting `docs/`.

### Steps

11. **Rewrite `scripts/check-docs-freshness.mjs`.**
    The validator is deeply coupled to `docs/`: 8 hard references to
    `docs/README.md` (which no longer exists on disk), a full-tree scan
    of `docs/*.md`, and checks for agent/skill counts, prohibited
    references, superseded links, agent/skill table verification, and
    version headers all scoped to `docs/`. Rewrite the entire validator
    to operate against `count-manifest.json` and/or
    `site/src/content/docs/`. This also affects
    `.github/workflows/weekly-maintenance.yml` (line 166) and the
    `validate:_node` aggregate in `package.json`.

12. **Delete `scripts/validate-docs-sync.mjs`** and remove the
    `validate:docs-sync` script from `package.json` (including from the
    `validate:_node` and `validate:_node-ci` aggregates). The sync
    validator's only purpose is enforcing `docs/CONTRIBUTING.md` ↔ root
    and `docs/CHANGELOG.md` ↔ root identity, which is eliminated by
    design. **Simultaneously slim root `CHANGELOG.md`** to a concise
    current-release summary with links to the site changelog and GitHub
    Releases — doing both in the same change avoids a window where three
    changelog copies diverge with no enforcement.

13. **Update `lefthook.yml`.** Change the `link-check` pre-commit hook
    glob from `docs/**/*.md` to `site/src/content/docs/**/*.md`.

14. **Update branch-scope tooling.** In
    `.github/workflows/branch-enforcement.yml`,
    `scripts/validate-branch-naming.sh`, and
    `scripts/validate-branch-scope.sh`: keep the `docs/` branch prefix
    as a valid documentation-domain label, but update the allowed-paths
    pattern from `'^(docs/|site/|README\.md|...'` to
    `'^(site/|README\.md|CONTRIBUTING\.md|CHANGELOG\.md|GLOSSARY\.md)'`,
    dropping `docs/` from the path list.

15. **Update `package.json`.** Change `lint:prose` from
    `vale --config .vale.ini docs/ .github/ README.md` to
    `vale --config .vale.ini site/src/content/docs/ .github/ README.md`.
    Fix any comments or helper tasks that reference `docs/` as a live
    tree. Remove `validate:docs-sync` from all aggregate commands.
    (`lint:links:docs` already targets `site/src/content/docs/` —
    confirmed, no change needed.)

16. **Update `.vale.ini`.** Replace or remove the `[docs/*.md]` section.
    Add a `[site/src/content/docs/**/*.md]` section if prose-lint
    overrides are needed for site content.

17. **Update `scripts/validate-no-deprecated-refs.mjs`.** Uncomment or
    replace the commented-out `docs/guides/` and `docs/reference/`
    patterns (lines 125, 130) with a broader `docs/` path pattern to
    catch post-migration regressions.

### Verification

- Run `npm run validate:all` — must pass with the rewritten/removed
  validators.
- Run `npm run docs:build` — published site must still resolve.

---

## Phase 4 — Update Agent Guidance, Contributor Guidance, and Repo References

**Goal:** Ensure no active guidance, prompt, instruction, or skill
reference sends users or agents to `docs/`.

### Steps — Agent and Skill Files

18. **`.github/instructions/docs-trigger.instructions.md`** — Replace
    the `docs/README.md` and `docs/prompt-guide/README.md` sections
    (lines 47, 54) with references to the site docs tree and root repo
    docs.

19. **`.github/instructions/docs.instructions.md`** — Fix body text
    "documentation in the `docs/` folder" (line 8), path-depth examples
    referencing `docs/` and `docs/subfolder/` (lines 22-23), and the
    content-principles table pointing to `docs/prompt-guide/` (line 114).
    The `applyTo` glob already correctly targets `site/src/content/docs/`.

20. **`.github/skills/docs-writer/SKILL.md`** — Remove `docs/` from the
    In Scope list; add `site/src/content/docs/` as the primary scope.
    Stop instructing agents to update `docs/README.md` agent/skill
    tables (lines 80, 82).

21. **docs-writer skill references:**
    - `references/freshness-checklist.md` — retarget all
      `docs/README.md` and `docs/prompt-guide/README.md` audit targets
      (lines 43-79, 116, 154) to site equivalents or
      `count-manifest.json`.
    - `references/doc-standards.md` — replace `docs/prompt-guide/` and
      `docs/README.md` references (lines 122, 153).
    - `references/repo-architecture.md` — replace `docs/README.md` and
      `docs/prompt-guide/README.md` in the doc-maintenance table
      (lines 216, 218).

22. **`.github/skills/github-operations/references/branch-strategy.md`**
    — Update the branch-scope table (line 14) to show `site/` instead of
    `docs/` in the allowed paths for the `docs/` prefix. Also update
    `SKILL.digest.md` (line 24).

23. **`.github/prompts/git-commit-push.prompt.md`** — Update lines 95,
    101 where `docs/` appears in branch-domain scope guidance.

24. **`.github/prompts/plan-docsPeerReview.prompt.md`** — Retarget from
    `docs/` to `site/src/content/docs/` throughout. Update file path
    examples, asset references (`docs/assets/`), and scope description.

25. **`.github/instructions/github-actions.instructions.md`** — Fix the
    CI trigger description referencing `docs/` (line 70).

26. **`.github/instructions/references/markdown-formatting-guide.md`** —
    Fix example links `../../docs/quickstart.md` (lines 142, 150) to
    point to site paths.

27. **`.github/copilot-instructions.md`** — Remove `docs/tf-support/`
    from the Key Files table (line 129); that path was already deleted.

### Steps — Repo-Facing Files

28. **`AGENTS.md`** — Replace `docs/validation-reference.md` link
    (line 40) and `docs/` in the project structure tree (line 209).

29. **`CONTRIBUTING.md`** — Replace all `docs/workflow.md` links
    (lines 11, 23, 45, 46, 189) with site URLs. Update the `docs/`
    branch-scope table row (line 84). Fix the `lint:links` comment still
    saying "docs/ only" (line 145).

30. **`.devcontainer/README.md`** — Replace `docs/prompt-guide/` in the
    quickstart snippet (line 154), `docs/troubleshooting.md` link
    (line 244), `docs/workflow.md` (line 264), and `docs/prompt-guide/`
    (line 265).

31. **`agent-output/README.md`** — Replace the prompt-guide link to
    `docs/prompt-guide/` (line 99). Remove the "Legacy Demo Outputs"
    section referencing `docs/adr/` and `docs/diagrams/`
    (lines 116-117).

32. **`.github/ISSUE_TEMPLATE/config.yml`** — Fix the dead URL to
    `docs/reference/workflow.md` (line 10).

33. **`.github/ISSUE_TEMPLATE/bug-report.yml`** — Update the area
    dropdown mentioning `docs/` (line 24).

### Steps — Site Docs That Reference `docs/` as Live

34. **`site/src/content/docs/project/contributing.md`** — Fix
    `docs/workflow.md` reference (line 24), `docs/` branch-scope table
    (lines 55, 83), and `lint:links` comment (line 144).

35. **`site/src/content/docs/reference/validation-reference.md`** — Fix
    `docs/**/*.md` in the lefthook table (line 36) and `docs/` in
    `lint:links:docs` description (line 134). These should reflect the
    updated globs from Phase 3.

### Verification

- Run `npm run lint:md` — zero errors.
- Run `npm run lint:links:docs` — zero broken links.
- Run `npm run validate:all` — full pass.

---

## Phase 5 — Re-Shape Root Repo Docs for Final State

**Goal:** Make root docs intentionally separate entry points, not
mirrors. This phase depends on Phases 3 and 4 because site paths and
contributor workflow references must already be stable.

### Steps

36. **`README.md`** — Already in good shape as a repo overview with links
    to the published site. Verify it contains no workflow links into
    `docs/`. Keep clearly repo-specific: project overview, quick-start
    links into the published site, contribution entry points, and release
    links.

37. **`CONTRIBUTING.md`** — Reshape to a concise GitHub contributor entry
    page: branch/PR expectations, validation commands, and a prominent
    link to the full site contributing page at the published URL. Remove
    the full workflow duplication.

38. **`CHANGELOG.md`** — Already handled in step 12 (slimmed
    simultaneously with sync-validator removal). Confirm shape: concise
    current-release summary plus links to the full site changelog and
    GitHub Releases.

39. If the team later wants zero duplication between root
    `CONTRIBUTING.md` / `CHANGELOG.md` and the site pages, introduce a
    generation or import workflow as a follow-on improvement. Do not make
    that a prerequisite for removing `docs/`.

### Verification

- Manually verify GitHub-root UX: `README.md`, `CONTRIBUTING.md`, and
  `CHANGELOG.md` still make sense as root entry points even after
  `docs/` is removed.

---

## Phase 6 — Remove the Legacy `docs/` Tree

**Goal:** Delete in controlled stages after all dependencies are removed
and verified.

### Steps

40. **Stage A** — Delete all direct-duplicate content files from `docs/`
    (the 25 files in the equivalence table from step 6) plus the
    orphaned files from step 7 (`docs/index.md`,
    `docs/migration/azure-skills-plugin.md`,
    `docs/architecture-explorer.html`).

41. **Stage B** — Delete legacy static assets from `docs/assets/` and
    `docs/presenter/` (confirmed in step 9 that site replacements
    already exist).

42. **Stage C** — Remove the empty `docs/` directory tree and any
    residual scripts or comments that still describe it as the source of
    truth.

43. **Also delete** the orphaned
    `site/src/content/docs/reference/azure-skills-plugin.md` (step 8).

### Verification

- `npm run validate:all` — full pass.
- `npm run docs:build` — site builds and all pages resolve.

---

## Phase 7 — Migration Safety Rails and Final Verification

**Goal:** Catch regressions and confirm nothing is broken.

### Steps

44. Add a one-time repository search check for live `docs/` references
    outside allowed historical files. The allowlist must include:
    - `CHANGELOG.md` and `site/src/content/docs/project/changelog.md`
      (historical entries)
    - `tests/exec-plans/tech-debt-tracker.md` (resolved debt items)
    - `QUALITY_SCORE.md` (historical quality-improvement log entries)
    - Any future retrospective/audit files that describe past paths

45. Run all documentation and repo validations after each major phase,
    not only at the end, so breakage is isolated quickly:
    - `npm run lint:md` after each phase.
    - `npm run lint:links:docs` after migrating site links and asset
      locations.
    - `npm run validate:all` at the end of each phase that touches
      scripts, workflows, or contributor guidance.
    - `npm run docs:build` and verify all published pages resolve.

46. After the tree is removed, run a final pass over GitHub workflows,
    prompts, instructions, and contributor docs to ensure no automation
    or human guidance still expects `docs/` to exist. The updated
    `validate-no-deprecated-refs.mjs` (step 17) should catch regressions
    going forward.

47. Manually verify GitHub-root UX: `README.md`, `CONTRIBUTING.md`, and
    `CHANGELOG.md` still make sense as root entry points.

---

## Decisions

| Decision                                                                  | Rationale                                             |
| ------------------------------------------------------------------------- | ----------------------------------------------------- |
| Canonical project documentation lives only in `site/src/content/docs/`    | Single source of truth; eliminates sync burden        |
| `docs/` is legacy and will be retired                                     | Not kept as a second source                           |
| Root `README.md`, `CONTRIBUTING.md`, `CHANGELOG.md` stay for GitHub UX    | Intentionally separate from the site docs tree        |
| Root `CONTRIBUTING.md` and `CHANGELOG.md` become thin entry-point docs    | Link to full site pages; no mirroring                 |
| First milestone is dependency removal, not physical deletion              | Ensures nothing breaks before files disappear         |
| Historical references to `docs/` may remain in archival records           | Changelogs, tech-debt tracker, quality-score logs     |
| `docs/` branch prefix survives as a semantic label                        | Only the allowed-paths pattern changes                |
| Root `CHANGELOG.md` slimming and sync-validator deletion are simultaneous | Avoids three-way divergence window                    |
| `azure-skills-plugin.md` is deleted from both locations                   | Completed migration guide; orphaned; no inbound links |
| No complex generation pipeline for root docs                              | Simpler model unless proven insufficient              |

---

## Further Considerations

1. Preserve major legacy public URLs where practical by adding redirects
   or compatibility pages for paths such as `quickstart`, `workflow`,
   `prompt-guide`, and `how-it-works/*` before the final cleanup.

2. If the team later wants root `CONTRIBUTING.md` and `CHANGELOG.md` to
   show the same full content as the site pages, plan that as a separate
   generation/sync design after the `docs/` retirement.

3. Implement as two PRs: first migrate references, validators, and
   root-doc reshaping (Phases 1-5); second delete the legacy `docs/`
   tree (Phase 6) plus final verification (Phase 7).

---

## Complete File Inventory

### Canonical destinations (keep)

| Path                     | Purpose                            |
| ------------------------ | ---------------------------------- |
| `site/src/content/docs/` | All project documentation pages    |
| `site/public/`           | Site-served static assets          |
| `site/astro.config.mjs`  | Authoritative sidebar and taxonomy |
| `README.md`              | Root GitHub landing page           |
| `CONTRIBUTING.md`        | Root contributor entry doc         |
| `CHANGELOG.md`           | Root changelog entry doc           |

### Scripts and tooling blockers (Phase 3)

| File                                       | Change                                                    |
| ------------------------------------------ | --------------------------------------------------------- |
| `scripts/check-docs-freshness.mjs`         | Full rewrite; 8 `docs/README.md` refs, full-tree scans    |
| `scripts/validate-docs-sync.mjs`           | Delete entirely                                           |
| `scripts/validate-no-deprecated-refs.mjs`  | Add `docs/` regression detection                          |
| `lefthook.yml`                             | `link-check` glob update                                  |
| `package.json`                             | `lint:prose`, remove `validate:docs-sync`, fix aggregates |
| `.vale.ini`                                | Remove `[docs/*.md]` section                              |
| `.github/workflows/branch-enforcement.yml` | Update scope pattern                                      |
| `.github/workflows/weekly-maintenance.yml` | Freshness check invocation                                |
| `scripts/validate-branch-naming.sh`        | Help text update                                          |
| `scripts/validate-branch-scope.sh`         | Allowed-paths pattern                                     |

### Agent and skill guidance (Phase 4)

| File                                                             | Change                                           |
| ---------------------------------------------------------------- | ------------------------------------------------ |
| `.github/instructions/docs-trigger.instructions.md`              | Retarget from `docs/README.md`                   |
| `.github/instructions/docs.instructions.md`                      | Fix body text, path examples, content principles |
| `.github/instructions/github-actions.instructions.md`            | Fix CI trigger description                       |
| `.github/instructions/references/markdown-formatting-guide.md`   | Fix example links                                |
| `.github/skills/docs-writer/SKILL.md`                            | Remove `docs/` from scope                        |
| `.github/skills/docs-writer/references/freshness-checklist.md`   | Retarget audit targets                           |
| `.github/skills/docs-writer/references/doc-standards.md`         | Replace references                               |
| `.github/skills/docs-writer/references/repo-architecture.md`     | Replace references                               |
| `.github/skills/github-operations/references/branch-strategy.md` | Update scope table                               |
| `.github/skills/github-operations/SKILL.digest.md`               | Update scope table                               |
| `.github/prompts/plan-docsPeerReview.prompt.md`                  | Retarget scope                                   |
| `.github/prompts/git-commit-push.prompt.md`                      | Update branch-domain guidance                    |
| `.github/copilot-instructions.md`                                | Remove stale `docs/tf-support/` entry            |

### Repo-facing guidance (Phase 4)

| File                                                      | Change                                                  |
| --------------------------------------------------------- | ------------------------------------------------------- |
| `AGENTS.md`                                               | Replace `docs/` links and structure tree                |
| `CONTRIBUTING.md`                                         | Replace `docs/workflow.md` links, scope table, comments |
| `.devcontainer/README.md`                                 | Replace quickstart, troubleshooting, workflow links     |
| `agent-output/README.md`                                  | Replace prompt-guide link, remove legacy demo section   |
| `.github/ISSUE_TEMPLATE/config.yml`                       | Fix dead URL                                            |
| `.github/ISSUE_TEMPLATE/bug-report.yml`                   | Update area dropdown                                    |
| `site/src/content/docs/project/contributing.md`           | Fix workflow ref, scope table                           |
| `site/src/content/docs/reference/validation-reference.md` | Fix lefthook table, lint description                    |

### Legacy tree to delete (Phase 6)

| Path                                                     | File count      |
| -------------------------------------------------------- | --------------- |
| `docs/` (entire directory)                               | 37 files        |
| `site/src/content/docs/reference/azure-skills-plugin.md` | 1 orphaned file |
