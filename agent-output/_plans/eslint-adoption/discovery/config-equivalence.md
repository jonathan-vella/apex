# Editor ↔ CLI Prettier Config Equivalence Check (Phase 1.2c)

Source of truth: [.vscode/settings.json](../../.vscode/settings.json) (editor) vs.
[proposed.prettierrc.json](./proposed.prettierrc.json) (CLI).

Pass condition: zero unaccounted-for keys.

## Prettier-relevant keys in `.vscode/settings.json`

| Editor key                                  | Editor value                | CLI representation                            | Status                                                                                                |
| ------------------------------------------- | --------------------------- | --------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `editor.formatOnSave`                       | `true`                      | n/a (editor behavior, not formatter rule)     | Represented (no CLI rule needed; CLI is invoked explicitly)                                           |
| `editor.defaultFormatter`                   | `esbenp.prettier-vscode`    | n/a (editor's choice of which formatter)      | Represented (CLI uses Prettier directly; same engine/output)                                          |
| `editor.rulers`                             | `[120]`                     | `printWidth: 120`                             | Represented                                                                                           |
| `editor.wordWrap`                           | `wordWrapColumn`            | n/a (display-only; not a formatter rule)      | Intentionally not enforced by CLI (purely cosmetic editor behavior)                                   |
| `editor.wordWrapColumn`                     | `120`                       | `printWidth: 120`                             | Represented                                                                                           |
| `files.eol`                                 | `"\n"`                      | `endOfLine: "lf"`                             | Represented                                                                                           |
| `editor.tabSize`                            | `2`                         | `tabWidth: 2`                                 | Represented                                                                                           |
| `[markdown].editor.defaultFormatter`        | `esbenp.prettier-vscode`    | n/a (engine choice)                           | Represented (CLI Prettier formats markdown identically)                                               |
| `[markdown].editor.rulers`                  | `[120]`                     | overrides.files=*.md → `printWidth: 120`      | Represented                                                                                           |
| `[markdown].editor.wordWrap`                | `wordWrapColumn`            | n/a (display-only)                            | Intentionally not enforced (cosmetic)                                                                 |
| `[bicep].editor.tabSize`                    | `2`                         | n/a (Prettier has no Bicep parser)            | Intentionally not enforced by CLI (Bicep formatting handled by `bicepLanguage` extension / `bicep format`) |
| `[terraform].editor.tabSize`                | `2`                         | n/a (Prettier has no HCL parser)              | Intentionally not enforced by CLI (handled by `terraform fmt` and `npm run lint:terraform-fmt`)       |
| `[terraform].editor.formatOnSave`           | `true`                      | n/a                                           | Intentionally not enforced (HashiCorp extension domain)                                               |
| `[terraform].editor.defaultFormatter`       | `hashicorp.terraform`       | n/a (explicit non-Prettier formatter)         | Intentionally not enforced (HCL is out-of-scope per plan)                                             |
| `[powershell].editor.tabSize`               | `4`                         | n/a (Prettier has no PowerShell parser)       | Intentionally not enforced by CLI (PowerShell out-of-scope per plan)                                  |
| `[python].editor.tabSize`                   | `4`                         | n/a (Prettier has no Python parser by default)| Intentionally not enforced by CLI (Python uses `ruff` per `npm run lint:python`)                      |
| `editor.formatOnSave` (global)              | `true`                      | n/a                                           | Represented (editor behavior)                                                                         |

## Prettier-3 defaults adopted explicitly

These are not in `.vscode/settings.json` but Prettier 3 defaults them; we make them explicit in the proposed config to
prevent silent drift if Prettier defaults change in a future major:

| CLI key          | Value      | Rationale                                                                          |
| ---------------- | ---------- | ---------------------------------------------------------------------------------- |
| `singleQuote`    | `false`    | Match Prettier 3 default; editor uses Prettier so already in effect                |
| `arrowParens`    | `"always"` | Prettier 3 default; explicit to lock against future default flip                   |
| `trailingComma` | `"all"`    | Prettier 3 default; explicit to prevent regression on Node ≥10 environments       |
| `semi`           | `true`     | Prettier 3 default                                                                 |
| `bracketSpacing` | `true`     | Prettier 3 default                                                                 |

## Result

**Zero unaccounted-for keys.** All Prettier-relevant editor settings are either represented in
`proposed.prettierrc.json` or explicitly classified as "intentionally not enforced by CLI" with rationale (parser-not-available
or out-of-scope per the plan's Scope section).

Pass: ✅
