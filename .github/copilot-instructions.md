# APEX - Copilot Instructions

> VS Code Copilot-specific orchestration instructions.
> For general project conventions, build commands, and code style, see the root `AGENTS.md`.

## Azure Defaults (canonical)

This section is the canonical declaration of Azure infrastructure defaults.
Every skill, agent, and prompt must reference this section — never restate
the values inline. The IaC-flavoured mirror with CAF naming, AVM modules,
and reference index lives in
[`.github/skills/azure-defaults/SKILL.md`](skills/azure-defaults/SKILL.md).

### Default Regions

| Service             | Default Region       | Reason                         |
| ------------------- | -------------------- | ------------------------------ |
| **All resources**   | `swedencentral`      | EU GDPR-compliant              |
| **Static Web Apps** | `westeurope`         | Not available in swedencentral |
| **Failover**        | `germanywestcentral` | EU paired alternative          |

### Required Tags (Azure Policy Enforced)

Tag schema is **whatever live Azure Policy enforces** in the target
subscription. Governance Discovery (Step 3.5) discovers the real
contract via `discover.py` and writes it to
`04-governance-constraints.json` (`tag_contract.tags[]`,
`tag_contract.source: "policy"`); that always wins.

**Greenfield fallback** (no tag policy found at any inherited scope):
`environment`, `owner`, `costcenter`, `project` — lowercase, per
Microsoft's CAF tag-strategy guidance. Citation +
greenfield decision checklist:
[`azure-defaults/references/tag-strategy.md`](skills/azure-defaults/references/tag-strategy.md).

> The PascalCase 4-tag set (`Environment`, `ManagedBy`, `Project`,
> `Owner`) is a **deprecated convention** retained only for backward
> compatibility on existing projects whose deployed resources already
> carry that casing. Do not propagate it to new projects.

### Security baseline + AVM mandate

Non-negotiable: HTTPS-only, TLS 1.2 minimum, no public blob, public network
disabled for prod data services, Managed Identity over keys, AVM-first.
Full rules:
[`iac-policy-compliance.md`](instructions/references/iac-policy-compliance.md)
and
[`iac-security-baseline.md`](instructions/references/iac-security-baseline.md).

### SKU source of truth

Creative SKU decisions (App Service, VM, SQL, Cosmos, AKS pools, Redis,
APIM, App Gateway, Storage replication) flow through
`agent-output/{project}/sku-manifest.{json,md}` — never re-derive SKUs
from artifact prose. Authoring rules:
[`sku-manifest.instructions.md`](instructions/sku-manifest.instructions.md).

## Session State — apex-recall

All session state flows through `apex-recall`. Do not read or write
`00-session-state.json` directly.

```bash
# Lifecycle
apex-recall init <project> --json                                    # new project
apex-recall show <project> --json                                    # context: step, decisions, findings, artifacts
apex-recall checkpoint <project> <step> <phase> --json               # after each phase
apex-recall complete-step <project> <step> --json                    # on step completion
apex-recall review-audit <project> <step> ... --json                 # after challenger reviews

# Decisions + findings
apex-recall decide <project> --key <k> --value <v> --json
apex-recall decide <project> --decision "<text>" --rationale "<why>" --json
apex-recall finding <project> --add "<text>" --json

# Read-only orientation: sessions | files | search '<term>' | decisions (all accept --json)
```

If `apex-recall` returns useful context, skip redundant file reads.
If empty/errored, continue normally — it's a convenience, not a blocker.

Canonical `show --json` schema (including the `session.steps` shape and
jq query templates) lives at
[`tools/apex-recall/docs/show-schema.md`](../tools/apex-recall/docs/show-schema.md).
The valid decision-keys registry lives at
[`tools/apex-recall/docs/decision-keys.md`](../tools/apex-recall/docs/decision-keys.md).

## Multi-Step Workflow

The Steps 1–7 + Post-Lessons table is in [AGENTS.md](../AGENTS.md#agent-workflow);
the machine-readable source is
[`.github/skills/workflow-engine/templates/workflow-graph.json`](skills/workflow-engine/templates/workflow-graph.json).
Each step's outputs land in `agent-output/{project}/`; context flows via artifact
files + handoffs. Reviews are adversarial passes by challenger subagents —
**default flow is single-pass `comprehensive`** (mandatory at Steps 1, 2, 4;
Step 3.5 uses `governance-reconciliation`). Multi-pass deep review is **opt-in
only** via `decisions.review_depth = "deep"` or an explicit `10-Challenger`
invocation; never auto-fires by complexity tier. Reviews target AI-generated
creative decisions only (Steps 1, 2, 3.5, 4, with Step 3 ADRs and Step 5 code
as opt-in).

## Skills

Skills auto-discover via the `description` field in `.github/skills/{name}/SKILL.md`.
Agents read `SKILL.md` files on demand and load `references/*.md` only when the
body explicitly points to one. There is one tier — no digest, no minimal.

## Chat Triggers

- Messages starting with `gh` are GitHub operations (e.g., `gh pr create`,
  `gh workflow run`, `gh api`). Follow `.github/skills/github-operations/SKILL.md`
  (`gh` CLI-first, MCP fallback).

### GitHub Tool Priority (Mandatory)

For issues and pull requests, prefer the `gh` CLI over GitHub MCP tools — the
CLI is always available in this dev container and is the more stable primitive.
Fall back to MCP only when an operation has no `gh` CLI equivalent (e.g., rich
PR review thread management or bulk GraphQL queries). In devcontainers,
do not run `gh auth` commands unless the user explicitly asks for CLI auth
troubleshooting (`GH_TOKEN` is set via VS Code User Settings →
`terminal.integrated.env.linux`; shell exports do not propagate reliably).

### Explore Subagent Thoroughness

Specify thoroughness explicitly when invoking Explore:

| Lookup Type                           | Thoroughness | Examples                                                  |
| ------------------------------------- | ------------ | --------------------------------------------------------- |
| Single file read, config check        | `quick`      | "What's in azure.yaml?", "Find the main.bicep path"       |
| Multi-file comparison, pattern search | `medium`     | "How do agents reference skills?", "What modules exist?"  |
| Deep codebase research                | `thorough`   | "Audit all security patterns", "Full dependency analysis" |

Check whether the needed information is already in context from earlier
file reads before calling Explore.

## Conventions, Key Files & Validation

See `AGENTS.md` for all conventions, project structure, key file paths,
and build/validation commands.

**Terminal hygiene**: Never use `mv -i`, `rm -i`, `cp -i`, `read -p`, or any
prompt-driven shell builtin (incl. inside `bash -c '...'`). Pipe >50-line
output to a file. See `.github/instructions/no-interactive-shell.instructions.md`
for the full ruleset; `npm run lint:safe-shell` enforces it on committed
agent/skill/instruction snippets.
