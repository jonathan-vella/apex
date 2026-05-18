---
title: "Repository Slash Prompts"
description: "Built-in slash prompts for APEX workflow resume, git commits, and debug-log export"
sidebar:
  order: 4
---

APEX includes repository-scoped slash prompts in `.github/prompts/`. These are
available from the Copilot Chat slash menu when the workspace is open.

Use them for repeatable operational tasks where the prompt needs a precise tool
sequence, predictable exclusions, or a safe confirmation gate.

## Prompt Reference

- `/apex-resume-workflow`: resumes an APEX workflow after `/clear`.
  Source: `.github/prompts/apex-resume-workflow.prompt.md`.
- `/apex-git-commit`: commits, pushes, and handles the PR handoff.
  Source: `.github/prompts/apex-git-commit.prompt.md`.
- `/apex-debug-log-export`: bundles Copilot debug logs for review.
  Source: `.github/prompts/apex-debug-log-export.prompt.md`.

## Resume Workflow

Use `/apex-resume-workflow` after `/clear` or whenever you need to re-enter an
existing APEX workflow without carrying old chat context forward.

The prompt is bound to the `01-Orchestrator` agent. It asks for the target
project, then either lets you provide the next workflow step or reads session
state to detect it.

### Resume Behavior

- Lists candidate projects under `agent-output/`.
- Resolves a project from your answer or from the prompt argument.
- Uses `apex-recall show <project> --json` as the preferred state source.
- Maps the detected workflow node to an orchestrator handoff button.
- Surfaces the correct handoff without invoking the next agent automatically.

### Resume Usage

Use this prompt when a step agent tells you to run `/clear`, switch back to the
Orchestrator, and send `resume <project>`. That pattern keeps each workflow step
from inheriting unnecessary chat history.

### Resume Boundaries

The prompt does not re-run completed steps by itself, change recorded decisions,
or call `#runSubagent`. It only gets you back to the right orchestrator handoff.

## Git Commit

Use `/apex-git-commit` when you want the repository's standard commit workflow:
inspect scoped changes, stage allowed paths, create a conventional commit, push
the current branch, and decide what to do with the pull request.

### Commit Behavior

- Computes pathspec exclusions for `agent-output/`, `infra/`, and the Sensei
  skill directory when applicable.
- Refuses to commit from `main`.
- Stages only the allowed paths.
- Generates a conventional commit message from the staged diff unless you pass a
  subject.
- Pushes the current branch.
- Checks whether an open pull request already exists for the branch.
- Asks whether to update an existing PR, create a new PR, or skip the PR step.

### Commit Usage

Use this prompt after a focused code or documentation change when you want the
repo's commit exclusions and PR decision flow applied consistently.

### Commit Boundaries

The prompt never force-pushes, never stages excluded infrastructure or
`agent-output/` artifacts, and keeps the pull-request action as the final human
confirmation gate.

## Debug Log Export

Use `/apex-debug-log-export` when you need to package Copilot Chat debug logs
for review. It is especially useful when investigating custom-agent loading,
skill loading, tool behavior, latency, token use, or unexpected retries.

### Export Behavior

- Enumerates debug-log sessions for the current workspace.
- Recommends the most recent non-active session by default.
- Lets you opt into older sessions, transcript JSONL, and workspace logs.
- Builds a custom-agent filter from `.github/agents/` and the agent registry.
- Writes filtered `*.custom-agents.jsonl` files.
- Redacts common secret patterns from filtered output.
- Creates a `.tar.gz` bundle under `.apex-logs/`.

### Export Usage

Use this prompt before filing an upstream Copilot issue or asking another
maintainer to review an APEX agent session. The companion guide is
[Debug Log Export](../../apex-debug-log-export/).

### Export Boundaries

The prompt does not upload anything. It preserves raw session logs for auditing,
so you should review the bundle before sharing it outside the repository team.

## Choosing The Right Prompt

| Need                                        | Use                         |
| ------------------------------------------- | --------------------------- |
| Continue a workflow after a clean chat      | `/apex-resume-workflow`     |
| Commit current work with repository guards  | `/apex-git-commit`          |
| Share debug evidence for agent behavior     | `/apex-debug-log-export`    |

## Related

- [Prompt Guide](../) — prompt patterns for agents and skills
- [Workflow Prompts](../workflow-prompts/) — examples for workflow agents
- [Debug Log Export](../../apex-debug-log-export/) — export prompt operating guide
