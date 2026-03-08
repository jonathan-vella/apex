---
description: "Create a comprehensive plan to restructure, rewrite, and proofread the published documentation site for clarity, navigation, and visual appeal"
agent: Plan
tools:vscode, execute, read, agent, browser, edit, search, web, 'microsoft-learn/*', todo
[vscode, execute, read, agent, browser, edit, search, web, 'microsoft-learn/*', todo]
---

# Documentation Improvement Plan

Create a detailed, actionable plan to improve the Agentic InfraOps documentation site
(`docs/` folder published via MkDocs Material to GitHub Pages).

## Goals

- Easy to navigate — logical structure, minimal clicks to key content
- Easy to read — concise prose, consistent tone, scannable formatting
- Visually appealing — leverage MkDocs Material features (admonitions, tabs, grids, icons, Mermaid diagrams)
- Proofread — fix grammar, spelling, inconsistencies, broken links, stale references

## Scope and Constraints

### Immutable

- `docs/how-it-works.md` — DO NOT modify or delete this file

### Mutable

Every other file under `docs/` that appears in the published site may be rewritten,
restructured, split, merged, renamed, or deleted — as long as **all existing content
is preserved** somewhere in the final structure (no information loss).

### New Files

You MAY propose new files (e.g., an FAQ page, a "What's New" page, an architecture
overview) if they improve navigation or fill content gaps.

### Published Site Config

- Site config: `mkdocs.yml` (Material theme, indigo/amber palette, nav tabs, grid cards)
- Excluded from site: `presenter/`, `exec-plans/`, `branch-ruleset-config.md`, `README.md` files
- Live URL: `https://jonathan-vella.github.io/azure-agentic-infraops/`

## Inputs — Read These First

Before planning, read every published doc to assess current state:

1. `mkdocs.yml` — current nav structure, theme features, exclude list
2. `docs/index.md` — landing page (96 lines)
3. `docs/quickstart.md` — getting started guide (210 lines)
4. `docs/dev-containers.md` — dev container setup (254 lines)
5. `docs/how-it-works.md` — architecture deep-dive (1192 lines, **immutable**)
6. `docs/workflow.md` — 7-step workflow (418 lines)
7. `docs/GLOSSARY.md` — term definitions (316 lines)
8. `docs/prompt-guide/index.md` — prompt examples (740 lines)
9. `docs/troubleshooting.md` — issues and solutions (488 lines)
10. `docs/CONTRIBUTING.md` — contribution guide (243 lines)
11. `docs/CHANGELOG.md` — release history (586 lines)

Total: ~4,500 lines across 11 files.

## Workflow

### Phase 1 — Audit (read-only)

1. Read every file listed above end-to-end.
2. For each file, assess and record:
   - **Content quality**: accuracy, completeness, staleness, redundancy with other files
   - **Prose quality**: grammar, spelling, tone, jargon, readability (target: clear to a senior DevOps engineer new to this project)
   - **Structure**: heading hierarchy, logical flow, scannability (bullet lists, tables, code blocks)
   - **Visual features used**: admonitions, tabs, grids, Mermaid diagrams, code annotations, icons — and what's missing
   - **Navigation fit**: does the file belong in its current nav section? Is the section name clear?
   - **Cross-references**: broken links, missing links to related pages, orphaned content
3. Summarize findings in a per-file audit table.

### Phase 2 — Restructure Proposal

Based on the audit, propose a new information architecture:

1. **Proposed nav tree** — show the full `nav:` YAML block you recommend for `mkdocs.yml`.
   Explain what changed and why.
2. **File operations** — for each file, state one of:
   - `keep` — no structural change (content edits only)
   - `rewrite` — major rewrite in-place
   - `split` — split into N files (name them)
   - `merge` — merge into another file (name it)
   - `rename` — rename for clarity
   - `new` — brand new file (describe purpose and outline)
   - `delete` — remove (confirm content preserved elsewhere)
3. **Content moves** — if content migrates between files, list source → destination explicitly.
4. **Landing page** — propose improvements to `docs/index.md` (hero section, cards, CTAs).
5. **Visual enhancements** — list specific MkDocs Material features to adopt per page:
   - Admonitions (`!!! tip`, `!!! warning`, `!!! example`)
   - Content tabs (`=== "Bicep"` / `=== "Terraform"`)
   - Mermaid diagrams (where flow/sequence diagrams aid understanding)
   - Annotated code blocks
   - Grid cards
   - Status badges, icons, key-value tables

### Phase 3 — Proofreading Checklist

Produce a proofreading report covering every published file:

1. Grammar and spelling errors (list file, line, issue, fix)
2. Inconsistent terminology (e.g., "dev container" vs "devcontainer")
3. Tone inconsistencies (too formal, too casual, inconsistent voice)
4. Stale or inaccurate content (outdated version numbers, deprecated features)
5. Broken or suspicious links

### Phase 4 — Implementation Roadmap

Turn the proposals into an ordered task list:

1. Group tasks into logical work packages (e.g., "Restructure Getting Started section", "Rewrite Troubleshooting page")
2. Estimate effort per task: `S` (< 30 min), `M` (30-90 min), `L` (> 90 min)
3. Identify dependencies between tasks
4. Suggest a recommended execution order

### Phase 5 — Adversarial Review #1 (GPT 5.4)

After Phases 1-4 are complete, submit the full plan to an adversarial review.

**Reviewer model**: GPT 5.4
**Review instructions for the adversarial reviewer**:

> You are a senior technical writer and documentation architect reviewing a
> documentation improvement plan for an open-source Azure infrastructure project.
>
> Evaluate the plan against these lenses:
>
> 1. **User Journey** — Does the proposed structure support a new user going from
>    "What is this?" → "How do I set it up?" → "How do I use it?" → "How do I
>    troubleshoot?" without friction? Identify any dead ends or missing steps.
> 2. **Information Architecture** — Is the nav hierarchy intuitive? Are there pages
>    that should be consolidated or split differently? Is the depth right (too flat
>    vs too nested)?
> 3. **Completeness** — Does the plan address all weak areas found in the audit?
>    Are there obvious improvements it missed?
> 4. **Feasibility** — Are the proposed changes realistic? Is anything over-engineered
>    for a project of this size (~11 docs, ~4500 lines)?
> 5. **Visual Design** — Are the proposed MkDocs Material features appropriate and
>    not overused? Will the result look professional or cluttered?
>
> Return a structured review with:
>
> - **Verdict**: APPROVE / NEEDS_REVISION / RETHINK
> - **Strengths**: What's good about the plan
> - **Weaknesses**: What needs improvement (with specific suggestions)
> - **Missing**: Anything the plan should address but doesn't
> - **Priority fixes**: Top 3 changes to make before executing the plan

Incorporate the reviewer's feedback into the plan. Document what changed and why.

### Phase 6 — Adversarial Review #2 (Claude Sonnet 4.6)

Submit the revised plan (post-GPT 5.4 feedback) to a second adversarial review.

**Reviewer model**: Claude Sonnet 4.6
**Review instructions for the adversarial reviewer**:

> You are a developer experience (DevEx) specialist who evaluates documentation
> from the perspective of a busy platform engineer who has 15 minutes to evaluate
> whether this tool is worth adopting.
>
> Evaluate the revised plan against these lenses:
>
> 1. **Time-to-Value** — Can a new user get a working demo running within the first
>    page they land on? Is the quickstart truly quick?
> 2. **Scannability** — Will a user skimming at speed find what they need? Are there
>    walls of text that should be tables, diagrams, or bullet lists?
> 3. **Trust Signals** — Does the documentation convey production-readiness? Are there
>    enough examples, screenshots, or demo outputs to build confidence?
> 4. **Maintenance Burden** — Will the proposed structure be easy to maintain as the
>    project evolves? Are there fragile cross-references or duplicated content?
> 5. **Accessibility** — Is the language inclusive? Are code samples copy-pasteable?
>    Do diagrams have text alternatives?
>
> Return a structured review with:
>
> - **Verdict**: APPROVE / NEEDS_REVISION / RETHINK
> - **Strengths**: What's good about the revised plan
> - **Weaknesses**: What still needs work
> - **Quick Wins**: Low-effort changes with high impact
> - **Risk Areas**: Things that might create tech debt or maintenance issues later

Incorporate this reviewer's feedback into the final plan. Document what changed and why.

## Output Expectations

Produce a single artifact: `agent-output/docs-improvement/docs-improvement-plan.md`

Structure it with these H2 sections:

```
## Audit Summary
## Proofreading Report
## Proposed Information Architecture
## Visual Enhancement Plan
## Implementation Roadmap
## Adversarial Review #1 — GPT 5.4
## Plan Revisions (Post-Review #1)
## Adversarial Review #2 — Claude Sonnet 4.6
## Plan Revisions (Post-Review #2)
## Final Plan
```

The **Final Plan** section should be a clean, self-contained version incorporating
all feedback — ready to hand off for execution.

## Quality Assurance

Before finishing, verify:

- [ ] Every published doc file was read and assessed
- [ ] No content is lost — every piece of existing information has a home in the new structure
- [ ] `how-it-works.md` is unchanged in the proposal
- [ ] Both adversarial reviews were completed with different models
- [ ] Feedback from both reviews is incorporated and changes documented
- [ ] The implementation roadmap has clear task ordering and effort estimates
- [ ] The plan is actionable — someone could execute it without asking clarifying questions
