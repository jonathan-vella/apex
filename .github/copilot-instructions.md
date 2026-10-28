# APEX - Copilot Instructions

> VS Code Copilot-specific orchestration instructions.
> For general project conventions, build commands, and code style, see the root `AGENTS.md`.

## Azure Defaults (canonical)

This section is the canonical declaration of Azure infrastructure defaults.
Azure-producing skills, agents, and prompts use this section — never restate
the values inline. The IaC workflow, CAF naming guidance, AVM procedure,
and reference index live in
[`.github/skills/apex-azure-defaults/SKILL.md`](skills/apex-azure-defaults/SKILL.md).

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
the APEX-standard 9-tag set — `environment`, `owner`, `costcenter`,
`application`, `workload`, `sla`, `backup-policy`, `maint-window`,
`technical-contact` — all lowercase. This mirrors the org-wide
resource-group tag-deny policy (every key must exist on the RG or the
deployment is denied). Citation + greenfield decision checklist:
[`apex-azure-defaults/references/tag-strategy.md`](skills/apex-azure-defaults/references/tag-strategy.md).

> The PascalCase set (`Environment`, `ManagedBy`, `Project`, `Owner`)
> is a **deprecated convention** retained only for backward
> compatibility on existing projects whose deployed resources already
> carry that casing. Do not propagate it to new projects. `ManagedBy`
> and `Project` are not part of the required contract — `ManagedBy` may
> still be emitted as an optional deploy-provenance marker.

### Security baseline + AVM mandate

Non-negotiable: HTTPS-only, TLS 1.2 minimum, no public blob, Managed Identity
over keys, AVM-first. PaaS data services use private endpoints and disabled
public access in every environment, except Log Analytics and workspace-based Application Insights:
authenticated public query/ingestion is permitted when policy and approved requirements allow it;
AMPLS is required for mandated private monitoring, not by default. App Service APIs are private; public-facing
web applications may use public HTTPS ingress. Private DNS resolution is required;
verified DINE ownership avoids duplicate DNS deployment, not DNS itself.
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
apex-recall show <project> --json                                    # context: all state lives under .session (e.g. jq '.session | {current_step, steps, decisions, policy_feasibility, review_attempts, effective_reviews, gate_readiness}')
apex-recall handoff [<project>] --json                               # deterministic next-step owner, checkpoint, frozen artifacts, settled inputs, and resume command
apex-recall checkpoint <project> <step> <phase> --json               # after each phase
apex-recall complete-step <project> <step> --json                    # on step completion
apex-recall review-audit <project> <step> ... --json                 # after challenger reviews

# Atomic step transition — PREFERRED for moving between steps. Bundles
# complete-step (with challenger gate) + decide + start-step into one
# 00-session-state.json write, avoiding partial-update drift.
apex-recall transition <project> --from-step <s> --to-step <t> \
    --complete --decision key=value --json

# Decisions + findings
apex-recall decide <project> --key <k> --value <v> --json
apex-recall decide <project> --decision "<text>" --rationale "<why>" --json
apex-recall finding <project> --add "<text>" --json

# Read-only orientation: sessions | files | search '<term>' | decisions (all accept --json)
```

If recall returns sufficient, current context, skip redundant file reads.
A file inventory is not its content. Read missing required sections directly;
after edits, compaction, or a new chat, refresh what is no longer current or available.
Empty/failed recall does not waive required inputs or approvals: recover existing
project state before advancing, and never infer completion from artifact numbering.

Canonical `show --json` schema (including the `session.steps` shape and
jq query templates) lives at
[`tools/apex-recall/docs/show-schema.md`](../tools/apex-recall/docs/show-schema.md).
The valid decision-keys registry lives at
[`tools/apex-recall/docs/decision-keys.md`](../tools/apex-recall/docs/decision-keys.md).

## Multi-Step Workflow

The Steps 1–7 + Post-Lessons table is in [AGENTS.md](../AGENTS.md#agent-workflow);
the machine-readable source is
[`.github/skills/apex-workflow-engine/templates/workflow-graph.json`](skills/apex-workflow-engine/templates/workflow-graph.json).
Each step's outputs land in `agent-output/{project}/`; context flows via artifacts
and handoffs. Follow the graph's review contract and [workflow table](../AGENTS.md#agent-workflow),
including the independent Step 2 cost-feasibility review. Reuse valid completed reviews;
missing/stale evidence or blocking findings must be resolved before approval.
Deep review requires `decisions.review_depth = "deep"` or an explicit user request,
never complexity alone. Production handoffs and approval gates remain human-controlled.

## User Question Forms

For explicitly adopted `practical-v1` projects, the
[practical workflow](skills/apex-workflow-engine/references/practical-workflow.md)
replaces administrative disposition questions with granted mechanical work and a change summary.
Retain material decisions and final stage approvals. Legacy projects keep their existing contract
until explicit migration; source maintenance does not rewrite their histories or allowances.

Apply these checks to every agent producing a user-question form, for any workflow phase,
before direct display or delegated return:

- Ask only missing, applicable material inputs. Reuse captured custom answers; do not reconfirm settled fields.
- Use distinct contextual titles and one field per independent input. Native fields already accept custom text:
  never append unconditional companion note/guidance fields or separate "Other, explain" fields.
- Ask a dependent follow-up only after its actual trigger or genuine ambiguity remains.
  Identify its subject in the title and omit inputs already answered; batch independent pending follow-ups.
- Preflight the native shape: only `message` and `requestedSchema` reach `ask_user`;
  `requestedSchema` contains only `properties`. Keep delegated metadata outside that payload.
- Validate explicit applicability as well as shape. For authorized scoped files, run
  `python3 tools/scripts/validate_question_batching.py --form <scoped-form.json> --context <question-context.json> --require-context`.
  Without context, the compatibility check certifies shape only, not readiness to display.
  Do not widen write permissions to create validation files: read-only roles check the same contract in memory.
  Send only the validated payload to `ask_user`; recheck after edits. Remove any owned temporary payload after use.
- Keep context separate: `answers` maps stable material-input IDs to captured values; `fields` maps each displayed
  property to `{input_id, kind}`. Use `kind: input|follow_up|approval|disposition`; never default approval/disposition.
  Conditional fields add `when: {input_id, equals}` against an actual captured answer, not a suggested default.
  Every follow-up needs that trigger; omit already answered or duplicate material inputs.
  A renamed global guidance field is still conditional, not a new independent requirement.
  Genuine independent requirements may share a word such as "notes"; identify their distinct material input.
  Return this context alongside delegated forms, never inside the native payload.
- The reusable `validate_payload(form, context, require_context=True)` function in the same script performs the
  check without filesystem writes. For discovery, retain the tested helper's separate `context` and complete ledger.
  Ambiguous context returns for correction; do not invent a trigger or relabel a companion as independent to pass.
- Return malformed delegated forms for one schema-only correction; another failure blocks with the error.
  Validation is not evidence that a follow-up was triggered, human approval or permission to bypass role boundaries.

## Skills

Skills auto-discover via the `description` field in `.github/skills/{name}/SKILL.md`.
Agents read `SKILL.md` files on demand and load `references/*.md` only when the
body explicitly points to one. There is one tier — no digest, no minimal.

## Harness And Runtime Boundaries

- Target the GitHub Copilot SDK harness inside VS Code. Archived Local prompts are
  historical, not entry points. Skills inherit caller model/tools and grant no permissions.
- Describe the actual selected/calling role only when native context establishes it; otherwise report it as unknown.
  A default coordinating chat is not evidence that `01-Orchestrator` was selected. General assistance remains available,
  but a role name in prose, loaded skill or returned form never supplies that role's permissions or approvals.
- Missing role telemetry is not a workflow gate. For an explicit start/resume request, continue otherwise-authorized
  coordination under actual tools, calling constraints, scope and human approvals; report unknown identity honestly.
  Project `session.metadata` and generic session-information tools are not role-selection evidence.
  Do not request repeated UI selection or dispatch a role-verification worker merely because a role label is absent.
  Known role restrictions, missing required capabilities and unapproved operations still block the affected action.
- Load missing current coordinator and owner contracts before delegation; reuse available unchanged guidance.
  Preserve approved requirements and pass the full requested phase contract, not just a list of files to draft.
  Partial artifacts are not phase completion; follow the existing worker lifecycle for validation and continuation.
- `01-Orchestrator` remains human-selected (`disable-model-invocation: true`).
  Deploy, Diagnose and manual Challenger entries also disable implicit invocation;
  this metadata is not proof of credential isolation or consequential authorization.
  It dispatches authorized named workers through the
  [native task lifecycle](skills/apex-workflow-engine/references/worker-readiness.md).
  No custom readiness/execution envelope, nonce or per-worker raw-log verification is required.
  Step agents call only authorized leaves; leaves never delegate or ask users.
  Every directly selected main owns native `ask_user`; Requirements, Architect, Design and Governance
  remain interactive. Delegated steps return `USER_INPUT_REQUIRED` to their interactive parent.
  Decline never approves and cancellation stops. Static allowlists are not routing evidence.
- Automatic and optional manual reviews use the same read-only `challenger-review-subagent` through
  [shared structured review](skills/apex-azure-defaults/references/one-shot-review.md).
  The leaf returns JSON; its interactive parent records actual synchronous results and validates
  schema, provenance and freshness. Built-in prose critics are not mandatory JSON dependencies.
  Model selection remains runtime-managed.
  A delegated owner without nested task capability returns `REVIEW_REQUIRED`; the authorized interactive
  Orchestrator invokes that same reviewer as a sibling automatically, preserving budgets and actual provenance.
  Missing nested tools are not by themselves an unavailable reviewer or a reason to request manual Challenger.
- If a required reviewer is unavailable, STOP and return the actual failure to the
  interactive parent; never invoke a nested wrapper or fabricate an inline review.
  `10-Challenger` remains optional manual recovery. Missing/empty reviewer output
  permits exactly one identical-input retry within the existing budget, then a human decision under the
  [review protocol](skills/apex-azure-defaults/references/adversarial-review-protocol.md#subagent-discovery-fallback-default--deep).
- Keep essential role, approval, security, output, and stop rules in main agent bodies.
  Authoring `applyTo` matches do not prove runtime attachment. Load required guidance
  when missing; do not automatically load vendor-authoring guidance during production work.
- Active agent definitions omit model and reasoning-effort pins. The operator and
  runtime control selection, including Auto and HydraFusion; no picker identifier,
  underlying model, effort or model-source label is a readiness requirement.
  Missing or differing model telemetry is diagnostic only. Verify named-worker
  actual task results without per-call model, effort or context overrides.
  Continue the same task only when its native handle supports it; one-shot tasks need new bounded input.
  Missing required tools or approval still blocks the affected execution. Optional legacy model labels remain
  descriptive fixture support, not active assignments or
  proof of runtime cost-tier eligibility.
- Active agents have no UI handoff metadata: the owner observed no controls in the tested Copilot client.
  Tool restrictions were not established by that probe; role metadata is not credential isolation.
  Native Autopilot can auto-answer questions, so a form/task result is not real owner authorization.
- Use available editing tools for existing files, preserve user work, and validate before
  dependent follow-up edits. No shared procedure requires a particular bulk-edit tool.
- Explicit lab risk acceptance follows [the authorization contract](../tools/apex-recall/docs/risk-authorizations.md).
  Keep review integrity separate, preserve NEEDS_REVISION and unresolved findings, and check current readiness for
  each action. Ordinary consent establishes no risk-owner authority; kit permission never authorizes deployment.

## Chat Triggers

- Messages starting with `gh` are GitHub operations (e.g., `gh pr create`,
  `gh workflow run`, `gh api`). Follow `.github/skills/apex-github-operations/SKILL.md`
  (`gh` CLI-first, MCP fallback).

### GitHub Tool Priority (Mandatory)

For issues and pull requests, prefer the `gh` CLI over GitHub MCP tools — the
CLI is always available in this dev container and is the more stable primitive.
Use `gh api` for REST/GraphQL operations beyond high-level CLI commands.
Fall back to discovered MCP tools only when a required CLI capability is unavailable;
GraphQL or review threads alone do not establish that limitation. In devcontainers,
do not run `gh auth` commands unless the user explicitly asks for CLI auth
troubleshooting. Git normally uses VS Code-forwarded host credentials;
`gh` uses its explicitly authenticated config volume or optional `GH_TOKEN`
inherited by the host VS Code process at launch (`${localEnv:GH_TOKEN}`).
`terminal.integrated.env.*` affects terminals only, not that substitution
or all hooks, MCP processes, and the extension host. Never request tokens
through chat, expose them to the model, or store secrets in repository files.
For an identity mismatch, compare `gh api user --jq .login` with the account
named in Git's denial. Only with explicit user authorization, use
`git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin <approved-feature-branch>`.
Keep the helper single-quoted. Never switch credentials automatically, change
persistent Git configuration, force-push, or infer approval to push to `main`.

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

**Artifact lint delegation**: Agents do not call `npm run lint:artifact-templates`
or `markdownlint-cli2` directly against `agent-output/**`. The lefthook
`artifact-validation` pre-commit hook and the `10-Challenger` review own the
contract. Validator-tracked anti-pattern — see
[`agent-authoring.instructions.md`](instructions/agent-authoring.instructions.md#no-direct-markdownlint-on-agent-output-rule).
