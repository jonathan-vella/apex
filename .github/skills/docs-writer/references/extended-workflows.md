<!-- ref:extended-workflows-v1 -->

# Extended Documentation Workflows

> Loaded by `docs-writer` SKILL.md. Workflows 1–4 are the everyday
> doc-gardening cycle; Workflows 5–7 are periodic operations
> (changelog, proofreading, freshness-issue triage).

## Workflow 1: Update Existing Documentation

1. **Identify target files**: Determine which files in `site/src/content/docs/` need updates.
2. **Read latest version**: Always read the current file before editing.
3. **Load standards**: Read `references/doc-standards.md` for conventions.
4. **Apply changes**: Follow the doc-standards conventions strictly:
   - 120-char line limit (CI enforced)
   - Single H1 rule (title only)
   - File header: `# {Title}` + `> Version {X.Y.Z} | {description}`
   - Version number from `VERSION.md` (single source of truth)
5. **Verify links**: Check all relative links resolve to existing files.
6. **Run validation**: Offer to run `npm run lint:md` and `npm run lint:links`.

## Workflow 2: Add Documentation for New Entity

When a new agent or skill is added to the repo:

1. **Read architecture**: Load `references/repo-architecture.md` for current
   entity inventory and naming conventions.
2. **Identify all files needing updates**:
   - New agent → update `README.md` (root) agent references
   - New skill → update `README.md` (root) skill references
3. **Match existing patterns**: Study adjacent entries in each table
   to match column format, emoji conventions, and description style.
4. **Update references**: Use descriptive language per the
   `no-hardcoded-counts` instruction — never hard-code entity totals.
5. **Cross-reference check**: Search for other files referencing the
   entity and add it to the appropriate tables.

## Workflow 3: Freshness Audit (Staleness Check)

1. **Load checklist**: Read `references/freshness-checklist.md`.
2. **Scan each audit target**:
   - Version numbers match `VERSION.md`
   - Agent/skill counts match filesystem
   - Tables list all entities present in filesystem
   - No references to removed/renamed agents
3. **Check project health files**:
   - Read `QUALITY_SCORE.md` — verify grades still reflect reality
   - Read `tools/tests/exec-plans/tech-debt-tracker.md` — verify items still relevant
4. **Report findings**: Present a table of issues found with:
   - File path, line number, issue description, suggested fix
5. **Auto-fix**: For each issue, propose the exact edit and apply it
   after user confirmation (or immediately if user said "fix all").
6. **Update health metrics**: If fixes change quality grades, update `QUALITY_SCORE.md`.

## Workflow 4: Explain the Repo Architecture

1. **Load architecture**: Read `references/repo-architecture.md`.
2. **Answer questions**: Use the reference to explain how components
   connect — agents, skills, instructions, templates, artifacts,
   and the multi-step workflow.
3. **Cite sources**: Point to specific files when answering.
4. **Stay current**: If the reference seems outdated vs. filesystem,
   note the discrepancy and offer to update the reference.

## Workflow 5: Generate Changelog Entry

1. **Find last version tag**: Run `git tag --sort=-v:refname | head -1`.
2. **Get commits since tag**: Run
   `git log --oneline {tag}..HEAD --no-merges`.
3. **Classify by type**: Map conventional commit prefixes to
   Keep a Changelog sections:
   - `feat:` → `### Added`
   - `fix:` → `### Fixed`
   - `docs:`, `style:`, `refactor:`, `perf:`, `test:`, `build:`,
     `ci:`, `chore:` → `### Changed`
   - `feat!:` or `BREAKING CHANGE:` → `### ⚠️ Breaking Changes`
4. **Format entry**: Match the style in `CHANGELOG.md`:

   ```markdown
   ## [{next-version}] - {YYYY-MM-DD}

   ### Added

   - Description of feature ([commit-hash])

   ### Changed

   - Description of change ([commit-hash])

   ### Fixed

   - Description of fix ([commit-hash])
   ```

5. **Determine version bump**:
   - Breaking change → major
   - `feat:` → minor
   - `fix:` only → patch
6. **Present to user**: Show the formatted entry for review before
   inserting into `CHANGELOG.md`.

## Workflow 6: Proofread Documentation

A three-layer review: language quality, tone/terminology, and
technical accuracy.

1. **Select scope**: Ask user which files to review, or default to
   all files in `docs/`.
2. **Layer 1 — Language quality**:
   - Run `npm run lint:prose` (Vale) for automated prose checks.
   - Manually scan for: grammar errors, spelling mistakes, passive
     voice, awkward phrasing, overly long sentences (>30 words).
3. **Layer 2 — Tone and terminology**:
   - Verify consistent terminology against `site/src/content/docs/reference/glossary.md`
     (authoritative source; `docs/GLOSSARY.md` is a stub).
   - Check tone is active and action-oriented (not academic/passive).
   - Flag jargon not defined in the glossary.
   - Ensure agent/skill names use exact casing from their frontmatter
     (`name:` field) — e.g., "Bicep Code" not "bicep code agent".
4. **Layer 3 — Technical accuracy**:
   - Load `references/repo-architecture.md` for ground truth.
   - Verify agent/skill names and descriptions match
     the actual filesystem. Do not hard-code counts — reference
     `tools/registry/count-manifest.json` for canonical numbers.
   - Confirm artifact filenames are correct.
   - Check that capability claims are truthful and verifiable
     against the filesystem.
   - Cross-check version numbers against `VERSION.md`.
5. **Report findings**: Present a table per file:

   ```markdown
   | #   | Line | Layer       | Issue                      | Suggestion               |
   | --- | ---- | ----------- | -------------------------- | ------------------------ |
   | 1   | 12   | Language    | Passive voice              | Rewrite actively         |
   | 2   | 34   | Terminology | "IaC tool" not in glossary | Use "Bicep"              |
   | 3   | 56   | Accuracy    | Hard-coded count detected  | Use descriptive language |
   ```

6. **Apply fixes**: After user review, apply corrections. For
   language/tone fixes, show before/after for each change.
   For accuracy fixes, apply directly (same as freshness audit).

## Workflow 7: Process Freshness Issues

**Trigger**: "Fix the docs freshness issue" or auto-created GitHub
issue with `docs-freshness` label

1. Read the issue body for the findings table
2. For each finding, apply the appropriate fix from the freshness
   checklist
3. Run `npm run lint:docs-freshness` to verify 0 findings remain
4. Summarize changes made
