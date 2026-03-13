---
description: "Cross-agent decision logging rules for session state"
applyTo: "**/*.agent.md"
---

# Decision Logging

When you make a significant choice during your workflow step, append an entry to
the `decision_log` array in `00-session-state.json`.

## When to Log

Log decisions about: architecture pattern, SKU or tier selection, deployment
strategy, IaC tool choice, security approach, networking topology, or when you
reject a viable alternative with meaningful trade-offs.

Do NOT log: minor implementation details, formatting choices, file naming, or
decisions already captured in the `decisions` object fields.

## Entry Format

```json
{
  "id": "D001",
  "step": 2,
  "agent": "03-Architect",
  "timestamp": "2026-03-13T15:10:00Z",
  "title": "B1 App Service over Container Apps",
  "choice": "App Service Plan B1 (Linux)",
  "alternatives": ["Container Apps Consumption", "AKS"],
  "rationale": "Budget < EUR1000/mo; no container expertise; B1 meets 200 concurrent users NFR",
  "impact": "No container registry needed; simplifies deployment"
}
```

**Required fields**: `id`, `step`, `agent`, `title`, `choice`, `rationale`.
Use sequential IDs (`D001`, `D002`, ...) continuing from the last entry.
Set `timestamp` to the current ISO 8601 time. `alternatives` and `impact` are
optional but encouraged when rejecting a viable option.
