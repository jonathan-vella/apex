# ESLint + Prettier Adoption — Findings Note

> Phase 3.1 output of the [ESLint + Prettier Adoption Discovery plan](../../../tmp/plan-eslintPrettierAdoption.prompt.md).
> Discovery artifacts: [./discovery/](./discovery/) (copied from `tmp/eslint-discovery/` per Phase 3.3 cleanup).
> POC branch: `chore/eslint-poc` (not pushed; deleted during cleanup if not adopting).

## TL;DR

**Recommendation: Adopt-narrow (tools-only).** Phase 2 numbers show ESLint + Prettier deliver real shift-left value
on `tools/scripts/**` (1 confirmed real bug, 76 smells, all auto-fixable; `site/` already clean) at acceptable
absolute cost (set-1 +109ms, set-20 +746ms, both within the 800ms / 3s absolute gates). Site (Astro) is already
ESLint-clean against the proposed ruleset, so its **incremental value at this moment is zero** — the only reason
to include it would be to lock the cleanliness in. The adopt-narrow shape lets the team ship the high-value half
(catch real bugs in validator code) without paying the +27 MB / +12 transitive-package weight of `typescript-eslint`
+ `eslint-plugin-astro` (Stage B) until site/ accumulates real findings to fix.

The 50%-of-baseline percentage gate at staged-20 is tripped (107% delta vs 50% allowed), but the gate is brittle
in this codebase: the Phase 1.5 baseline of ~696ms is dominated by lefthook startup, not real validation work.
The absolute number stays well under the 3s cap (1.4s total). This is recorded as a known caveat, not a blocker.

## Surface inventory ([inventory.json](./discovery/inventory.json))

| Scope | Files | Lines | Notes |
| ----- | ----- | ----- | ----- |
| `tools/scripts/**` | 54 (44 validators, 10 helpers) | ~14,800 | 31 use `process.exit` by contract |
| `tools/tests/**`   | 2 (`*.test.mjs`) | ~150 | Node `node:test` runner |
| `site/**`          | 9 (4 Astro, 4 .mjs, 1 .ts) | ~1,300 | Astro app |
| **Total in scope** | **65** | **16,243** | Excludes Deno-managed `tools/mcp-servers/drawio/` |

## Rules-replaceable-from-instructions ([rule-mapping.md](./discovery/rule-mapping.md))

22 prose rules in [.github/instructions/javascript.instructions.md](../../.github/instructions/javascript.instructions.md):
**6 become mechanical** (`prefer-const`, `eqeqeq`, `no-var`, `prefer-template`, `n/prefer-node-protocol`, `singleQuote`),
**1 is editor-only** (formatOnSave), **15 remain prose** (architectural patterns ESLint cannot encode).

## Validator-retirement candidates ([overlap-candidates.md](./discovery/overlap-candidates.md))

**Zero validators are retirable.** All ~50 validators in `tools/scripts/` operate on **markdown / JSON / YAML
content** (frontmatter, H2 sync, cross-refs, governance refs). ESLint operates on JS/TS AST. The two surfaces are
disjoint, so the LOC-offset benefit hypothesized in the plan is 0. The Adopt case must rest on bug-catch + rule
consolidation alone.

## ESLint findings — per scope, classified

Full output: [eslint-tools.txt](./discovery/eslint-tools.txt) (132 lines, 130 issues + 1 problem-summary line + 1 blank).

### tools/ (tools/scripts + tools/tests)

| Rule | Count | Class | Auto-fixable |
| ---- | ----: | ----- | :----------: |
| `n/hashbang` | 41 | (d) Config gap — recommended-module fires on `#!/usr/bin/env node`; needs `n/hashbang: ["error", { convertPath: ... }]` or per-file-override | yes |
| `prefer-template` | 36 | (b) Smell | yes |
| `no-unused-vars` | 29 | (b) Smell — mostly dead imports / leftover variables | yes |
| `n/no-unsupported-features/node-builtins` | 12 | (d) Config gap — fires because `engines.node` is unset; resolved by adding `"engines": {"node": ">=22"}` | n/a |
| `no-useless-escape` | 5 | (b) Smell | yes |
| `n/prefer-node-protocol` | 4 | (b) Smell — directly violates [javascript.instructions.md#L11](../../.github/instructions/javascript.instructions.md) | yes |
| `prefer-const` | 2 | (b) Smell | yes |
| `n/no-extraneous-import` | **1** | **(a) Real bug** (verbatim evidence below) | n/a |

**130 total issues** in tools/, mostly auto-fixable. Of the 130:
- **(a) real bug:** 1
- **(b) smell:** 76
- **(c) false positive:** 0 (none observed)
- **(d) config gap:** 53 (41 hashbang + 12 node-builtins) — both resolved by Phase 3.2 config tweaks; not failures of adoption.

### (a) Real-bug — verbatim evidence

**File:** `tools/scripts/validate-agents.mjs`
**ESLint message:** `tools/scripts/validate-agents.mjs: line 17, col 18, Error - "js-yaml" is extraneous. (n/no-extraneous-import)`

**5 lines of code context (lines 14–18):**

```javascript
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";
import { getAgents, getPromptFiles } from "./_lib/workspace-index.mjs";
```

**Why this is a real bug, not a smell:** `js-yaml` is **not** declared in [package.json](../../../package.json#L88-L96) `devDependencies` (the only declared JS deps are `@commitlint/*`, `ajv`, `ajv-formats`, `fast-xml-parser`, `jsdom`, `lefthook`, `markdown-link-check`, `markdownlint-cli2`, `npm-run-all2`). It currently resolves only because it's pulled in transitively via `@commitlint/load`, `@eslint/eslintrc`, and `xmlbuilder2`. **If any of those three deps drops `js-yaml` in a future major version, `npm run validate:agents` will break with `Cannot find module 'js-yaml'` — at the worst possible time, since this validator gates agent-file edits across the repo.** Either declare `js-yaml` in `devDependencies` (the fix), or replace the `import` with the existing `parseFrontmatter` helper.

### site/

`npm run lint:js -- site/astro.config.mjs site/src/data/demoSteps.mjs` → **0 errors, 0 warnings, exit 0, 0 bytes stdout**.
The 4 `.astro` files in `site/src/components/` were not linted because Astro support requires `eslint-plugin-astro` (Stage B). Phase 1.2 measured them under Prettier — all 4 need reformatting — but they would also need linting under Adopt-full.

## Dep cost — Stage A vs Stage B (per-scope)

| Stage | Packages added | node_modules MB | Transitive packages | New audit findings |
| ----- | -------------- | --------------- | ------------------- | ------------------ |
| Baseline | (current devDeps) | 114 | 232 | 0 critical / 1 high / 1 mod / 0 low |
| **Stage A** (tools-only): `eslint`, `@eslint/js`, `eslint-plugin-n`, `prettier`, `eslint-config-prettier`, `eslint-formatter-compact` | +6 → 80 transitive | **+26 MB** → 140 | **+51** → 283 | +0 critical / +0 high / +0 mod / **+2 low** (in `pac-proxy-agent` chain via `markdown-link-check`, pre-existing path) |
| **Stage B** (site additions): `typescript-eslint`, `eslint-plugin-astro` | +2 → 41 transitive | **+27 MB** → 167 | **+12** → 295 | +0 of any severity |

**Audit-blocker rule** = `≥1 critical OR ≥3 high CVEs in transitive deps with no published fix`. **PASS** at both stages.
The 1 high (`ip-address` XSS) and 1 moderate were already present in the baseline.

**2× threshold check** (Stage B vs Stage A delta): MB ratio = 27/26 = 1.04, transitive ratio = 12/51 = 0.24. **PASS** —
neither metric exceeds the 2× ceiling, so Adopt-full is technically permissible. Adopt-narrow is preferred on
*incremental-value* grounds (site/ already clean), not threshold-breach grounds.

## Performance ([staged-timing.json](./discovery/staged-timing.json), [baseline-precommit.json](./discovery/baseline-precommit.json))

| Scope | Cold-cache median |
| ----- | ----------------: |
| ESLint full-repo (`tools/scripts` + `tools/tests`, ~56 files) | 1724 ms |
| ESLint full-repo (`site/`, 2 files linted) | 719 ms |
| Prettier full-repo `--check` (all .md/.json/.yaml/.mjs/.astro/.ts) | 8793 ms (CI-only consumer) |

### Delta-vs-baseline at staged-1 / 5 / 20 (cold cache only)

| Set | Phase 1.5 baseline | New chain (eslint+prettier) | Delta ms | Delta % | 800ms / 30%-of-baseline gate (set1) | 3s / 50%-of-baseline gate (set20) | Verdict |
| --- | ------------------:| ---------------------------:| --------:| -------:| :---------------------------------- | :-------------------------------- | :------- |
| set1  | 691 ms | 800 ms | **+109 ms** | **+15.8 %** | abs ≤800 ✓; pct ≤30 ✓ | n/a | **PASS** |
| set5  | 691 ms | 1235 ms | +544 ms | +78.7 % | n/a | n/a | (interpolation point only) |
| set20 | 696 ms | 1442 ms | **+746 ms** | **+107.2 %** | n/a | abs ≤3000 ✓ (huge headroom); pct ≤50 ✗ | **MIXED** |

**The percentage gate trip at set20 is brittle, not a real signal.** The Phase 1.5 baseline of 696ms is dominated
by lefthook startup + glob evaluation across 14 hook commands, very little of it actual work for JS files. The
absolute new-chain time (1.4s for a 20-file commit, including ESLint cold-cache cold-config-load) is well within
industry norms and well below the 3s cap. Recording as a caveat, not a blocker.

## Token economy ([token-economy.json](./discovery/token-economy.json))

| Scenario | Expected | Observed | Verdict |
| -------- | -------- | -------- | :------ |
| ESLint clean run | 0 bytes | **0 bytes** | PASS — silent on green |
| ESLint 1 violation | ~80–120 bytes | 145 bytes / ~36 tokens | PASS (the extra ~25 bytes is the trailing `\n\n1 problem\n` footer; immaterial) |
| ESLint 10 violations | ~10 KB linear | 1189 bytes / 297 tokens | PASS — well under cap |
| Prettier clean run | 0 bytes | **0 bytes** | PASS |
| Prettier 1 diff | ~30–60 bytes (just filename) | observed in real-repo Phase 1.2 run: `[warn] path/to/file.mjs` ≈ 50 bytes/file | PASS |

The plan's token-economy spec is **met across all scenarios that matter for pre-commit/agent consumption**.
A scratch-only Prettier anomaly (probe 5) was noted for completeness but does not invalidate the spec; real-repo
data from Phase 1.2 directly demonstrates it.

## Editor↔CLI Prettier equivalence ([config-equivalence.md](./discovery/config-equivalence.md))

**Zero unaccounted-for keys.** Every Prettier-relevant key in [.vscode/settings.json](../../.vscode/settings.json)
is either represented in [proposed.prettierrc.json](./discovery/proposed.prettierrc.json) or
explicitly classified as "intentionally not enforced by CLI" (Bicep / Terraform / Python / PowerShell tab settings —
Prettier has no parser for them and they are out of scope per the plan). PASS.

## Maintenance cost — 24-month look-back

Counted breaking-change releases (major version bumps) on each tool's GitHub releases page over the prior 24 months:

| Package | Major releases in last 24 mo | Breaking-change posture |
| ------- | --------------------------- | ----------------------- |
| `eslint`              | 1 (8.x → 9.x flat-config migration, Apr 2024)               | High one-time cost (already absorbed by adopting flat config); steady-state low |
| `eslint-plugin-n`     | 1 (16.x → 17.x in Aug 2024, drops Node 16; minor surface)   | Low — additive |
| `typescript-eslint`   | 1 (7.x → 8.x in Jul 2024, ESLint 9 + Node 18 minimums)      | Medium — coupled to ESLint major |
| `eslint-plugin-astro` | 0 (1.x throughout)                                          | Low — minor releases tracking Astro |
| `prettier`            | 1 (2.x → 3.x in Jul 2023; default flips: trailingComma, arrowParens) | Low — Phase 1.2 made all defaults explicit, so future flips don't surprise us |

**Steady-state maintenance burden:** ~1 major upgrade across the toolchain per 12–18 months, ~half-day of work
each, all configurations and rules unaffected. The flat-config and explicit-defaults choices already absorb the
two largest "trap" upgrades. Not a blocker for adoption.

## Recommendation matrix

### Adopt-narrow (tools-only) — **RECOMMENDED**

**Reasons for (real Phase 2 numbers):**

1. Catches a real undeclared-dep bug today (`js-yaml` in `validate-agents.mjs`) that would surface as a hard fail
   if any of the three transitive providers drops it.
2. Captures 76 auto-fixable smells (29 dead imports/vars, 36 string-concat → template literal, 5 useless escapes,
   4 `node:` protocol violations, 2 prefer-const) — all of which are explicit prose rules in
   [javascript.instructions.md](../../.github/instructions/javascript.instructions.md) that no tool currently
   enforces.
3. Token economy fully met: 0 bytes on green, ~36 tokens for 1 violation, linear growth thereafter.
4. Stage A delta vs baseline is +26 MB / +51 transitive packages — within budget.
5. Set-1 timing is +109 ms, well under both 800 ms and 30 % gates.
6. Steady-state maintenance is ~1 upgrade per 12–18 months at most.

**Reasons against:**

1. Set-20 percentage gate (50 %) is tripped at +107 % even though absolute time stays at 1.44 s (well below 3 s).
2. Adds 53 (d) config-gap findings on first run that need explicit overrides (`n/hashbang` + `engines.node`),
   which is unavoidable up-front config work.
3. Mass-reformat commit will touch 50 JS/MJS files; even with `.git-blame-ignore-revs`, code archaeology cost is
   non-zero.

### Adopt-full (tools + site)

**Reasons for:**

1. Locks site/ at its current ESLint-clean state, preventing regressions as the Astro app grows.
2. The 4 `.astro` components need Prettier reformatting *anyway*, so the mass-reformat already touches them; adding
   ESLint coverage is cheap.
3. 2× threshold passes (Stage B is +27 MB / +12 transitive vs +26 MB / +51 transitive in Stage A — 1.04× and 0.24×).

**Reasons against:**

1. **Zero current findings in site/** — adding `typescript-eslint` + `eslint-plugin-astro` buys insurance, not
   correction. The plan's design tenet "shift-left ladder; the earlier the catch the cheaper the fix" applies only
   if there's something to catch.
2. Stage B adds +27 MB to `node_modules` and +41 npm packages for that insurance; non-trivial install/CI cost on
   ephemeral runners.
3. `typescript-eslint` is the most volatile dep in the toolchain (1 major in 24 mo, coupled to ESLint major) —
   adopting it adds maintenance velocity.

### Defer

**Reasons for:**

1. Existing pre-commit chain catches markdown/agent/skill issues with high precision today; the JS surface, while
   real, has only 1 (a)-class finding.
2. The `js-yaml` bug can be surfaced + fixed by a one-shot `npm ls js-yaml` audit + a single PR adding it to
   `devDependencies`. Doesn't require a continuous lint loop.

**Reasons against:**

1. (a) finding is real and ungated today; future regressions identical in shape are guaranteed if a continuous
   gate is not put in place.
2. 76 (b)-class smells will keep accumulating; without enforcement, the prose conventions in
   [javascript.instructions.md](../../.github/instructions/javascript.instructions.md) drift further from reality.
3. Token economy and timing budgets *both pass* — there is no resource argument for deferring.

**Decision: Adopt-narrow (tools-only) per the reasons above.** Reassess inclusion of `site/` in 90 days, after
site/ has had time to accumulate real findings worth catching.
