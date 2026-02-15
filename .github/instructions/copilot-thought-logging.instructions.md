---
description: "Optional workflow logging guidance when using Copilot-Processing.md for long-running tasks"
applyTo: "Copilot-Processing.md"
---

# Copilot Processing Log Instructions

Use this file as an optional task ledger for complex or long-running work.

## When to use

- Use `Copilot-Processing.md` only when the user asks for process logging, progress persistence,
  or when multi-step work benefits from a durable checklist.
- Do not create or update this file for short, single-step tasks.

## What to record

- User objective and key constraints
- Action plan with checkbox tasks (`- [ ]` / `- [x]`)
- Execution notes tied to completed tasks
- Final summary with outcomes, open items, and next actions

## Operating rules

- Keep entries concise, factual, and task-focused.
- Update progress in place; avoid duplicate sections.
- Prefer one current plan section over repeated plan rewrites.
- Do not require rigid phased wording or fixed response text.
- Do not block normal user interaction while updating this file.

## Recommended structure

- `## Request`
- `## Constraints`
- `## Plan`
- `## Progress Log`
- `## Final Summary`

## Repository hygiene

- `Copilot-Processing.md` is local working state and is gitignored.
- If work is complete, optionally ask the user whether to keep or remove the file.
