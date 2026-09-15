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

## Bounded Tool Results

- Once a shared MCP server returns a process-start failure, do not fan out more calls to that server in the
   same research phase. Use an available authorized fallback or report the missing capability.
- Prefer targeted documentation search and the specific section needed for a claim. Avoid multi-page full-content
   fetches that replay entire service guides into every subsequent model request. A narrow query does not guarantee
   the fetch tool truncates its response. Start with one necessary page; inspect output size before fetching more.
- If a fetch still returns a full guide, persist the useful claims, source URLs and unresolved gaps in the existing
   research checkpoint. Use bounded local excerpts for subsequent evidence recovery, not repeated complete reads.
   Preserve required security and capability evidence; do not treat smaller context as permission to guess.
- A checkpoint or summary does not clear the transcript. When oversized results remain, checkpoint and request
   a fresh chat or `/clear` at the current agent before the next expensive phase; resume only from verified state.
- Tool invocation or package-policy failure is not evidence of an Azure service capability limitation. Do not
   repeatedly attempt unavailable installers or infer availability from unrelated provider-wide region counts.

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
