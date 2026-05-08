# Phase 1.4 — Convention Extraction

Source: [.github/instructions/javascript.instructions.md](../../.github/instructions/javascript.instructions.md)

Each prose rule is tagged with its mechanical destination:

| # | Rule (verbatim or near-verbatim) | Tag | Mapping |
|---|----------------------------------|-----|---------|
| 1 | "Use ES modules exclusively — all scripts use `.mjs` extension" | ESLint plugin-n | `n/file-extension-in-import` (advisory) + filename convention enforced via repo glob |
| 2 | "Import Node.js built-ins with the `node:` protocol" | ESLint plugin-n | `n/prefer-node-protocol` (recommended-module) |
| 3 | "Prefer `node:fs/promises` over callback-based `node:fs` for async operations" | Still prose | No equivalent ESLint rule; remains a code-review item |
| 4 | "Use named imports where practical" | Still prose | No mechanical check; subjective |
| 5 | "Constants at top" | Still prose | Not lintable |
| 6 | "Use `const` by default, `let` when reassignment is needed, never `var`" | ESLint core | `prefer-const` + `no-var` |
| 7 | "Use double quotes for strings (matches Prettier config)" | Prettier territory | `singleQuote: false` (already in `proposed.prettierrc.json`) |
| 8 | "Use template literals for string interpolation" | ESLint core | `prefer-template` |
| 9 | "Use `===` and `!==` for comparisons" | ESLint core | `eqeqeq` |
| 10 | "Prefer arrow functions for callbacks" | Still prose | `prefer-arrow-callback` exists but stylistic; intentionally not added per Phase 2.1 narrow ruleset |
| 11 | "Use destructuring where it improves readability" | Still prose | `prefer-destructuring` exists but subjective; not added |
| 12 | "End files with `process.exit(...)` for validation scripts" | Still prose / convention | `n/no-process-exit` would block this; per-file-override allows it for `tools/scripts/**` |
| 13 | "Validation scripts: accumulate errors, log all issues, then exit" | Still prose | Architectural convention, not lintable |
| 14 | "Use `try/catch` for file operations that may fail" | Still prose | Not lintable |
| 15 | "Log errors to stderr with descriptive messages including the file path" | Still prose | Not lintable |
| 16 | "Use emoji prefixes for log output" | Still prose | Not lintable |
| 17 | "Use `fs.readFileSync` for simple validation scripts" | Still prose | Not lintable |
| 18 | "Use `path.join()` or `path.resolve()` for paths — never string concatenation" | Still prose | Some paths may be caught by `n/no-path-concat` but coverage incomplete |
| 19 | "Walk directories with `fs.readdirSync` and filter by extension" | Still prose | Not lintable |
| 20 | "Check existence with `fs.existsSync` before reading" | Still prose | Not lintable; opinionated |
| 21 | "Minimize external dependencies — prefer Node.js built-ins" | Still prose | `n/no-extraneous-import` partial; needs governance review |
| 22 | "Do not add runtime dependencies" | Still prose | Reviewable in PR; package.json `dependencies` block stays empty |

## Summary

| Tag | Count | Action in Phase 3.2 if Adopt |
|-----|-------|------------------------------|
| Prettier territory | 1 | Delete from instructions; replace with one-line pointer to `.prettierrc.json` |
| ESLint core | 4 | Delete from instructions; replace with one-line pointer to `eslint.config.mjs` |
| ESLint plugin-n | 2 | Delete from instructions; replace with one-line pointer to `eslint.config.mjs` |
| Still prose | 15 | Keep; these are architectural / stylistic conventions ESLint cannot enforce |

## Mechanical checks consolidated to `eslint.config.mjs` (Phase 2.1 source of truth)

```text
@eslint/js recommended
eslint-plugin-n recommended-module
prefer-const
eqeqeq
no-var
prefer-template
n/prefer-node-protocol
```

This list is the single source of truth (per Decisions block in the plan). The
prose-rule trim in Phase 3.2 must point at this list verbatim.
