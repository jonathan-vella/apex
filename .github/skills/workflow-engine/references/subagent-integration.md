<!-- ref:subagent-integration-v1 -->

# Subagent Integration Matrix

Subagents are wired into their parent agents automatically:

| Subagent                        | Parent Agent       | When Used                                              | Passes |
| ------------------------------- | ------------------ | ------------------------------------------------------ | ------ |
| `challenger-review-subagent`    | Requirements       | Step 1 — adversarial review of requirements            | 1x     |
| `challenger-review-subagent`    | Architect          | Step 2 — adversarial review of architecture (3 lenses) | 3x     |
| `challenger-review-subagent`    | Architect          | Step 2 — adversarial review of cost estimate           | 1x     |
| `challenger-review-subagent`    | Bicep Plan         | Step 4 — adversarial review of governance constraints  | 1x     |
| `challenger-review-subagent`    | Bicep Plan         | Step 4 — adversarial review of implementation plan     | 3x     |
| `challenger-review-subagent`    | Terraform Planner  | Step 4† — adversarial review of governance constraints | 1x     |
| `challenger-review-subagent`    | Terraform Planner  | Step 4† — adversarial review of implementation plan    | 3x     |
| `challenger-review-subagent`    | Bicep Code         | Step 5 — adversarial review of IaC code                | 3x     |
| `challenger-review-subagent`    | Terraform Code Gen | Step 5† — adversarial review of IaC code               | 3x     |
| `challenger-review-subagent`    | Deploy             | Step 6 — pre-deploy adversarial review                 | 1x     |
| `challenger-review-subagent`    | Terraform Deploy   | Step 6† — pre-deploy adversarial review                | 1x     |
| `cost-estimate-subagent`        | Architect          | Step 2 — pricing isolation + accuracy validation       | —      |
| `cost-estimate-subagent`        | As-Built           | Step 7 — as-built pricing for deployed SKUs            | —      |
| `governance-discovery-subagent` | Bicep Plan         | Step 4 — policy discovery gate                         | —      |
| `governance-discovery-subagent` | Terraform Planner  | Step 4† — policy discovery gate                        | —      |
| `bicep-lint-subagent`           | Bicep Code         | Step 5 Phase 4 — syntax check                          | —      |
| `bicep-review-subagent`         | Bicep Code         | Step 5 Phase 4 — code review                           | —      |
| `bicep-whatif-subagent`         | Deploy             | Step 6 — deployment preview                            | —      |
| `terraform-lint-subagent`       | Terraform Code Gen | Step 5† — syntax + format check                        | —      |
| `terraform-review-subagent`     | Terraform Code Gen | Step 5† — AVM-TF + security review                     | —      |
| `terraform-plan-subagent`       | Terraform Deploy   | Step 6† — deployment preview                           | —      |

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
