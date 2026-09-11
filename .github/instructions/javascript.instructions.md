---
description: "JavaScript and Node.js conventions for validation scripts and tooling"
applyTo: "**/*.{js,mjs,cjs}"
---

# JavaScript Guidelines

Instructions for writing clean, consistent JavaScript in this repository. All scripts
target Node.js LTS (22+) and use ES modules (`.mjs`).

## Module System

- Use ES modules exclusively — all scripts use `.mjs` extension
- Import Node.js built-ins with the `node:` protocol: `import fs from "node:fs"`
- Prefer `node:fs/promises` over callback-based `node:fs` for async operations
- Use named imports where practical: `import { readFile } from "node:fs/promises"`

## Script Structure

Follow the existing pattern in `tools/scripts/`:

```javascript
#!/usr/bin/env node
/**
 * Brief description of what the script validates or does.
 *
 * @example
 * node tools/scripts/my-script.mjs
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Constants at top
const SOME_DIR = ".github/agents";

// Counters for validation scripts
let errors = 0;
let warnings = 0;

export async function runValidator(options = {}) {
  // Accumulate findings and return an exit code or result object.
}

const invokedAsScript =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(await runValidator());
```

## Conventions

- Use `const` by default, `let` when reassignment is needed, never `var`
- Use double quotes for strings (matches Prettier config)
- Use template literals for string interpolation
- Use `===` and `!==` for comparisons
- Prefer arrow functions for callbacks
- Use destructuring where it improves readability
- Export validator logic and keep the CLI entrypoint thin. Async entrypoints must
  be awaited so `validate-all.mjs` can isolate lifecycle and exit codes.
- Return an exit code or result object from validator logic; call `process.exit`
  only in the guarded CLI entrypoint.

## Error Handling

- Validation scripts: accumulate errors in a counter, log all issues, then exit
  with non-zero code — do not throw on first error
- Use `try/catch` for file operations that may fail
- Log errors to stderr with descriptive messages including the file path
- Use emoji prefixes for log output: `❌` errors, `⚠️` warnings, `✅` pass

## File System Operations

- Use `fs.readFileSync` for simple validation scripts (synchronous is fine)
- Use `path.join()` or `path.resolve()` for paths — never string concatenation
- Walk directories with `fs.readdirSync` and filter by extension
- Check existence with `fs.existsSync` before reading

## Frontmatter Parsing

Reuse `parseFrontmatter` from `tools/scripts/_lib/parse-frontmatter.mjs`
for the repository's supported YAML-like frontmatter subset:

```javascript
import { parseFrontmatter } from "./_lib/parse-frontmatter.mjs";

const frontmatter = parseFrontmatter(content);
```

Adjust the relative import for the caller. The shared parser returns null when
frontmatter is absent, lowercases keys, and supports arrays and multiline strings;
it is not a full YAML parser. Do not duplicate a regex parser or silently extend
the supported subset. For unsupported YAML structures, use an existing suitable
structured parser or extend the shared parser with focused tests; do not add a
new dependency without checking existing tooling.

## Dependencies

- Minimize external dependencies — prefer Node.js built-ins
- Current dev dependencies: `fast-xml-parser`, `markdownlint-cli2`, `lefthook`,
  `commitlint`, `markdown-link-check`
- Do not add runtime dependencies — this is a tooling-only `package.json`
