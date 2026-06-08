---
title: "Step 7 — As-Built Documentation"
description: "Assemble the post-deployment documentation suite from the previous artifacts and the deployed resource state."
sidebar:
  order: 8
  label: "Step 7 — As-Built"
---

## Purpose

Produce the canonical post-deployment documentation suite — design document, operations runbook,
cost estimate, compliance matrix, backup/DR plan, resource inventory, and a master index. This is
the artifact future operators reach for first.

## Agent

[`08-As-Built`](https://github.com/jonathan-vella/apex/blob/main/.github/agents/08-as-built.agent.md)
— uses the
[`azure-artifacts`](https://github.com/jonathan-vella/apex/blob/main/.github/skills/azure-artifacts/SKILL.md)
skill and reads every prior artifact in `agent-output/{project}/`.

## Invocation

```text
Invoke: Ctrl+Shift+A → 08-As-Built
Output: agent-output/{project}/07-*.md
```

## Document suite

| File                          | Purpose                                              |
| ----------------------------- | ---------------------------------------------------- |
| `07-documentation-index.md`   | Master index linking the whole suite                 |
| `07-design-document.md`       | Technical design (architecture + decisions)          |
| `07-operations-runbook.md`    | Day-2 operational procedures                         |
| `07-resource-inventory.md`    | Complete resource listing with IDs and tags          |
| `07-ab-cost-estimate.md`      | As-built cost analysis                               |
| `07-compliance-matrix.md`     | Mapping of deployed resources to governance constraints |
| `07-backup-dr-plan.md`        | Backup, restore, and DR runbooks                     |

## Drift detection

The agent runs a bidirectional drift check against `sku-manifest.json` — any deployed SKU that does
not appear in the manifest (or vice versa) is surfaced in the documentation index.

## Hand-off

The Orchestrator concludes the per-project workflow. Continue with [`Post — Lessons
Learned`](/concepts/workflow/post-lessons/) if the project ran into systemic
issues worth capturing.
