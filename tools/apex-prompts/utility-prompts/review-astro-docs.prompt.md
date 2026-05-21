---
description: "Single deep-reviewer audit of the Astro Starlight docs site covering completeness, accuracy, errors, grammar, visuals, Microsoft terminology, site standards, and information architecture. Report-only by default; safe auto-fix gated behind --apply-fixes."
agent: agent
model: "Claude Opus 4.7"
tools:
  - vscode
  - read
  - search
  - execute
  - edit
  - web
  - agent
argument-hint: "Optional: scope path under site/src/content/docs/ (e.g., 'getting-started/'), and/or --apply-fixes, --screenshot-age-months N"
---

# Review Astro Docs (Deep)

Perform a deep single-reviewer audit of every Markdown / MDX page under
`site/src/content/docs/` along eight dimensions, emit a categorised Markdown
report and a severity-tagged JSON findings file, and optionally apply a
narrow allow-list of safe fixes when the user passes `--apply-fixes`.

This prompt OWNS information-architecture recommendations for the docs
site. The peer-review prompt (`plan-docsPeerReview.prompt.md`) and the
gardening prompt (`doc-gardening.prompt.md`) do not propose IA changes.

<investigate_before_answering>

- Confirm the `sidebar` in `site/astro.config.mjs` is readable and parse
  it as the authoritative published-page list. The on-disk file tree is
  the inventory; the sidebar is the published-page filter.
- Confirm `tools/registry/count-manifest.json` exists and load it as the
  authoritative source for entity counts (agents, subagents, skills,
  instructions, prompts).
- Detect arguments: a scope path (subfolder under
  `site/src/content/docs/`), the `--apply-fixes` flag (default OFF), and
  `--screenshot-age-months N` (default 4).
- Check that `logs/copilot/docs-review/` is reachable. If the repository's
  `.gitignore` does not contain `!logs/copilot/docs-review/`, surface a
  one-line instruction in the report so the JSON audit trail becomes
  committable. Continue regardless — the report still writes.

</investigate_before_answering>

<context>

- **In scope**: all `.md` / `.mdx` files under `site/src/content/docs/`
  including `getting-started/`, `concepts/`, `guides/`, `reference/`,
  `project/`, `demo/`. If a scope path argument is supplied, restrict to
  that subtree but always run sidebar parsing and orphan detection on
  the full set.
- **Out of scope (read-only context, never edited)**: `agent-output/**`,
  `tools/registry/*.json`, `site/astro.config.mjs`, `site/src/data/**`,
  `site/src/components/**`, `site/src/styles/**`, `site/public/**`
  binaries, theme files.
- **Authoritative inputs**:
  - `site/astro.config.mjs` (sidebar = published pages)
  - `tools/registry/count-manifest.json` (entity counts)
  - `tools/registry/agent-registry.json` (agent → file mapping)
  - `.github/skills/workflow-engine/templates/workflow-graph.json`
    (workflow step list, incl. Step 3.5)
  - `VERSION.md` (version refs)
- **Microsoft style references** (fetch on first ambiguous term, cache
  judgements in the report appendix):
  - <https://learn.microsoft.com/style-guide/welcome/>
  - <https://learn.microsoft.com/style-guide/a-z-word-list-term-collections/term-collections/cloud-style-guide>
  - If either URL 404s, record that as a finding and fall back to inline
    high-confidence rules only.

</context>

## Review dimensions

Run each dimension against every in-scope page. Tag every finding with one
category, one severity, a file:line anchor, and a suggestion.

### 1. Completeness

Required H2 sections per template (see
[`markdown-docs.instructions.md`](../../../.github/instructions/markdown-docs.instructions.md));
dangling `TODO` / `TKTK` markers; sidebar entries with no underlying
file; underlying files with no sidebar entry (orphans).

### 2. Accuracy

Cross-check every claim about agents, skills, subagents, instructions,
prompts, MCP servers, and workflow steps against
`tools/registry/count-manifest.json`, `tools/registry/agent-registry.json`,
and the on-disk file tree. Numeric counts in docs must derive from the
manifest's `computed_from` patterns at review time — never hard-code.
Version references must match `VERSION.md`. Command examples must be
runnable (binary on `$PATH`, file paths exist).

### 3. Errors

Run `node site/check-links.mjs` for the link audit (if it does not
accept a scope argument, run full-site and filter results to in-scope
paths in the report). Flag invalid frontmatter, malformed Starlight
admonitions (`:::note` etc.), and MDX syntax errors. Surface any
`cd site && npm run build` failures as blocker findings.

### 4. Grammar

Sentence-level proofreading. Allow-listed auto-fixes when
`--apply-fixes` is set: unambiguous typos, subject-verb agreement,
articles, punctuation spacing. Anything that changes voice, tense, or
meaning is report-only.

### 5. Visuals

Broken `![]()` references; empty or missing alt text; oversized PNGs
(flag > 500 KB); Mermaid render validity (parse each fenced
`mermaid` block); drawio diagram freshness (compare to
`assets/drawio-libraries/`); screenshot staleness. Staleness rule:
flag a file when **both** of the following hold:

- Filename matches `screenshot|ui-|capture|portal-` (suppresses
  false positives on architecture diagrams and logos).
- Creation age in months (from
  `git log --follow --diff-filter=A --format=%ct -- <file> | tail -1`)
  exceeds the threshold (default 4, configurable via
  `--screenshot-age-months N`).

### 6. Microsoft terminology

Enforce high-confidence swaps:

| Wrong               | Right                                       |
| ------------------- | ------------------------------------------- |
| `Azure AD`, `AAD`   | `Microsoft Entra ID`                        |
| `click`             | `select` (UI verb)                          |
| `log in` (verb)     | `sign in`                                   |
| `login` (noun)      | `sign-in`                                   |
| `azure`             | `Azure` (always capitalised at sentence/UI) |
| `Powershell`        | `PowerShell`                                |
| `github`            | `GitHub`                                    |

**Auto-fix exclusions (always report-only, even with `--apply-fixes`)**:

- Any file under `site/src/content/docs/project/**`
- `CHANGELOG.md`
- Any line inside a fenced code block
- Any line containing `deprecated`, `historical`, `renamed`, `legacy`,
  `formerly`, or `previously known as`

Log every ambiguous judgement to the report's **Terminology Decisions**
appendix so the next reviewer reuses prior calls.

### 7. Site standard alignment

The `# Title` + `> [Current Version](...)` header pattern, single-H1
rule, relative-link depth, `:::note` admonition syntax (not MkDocs
`!!!`), trailing-slash internal links, no hard-coded entity counts
(defer to `count-manifest.json`). See
[`docs.instructions.md`](../../../.github/instructions/docs.instructions.md)
and
[`markdown-docs.instructions.md`](../../../.github/instructions/markdown-docs.instructions.md).

### 8. Information architecture

Evaluate end-to-end narrative flow. A new reader should be able to
move from *what is APEX* → *why it exists* → *how to try it* → *walk
the workflow step by step* → *deep reference* with no backtracking.

Flag these IA smells:

- Mixed page types in one section (tutorial + how-to + reference under
  one heading).
- Orphan pages (file exists but not in sidebar).
- Duplicated content across `concepts/` and `guides/`.
- Missing "next step" transitions between sequential pages.
- Inconsistent step terminology — the invariant is "Step N" for
  `N ∈ {1, 2, 3, 3.5, 4, 5, 6, 7}`. Flag "stage" and "phase" usage.

Produce a dedicated **Information Architecture** section in the report
(see Output Contract below).

#### Recommended target IA (Diátaxis + progressive disclosure)

Use this as the comparison baseline when diffing the current sidebar:

1. **Start here** (Tutorials) — Quickstart → Azure Setup → Dev
   Containers → *Your first APEX run end-to-end* (a new happy-path
   walkthrough of Steps 1–7).
2. **Understand APEX** (Explanation, high-level) — Overview, Core
   Concepts, System Architecture, Agents / Skills / Subagents model.
3. **Walk the workflow** (Explanation, one page per step — the story
   spine) — Step 1 Requirements, Step 2 Architecture, Step 3 Design,
   Step 3.5 Governance, Step 4 IaC Plan, Step 5 IaC Code, Step 6
   Deploy, Step 7 As-Built, Post Lessons. Each page cross-links to
   the relevant How-to + Reference + ADR examples.
4. **How-to guides** (task-oriented, flat) — current `guides/`
   content split by intent: deploy / debug / secure / test / govern /
   customize.
5. **Reference** — glossary, validation reference, FAQ, architecture
   explorer, catalogs.
6. **Project** — changelog, contributing, sensei-branch (unchanged).

## Auto-fix policy

Default: report-only. When the user passes `--apply-fixes`, apply
**only** the following allow-list, one file at a time, with a diff
preview line in the report for each fix:

- Unambiguous typos (single-edit-distance against a dictionary match).
- Terminology swaps from the table in dimension 6, subject to the
  exclusion rules.
- Trailing whitespace removal.
- `markdownlint-cli2 --fix` restricted to rules MD009, MD010, MD012,
  MD047 (no global `--fix`).

The following are always report-only, even with `--apply-fixes`:

- Alt-text generation (descriptive filenames lie).
- IA recommendations (severity `ia:proposal`, advisory only).
- Anything inside `agent-output/**`, `tools/registry/*.json`,
  `site/astro.config.mjs`, `site/src/data/**`, components, theme.
- Grammar fixes that change voice, tense, or meaning.
- Anything under `site/src/content/docs/project/**` or `CHANGELOG.md`.

## Workflow

1. **Pre-flight** — parse arguments, read sidebar, load
   `count-manifest.json`, build in-scope file inventory, check
   `.gitignore` for the un-ignore rule.
2. **Per-dimension sweep** — for each in-scope file, evaluate the
   eight dimensions and accumulate findings. Findings carry
   `{file, line, category, severity, finding, suggestion, auto_fixed}`.
3. **IA analysis** — diff current sidebar vs the recommended target
   IA, classify each page by Diátaxis intent
   (tutorial / how-to / reference / explanation), enumerate orphans,
   and propose the two paths (Minimal-S vs Full-L).
4. **Auto-fix pass** (only if `--apply-fixes`) — iterate the
   allow-list per file, write changes via file-edit tooling (never
   shell heredocs), record diffs in the report's
   **Files Auto-Fixed** section.
5. **Write outputs** — `astro-docs-review.md` and `.json` under
   `logs/copilot/docs-review/{date}/`.
6. **Verification** — run `npm run lint:md`, `node site/check-links.mjs`,
   and `cd site && npm run build`. Pipe long output to a file under the
   same date folder; do not replay full output into chat. Summarise
   pass/fail in the report.

<output_contract>

Two files are produced per run, both under
`logs/copilot/docs-review/{YYYY-MM-DD}/` (use `date +%Y-%m-%d` at
runtime):

- `astro-docs-review.md` — human report with sections in this order:
  1. **Summary** — counts per severity, top 5 must-fix items.
  2. **Findings by Category** — one subsection per dimension.
  3. **Information Architecture** — current vs proposed sidebar
     tree (diff view), per-page intent-classification table
     (tutorial / how-to / reference / explanation), orphan list,
     recommended new pages, and **two paths**: Minimal viable IA
     (T-shirt size **S**) and Full Diátaxis migration (T-shirt
     size **L**).
  4. **Files Auto-Fixed** — only present when `--apply-fixes`
     was set; one row per file with a diff hunk.
  5. **Verification** — pass/fail of `lint:md`, `check-links`,
     `npm run build`.
  6. **Terminology Decisions** appendix — every Cloud Style Guide
     judgement made during the run.
- `astro-docs-review.json` — array of finding objects:

  ```json
  {
    "file": "site/src/content/docs/getting-started/quickstart.md",
    "line": 42,
    "category": "terminology",
    "severity": "major",
    "finding": "Uses 'Azure AD' — superseded by 'Microsoft Entra ID'",
    "suggestion": "Replace 'Azure AD' with 'Microsoft Entra ID'",
    "auto_fixed": false
  }
  ```

Severity values (use exactly these strings):
`blocker` | `major` | `minor` | `nit` | `ia:proposal`.

Category values:
`completeness` | `accuracy` | `errors` | `grammar` | `visuals` |
`terminology` | `site-standard` | `ia`.

Returned-to-user summary: counts per severity, top 5 must-fix items,
report paths.

</output_contract>

## Stop rules

- Never edit `agent-output/**`, `tools/registry/*.json`,
  `site/astro.config.mjs`, `site/src/data/**`, components, theme, or
  `site/public/**` binaries.
- Never bulk-rewrite — apply auto-fixes one file at a time.
- Never use interactive shell flags (`mv -i`, `rm -i`, `cp -i`,
  `read -p`) or heredocs. Use file-edit tooling for writes.
- Never auto-apply IA recommendations or file moves.
- Pipe any command output longer than 50 lines to a file under
  `logs/copilot/docs-review/{date}/` rather than replaying into chat.

## Quality assurance

- [ ] Report file and JSON file both written under the dated folder.
- [ ] Every finding has a category, severity, file:line, and suggestion.
- [ ] Auto-fixes only applied when `--apply-fixes` was supplied.
- [ ] IA section includes both Minimal-S and Full-L paths with
  T-shirt sizing.
- [ ] Terminology appendix non-empty when any terminology finding
  was raised.
- [ ] Verification block reports pass/fail for `lint:md`,
  `check-links`, and `npm run build`.
