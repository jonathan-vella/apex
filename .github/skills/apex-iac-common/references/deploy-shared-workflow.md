<!-- ref:deploy-shared-workflow-v1 -->

# Deploy Shared Workflow

Shared workflow elements for both Bicep and Terraform deploy agents.
Each agent reads this reference and uses its IaC-specific deployment commands.

## Pre-Deploy Challenger Review

The workflow graph assigns no Challenger review to Step 6. Do not repeat creative reviews over tool output.
Preserve required upstream reviews, current live policy precheck (L3), destructive-change review, and user approval.
An explicit standalone Challenger request remains separate from the deployment gate.

## Preflight: Security Baseline Check

Before asking for runtime values, load and follow
[input resolution](../../apex-azure-defaults/references/identity-resolution.md#resolve-before-asking).
Reuse manifest and `session.decision_log` approvals; redacted placeholders and unset variables are different cases.

Run `npm run validate:iac-security-baseline` before preview/what-if.
If violations found, hand back to Code agent.
Reuse `security_validation_status: PASSED` only when its inputs match the current
IaC tree, baseline and tool/version evidence. Missing or stale evidence requires revalidation.

## Copy-Then-Fill Artifact Protocol

### Structured preview evidence

Bicep preview capture requires `--no-pretty-print --output json`; `--output json` alone may still emit human text.
Read Azure's actual top-level `changes`, `diagnostics`, `potentialChanges` and `status` (or explicit REST properties).
Use `node tools/scripts/summarize-deployment-preview.mjs --input <raw-json> --tool bicep|terraform
--expected-ids <approved-expanded-identities.json>`. Reconcile exact expected IDs, including child resources, from
approved bindings, not by copying the preview itself. Exit 0 is checked coverage, 2 requires review, 1 is invalid or blocked.
None grants apply permission. Unknown actions, diagnostics and incomplete expansion cannot become zero-change success.
Retain the raw payload and input/scope binding. Do not strip arbitrary text until JSON parsing happens to succeed.
Run `validate-policy-precheck.mjs <result> --preview <raw-json> --tool bicep|terraform
--expected-ids <approved-expanded-identities.json>` on that same evidence.
Policy-state observations are not complete effective assignments; retain query caps and missing/newer details.
Policy PROCEED is not approval of destructive changes or a substitute for preview coverage and human approval.

#### Accounted ignored resources

An existing child or service-linked resource may appear as `Ignore` outside the approved managed-ID set.
Do not copy it into that set or call it harmless based on its type. Both preview commands accept optional
`--ignored-evidence <bundle/ignored.json>` for exact unexpected Bicep `Ignore` IDs only. Leave this flag absent
when not needed; unaccounted Ignore entries still require review. Terraform behavior is unchanged.

Create this local evidence document with editing tools; retain the original preview and expected-ID bytes:

```json
{
  "schema_version": "preview-ignored-evidence-v1",
  "preview_sha256": "<full SHA-256 of raw preview file>",
  "expected_ids_sha256": "<full SHA-256 of independently derived expected-ID file>",
  "resources": [
    {
      "resource_id": "<exact ignored Azure resource ID>",
      "owner_id": "<exact approved parent resource ID>",
      "relationship": "private-endpoint-nic",
      "reason": "<why this verified related resource remains unmanaged by this deployment>",
      "evidence": { "path": "observations/endpoint.json", "sha256": "<full observation-file SHA-256>" }
    }
  ]
}
```

Supported relationship observations are read-only Azure response JSON, preserved in regular files inside the bundle:

- `private-endpoint-nic`: endpoint `id` equals `owner_id`; `networkInterfaces[].id` (or
  `properties.networkInterfaces[].id`) contains the ignored NIC ID.
- `sql-system-database`: database `id` equals the ignored ID, `name` is `master`, and the ID is exactly the
  approved SQL server ID followed by `/databases/master`.
- `storage-system-topic`: topic `id` equals the ignored ID; `properties.source` equals the approved Storage ID;
  `properties.topicType` is `Microsoft.Storage.StorageAccounts`. This proves association, not creation/ownership.

Reuse already captured observations while valid; if a prior command output was not saved, obtain only the missing
read-only observation instead of repeating discovery or what-if. Record collection scope/time and review provenance.
Hashes prove unchanged bytes, not truthful origin, current live state, approval or ownership; the owner must verify
those facts and record why the resource may remain unmanaged. Never synthesize observations to satisfy a check.
Record account checks without tokens (`az account get-access-token --output none`).

Absolute/traversing evidence paths, duplicate/stale entries, unknown relationships, approved managed IDs, actions
other than `Ignore`, and non-null `unsupportedReason` records cannot be excluded (absent/null means no reported reason).
The summary retains every change and emits
`coverage.accounted_ignored`, `counts.ignored` and evidence hashes. Missing expected resources, policy errors,
unknown actions, diagnostics and potential changes retain their normal gates. Use the same bundle in both commands:

```bash
node tools/scripts/summarize-deployment-preview.mjs --input preview.json --tool bicep \
  --expected-ids expected.json --ignored-evidence bundle/ignored.json
node tools/scripts/validate-policy-precheck.mjs precheck.json --preview preview.json --tool bicep \
  --expected-ids expected.json --ignored-evidence bundle/ignored.json
```

Passing this check establishes accounted resource coverage, not full provider validation or deployment approval.
Keep policy-definition freshness unverified when definition modification metadata is unavailable. Do not change an
existing policy verdict or overwrite previous evidence merely to obtain a passing result.

Start `06-deployment-summary.md` from the template, never from memory.

1. Read `.github/skills/apex-azure-artifacts/templates/06-deployment-summary.template.md`
   and copy its full content to `agent-output/{project}/06-deployment-summary.md`
2. Fill each `{placeholder}` with real deployment data — do not add, remove, or reorder H2 headings
3. Artifact lint is enforced by the lefthook `artifact-validation` pre-commit
   hook and the `10-Challenger` review — do **not** invoke
   `npm run lint:artifact-templates` or `markdownlint-cli2` directly against
   `agent-output/**` (see
   [`agent-authoring.instructions.md`](../../../instructions/agent-authoring.instructions.md#no-direct-markdownlint-on-agent-output-rule)).

The attribution line must match `> Generated by {agent-name} agent` (validated by regex).

## Post-Deploy: Smart PR Flow

Only when a PR actually exists and the user authorizes GitHub writes:

1. Check CI status via `gh pr checks` or MCP tools
2. Apply label `infraops-ci-pass` or `infraops-needs-fix`
3. Merge only with separate explicit user authorization; deployment success is not merge approval
4. See `.github/skills/apex-github-operations/references/smart-pr-flow.md`

## Stopping Rules

Stop immediately if: auth token fails · unresolved placeholders in params
(collect via `askQuestions` first) · preview/validate errors · destructive
operations without approval · >10 resource changes (summarize first) ·
user hasn't approved · deprecation signals detected.

Plan-only mode: if user selects plan/what-if only, generate `06-deployment-summary.md`
with preview results and mark status as simulated/not-applied, then stop before approval/apply.
Validation-only returns passed, failed, and unperformed checks without invoking preview or deployment.
Neither mode completes Step 6 as deployed or authorizes resource creation, backend bootstrap, or regeneration.
If a prerequisite needs those mutations, report the blocked check or preview and stop; do not solicit
bootstrap or deployment approval within the validation-only/preview-only request. A successful preview
does not expand that scope. Explain future authorization requirements only as information, not an approval gate.
Later setup/deployment requires an explicit user scope change and separate authorization for bootstrap
when needed, followed by current preview/policy evidence and final apply approval. Changed inputs invalidate
earlier approval; do not reuse it for new variables, state context or resource changes.

## Default Follow Through Policy

Within an explicitly requested deployment, when an approval gate is presented and the user approves, proceed immediately.
Do not re-confirm. If the user provides a custom response, interpret as instructions.

## Boundaries

- Always: run preview before apply, require user approval, validate prerequisites
- Always: use `askQuestions` for deployment approval gates
- Ask first: non-standard parameters or production deployment; preview remains mandatory
- Do not: deploy without user approval, modify IaC configurations, skip preview for production

---

## Deploy Agent — Shared DO / Pitfalls

Shared DO/Pitfalls bullets that apply to both
[`07b-bicep-deploy`](../../../agents/07b-bicep-deploy.agent.md) and
[`07t-terraform-deploy`](../../../agents/07t-terraform-deploy.agent.md).
Each agent appends only its tool-specific bullets (Bicep what-if
`--output` rule, `bicep build` skip, `deploy.ps1 -SkipValidation`,
deprecation scan — Terraform state-backend verification, `bootstrap-backend`
offer, `terraform validate`/`fmt -check`, no `-target`).

### DO — applies to both 07b and 07t

- Run preflight validation (auth + governance + plan check) BEFORE any
  deployment command.
- Scan parameter/tfvars inputs for placeholders; resolve approved/discoverable values first, then batch only
  genuine missing-value or conflict questions under the input-resolution procedure above.
- Check `04-implementation-plan.md` for the chosen deployment strategy
  (single shot vs. phased).
- Deploy phases one at a time with an explicit user approval gate
  between every phase.
- Present the preview / what-if / plan summary and **wait** for user
  approval before applying.
- Require explicit user approval for any **destructive operation**
  (Delete `-` in what-if, `- destroy` in plan).
- Generate `06-deployment-summary.md` with the actual success, partial, failed,
  or not-applied status; partial success is not completed deployment.
- Verify resources via Azure Resource Graph after the deploy.
- Update `agent-output/{project}/README.md` from verified graph/session status;
  mark Step 6 complete only after all required deployment checks succeed.

### Pitfalls — applies to both 07b and 07t

- **Do not create or modify IaC templates from the Deploy agent** —
  any template change unwinds to the matching Code agent (06b / 06t).
  Drift here is a governance violation, not a deploy decision.

---

## Slim Deploy Loop (Wave 3, all workloads)

Replaces the prior practice of re-reading the full
`04-implementation-plan.md` + every IaC file. The deploy agents
(07b / 07t) use `05-iac-handoff.json` and `04-environment-manifest.json` as primary inputs.
These are not an exhaustive read prohibition: read required referenced policy, SKU, phase and L3 inputs.
No generic `.azure/plan.md` is required. Missing or unusable handoff/code/expected manifest returns to CodeGen;
L1m mismatch returns to Planner; missing/stale governance returns to Governance.
The documented legacy `05-implementation-reference.md` fallback is permitted only with actual validation evidence
and current applicable checks; if neither usable path exists, stop. Never infer readiness from a validator's
zero-match success, file presence alone, or generic plan status. CodeGen owns handoff re-emission.
Legacy evidence supports validation/recovery, not a bypass of the hash gate. Without the JSON handoff,
return to CodeGen for re-emission before preview/apply; do not fabricate recorded hashes or change the approved method.

```text
1. read   agent-output/{project}/05-iac-handoff.json
2. read   agent-output/{project}/04-environment-manifest.json
3. assert validation_summary.verdict == APPROVED
  verify entrypoint, successful validate_gate evidence, and current l1m_ref
4. recompute tree_hash under iac-handoff.tree_hash.root
   ├─ match    → proceed
   └─ mismatch → invoke compact validate-subagent rerun
                 (lint-only, no full code review). If subagent re-approves
                 and the new tree_hash matches the recompute → continue.
                 Otherwise BLOCK and return to step-5.
5. resolve required_inputs[] from environment-manifest;
   render *.bicepparam / *.tfvars.json via redaction rules
  validation-only: return results and STOP (no preview/apply)
6. policy-precheck-subagent (L3) using policy_precheck_inputs
7. what-if (Bicep) / plan (Terraform) → preview-only: record not-applied and STOP;
  deployment request: human approval gate
8. azd provision / terraform apply → write 06-deployment-summary.md
```

The handoff carries the L2 attestation rows so the deploy agent does
not re-derive policy mapping from the IaC tree. Read source only for required verification or recovery;
delegate code revalidation to the declared validate-subagent rather than another creative review.

Schema + validator: `tools/schemas/iac-handoff.schema.json`,
`tools/scripts/validate-iac-handoff.mjs`.

## Hash-Match Gate Failure Modes

| Symptom                                           | Cause                                  | Action                                                                                                    |
| ------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `tree_hash` mismatch                              | IaC tree edited after Step 5 exit      | Run compact validate-subagent. If APPROVED + new hash matches recompute, continue. Else return to step-5. |
| `validation_summary.verdict != APPROVED`          | Step 5 exited NEEDS_REVISION or FAILED | BLOCK deploy; return to step-5 with reason recorded in apex-recall finding.                               |
| `entrypoint.path` missing on disk                 | IaC tree deleted / moved               | BLOCK; return to step-5.                                                                                  |
| `l1m_ref.sha256` mismatch                         | Plan was re-emitted after handoff      | BLOCK; return to step-4 (planner) — anti-livelock return edge.                                            |
| `required_inputs[].source_field` resolves to null | Environment manifest incomplete        | BLOCK with explicit user prompt listing missing keys.                                                     |
