# Reference Documentation

> Version: see [VERSION.md](../../VERSION.md) | [Back to Documentation Hub](../README.md)
>
> **Single source of truth** for Agentic InfraOps patterns and defaults

This folder contains authoritative reference documentation. Other docs and agent files should link to these
documents rather than duplicating content.

## Contents

| Document                                 | Purpose                                                             |
| ---------------------------------------- | ------------------------------------------------------------------- |
| [defaults.md](defaults.md)               | Regions, CAF naming conventions, required tags, SKU recommendations |
| [agents-overview.md](agents-overview.md) | All 7 agents in one comparison table with usage examples            |
| [workflow.md](workflow.md)               | Canonical 7-step workflow diagram                                   |
| [bicep-patterns.md](bicep-patterns.md)   | Critical Bicep deployment patterns                                  |

## Why Single Source of Truth?

Before this consolidation, patterns like region defaults appeared in 10+ files. When updating from
`westeurope` to `swedencentral`, every file needed manual updates.

Now: Update `defaults.md` once, all other docs reference it.

## For Agent Authors

When creating or updating agent definitions in `.github/agents/`:

```markdown
<!-- Reference shared defaults instead of duplicating -->

📖 **Region Defaults**: See [docs/reference/defaults.md](../../docs/reference/defaults.md)
📖 **Naming Conventions**: See [docs/reference/defaults.md#caf-naming-conventions](../../docs/reference/defaults.md)
```

---

## IT Pro Voice Checklist

Use this checklist when editing docs so content stays operational, consistent, and low-drama for platform teams.

- Outcome-first intros: start with what the reader gets, then how.
- Terminology: use WAF/AVM/CAF/MCP consistently; prefer "agent-output artifacts" and "guardrails".
- Safety framing: approval-first flow, RBAC-aware steps, least privilege, and auditability.
- Stable CTAs: "Start with the accelerator", "Run a scenario", "Validate with…".
- UI guidance: avoid brittle click-paths unless necessary; prefer task-based steps and commands.
