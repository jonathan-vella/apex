# Phase 1.3 — Bug-class Hunt (Manual Review)

Date: 2026-05-08
Files reviewed in detail:
- tools/scripts/_lib/parse-frontmatter.mjs (160 lines)
- tools/scripts/_lib/regex-helpers.mjs (32 lines)
- tools/scripts/validate-agents.mjs (1229 lines, sampled regex sites)
- tools/scripts/validate-skills.mjs (374 lines)
- tools/scripts/validate-artifacts.mjs (1348 lines, sampled regex sites)

Method: read each helper end-to-end; for the large validators, grep for regex
operators, `await`, `let`, and `==`/`var` patterns and inspect each hit.

## Findings (human-reviewer upper bound for ESLint catches)

### (a) Real-bug class

**None found** in the manual hunt. The regex-heavy code is defensive (lastIndex
management is centralized in `regex-helpers.mjs::findAllMatches`), all loops are
synchronous (no `await` inside `for`), and there are no `var` declarations
anywhere in the sampled files. The `let` declarations that exist
(`overallFailed`, `currentKey`, `currentValue`, `inArray`, `inMultilineString`,
`pendingKey`) are all reassigned in state-machine bodies, so `prefer-const`
would not flag them.

This means **the bug-class catch from ESLint adoption is expected to be (b) and
(d), not (a)**, on the existing codebase. The shift-left value is forward-looking:
catching new bugs before they land, not retrofitting old ones.

### (b) Smell class

1. **`no-useless-escape` candidates** — `\[` inside a character class is
   redundant (the `]` MUST be escaped, but `[` need not). Three sites:

   - `tools/scripts/_lib/parse-frontmatter.mjs:35`  `replace(/[\[\]]/g, "")`
   - `tools/scripts/_lib/parse-frontmatter.mjs:50`  `replace(/["\[\],]/g, "")`
   - `tools/scripts/_lib/parse-frontmatter.mjs:68`  `replace(/[\[\]]/g, "")`

   Behavior is identical to the cleaner form (e.g. `/[[\]]/g`). Pure cosmetic,
   would auto-fix via `eslint --fix`.

2. **Non-`node:`-protocol imports** — 4 sites, would be flagged by
   `n/prefer-node-protocol`:

   - `tools/scripts/fetch-azure-deprecations.mjs:10`  `from "fs"`
   - `tools/scripts/validate-vscode-config.mjs:11`   `from "fs"`
   - `tools/scripts/validate-vscode-config.mjs:12`   `from "path"`
   - `tools/scripts/validate-vscode-config.mjs:13`   `from "url"`

   These directly contradict the `javascript.instructions.md` rule
   "Import Node.js built-ins with the `node:` protocol". Auto-fixable.

### (c) False-positive class

Anticipated, **not yet observed** because a real ESLint run hasn't been done. The
real Phase 2 run will surface these. Likely candidates:

- `n/no-process-exit` will fire on ~30 validators that exit with a non-zero code
  by design. Phase 2.1 already plans an override disabling this rule for
  `tools/scripts/**`.
- `n/no-unsupported-features/es-syntax` may fire if `engines.node` is not pinned
  in `package.json`. Pre-emptive note for Phase 2.

### (d) Config-gap class

- The override above (`n/no-process-exit` off for `tools/scripts/**`) is the
  primary expected gap.
- `tools/tests/**` may need `node/global-require` or `n/no-unpublished-import`
  relaxations because tests import from devDependency-only paths.

## Bug-class catch upper bound (manual)

| Severity | Count | Auto-fixable |
| -------- | ----- | ------------ |
| (a) Bug  | 0     | n/a          |
| (b) Smell | 7    | yes          |
| (c) FP   | 0 (manual review)    | n/a          |
| (d) Gap  | 1–2 (anticipated) | n/a |

Phase 2 will produce the actual machine-counted ESLint findings, classified by
the same scheme.
