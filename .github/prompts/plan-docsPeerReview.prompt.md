---
description: "Multi-model peer review of all published documentation with adversarial passes. Uses GPT 5.4 and Sonnet 4.6 subagents for independent reviews, then reconciles findings."
agent: agent
model: "Claude Opus 4.6 (1M context)(Internal only)"
tools:vscode, execute, read, agent, browser, 'microsoft-learn/*', edit, search, web, todo
---

# Docs Peer Review

Orchestrate a multi-model peer review of every published documentation page in `docs/`.
Two independent reviewer passes run first, then an adversarial pass, then reconciliation.

## Scope

Published pages only (matches `mkdocs.yml` nav). Excludes `docs/exec-plans/` and
`docs/presenter/`.

### File inventory

| Section                 | Files                                                                                                                                                     |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Landing                 | `docs/index.md`                                                                                                                                           |
| Getting Started         | `docs/quickstart.md`, `docs/dev-containers.md`                                                                                                            |
| Concepts — How It Works | `docs/how-it-works/index.md`, `architecture.md`, `four-pillars.md`, `agents.md`, `skills-and-instructions.md`, `workflow-engine.md`, `mcp-integration.md` |
| Concepts — Workflow     | `docs/workflow.md`                                                                                                                                        |
| Guides — Prompt Guide   | `docs/prompt-guide/index.md`, `best-practices.md`, `workflow-prompts.md`, `reference.md`                                                                  |
| Guides                  | `docs/troubleshooting.md`                                                                                                                                 |
| Reference               | `docs/GLOSSARY.md`, `docs/faq.md`                                                                                                                         |
| Project                 | `docs/CONTRIBUTING.md`, `docs/CHANGELOG.md`                                                                                                               |

## Workflow

### Phase 1 — Independent reviews (parallel)

Run two subagent reviews in parallel. Each reviewer reads every file above and
produces a structured findings list.

**Reviewer A — GPT 5.4** (technical accuracy lens):

> You are a senior technical writer reviewing Azure infrastructure documentation.
> Read every file listed in the inventory. For each file, check:
>
> 1. **Factual accuracy** — Do counts, version numbers, agent names, skill names,
>    and CLI commands match reality? Cross-reference `AGENTS.md`, `.github/agents/`,
>    `.github/skills/`, `package.json`, and `mkdocs.yml`.
> 2. **Internal consistency** — Do cross-page references agree? Are tables, lists,
>    and terminology consistent across files?
> 3. **Completeness** — Are any agents, skills, instructions, or MCP servers missing?
>    Compare against the actual repo contents.
> 4. **Broken links** — Flag any relative links that point to deleted or renamed files.
>
> Return a JSON array of findings. Each finding:
>
> ```json
> {
>   "file": "docs/...",
>   "line": 42,
>   "severity": "must_fix|should_fix|nit",
>   "category": "accuracy|consistency|completeness|broken_link",
>   "description": "...",
>   "suggestion": "..."
> }
> ```

**Reviewer B — Claude Sonnet 4.6** (readability and UX lens):

> You are a documentation UX specialist reviewing a developer docs site.
> Read every file listed in the inventory. For each file, check:
>
> 1. **Scannability** — Can a reader find what they need in <30 seconds?
>    Are headings descriptive? Are long sections broken up?
> 2. **Onboarding flow** — Does the quickstart→concepts→guides progression
>    make sense for a new user? Are prerequisites clear?
> 3. **Redundancy** — Is content duplicated across pages without purpose?
>    Flag overlapping sections that could confuse readers.
> 4. **Tone and clarity** — Is language direct, jargon-free where possible,
>    and consistent in voice?
> 5. **Navigation** — Do pages link forward to logical next steps?
>    Are dead ends flagged?
>
> Return a JSON array of findings using the same schema as Reviewer A,
> with categories: `scannability|onboarding|redundancy|clarity|navigation`.

### Phase 2 — Adversarial review

Run a third subagent pass using **Claude Sonnet 4.6** with an adversarial lens:

> You are a hostile reviewer whose job is to find ways the documentation misleads,
> confuses, or fails its readers. You have access to the findings from Reviewer A
> and Reviewer B. Your job is NOT to repeat their findings. Instead:
>
> 1. **Untested assumptions** — What does the documentation assume the reader knows
>    that is never explained? (e.g., "dev container" without explaining what it is)
> 2. **Happy path bias** — Where does documentation only cover the success case?
>    What happens when things go wrong?
> 3. **Stale promises** — Are there claims about features, counts, or capabilities
>    that may have drifted from the actual codebase?
> 4. **Missing audience** — Who is excluded by the current documentation?
>    (e.g., Terraform-only users, non-Azure users evaluating the project)
> 5. **Contradictions** — Do any two pages contradict each other?
>
> Return a JSON array of findings with severity and category:
> `assumption|happy_path|stale_promise|missing_audience|contradiction`.

### Phase 3 — Reconciliation

As the orchestrator (Claude Opus 4.6), consolidate all three finding sets:

1. **Deduplicate** — Merge findings that describe the same issue from different lenses.
2. **Prioritise** — Rank by severity: `must_fix` > `should_fix` > `nit`.
3. **Group by file** — Present findings grouped by file path, then by severity.
4. **Action items** — For each `must_fix`, write a concrete one-line fix description.
5. **Summary** — Count totals per severity and category. Call out the 3 most
   impactful issues.

## Output

Present the reconciled report to the user as a markdown table per file, followed
by the summary. Format:

```markdown
### docs/{file}.md

| #   | Severity | Category | Description | Suggested Fix | Source     |
| --- | -------- | -------- | ----------- | ------------- | ---------- |
| 1   | must_fix | accuracy | ...         | ...           | Reviewer A |
```

Then:

```markdown
## Summary

| Severity   | Count |
| ---------- | ----- |
| must_fix   | N     |
| should_fix | N     |
| nit        | N     |

**Top 3 issues:**

1. ...
2. ...
3. ...
```

Do NOT edit any files. This is a read-only review. Present findings only.
