<!-- ref:subagent-integration-v1 -->

# Subagent Integration Matrix

Subagents are wired into their parent agents automatically:

| Subagent                      | Parent Agent       | When Used                                              | Passes |
| ----------------------------- | ------------------ | ------------------------------------------------------ | ------ |
| `challenger-review-subagent`  | Requirements       | Step 1 — adversarial review of requirements            | 1x     |
| `challenger-review-subagent`  | Architect          | Step 2 — adversarial review of architecture (3 lenses) | 3x     |
| `challenger-review-subagent`  | Architect          | Step 2 — adversarial review of cost estimate           | 1x     |
| `challenger-review-subagent`  | IaC Planner        | Step 4 — adversarial review of governance constraints  | 1x     |
| `challenger-review-subagent`  | IaC Planner        | Step 4 — adversarial review of implementation plan     | 3x     |
| `challenger-review-subagent`  | Bicep Code         | Step 5 — adversarial review of IaC code                | 3x     |
| `challenger-review-subagent`  | Terraform Code Gen | Step 5† — adversarial review of IaC code               | 3x     |
| `challenger-review-subagent`  | Deploy             | Step 6 — pre-deploy adversarial review                 | 1x     |
| `challenger-review-subagent`  | Terraform Deploy   | Step 6† — pre-deploy adversarial review                | 1x     |
| `cost-estimate-subagent`      | Architect          | Step 2 — pricing isolation + accuracy validation       | —      |
| `cost-estimate-subagent`      | As-Built           | Step 7 — as-built pricing for deployed SKUs            | —      |
| `bicep-validate-subagent`     | Bicep Code         | Step 5 Phase 4 — lint + code review                    | —      |
| `bicep-whatif-subagent`       | Deploy             | Step 6 — deployment preview                            | —      |
| `terraform-validate-subagent` | Terraform Code Gen | Step 5† — lint + AVM-TF/security review                | —      |
| `terraform-plan-subagent`     | Terraform Deploy   | Step 6† — deployment preview                           | —      |

† Terraform path only.

> [!NOTE]
> **Pricing Accuracy Gate (Steps 2 & 7)**: No agent writes dollar figures from
> parametric knowledge. All prices must originate from `cost-estimate-subagent`
> (Codex + Azure Pricing MCP). This policy applies to both the Architect
> (Step 2, `03-des-cost-estimate.md`) and As-Built (Step 7, `07-ab-cost-estimate.md`)
> agents. Established after model evaluation found pricing hallucinations
> (see `agent-output/model-eval-scoring.md`).

Optional manual validation (power users only):
If user explicitly requests extra validation at Step 5, delegate to lint/review/whatif subagents directly.

## Interactive vs Autonomous Delegation

> [!CAUTION]
> **`askQuestions` does NOT work in subagents.** The `askQuestions` tool presents
> interactive UI panels requiring direct user participation. Subagents run
> autonomously — any `askQuestions` calls are silently skipped.

Steps that use `askQuestions` must be delegated via **handoff buttons**
(direct user interaction), NOT via `#runSubagent`:

| Step | Agent           | Uses `askQuestions`      | Delegation Method |
| ---- | --------------- | ------------------------ | ----------------- |
| 1    | 02-Requirements | Phases 1-4 (mandatory)   | **Handoff only**  |
| 2    | 03-Architect    | If NFRs/budget missing   | `#runSubagent` OK |
| 3    | 04-Design       | No                       | `#runSubagent` OK |
| 4    | 05-IaC Planner  | Deployment Strategy Gate | **Handoff only**  |
| 5    | 06b/06t CodeGen | No                       | `#runSubagent` OK |
| 6    | 07b/07t Deploy  | No                       | `#runSubagent` OK |
| 7    | 08-As-Built     | No                       | `#runSubagent` OK |

For Step 2 (Architect): `askQuestions` is a fallback for missing info.
If `01-requirements.md` is complete, `#runSubagent` works fine. If the
Architect detects missing info with no upstream requirements, consider
sending the user back to Step 1 instead.

## File-Mode Contract for Subagent Output (Phase 1 of Context-Window Optimization)

`challenger-review-subagent` and `cost-estimate-subagent` follow a **file-mode
contract**: the subagent writes its full structured output to a parent-supplied
path on disk and returns only a compact summary (≤15 lines, ≤2 KB) to the
parent's chat context. This keeps parent agents' context windows small and
prevents repeated JSON dumps from bloating the conversation.

### Path convention

The parent agent **always** supplies `output_path` explicitly. The subagent
never invents or guesses a path.

| Subagent                     | Caller (step)                 | Canonical `output_path`                                                       |
| ---------------------------- | ----------------------------- | ----------------------------------------------------------------------------- |
| `challenger-review-subagent` | Requirements (1)              | `agent-output/{project}/challenge-findings-requirements.json`                 |
| `challenger-review-subagent` | Architect (2) — architecture  | `agent-output/{project}/challenge-findings-architecture-pass{N}.json`         |
| `challenger-review-subagent` | Architect (2) — cost          | `agent-output/{project}/challenge-findings-cost-estimate.json`                |
| `challenger-review-subagent` | Governance (3.5)              | `agent-output/{project}/challenge-findings-governance-constraints-pass1.json` |
| `challenger-review-subagent` | IaC Planner (4)               | `agent-output/{project}/challenge-findings-plan-pass{N}.json`                 |
| `challenger-review-subagent` | Bicep / Terraform CodeGen (5) | `agent-output/{project}/challenge-findings-iac-code-pass{N}.json`             |
| `cost-estimate-subagent`     | Architect (2)                 | `agent-output/{project}/02-cost-estimate.json`                                |
| `cost-estimate-subagent`     | As-Built (7)                  | `agent-output/{project}/07-ab-cost-estimate.json`                             |

Pass numbering uses `pass{N}` for multi-pass reviews; single-pass artifacts
omit the suffix. Backward compatibility: the legacy
`nordic-foods/challenge-findings-requirements.json` (no `-pass` suffix) is
grandfathered. Parents may read either name; new writes always use the new
convention.

### Atomic write + refuse-on-exists

The subagent:

1. Writes to `{output_path}.tmp` first.
2. Renames `{output_path}.tmp` → `{output_path}` only after a successful
   complete write. Partial writes never appear under the canonical name.
3. Refuses to overwrite an existing file unless the parent explicitly passes
   `overwrite: true`. This protects against silent loss on retries or
   parallel runs.

### Parent responsibilities

After the subagent returns its compact summary, the parent agent MUST:

1. Avoid pasting the full JSON inline in chat. Read `output_path` from disk
   only when full finding details are needed (e.g., Gate presentation, fix
   triage).
2. Record the artifact in session state via:

   ```bash
   apex-recall checkpoint <project> <step> <phase-tag> --json
   ```

   `apex-recall` has no dedicated `artifact` subcommand; the existing
   `checkpoint` subcommand stamps the new file in session state, and the
   file index picks the new file up on the next `reindex`.

3. When re-running after revisions, set `overwrite: true` explicitly.

### Why the contract was flipped

Previously parents wrote the JSON, which forced the subagent to return the
full payload via chat. On multi-pass reviews this dumped 5–10 KB of JSON
into the parent's context per pass. The file-mode contract pushes that
weight to disk and replaces it with a 15-line summary, cutting per-turn
context floor on review-heavy steps (2, 4, 5).
