# APEX v1 Known Defects

> [Current Version](../../../VERSION.md) | Defects and accepted limitations that the vNext rewrite must not preserve.

## Classification

| Class               | Meaning                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| Product defect      | APEX behavior or repository setup violates its declared contract.                    |
| Platform limitation | Azure, Copilot, or tool behavior that APEX must detect, explain, or work around.     |
| Deliberate boundary | Supported v1 behavior that is intentionally not migrated into vNext.                 |
| Obsolete check      | A check whose contract has been superseded and should be removed rather than ported. |

## Ledger

| ID      | Class               | State                                 | Behavior and evidence                                                                                                                                | vNext treatment                                                                                                                                |
| ------- | ------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| DEF-001 | Product defect      | Fixed in candidate                    | Global `pytest` was undeclared and pricing tests bypassed the component venv. See [baseline evidence](baseline-evidence.json).                       | Keep Python projects independently locked and execute tests with the owning interpreter.                                                       |
| DEF-002 | Product defect      | Fixed in candidate                    | Site validation failed because the independent site lockfile was not installed by the devcontainer. See [baseline evidence](baseline-evidence.json). | Keep external projects independently locked and include each in setup/doctor.                                                                  |
| DEF-003 | Product defect      | Accepted v1 limitation                | v1 records deployment previews but does not kernel-enforce expiry and all source hashes before apply.                                                | Gate 4 binds the exact operation, target, inputs, IaC tree, policy envelope, preview, and expiry.                                              |
| DEF-004 | Product defect      | Accepted v1 limitation                | Creative v1 agents can rely on prompt/tool profiles rather than a single authorization boundary for state-changing capabilities.                     | Agents receive only narrow APEX MCP tools; the kernel authorizes every state change and external operation.                                    |
| DEF-005 | Product defect      | Accepted v1 limitation                | v1 state has no hash-linked event journal, one-writer lease, or compare-and-swap head contract.                                                      | Implement the journal, lease, CAS, divergence detection, and crash reconciliation before workflow features.                                    |
| DEF-006 | Product defect      | Accepted v1 limitation; characterized | Draw.io transport can fail on malformed surrogate data. The reproducer detects lone surrogate halves, while the root-cause fix remains incomplete.   | Keep Draw.io optional; reject malformed content at the capability boundary and prove VS Code cannot trigger the crash.                         |
| DEF-007 | Product defect      | Fixed in v1                           | Policy precheck previously allowed a blocked result with no blocking policy or what-if violation.                                                    | Preserve the contradiction validator as a deterministic business rule.                                                                         |
| DEF-008 | Platform limitation | Workaround documented                 | Some Azure provider checks occur only during apply, including SQL Entra object IDs and AKS outbound topology conflicts.                              | Add typed preflight checks, retain provider enforcement as authoritative, and reconcile indeterminate operations.                              |
| DEF-009 | Deliberate boundary | Approved by locked decision           | v1 sessions and artifacts are not resumable in vNext.                                                                                                | Keep v1 on its maintenance branch and require clean vNext runs.                                                                                |
| DEF-010 | Obsolete check      | Retire                                | v1 workflow metadata and UI expose additional approval gates beyond the four locked environment-run decisions.                                       | Preserve validation and governance preconditions, but expose only Requirements, Architecture and Cost, Plan, and Deployment Preview decisions. |

## Reproduction and Acceptance

- `DEF-001` and `DEF-002` have exact failed transcripts and a successful full-suite transcript in `evidence/`.
- `DEF-006` is reproduced by `node --test tests/drawio/reproduce-surrogate-error.test.mjs`.
- `DEF-007` is characterized by the policy-precheck validator fixtures.
- Repository owner `@jonathan-vella` explicitly accepted `DEF-003` through `DEF-006` as final-v1 limitations on
  2026-07-13. Each still requires an executable Phase 0B proof test before its vNext treatment is considered proven.
- Provider runtime failures and their current workarounds remain catalogued in
  `.github/skills/iac-common/references/known-deploy-issues.md`.

No baseline waiver is proposed. Accepted limitations remain visible in the freeze record; they are not reclassified as
successful behavior.
