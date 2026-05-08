# ESLint + Prettier Adoption — Implementation Plan (Adopt-narrow)

> Companion plan to [findings.md](./findings.md). Activated only on Adopt or Adopt-narrow recommendations.
> This plan covers **Adopt-narrow (tools-only)**. The site/ extension is deferred and tracked at the bottom.

## Scope (this plan)

- `tools/scripts/**/*.{js,mjs,cjs}` (54 files)
- `tools/tests/**/*.{js,mjs,cjs}` (2 files)
- Root-level Prettier reformat across the same JS/MJS surface (50 files needing reformat per Phase 1.2)
- **Not in scope here:** `site/**`, `.astro` files, `typescript-eslint`/`eslint-plugin-astro` — these are deferred for 90-day reassessment.

## Sequencing (in this order)

### Step 1 — Mass-reformat commit (`chore/prettier-mass-reformat`)

A dedicated branch and a single mechanical commit, **no logic changes**, to be reviewable as "no logic delta":

1. From `main`, create `chore/prettier-mass-reformat`.
2. Add devDeps + config files **without** wiring lefthook yet:
   - `prettier@^3.6` → devDependency
   - `.prettierrc.json` ← copy of [tmp/eslint-discovery/proposed.prettierrc.json](./discovery/proposed.prettierrc.json) (validated by Phase 1.2c equivalence check)
   - `.prettierignore` listing: `node_modules/`, `site/dist/`, `site/.astro/`, `agent-output/`, `tmp/`, `infra/`, `logs/`, `assets/`, `**/*.min.js`, `tools/mcp-servers/drawio/`
3. Run `npx prettier --write .` over the in-scope file set (50 JS/MJS reformats per the Phase 1.2 measurement). No `.astro` reformats in this commit because Astro stays out of scope.
4. Commit message: `chore: prettier mass-reformat (no logic changes)` with a body listing exact file count and a link to this plan.
5. Add the resulting commit SHA to `.git-blame-ignore-revs` (create the file at repo root; document in `CONTRIBUTING.md`):

   ```text
   # .git-blame-ignore-revs
   # Commits to skip when running `git blame`.
   # Configure locally with: git config blame.ignoreRevsFile .git-blame-ignore-revs
   <SHA-of-prettier-mass-reformat-commit>
   ```

6. PR review focuses on confirming "no logic delta" (use `git diff -w` to verify whitespace-only).
7. Merge to `main` standalone before Step 2.

### Step 2 — ESLint config + scripts (no enforcement yet)

Same branch (`chore/eslint-tools-adopt`) for steps 2–4. **Do not wire lefthook in this step.**

1. Add devDeps:
   - `eslint@^9.17`
   - `@eslint/js@^9.17`
   - `eslint-plugin-n@^17.15`
   - `eslint-config-prettier@^9.1`
   - `eslint-formatter-compact@^8.40` (required since ESLint 9 dropped the built-in compact formatter)
2. Add `engines.node`: `">=22"` in `package.json` (resolves the 12 `n/no-unsupported-features/node-builtins` config-gap findings observed in Phase 2.5).
3. Declare `js-yaml` in `devDependencies` (resolves the (a)-class real bug from Phase 2.5).
4. Create `eslint.config.mjs` — copy of [the POC config](./discovery/) tools-scope rules:

   ```javascript
   import js from "@eslint/js";
   import nodePlugin from "eslint-plugin-n";
   import prettierConfig from "eslint-config-prettier";

   export default [
     {
       ignores: [
         "node_modules/**",
         "site/**",                  // Adopt-narrow: site/ deferred
         "tools/mcp-servers/drawio/**",
         "agent-output/**",
         "tmp/**",
         ".eslintcache",
         "infra/**",
         "logs/**",
         "assets/**",
         "**/*.min.js",
       ],
     },
     js.configs.recommended,
     nodePlugin.configs["flat/recommended-module"],
     {
       languageOptions: { ecmaVersion: 2024, sourceType: "module" },
       rules: {
         "prefer-const": "error",
         eqeqeq: ["error", "smart"],
         "no-var": "error",
         "prefer-template": "error",
         "n/prefer-node-protocol": "error",
         "n/hashbang": "off",        // Validators all use `#!/usr/bin/env node` shebangs intentionally
         "no-console": "off",
       },
     },
     {
       files: ["tools/scripts/**/*.{js,mjs,cjs}"],
       rules: { "n/no-process-exit": "off" },
     },
     {
       files: ["tools/tests/**/*.{js,mjs,cjs}"],
       rules: { "n/no-process-exit": "off", "n/no-unpublished-import": "off" },
     },
     prettierConfig,
   ];
   ```

5. Append npm scripts to [package.json](../../../package.json) (token-frugal flags from Phase 2.1):

   ```json
   "lint:js": "eslint --cache --cache-location node_modules/.cache/eslint/ --quiet --format=compact",
   "lint:js:warnings": "eslint --cache --cache-location node_modules/.cache/eslint/ --format=compact",
   "lint:js:json": "eslint --cache --cache-location node_modules/.cache/eslint/ --quiet --format=json",
   "format": "prettier --write --cache --cache-location node_modules/.cache/prettier/ --log-level warn .",
   "format:check": "prettier --check --cache --cache-location node_modules/.cache/prettier/ --log-level warn ."
   ```

6. Add to `.gitignore`:

   ```text
   .eslintcache
   node_modules/.cache/
   ```

### Step 3 — Auto-fix all current findings, then verify clean

In the same branch, after Step 2:

1. `npm run lint:js -- --fix tools/scripts tools/tests` → expect 76 (b)-class auto-fixes.
2. The 53 (d)-class findings (`n/hashbang`, `n/no-unsupported-features/node-builtins`) are silenced by Step 2's
   config (`n/hashbang: "off"`, `engines.node: ">=22"`).
3. The 1 (a)-class finding (`js-yaml` extraneous) is silenced by Step 2's `js-yaml` devDependency add.
4. Re-run `npm run lint:js -- --max-warnings=0 tools/scripts tools/tests` → must exit 0 with 0 bytes stdout. **This
   is the Verification §2 reproducibility test.** If non-zero, stop and triage.
5. Run `npm run format:check` → must exit 0 (mass-reformat from Step 1 already on main).

### Step 4 — Wire pre-commit hook (token-frugal, staged-only)

Append to [lefthook.yml](../../../lefthook.yml) `pre-commit.commands` block (matching the existing pattern):

```yaml
    js-lint:
      glob: "**/*.{js,mjs,cjs}"
      run: |
        STAGED_JS=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|mjs|cjs)$' || true)
        # Out-of-scope filter for Adopt-narrow: skip site/ until reassessment
        STAGED_JS=$(echo "$STAGED_JS" | grep -vE '^site/' || true)
        if [ -n "$STAGED_JS" ]; then
          COUNT=$(echo "$STAGED_JS" | wc -l | tr -d ' ')
          echo "🧹 Linting $COUNT JS/MJS file(s)..."
          echo "$STAGED_JS" | xargs npx eslint --cache --cache-location node_modules/.cache/eslint/ --quiet --format=compact --max-warnings=0
        else
          echo "ℹ️  No JS/MJS files to lint"
        fi
      fail_text: |
        ❌ ESLint failed.
        🔧 Fix: npm run lint:js -- --fix <files>  (or run `npm run lint:js:warnings` to see warnings too)
        📚 Reference: eslint.config.mjs

    js-format:
      glob: "**/*.{js,mjs,cjs}"
      run: |
        STAGED_FMT=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(js|mjs|cjs)$' || true)
        STAGED_FMT=$(echo "$STAGED_FMT" | grep -vE '^site/' || true)
        if [ -n "$STAGED_FMT" ]; then
          echo "💅 Checking Prettier on $(echo "$STAGED_FMT" | wc -l | tr -d ' ') file(s)..."
          echo "$STAGED_FMT" | xargs npx prettier --check --cache --cache-location node_modules/.cache/prettier/ --log-level warn
        else
          echo "ℹ️  No JS/MJS files to format-check"
        fi
      fail_text: |
        ❌ Prettier check failed.
        🔧 Fix: npm run format -- <files>
```

Per Phase 2.4 measurement, this adds set-1 +109 ms / set-20 +746 ms (cold cache) on top of the current 691 ms
chain. Within absolute gates (set-1 ≤800 ms, set-20 ≤3000 ms).

### Step 5 — Wire safety-net layer (CI parity)

Append `lint:js` to the `validate:_node-ci` script in [package.json](../../../package.json) so CI catches anything the
hook missed (e.g., a developer who bypassed pre-commit with `--no-verify`):

- Edit `validate:_node-ci`: append `lint:js` to the `run-p` chain. Same change in `validate:_node` for local parity.
- The `lint:js` script as defined operates on default config-discovered files; in CI add explicit args:
  - `"lint:js:ci": "npm run lint:js -- --max-warnings=0 tools/scripts tools/tests"` and reference that one.

### Step 6 — Trim instructions doc (delete superseded prose)

Edit [.github/instructions/javascript.instructions.md](../../.github/instructions/javascript.instructions.md):

Delete the following bullets from the "Conventions" section (per Phase 1.4 [rule-mapping.md](./discovery/rule-mapping.md)):

- "Use `const` by default, `let` when reassignment is needed, never `var`" (now `prefer-const` + `no-var`)
- "Use double quotes for strings (matches Prettier config)" (now `singleQuote: false` in `.prettierrc.json`)
- "Use template literals for string interpolation" (now `prefer-template`)
- "Use `===` and `!==` for comparisons" (now `eqeqeq`)

Delete from "Module System":

- "Import Node.js built-ins with the `node:` protocol: `import fs from \"node:fs\"`" (now `n/prefer-node-protocol`)

Replace the deleted bullets with a single-line pointer at the top of "Conventions":

> **Mechanical conventions** are enforced by [`eslint.config.mjs`](../../eslint.config.mjs) (rules: `prefer-const`,
> `eqeqeq`, `no-var`, `prefer-template`, `n/prefer-node-protocol`) and [`.prettierrc.json`](../../.prettierrc.json)
> (double quotes, 2-space indent, 120-col width, LF). Edit those files to change the rules; this section covers
> the architectural conventions linters cannot encode.

Edit [.github/instructions/json.instructions.md](../../.github/instructions/json.instructions.md#L12) — the line
that says "Prettier configured in devcontainer" — to read "Prettier configured via `.prettierrc.json` (CLI) and
the VS Code extension; both share config".

### Step 7 — Validator retirement

Per [overlap-candidates.md](./discovery/overlap-candidates.md): **no validators retire** under
this adoption. The validators in `tools/scripts/` operate on markdown/JSON/YAML, ESLint operates on JS/TS — disjoint
surfaces. This step is a no-op recorded for completeness so future readers don't expect deletions.

### Step 8 — Rollout sequencing

In strict order, one PR each:

1. **PR 1** — Step 1 (mass-reformat). Whitespace-only diff; review focus is "no logic change" check via `git diff -w`. Land standalone.
2. **PR 2** — Steps 2 + 3 (config files, devDeps, auto-fix to clean). Review focuses on the `eslint.config.mjs` rule set + the `js-yaml` devDependency add.
3. **PR 3** — Step 4 (lefthook wire-up). Smaller surface; reviewable by running `lefthook run pre-commit --files <set>` locally.
4. **PR 4** — Steps 5 + 6 + 7 (CI safety-net, instructions trim, validator-retirement no-op).

Between PR 2 and PR 3, run a 1-week soft-enforce window:

- Set the pre-commit ESLint command to use `--max-warnings=10000` (effectively warn-only) so contributors see
  output but commits don't block. After 1 week of zero new findings, flip to `--max-warnings=0` (PR 3).

### Step 9 — Site/ reassessment trigger

After 90 days, re-run Phase 2.4 ESLint on `site/` with `typescript-eslint` + `eslint-plugin-astro` installed in
a scratch worktree (using the same harness as `chore/eslint-poc`). If site/ has accumulated ≥3 (a)/(b)-class
findings, open a follow-up plan to extend coverage. If still 0, defer another 90 days.

## Verification

- After PR 2 merges, `npm run lint:js -- tools/scripts tools/tests` exits 0 silently (PASS = literally 0 bytes stdout).
- After PR 3 merges, `git commit` of an in-scope file with a deliberate `let x = 1` (where `x` is never reassigned) blocks with `prefer-const` error in compact format.
- After PR 4 merges, `npm run validate:_node-ci` includes lint output in its CI artifact.
- All four PRs combined keep the JS-only pre-commit chain median at ≤1.5 s for staged-20.

## Rollback

Each PR is rebaseable independently:

- PR 1 rollback: `git revert <mass-reformat-SHA>` and remove `.git-blame-ignore-revs`.
- PR 2 rollback: revert + `npm rm eslint @eslint/js eslint-plugin-n eslint-config-prettier eslint-formatter-compact prettier`.
- PR 3 rollback: revert just the `lefthook.yml` block.
- PR 4 rollback: revert the `validate:_node-ci` change and restore the deleted prose in `javascript.instructions.md`.
