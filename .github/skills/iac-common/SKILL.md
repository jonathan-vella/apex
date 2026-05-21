---
name: iac-common
description: '**UTILITY SKILL** — Shared IaC deploy patterns for Bicep + Terraform agents: deployment strategies, circuit breaker, known deploy issues. WHEN: "phased deployment", "circuit breaker", "deploy strategy", "deploy issue", "shared IaC pattern". DO NOT USE FOR: preflight (azure-validate), code generation (azure-bicep-patterns / terraform-patterns).'
---

# IaC Common Skill

Shared deployment patterns used by both Bicep and Terraform deploy agents
(07b, 07t) and review subagents.

> **Preflight validation** (CLI auth, governance mapping, stop rules, known issues)
> has moved to the **azure-validate** skill. See `azure-validate/references/infraops-preflight.md`.

---

## Rules

- **Preflight first** — always run `azure-validate` before invoking any deploy strategy in this skill
- **azd by default** — use `azd provision` / `azd up` for all new projects. The legacy `deploy.ps1` path is deprecated; full decision matrix in [`references/azd-vs-deploy-guide.md`](references/azd-vs-deploy-guide.md).
- **Phased deployment for high-risk changes** — split into Foundation → Security → Data → Compute → Edge with user approval at each gate
- **Circuit breaker** — stop deployment automatically when policy violations, governance failures, or budget breaches are detected; surface to user before retrying
- **Set environment values before `--no-prompt`** — `AZURE_SUBSCRIPTION_ID`, `AZURE_RESOURCE_GROUP`, `AZURE_ENV_NAME`, `AZURE_LOCATION` must all be present (`azd env get-values`)
- **Use `azd env new {project}-{env}`** to avoid environment-name collisions across projects
- **Out of scope**: preflight (use `azure-validate`); code generation (use `azure-bicep-patterns` or `terraform-patterns`)

## Steps

Standard deploy flow used by `07b-Bicep Deploy` and `07t-Terraform Deploy`:

1. **Preflight** — run `azure-validate` (auth, governance, plan, what-if review)
2. **Set environment** — `azd env set AZURE_SUBSCRIPTION_ID/RESOURCE_GROUP/LOCATION` + verify via `azd env get-values`
3. **Preview** — `azd provision --preview` (Bicep) or `terraform plan` (Terraform); user reviews destructive operations
4. **Approve gate** — user explicitly approves the preview before any apply
5. **Apply** — `azd provision` / `azd up` (Bicep) or `terraform apply` (Terraform); for high-risk projects, deploy in phases (Foundation → Security → Data → Compute → Edge)
6. **Circuit-break on failure** — stop on policy/governance/budget violations; surface diagnostics to user
7. **Hand off** to `08-As-Built` for documentation

## Deployment Strategies

**Default**: use `azd` for every project. Each project is a self-contained azd project
(`azure.yaml` + `.azure/` inside `infra/{iac}/{project}/`). Phased deployment is now done
via azd hooks (`preprovision` / `postprovision`).

Full procedure (`azd up` / `azd provision --preview`, environment preflight checklist for
`--no-prompt` deploys, deprecated phased table, single-deployment fallback, and the legacy
`deploy.ps1` decision matrix) lives in
[`references/deployment-strategies.md`](references/deployment-strategies.md).

> **Single-deployment exception**: for projects with < 5 resources in dev/test, a single
> azd deployment is acceptable. All deploys still require explicit user approval.

---

## Reference Index

| Reference                     | Location                                                                                                                              |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Deployment strategies**     | `references/deployment-strategies.md`                                                                                                 |
| **azd vs `deploy.ps1` guide** | `references/azd-vs-deploy-guide.md`                                                                                                   |
| **AVM module index**          | `references/avm-module-index.md` (canonical CSV + JSON list of AVM modules in `.github/data/`)                                        |
| **AVM version freeze gate**   | `references/avm-version-freeze-gate.md` (Phase 4.4 gate before `plan_status=APPROVED`)                                                |
| **Codegen shared workflow**   | `references/codegen-shared-workflow.md` (Phase 2 output cadence loaded by `06b`/`06t` CodeGen agents)                                  |
| **Codegen file-order**        | `references/codegen-file-order.md` (per-tool file emission order loaded by `06b`/`06t` CodeGen agents)                                 |
| **Codegen DO / DON'T**        | `references/codegen-do-dont.md` (shared DO/DON'T bullets between `06b` + `06t`; tool-specific bullets stay in each agent body)         |
| **Preflight policy checks**   | `references/preflight-policy-checks.md` (deploy-agent jq snippets, skip-validation shortcut, L3 precheck routing matrix, deprecation scan regex) |
| **Azure Resource Graph primer** | [`references/azure-resource-graph-primer.md`](references/azure-resource-graph-primer.md) (canonical shared head used by `azure-compliance` / `azure-cost-optimization` / `azure-diagnostics` resource-graph references) |
| Preflight validation          | `azure-validate/references/infraops-preflight.md`                                                                                     |
| CLI auth validation procedure | `azure-defaults/references/azure-cli-auth-validation.md`                                                                              |
| Policy effect decision tree   | `azure-defaults/references/policy-effect-decision-tree.md`                                                                            |
| IaC policy compliance         | `.github/instructions/iac-bicep-best-practices.instructions.md` / `.github/instructions/iac-terraform-best-practices.instructions.md` |
| Bootstrap backend templates   | `terraform-patterns/references/bootstrap-backend-template.md`                                                                         |
| Deploy script templates       | `terraform-patterns/references/deploy-script-template.md`                                                                             |
| Circuit breaker               | `references/circuit-breaker.md`                                                                                                       |

## Circuit Breaker

Deploy agents MUST read `references/circuit-breaker.md` before starting
any deployment. It defines:

- **Failure taxonomy**: 6 categories (build, validation, deployment, empty, timeout, auth)
- **Anomaly patterns**: detection thresholds for repetitive failures
- **Stopping rule**: 3 consecutive same-type failures → halt + escalate
- **Escalation protocol**: write to session state, notify user, wait for guidance

## Bounded retry

Any retry loop in `04g-governance`, `07b-bicep-deploy`, `07t-terraform-deploy`,
or the deploy-time subagents (`bicep-whatif`, `terraform-plan`, `policy-precheck`,
`cost-estimate`) is capped at **3 attempts**. On the third failure the
agent escalates to the user with these three fixed options (and no
others):

| Option                    | When to choose                                                                            |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `proceed-with-substitute` | A safe substitute exists (alternate SKU, alternate AVM module, alternate parameter set). |
| `change-region`           | The failure is region-scoped (capacity, regional service gap, regional pricing spike).   |
| `abort`                   | None of the above is safe — return control to the user.                                  |

Use the same options across all four loops so the user's mental model
is consistent. The challenger-review-subagent checklist enforces
"retry loop bounded ≤3 with named escalation options"; unbounded loops
are flagged as `HIGH`.

Implementation hooks:

- Loop counter lives in the agent body, not in shared infrastructure
  (counts reset between human approvals).
- Record the substitute/region change as an `apex-recall decide` entry
  before retrying so the next session can trace the path.
- Combine with the circuit breaker: a 3-failure retry that escalates
  with `abort` ALSO trips the circuit breaker's escalation protocol.
