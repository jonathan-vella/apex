---
name: review-imported-iac
agent: agent
model: GPT-5.4
description: "Ingest pasted or existing Bicep or Terraform, normalize it into the repo, run static review plus AVM and governance checks, and generate WAF review artifacts."
argument-hint: "Paste or select IaC, or provide a workspace path plus a project name"
---

# Review Imported IaC

## Mission

Take existing Azure IaC from the user, whether pasted into chat, selected in the editor,
or already present in the workspace, and run the full imported-IaC review flow:

1. intake and normalize the code into the repo layout
2. run static validation and security checks
3. audit AVM usage and pinned versions
4. detect non-AVM resources where AVM exists
5. perform governance review when Azure scope is available
6. generate a WAF review with cost context when workload inputs are available

Use the repository's existing agents, validators, and conventions wherever possible.
Do not replace existing workflow steps with ad hoc inline behavior when a repo-native
agent or validator already exists.

## Scope And Preconditions

- Supported input forms:
  - current editor selection: `${selection}`
  - IaC pasted directly into the current chat message
  - a file path or folder path in the workspace
  - an existing project already under `infra/bicep/` or `infra/terraform/`
- Supported IaC tools: Bicep and Terraform
- This prompt is for existing IaC intake and review, not greenfield code generation
- Never overwrite unrelated existing projects without explicit approval
- If the target project folder already exists and the user did not ask to replace it,
  ask before making structural changes

## Variables

- Project: `${input:project:imported-iac}`
- Source path: `${input:source_path:optional-workspace-path}`
- Preferred IaC tool: `${input:iac_tool:auto}`
- Target subscription: `${input:subscription:optional}`
- Target resource group: `${input:resource_group:optional}`

## Inputs To Collect

If any of these are missing, use one `askQuestions` call to collect them together.
Do not spread them across multiple back-and-forth turns.

- workload purpose and users
- environments
- SLA, RTO, RPO, and performance targets
- compliance and data-residency requirements
- monthly budget range
- scale assumptions: users, requests, data volume, transactions
- Azure subscription and optional resource group
- whether pasted code should be written into `infra/bicep/{project}/` or
  `infra/terraform/{project}/`

If the user provides only code and no workload context, complete the static IaC review first,
then collect the missing architecture inputs before finalizing the WAF assessment.

## Workflow

### 1. Resolve The IaC Source

1. If `${selection}` contains IaC, use it as the primary source.
2. Else if the current user message includes pasted IaC, use that source.
3. Else if `source_path` exists, read it.
4. Else stop and ask the user to either paste IaC or provide a workspace path.

### 2. Detect The IaC Tool

Classify the source before taking any write action.

- Bicep indicators:
  - `.bicep` or `.bicepparam` files
  - `resource foo 'Microsoft.` declarations
  - `module foo 'br/public:avm/res/` references
- Terraform indicators:
  - `.tf` or `.tfvars` files
  - `resource "azurerm_` blocks
  - `module` blocks using `Azure/avm-res-` or Terraform registry sources

If the source mixes Bicep and Terraform, ask which track to review first.

### 3. Normalize Into Repo Layout

Map the review target into the repo's expected structure.

- Bicep target: `infra/bicep/{project}/`
- Terraform target: `infra/terraform/{project}/`

Rules:

- If the source is already in the correct project folder, review in place.
- If the source is pasted text or a loose file set, create the target folder and place the
  imported IaC there.
- Preserve original filenames where possible.
- Create `main.bicep` or `main.tf` only when the source lacks a clear entry file.
- Keep changes isolated to the selected project folder.

### 4. Initialize Review Artifacts

Create or update the run directory under `agent-output/{project}/`.

Required setup:

1. Create `agent-output/{project}/` if missing.
2. Create `agent-output/{project}/00-session-state.json` from the repository template if missing.
3. Create `agent-output/{project}/00-handoff.md` summarizing source, tool, and scope.
4. Create `agent-output/{project}/01-requirements.md` from:
   - user-provided context
   - explicit assumptions gathered via questions
   - clearly labeled inferences from the IaC itself

When writing `01-requirements.md`, separate user-stated facts from inferred facts.
Do not present inferred architecture assumptions as confirmed requirements.

### 5. Run Static IaC Review

Always complete the static review, even if workload context is missing.

For Bicep:

1. Run `bicep lint` on the entry template.
2. Run `bicep build` on the entry template.
3. Run `npm run validate:iac-security-baseline`.
4. Invoke `bicep-validate-subagent` for structured review.

For Terraform:

1. Run `terraform fmt -check` on the target project.
2. Run `terraform validate` on the target project.
3. Run `npm run validate:iac-security-baseline`.
4. Invoke `terraform-validate-subagent` for structured review.

Persist static review findings to `agent-output/{project}/05-iac-static-review.md`.

### 6. Audit AVM Usage And Versions

Perform an explicit AVM audit separate from lint/build.

For Bicep:

1. Extract every `br/public:avm/res/...:x.y.z` reference.
2. Use `mcp_bicep_list_avm_metadata` to compare pinned versions with the latest catalog.
3. Flag any outdated module version.

For Terraform:

1. Extract every `Azure/avm-res-.../azurerm` module source.
2. Compare module versions with the latest Terraform registry version when tooling is available.
3. If version lookup is not available, mark the item as manual verification required.

For both tools:

1. Detect resources that are not using AVM even though an AVM exists.
2. Treat raw-resource usage as high severity unless the user explicitly approved a non-AVM exception.
3. Distinguish between:
   - no AVM exists
   - AVM exists but imported code is not using it
   - AVM exists and is used, but pinned version is stale

Persist results to `agent-output/{project}/04-avm-version-audit.md`.

### 7. Review Best Practices, Repeatability, And Deprecation Risk

Review the imported IaC for maintainability and policy drift.

Check for:

- hardcoded resource names or project identifiers
- hardcoded tag values
- missing required tags
- missing parameter descriptions or missing output definitions where expected
- explicit dependency wiring that should use symbolic references
- missing diagnostics or cost-management guardrails
- security-baseline drift
- stale Bicep API versions
- retired or deprecated Azure services
- Terraform usage patterns likely to be deprecated or legacy

Important:

- Verify deprecation claims with authoritative tooling or documentation.
- If uncertain, record `manual verification required` instead of guessing.

Append these findings to `agent-output/{project}/05-iac-static-review.md`.

### 8. Run Governance Review

If the user supplied subscription or resource-group context, perform policy-aware review.

1. Invoke `04g-Governance` when the repo-native governance path is appropriate.
2. Otherwise perform equivalent Azure Policy discovery using Azure tools.
3. Save `agent-output/{project}/04-governance-constraints.md` and
   `agent-output/{project}/04-governance-constraints.json`.
4. Compare the imported IaC against deny, modify, deploy-if-not-exists, and audit constraints.
5. Append compliance findings to `agent-output/{project}/05-iac-static-review.md`.

If Azure context is unavailable, do not silently skip governance review.
Mark it as pending due to missing scope.

### 9. Generate WAF Review

Once `01-requirements.md` contains workload purpose, NFRs, compliance, budget, and scale,
perform the architecture review.

Preferred path:

1. Invoke `03-Architect` to generate:
   - `agent-output/{project}/02-architecture-assessment.md`
   - `agent-output/{project}/03-des-cost-estimate.md`

Fallback path:

1. If one or more requirement categories are missing, ask for them in one batch.
2. If the user still declines to provide them, produce a code-derived WAF review with
   low confidence and explicitly list the missing evidence.

Do not claim a high-confidence WAF assessment when the only input is code.

### 10. Close The Intake Run

Present findings in priority order:

1. critical and blocking issues
2. standards and AVM gaps
3. warnings and manual-verification items
4. governance gaps
5. WAF risks and trade-offs

State whether the imported IaC is:

- ready for remediation only
- ready for governance and WAF review
- or ready to enter the standard plan, code, and deploy flow

Offer next actions only after the artifacts are written.

## Output Expectations

Write only the files relevant to the imported-IaC run.

Required artifacts:

- `agent-output/{project}/00-session-state.json`
- `agent-output/{project}/00-handoff.md`
- `agent-output/{project}/01-requirements.md`
- `agent-output/{project}/04-avm-version-audit.md`
- `agent-output/{project}/05-iac-static-review.md`

Conditional artifacts:

- `agent-output/{project}/04-governance-constraints.md`
- `agent-output/{project}/04-governance-constraints.json`
- `agent-output/{project}/02-architecture-assessment.md`
- `agent-output/{project}/03-des-cost-estimate.md`

## Quality Assurance

- Use the repository's existing agents, validators, and scripts before inventing new checks.
- Prefer subagents for formal validation and WAF assessment where the repo already defines them.
- Never silently skip AVM, governance, deprecation, or WAF checks.
- Keep imported code changes minimal and isolated to the selected project.
- Require approval before replacing or deleting existing project folders.
- Report uncertainty explicitly instead of making unsupported platform claims.
