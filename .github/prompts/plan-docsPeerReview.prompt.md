---
description: "Review all published docs for accuracy, UX, and contradictions using three independent reviewers, then consolidate into an actionable triage report."
agent: agent
tools: vscode, execute, read, agent, search, web, 'microsoft-learn/*'
argument-hint: "Optional: scope to a specific docs section (e.g., 'how-it-works only')"
---

# Docs Peer Review

Orchestrate a peer review of every published documentation page in
`site/src/content/docs/` **plus** the interactive Architecture Explorer at
`site/public/architecture-explorer.html`. Two independent reviewers (A + B) run
**in parallel**, then an adversarial pass runs after them with their JSON as
context, then reconciliation into a prioritised triage report.

## Scope

**In scope:**

- All `.md`/`.mdx` pages under `site/src/content/docs/` (includes `demo/`,
  `concepts/`, `guides/`, `getting-started/`, `reference/`, `project/`).
- `site/public/architecture-explorer.html` (interactive component — accuracy,
  a11y, responsive, legend vs. repo reality).

**Out of scope:** `tools/tests/exec-plans/`, `agent-output/`, `site/public/demo/*` raw
fixtures, `site/public/downloads/`.

### Step 0 — Build file inventory dynamically

Before running any reviewer, read `site/astro.config.mjs` and extract the `sidebar`
configuration. This is the authoritative list of published pages. Do NOT rely on a
hardcoded table — the sidebar changes over time.

Expected sections (for reference, not as source of truth):

- Landing, Getting Started, Concepts (How It Works + Workflow), Guides (Prompt Guide,
  Troubleshooting, Session Debugging, Security Baseline, Cost Governance, azd Deployment,
  Agent Hooks, E2E Testing), Reference (FAQ, Validation & Linting, Architecture Explorer,
  Glossary, Resources & Downloads), Project (Contributing, Changelog),
  Demo (Il-Pastizzeria ta' Mario)

Known filename note: `four-pillars.md` renders as "Core Concepts" in the nav.

### Source-of-truth files for cross-referencing

Reviewers validate docs claims against these files. **Counts** come from
`tools/registry/count-manifest.json` (computed from globs) — never hard-code numbers in
findings; compute them from the manifest's `computed_from` patterns at review
time.

| File                                           | What it proves                                                 |
| ---------------------------------------------- | -------------------------------------------------------------- |
| `tools/registry/count-manifest.json`           | **Authoritative** entity counts (agents, subagents, skills, …) |
| `.github/agents/*.agent.md`                    | Top-level agent names                                          |
| `.github/agents/_subagents/*.agent.md`         | Subagent names                                                 |
| `.github/skills/*/SKILL.md`                    | Skill names                                                    |
| `.github/instructions/*.instructions.md`       | Instruction file names                                         |
| `.github/prompts/*.prompt.md`                  | Prompt names                                                   |
| `tools/registry/agent-registry.json`           | Agent → file/model/skills mapping                              |
| `.vscode/mcp.json`                             | MCP server names and config                                    |
| `package.json`                                 | Validation script names                                        |
| `site/astro.config.mjs`                        | Sidebar structure and published page list                      |
| `site/public/architecture-explorer-graph.json` | Graph node/edge canonical data (if present)                    |
| `tools/tests/exec-plans/tech-debt-tracker.md`  | Known tech-debt items (cross-check "stale promise" findings)   |
| `AGENTS.md`                                    | Project conventions table of contents                          |

## Workflow

### Phase 1 — Independent reviews (PARALLEL)

Run Reviewer A and Reviewer B **in parallel** — they read independent inputs and
must not share context. Invoke both subagents in the same tool-call batch.
Each reviewer reads every file from the dynamic inventory and produces a
structured findings list.

**Constraints for both reviewers:**

- Max **30 findings** per reviewer (prioritise `must_fix` over nits)
- Max **5 `must_fix`** per file
- Line numbers are approximate — use the **section heading** as anchor if uncertain
- Verify each finding's file path exists before including it
- Verify image/asset references in `site/public/` resolve to real files
- If approaching context limits after reading docs, prioritise: (1) broken links,
  (2) agent/skill name accuracy, (3) cross-page consistency

**Reviewer A** (data accuracy and structural correctness):

> You are a QA triage engineer reviewing Azure platform engineering documentation.
> Your signal-to-noise ratio must be > 3:1 — omit findings an average developer
> wouldn't care about.
>
> Read every page from the dynamic inventory. Check:
>
> 1. **Factual accuracy** — Do agent names, skill names, MCP server names,
>    and CLI commands match reality? Cross-reference the source-of-truth files.
>    For any numeric count in the docs, compute the expected value from
>    `tools/registry/count-manifest.json` globs and flag mismatches.
> 2. **Internal consistency** — Do cross-page references agree? Are tables, lists,
>    and terminology consistent across files? Does the workflow step numbering
>    (including Step 3.5 Governance) appear correctly everywhere?
> 3. **Completeness** — Are any agents, subagents, skills, or MCP servers missing
>    from docs but present on disk?
> 4. **Broken links** — Flag any relative links or image references that point to
>    deleted or renamed files.
> 5. **Explorer parity** — For `architecture-explorer.html`: do legend counts
>    match `count-manifest.json` values? Do referenced node IDs exist as real
>    files on disk?
>
> Return a JSON array (max 30 items). Each finding:
>
> ```json
> {
>   "file": "docs/how-it-works/architecture.md",
>   "line": 42,
>   "severity": "must_fix",
>   "category": "accuracy",
>   "description": "Agent table lists 15 top-level agents but disk has 16",
>   "suggestion": "Update table row count and add 04g-Governance row"
> }
> ```
>
> Severity values: `must_fix` | `should_fix` | `nit` (use exactly these strings).
> Category values: `accuracy` | `consistency` | `completeness` | `broken_link`.
> One category per finding — if multi-faceted, split into separate findings.

**Reviewer B** (readability, UX, navigation, accessibility, responsive):

> You are a documentation UX specialist reviewing a developer docs site.
> Your goal is actionable UX improvements, not style nits. Aim for
> 5–10 findings per file max.
>
> Read every page from the dynamic inventory. Check:
>
> 1. **Scannability** — Can a reader find what they need in <30 seconds?
>    Are headings descriptive? Are long sections broken up?
> 2. **Onboarding flow** — Does the quickstart→concepts→guides progression
>    make sense for a new user? Are prerequisites clear?
> 3. **Redundancy** — Is content duplicated across pages without purpose?
>    Flag overlapping sections that could confuse readers.
> 4. **Tone and clarity** — Is language direct, jargon-free where possible,
>    and consistent in voice? (Guides should use imperative "Do X";
>    concepts should use declarative "X is...")
> 5. **Navigation** — Do pages link forward to logical next steps?
>    Are dead ends flagged?
> 6. **Accessibility (a11y)** — Check published markdown for: images without
>    alt text, heading-order jumps (e.g., h2 → h4), link text that reads as
>    "click here", color-only indicators in tables/callouts. For
>    `architecture-explorer.html`, check: keyboard-navigability claims, ARIA
>    labels on interactive controls, focus-visible styling, and whether
>    category cues rely on color alone.
> 7. **Responsive** — Flag wide tables that will overflow on mobile (>6
>    columns without wrapping), fixed-width code blocks without horizontal
>    scroll, and explorer/interactive components that lack viewport-meta
>    consideration or touch-target sizing (<44 px hit areas).
>
> Return a JSON array (max 30 items) using the same schema as Reviewer A.
> Category values: `scannability` | `onboarding` | `redundancy` | `clarity` |
> `navigation` | `accessibility` | `responsive`.

### Phase 2 — Adversarial review

Run a third subagent pass. **Pass Phase 1 findings as JSON context** at the start
of the adversarial reviewer's prompt so it can see what was already found.

> You are a hostile reviewer whose job is to find ways the documentation misleads,
> confuses, or fails its readers. You have access to the findings from Reviewer A
> and Reviewer B (provided as JSON arrays above). Your job is NOT to repeat their
> findings verbatim. However, independently verify A and B's conclusions — if you
> disagree with any finding, flag the disagreement explicitly. Then add adversarial
> findings they missed.
>
> Focus on:
>
> 1. **Untested assumptions** — Knowledge the docs assume but never define.
>    Only flag assumptions not explained _anywhere_ in the published docs
>    (check Glossary and FAQ before flagging).
> 2. **Happy path bias** — Step-by-step guides that never mention what happens
>    when a step fails (e.g., no "if deployment fails, check logs" guidance).
> 3. **Stale promises** — Claims that demonstrably conflict with current code.
>    Verify against source-of-truth files listed above.
> 4. **Missing audience** — Documented workflows that assume a specific IaC tool
>    without mentioning the alternative track (e.g., all examples use Bicep but
>    Terraform equivalents exist and are undocumented).
> 5. **Contradictions** — Two pages that make conflicting claims about the same
>    topic (e.g., different step counts, different agent names).
>
> Max **20 findings**. Return a JSON array with the same schema.
> Category values: `assumption` | `happy_path` | `stale_promise` | `missing_audience` | `contradiction`.
>
> If either Phase 1 reviewer found zero findings in a domain, increase your
> scrutiny in that domain — zero findings may indicate the reviewer missed issues,
> not that none exist.

### Phase 3 — Reconciliation

As the orchestrator, consolidate all three finding sets:

1. **Validate** — For each finding, verify the file path exists and the line number
   is within the file's actual line count. Remove any finding that references a
   non-existent file (mark as `INVALID: file not found` in logs).

2. **Deduplicate** — Merge findings that share the same `file` + overlapping line
   range + identical `category`. Different categories on the same line = separate
   findings. When merging, keep the most specific description and list all reviewer
   sources (e.g., "Reviewer A + Adversarial").

3. **Resolve contradictions** — If two reviewers disagree on the same finding
   (e.g., A says accurate, Adversarial says stale), check the source-of-truth file.
   If conflict persists, mark as "CONFLICT: needs manual triage".

4. **Handle cross-file findings** — Issues that span multiple files (e.g., terminology
   inconsistency across 5 pages) get their own section in the output rather than being
   repeated per file.

5. **Prioritise** — Rank by severity: `must_fix` > `should_fix` > `nit`.

6. **Group** — Present per-file findings grouped by file path, then by severity.

## Output

Present a **triage report** structured for fast human action:

```markdown
## Must-Fix (blockers) — N items

| #   | File                            | Line | Category | Description | Fix | Source     |
| --- | ------------------------------- | ---- | -------- | ----------- | --- | ---------- |
| 1   | concepts/how-it-works/agents.md | ~42  | accuracy | ...         | ... | Reviewer A |

## Should-Fix (next sprint) — top 10

| #   | File                 | Line | Category    | Description | Fix | Source      |
| --- | -------------------- | ---- | ----------- | ----------- | --- | ----------- |
| 1   | concepts/workflow.md | ~12  | consistency | ...         | ... | Adversarial |

## Cross-File Findings

| #   | Files                                   | Category    | Description | Fix | Source                   |
| --- | --------------------------------------- | ----------- | ----------- | --- | ------------------------ |
| 1   | workflow.md, agents.md, architecture.md | consistency | ...         | ... | Reviewer A + Adversarial |

## Nits — N items (collapsed)

<details><summary>Expand nit-level findings</summary>

| #   | File | Line | Category | Description | Source |
| --- | ---- | ---- | -------- | ----------- | ------ |
| 1   | ...  | ...  | ...      | ...         | ...    |

</details>

## Summary

| Severity   | Count |
| ---------- | ----- |
| must_fix   | N     |
| should_fix | N     |
| nit        | N     |

**Verdict:** PASS | CONDITIONAL PASS | FAIL

- FAIL = any `must_fix` findings remain
- CONDITIONAL PASS = `must_fix` == 0, `should_fix` >= 15
- PASS = `must_fix` == 0, `should_fix` < 15

**Top 3 issues:**

1. ...
2. ...
3. ...
```

Valid `Source` values: `Reviewer A`, `Reviewer B`, `Adversarial`, or combined
(e.g., `Reviewer A + Adversarial`).

Do NOT edit any files. This is a read-only review. Present findings only.
