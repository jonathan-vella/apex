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
the resolved AVM schema (`bicep-resolve-avm-module` or
`terraform/get_module_details`); pin mismatches block Phase 2.

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

```bash
cd infra/terraform/{project}/
terraform init -backend=false
terraform validate
terraform plan -refresh=false -input=false \
  -var-file=<env>/main.tfvars.json -out=tfplan
```

Re-render the env-specific bicepparam / tfvars from
`04-environment-manifest.json` via
`tools/scripts/validate-environment-manifest.mjs --redact` before
invoking.

**Timeout-retry policy** (enforced by `*-validate-subagent`): retry
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
