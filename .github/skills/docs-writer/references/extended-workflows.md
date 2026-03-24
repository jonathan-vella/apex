<!-- ref:extended-workflows-v1 -->

# Extended Documentation Workflows

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
   - Verify consistent terminology against `docs/GLOSSARY.md`.
   - Check tone is active and action-oriented (not academic/passive).
   - Flag jargon not defined in the glossary.
   - Ensure agent/skill names use exact casing from their frontmatter
     (`name:` field) — e.g., "Bicep Code" not "bicep code agent".
4. **Layer 3 — Technical accuracy**:
   - Load `references/repo-architecture.md` for ground truth.
   - Verify agent/skill names and descriptions match
     the actual filesystem. Do not hard-code counts — reference
     `.github/count-manifest.json` for canonical numbers.
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
