<!-- ref:research-workflow-v1 -->

# Research Workflow (All Agents)

## Standard 4-Step Pattern

1. **Validate Prerequisites** — Confirm previous artifact exists.
   If missing, STOP.
2. **Read Agent Context** — Read previous artifact for context.
   Read template for H2 structure.
3. **Domain-Specific Research** — Query ONLY for NEW information
   not in artifacts.
4. **Confidence Gate (80% Rule)** — Proceed at 80%+ confidence.
   Below 80%, ASK user.

## Confidence Levels

| Level           | Indicators                  | Action                 |
| --------------- | --------------------------- | ---------------------- |
| High (80-100%)  | All critical info available | Proceed                |
| Medium (60-79%) | Some assumptions needed     | Document, ask for gaps |
| Low (0-59%)     | Major gaps                  | STOP — request clarify |

## Context Reuse Rules

- **DO**: Read previous agent's artifact for context
- **DO**: Cache shared defaults (read once per session)
- **DO**: Query external sources only for NEW information
- **DON'T**: Re-query Azure docs for resources already in artifacts
- **DON'T**: Search workspace repeatedly (context flows via
  artifacts)
- **DON'T**: Re-validate previous agent's work (trust artifact
  chain)

## Agent-Specific Research Focus

| Agent        | Primary Research                   | Skip                    |
| ------------ | ---------------------------------- | ----------------------- |
| Requirements | User needs, business context       | —                       |
| Architect    | WAF gaps, SKU comparisons, pricing | Service list (from 01)  |
| IaC Plan     | AVM availability, governance       | Architecture (from 02)  |
| IaC Code     | AVM schemas, parameter types       | Resource list (from 04) |
| Deploy       | Azure state (what-if), credentials | Template structure      |

> **NOTE**: Governance constraints from
> `04-governance-constraints.md` MUST still be read and enforced —
> "trust artifact chain" means accepting decisions, not skipping
> compliance checks.
