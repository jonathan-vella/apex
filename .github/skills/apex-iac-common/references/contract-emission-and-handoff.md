<!-- ref:contract-emission-and-handoff-v1 -->

# Contract Emission & IaC Handoff (Wave 1+ / Wave 3+)

Shared CodeGen workflow for both 06b-Bicep and 06t-Terraform agents.
Defines the machine-readable contract integrity gate (Phase 1), the
validate gate (Phase 4.6), and the IaC handoff emission (Phase 6) that
replace the legacy prose `05-implementation-reference.md` as the input
to Deploy agents.

## Inputs from Step 4 (frozen)

CodeGen reads these as canonical sources of truth. Do NOT re-derive them
from `04-implementation-plan.md` prose:

| Artifact                       | Schema                                                                               | Purpose                                                      |
| ------------------------------ | ------------------------------------------------------------------------------------ | ------------------------------------------------------------ |
| `04-iac-contract.json`         | [`iac-contract-v0`/`v1`](../../../tools/schemas/iac-contract.schema.json)            | Resource list, module pins, diagnostics + identity contract  |
| `04-policy-property-map.json`  | [`policy-property-map-v1`](../../../tools/schemas/policy-property-map.schema.json)   | L1m governance attestation map (one row per Deny policy)     |
| `04-environment-manifest.json` | [`environment-manifest-v1`](../../../tools/schemas/environment-manifest.schema.json) | Per-environment values (subscription_id, identities, alerts) |

If any contract is missing or fails its validator, STOP and traverse
`↩ Return to Step 4`. CodeGen never patches the contract.

## Step 4 — Pre-review feasibility gate

Before the first independent review and after each authorized repair, validate the complete provider constraint set,
not only the last reported finding. This is author validation, not a replacement for independent review. Keep the
existing review/repair limits; finding another mechanical defect does not renew them.

### Names and scope

- Evaluate global-name derivations for every allowed environment with the full shared suffix, separators and
  maximum project segment. Storage and Key Vault must stay within 24 characters and their service-specific character
  rules. Bound the project segment using the remaining name budget, not a hard-coded assumption that every environment
  is `dev`. Preserve the approved suffix strategy. Check the same expression in plan and contract descriptions.
- For every raw resource, record resource scope, owning module target scope and caller scope. An RG module cannot
  contain a subscription-scoped `InsightAlert`; use a separate subscription module called by the subscription root.
  Keep budget/Action Group ownership independent from anomaly scope and direct email delivery.
- Read the selected track's cost guidance before authoring the cost task. For Bicep, load
  [all anomaly hard prerequisites](../../apex-azure-defaults/references/cost-alerts-bicep.md#6-cost-anomaly-alert-subscription-scoped)
  together: subscription module/call site, display-name limit, scope-matched view ID and bounded UTC-midnight schedule.
  Terraform implementations must satisfy the same Azure provider constraints using their supported resource API.

### Scheduled-action deployment contract

For each `Microsoft.CostManagement/scheduledActions` row, populate `resources[].deployment` with its actual kind
and scope. An `InsightAlert` requires all fields below (Bicep also requires `module_scope`); the existing
`validate:iac-contract` gate rejects incomplete or invalid values in both contract revisions and IaC tracks.

```json
{
  "kind": "InsightAlert",
  "scope": "subscription",
  "module_scope": "subscription",
  "display_name_max_length": 25,
  "view_scope": "same-subscription",
  "schedule": {
    "anchor": "deployment-date",
    "start_time": "00:00:00Z",
    "end_time": "00:00:00Z",
    "max_duration_days": 365
  }
}
```

These fields are CodeGen obligations, not proof of generated code or provider acceptance. Use the same values in
the task, raw-resource exception and code-generation bindings. Derive dates at deployment, not planning; Bicep can
use a `utcNow('yyyy-MM-dd')` parameter default and `dateTimeAdd(..., 'P365D', 'yyyy-MM-dd')` with midnight suffixes.
The 365-day bound is conservative across leap years. Preserve the full subscription ID in the view resource ID.
Do not invent an `Email` kind to bypass anomaly requirements. Retain provider/version verification at CodeGen/deploy.

### Validation and review brief

Run the explicit artifact-path commands below on the finalized batch, not a bare project name. A zero-file result
does not validate a project. For related checks use the actual plan path for `validate:plan-avm-pins`, contract path
for `validate:avm-versions:freeze`, and project directory for `validate:sku-iac-coverage`.
Use `apex-recall decisions --project <project> --json` and `.session.open_findings` from `show`; do not guess aliases.
Keep terminal programs explicit (`python3 -c`, `node --input-type=module -e`); bare language snippets are not shell code.
Confirm installed diagram icon classes before writing imports; preserve embedded SVG assets and inspect rendered output.
Recipient arrays contain plain email addresses, not Markdown links.

The review brief includes these provider constraints, exact input/output paths and actual validator commands/results.
Ask the first comprehensive reviewer to examine all coupled constraints and return all substantiated findings together,
not stop at the first issue. Confirmations check prior closure plus the same complete set; a clean schema is not
semantic feasibility. Do not increase the auto-fix cap or suppress later valid findings to reduce review counts.

## Phase 1 — Contract Integrity Gate (MANDATORY)

Run before any code-generation work:

```bash
npm run validate:iac-contract -- agent-output/{project}/04-iac-contract.json
npm run validate:iac-contract-consistency -- agent-output/{project}/04-iac-contract.json
npm run validate:policy-property-map -- agent-output/{project}/04-policy-property-map.json
```

Any non-zero exit ⇒ STOP. Run `validate:environment-manifest` too if
the workload uses identity / app regs / alerts / budgets.

Cross-check module source + version pins in `modules.<tool>[]` against
the resolved AVM schema (available Bicep metadata tools or Terraform Registry
metadata for the approved exact version); pin mismatches block Phase 2.

## Phase 4.6 — Validate Gate (MANDATORY)

Run an Azure-side validate **before** the challenger pass and **before**
handoff emission. This catches policy violations and template/provider
errors that local lint cannot.

### Bicep

```bash
az deployment sub validate \
  --location <primary-region> \
  --template-file infra/bicep/{project}/main.bicep \
  --parameters infra/bicep/{project}/main.<env>.bicepparam
```

### Terraform

The CodeGen parent runs this plan gate and records its evidence; the read-only
`terraform-validate-subagent` owns lint/review only. Backend-disabled init is
sufficient for local validation, not for planning against the configured backend.
Before this gate, verify backend existence/access and the approved backend
configuration and workspace. Do not bootstrap resources or migrate state here.
Missing prerequisites block the gate. After init, select and verify the approved
existing workspace before planning. Reinitialize on provider, lockfile, module,
or backend changes; workspace/environment changes invalidate prior plan evidence.
Reuse unchanged, verified initialization only when all those inputs remain current.

```bash
cd infra/terraform/{project}/
terraform init -input=false -lockfile=readonly && \
  terraform workspace select <approved-workspace> && \
  terraform workspace show && \
  terraform validate && \
terraform plan -refresh=false -input=false \
  -var-file=<env>/main.tfvars.json -out=tfplan
```

If init reports backend reconfiguration or migration is required, stop for the
existing approval/recovery path; never silently add migration or upgrade flags.
`-refresh=false` does not make a plan offline: providers/data sources may still
require Azure access. No access means no successful plan evidence.

Re-render the env-specific bicepparam / tfvars from
`04-environment-manifest.json` via
`tools/scripts/validate-environment-manifest.mjs --redact` before
invoking.

**Timeout-retry policy** (applied by the gate executor; Terraform: CodeGen parent): retry
**at most 2 times** with exponential backoff (5s, 15s) on transient
network / HTTP errors. Persistent template/provider errors are NOT
retried — they return to Phase 2.

Record `exit_code` and `stdout_sha256` in the upcoming
`05-iac-handoff.json#validation_summary.validate_gate`.

## Phase 6 — IaC Handoff Emission (MANDATORY, Wave 3+)

Emit `agent-output/{project}/05-iac-handoff.json` (schema:
[`iac-handoff-v1`](../../../tools/schemas/iac-handoff.schema.json)). This
compact record replaces the legacy prose `05-implementation-reference.md`
as the deploy agent's input — `07b/07t` reads ONLY the handoff and
`04-environment-manifest.json`, never re-reading the plan or the IaC
tree unless `tree_hash` mismatches.

### Required fields

- `tree_hash` — sha256 of sorted file hashes over the IaC root
  (`infra/bicep/{project}/` or `infra/terraform/{project}/`).
  Computed by `validate-iac-handoff.mjs`.
- `entrypoint`:
  - Bicep: `kind: bicep-main`, path to `main.bicep`, `scope: subscription`
  - Terraform: `kind: terraform-root`, path to module dir, `scope: subscription`
- `validation_summary.verdict` — must be `APPROVED`; anything else
  blocks `complete-step`.
- `validation_summary.tool_versions` — captured `bicep --version` or
  `terraform version` + `az version`.
- `validation_summary.validate_gate` — command + exit_code + stdout
  SHA-256 from Phase 4.6.
- `governance_attestation.rows[]` — one row per L1m Deny policy
  pointing at the file + line that satisfies it. **Every L1m Deny
  policy MUST have a row.**
- `required_inputs[]` — every IaC parameter / variable whose source
  field lives in `04-environment-manifest.json`.

### Validate before complete-step

```bash
npm run validate:iac-handoff -- agent-output/{project}/05-iac-handoff.json
```

`validation_summary.verdict != APPROVED` or any handoff validator error
blocks `apex-recall complete-step <project> 5 --json`.
