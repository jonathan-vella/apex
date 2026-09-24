---
description: "JavaScript and Node.js conventions for validation scripts and tooling"
applyTo: "**/*.{js,mjs,cjs}"
---

# JavaScript Guidelines

Repository-specific rules for Node.js tooling. Scripts are ES modules (`.mjs`) and target
Node.js `>=22` (`package.json` engines); CI runs Node 24. Prettier and ESLint own general
style — run them instead of hand-formatting.

## Modules and Structure

- Import built-ins with the `node:` protocol (`import fs from "node:fs"`).
- Keep validator logic in an exported function and the CLI entrypoint thin. Async entrypoints
  must be awaited so `validate-all.mjs` can isolate lifecycle and exit codes.
- Return an exit code or result object from validator logic; call `process.exit` only in the
  guarded CLI entrypoint:

```javascript
export async function runValidator(options = {}) {
  // Accumulate findings and return an exit code or result object.
}

const invokedAsScript =
  process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedAsScript) process.exit(await runValidator());
```

## Error Handling

- Validators accumulate findings, report every issue with its file path, then exit non-zero —
  do not throw on the first error. Prefer the shared `tools/scripts/_lib/reporter.mjs`.
- An explicit path argument that matches no files is an error, not a zero-file pass.
- Use `path.join()`/`path.resolve()` for paths, never string concatenation.

## Shared Helpers

Reuse `tools/scripts/_lib/` before writing new parsing code (`json.mjs`, `parse-jsonc.mjs`,
`h2-parser.mjs`, `glob-helpers.mjs`, `avm-patterns.mjs`).

### Frontmatter Parsing

Reuse `parseFrontmatter` from `tools/scripts/_lib/parse-frontmatter.mjs`
for repository YAML frontmatter, using the existing `js-yaml` dependency:

```javascript
import { parseFrontmatter } from "./_lib/parse-frontmatter.mjs";

const frontmatter = parseFrontmatter(content);
```

Adjust the relative import for the caller. The shared parser returns null when
frontmatter is absent and an empty object for an empty header. It uses
`yaml.JSON_SCHEMA`, lowercases only top-level keys, and preserves booleans,
arrays, multiline strings, and nested maps. Malformed YAML, non-mapping roots,
and duplicate keys (including case-insensitive top-level collisions) throw;
catch and report those errors with the source path at the validator boundary.
Do not treat parse errors as absent frontmatter or duplicate a regex parser.
Extend the shared parser only with focused tests; reuse existing dependencies.

## Dependencies

- `package.json` is tooling-only: no runtime `dependencies`.
- Prefer Node built-ins and existing dev dependencies (for example `js-yaml`, `ajv`,
  `jsonc-parser`); add a new one only when nothing present covers the need.
