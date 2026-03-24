<a id="top"></a>

# Execution Plans

> [Current Version](../../VERSION.md) | Structured plans for multi-step work

Execution plans track significant changes that span multiple steps or sessions.
They provide decision history and progress visibility for both humans and agents.

## What Is an Exec Plan?

A lightweight document that captures the intent, key decisions, and progress of a multi-step
initiative. Not every task needs one — use them for work that:

- Spans multiple files or agent sessions
- Involves architectural decisions worth recording
- Needs progress tracking across interruptions

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Format

```markdown
## Plan: {Title}

**Status**: Active | Completed | Blocked
**Owner**: {agent or human}
**Created**: {date}
**Decisions**: {key choices made}
**Progress**: {checklist}
```

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Lifecycle

1. Create in `active/` when starting multi-step work
2. Update progress checkboxes as work completes
3. Move to `completed/` when all items are done
4. Completed plans serve as decision history for future agent context

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Directory Structure

```text
docs/exec-plans/
├── README.md                  # This file
├── tech-debt-tracker.md       # Running inventory of known debt
├── active/                    # Currently in-progress plans
│   └── .gitkeep
└── completed/                 # Finished plans (kept for context)
    └── .gitkeep
```

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>

## Tech Debt Tracker

The [tech-debt-tracker.md](tech-debt-tracker.md) maintains a running inventory of known quality
gaps, technical debt, and planned remediation. It is updated by the doc-gardening workflow and
referenced by `QUALITY_SCORE.md`.

<div align="right"><a href="#top"><b>⬆️ Back to Top</b></a></div>
