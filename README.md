# APEX

Agentic Platform Engineering eXperience for Azure.

APEX is a multi-agent workflow that turns Azure platform engineering requirements into
deployable Bicep or Terraform with human approval gates across the lifecycle.

- [Documentation](https://apexops.pro/) ([source](https://github.com/jonathan-vella/apex-docs))
- [Accelerator template](https://github.com/jonathan-vella/apex-accelerator)
- [MicroHack](https://microhack.apexops.pro/)
- [Contributing guide](https://apexops.pro/project/contributing/)

## Workflow

New projects use the [practical workflow](.github/skills/apex-workflow-engine/references/practical-workflow.md):
reuse captured decisions, batch authorized routine repairs, bound review closure, and check policy feasibility early.
Specialists, production support and the lifecycle approval gates shown below remain.
Existing projects retain their legacy contract until explicitly adopted.
Delivery projects select [policy evidence](.github/skills/apex-azure-governance-discovery/references/policy-source.md)
before Architecture: explicitly accepted standard Corp assumptions or authorized target evidence.
The shared baseline needs no real subscription identifiers; assumptions never authorize implementation.
Native target capture can keep identifying scope and policy snapshots in an owner-only private store.
Private policy collection uses `--retain-rule-evidence` to retain full policy objects and effective parameter/member
lineage inside that same private snapshot. Offline semantic validation requires this evidence; summary-only caches
need a bounded authorized refresh. Existing opaque snapshot hashes bind the raw archive without publishing it in Git.
Retail pricing uses [captured meter evidence](.github/skills/apex-azure-defaults/references/pricing-guidance.md):
monthly estimates require explicit billing inputs and deterministic evidence-linked totals.
Explicit rate-only quotes support unknown monthly usage without approving an incomplete workload estimate.
Recovery preserves raw responses, original timestamps and consumed request allowances.
Older monthly outputs remain historical evidence: use explicit legacy audit for inspection, not current approval.
Refresh into a new owned output with its original request and required review.
Never restamp reviewed prices or reset allowances.

Delivery resume reports actual prerequisite recovery instead of an unconditional ready-to-run handoff.
Stale inputs and exhausted affected reviews return one actionable work package to their owners;
already-current reviews consume no new allowance. Stage scope includes the declared owned reconciliation,
updates and bounded reviews, while new permissions and human stage approvals remain explicit.
See the [complete-stage contract](.github/skills/apex-workflow-engine/references/practical-workflow.md#complete-stage-work-package).
Private-evidence reviewers use canonical literal paths. One verified same-invocation correction of an omitted
scope directory retains the failed read in provenance; missing evidence and access denials still block.

Product documentation uses [source/date references and original billing conclusions](.github/skills/apex-azure-defaults/references/cost-estimate-parent-contract.md#product-documentation-and-publication),
with explicit applicability and limitations, not automatic full-page copies.
Necessary full-text research captures remain private outside Git unless redistribution rights and attribution are
established. Repairing old review-bound captures preserves original evidence privately and historical review records;
changed inputs require revalidation, not restamped approval. Native retail API responses still require exact-byte capture.
Git preserves artifact bytes without line-ending normalization so staged captures retain their evidence hashes.

```mermaid
%%{init: {'theme':'neutral'}}%%
sequenceDiagram
  autonumber
  participant U as User
  participant C as Orchestrator
  participant R as Requirements
  participant X as Challenger
  participant A as Architect
  participant G as Governance
  participant IaC as IaC Plan
  participant Gen as IaC Code
  participant D as Deploy
  participant W as As-Built

  Note over C: ORCHESTRATION LAYER<br/>AI prepares. Humans decide.

  U->>C: Describe infrastructure intent
  C->>R: Translate intent into structured requirements
  R-->>C: 01-requirements.md (includes iac_tool selection)
  C->>X: Challenge requirements
  X-->>C: challenge-findings-requirements.json
  C->>U: Present requirements + challenge findings

  rect rgba(255, 200, 0, 0.15)
  Note over U,C: HUMAN APPROVAL GATE
  U-->>C: Approve requirements
  end

  C->>A: Assess architecture (WAF + Cost)
  Note right of A: cost-estimate-subagent<br/>handles pricing queries
  A-->>C: 02-architecture-assessment.md + 03-des-cost-estimate.md
  C->>X: Challenge architecture
  X-->>C: challenge-findings-architecture.json
  C->>X: Independently review cost feasibility
  X-->>C: challenge-findings-cost-estimate.json
  C->>U: Present architecture + challenge findings

  rect rgba(255, 200, 0, 0.15)
  Note over U,C: HUMAN APPROVAL GATE
  U-->>C: Approve architecture
  end

  C->>G: Discover policy constraints
  G-->>C: 04-governance-constraints.json and Markdown
  C->>X: Reconcile constraints with approved architecture
  X-->>C: challenge-findings-governance-constraints-pass1.json
  C->>U: Review governance constraints and confirmations
  U-->>C: Approve governance
  C->>IaC: Create implementation plan using approved inputs
  Note right of IaC: Unified IaC Planner (05)<br/>routes based on decisions.iac_tool
  IaC-->>C: 04-implementation-plan.md
  C->>X: Challenge implementation plan
  X-->>C: challenge-findings-plan.json
  C->>U: Present plan + challenge findings

  rect rgba(255, 200, 0, 0.15)
  Note over U,C: HUMAN APPROVAL GATE
  U-->>C: Approve plan
  end

  C->>Gen: Generate IaC templates (AVM-first)
  Note right of Gen: Bicep codegen or Terraform codegen
  Gen-->>C: infra/bicep/{project} or infra/terraform/{project}

  rect rgba(0, 150, 255, 0.08)
  Note over C,Gen: Validation loop
  alt Validation passes
    C->>U: Present templates for deployment
    rect rgba(255, 200, 0, 0.15)
    Note over U,C: HUMAN APPROVAL GATE
    U-->>C: Approve for deployment
    end
  else Validation fails
    C->>Gen: Revise with feedback
  end
  end

  C->>D: Execute deployment
  Note right of D: what-if or terraform plan preview first
  D-->>C: 06-deployment-summary.md
  C->>U: Present deployment summary

  rect rgba(255, 200, 0, 0.15)
  Note over U,D: HUMAN VERIFICATION
  U-->>C: Verify deployment
  end

  C->>W: Generate workload documentation
  Note right of W: Reads prior artifacts and deployed resource state
  W-->>C: 07-*.md documentation suite
  C->>U: Present as-built docs

  Note over U,W: AI orchestrated. Human governed. Azure ready.
```

## Assess an Existing Workload

Use `/waf-assess-existing` with `01-Orchestrator` to assess supplied IaC, diagrams, or explicitly scoped
read-only Azure evidence. Choose evidence-only (no business interview) or requirements-led assessment.
The [standalone workflow](.github/skills/apex-workflow-engine/references/standalone-assessment.md)
delivers a WAF report, architecture diagram and cost report after upfront scope authorization and automatic
internal work, independent WAF/cost-quality reviews and one final bundle acceptance.

Azure cost reports use authorized actual spend, trends and available forecast; IaC-only uses labelled estimates.
The proposed default is last completed calendar month, preceding-month comparison and month-to-date,
with current-month forecast when available. Missing evidence and unpriced costs are explicit gaps, not zeros.
Acceptance is terminal, not remediation, compliance approval or a handoff to formal Governance/deployment.
Existing projects keep their histories and require explicit adoption; the infrastructure delivery workflow is unchanged.
New Azure/combined assessments also deliver an
[Assessment Action Register](.github/skills/apex-azure-artifacts/references/assessment-action-register.md)
as Excel plus Markdown. Actions carry evidence, priorities, qualitative effort, relative recommended windows
and defensible monthly additions/savings/net change. Unknown costs stay unquantified; overlapping benefits
are not summed twice. Edit the structured source and regenerate the snapshot rather than tracking manual Excel changes.
IaC-only export is optional; historical runs keep their captured output contract.
See the [WAF Assessment User Guide](https://apexops.pro/guides/waf-assessment/) for step-by-step walkthroughs
and prompts for both `evidence_only` and `requirements_led` scenarios.

## Start Here

For new projects, start from the Accelerator template rather than cloning this repository
directly:

1. Create a repository from the [Accelerator template](https://github.com/jonathan-vella/apex-accelerator).
2. Open that repository in VS Code and reopen it in the dev container.
3. Follow the [published documentation](https://apexops.pro/).

## What This Repository Contains

- Agent definitions, [skills](.github/skills/README.md), and instruction files for the VS Code Copilot workflow engine
- Reference implementations for Bicep and Terraform tracks
- Validation scripts, MCP configuration, and sample agent outputs
- `apex-recall` CLI for session state and recall across `agent-output/` projects
- Runtime references, artifact templates, and Architecture Explorer graph metadata

See [AGENTS.md](AGENTS.md) for contributor setup, conventions, and validation commands, and
[CHANGELOG.md](CHANGELOG.md) for recent changes.

## License

MIT. See [LICENSE](LICENSE).
