---
description: 'Test Terraform convention and security compliance on generated code (TS-10, TS-11)'
agent: 'agent'
tools:
  - execute/runInTerminal
  - read/readFile
  - search/textSearch
  - search/fileSearch
  - search/listDirectory
  - edit/editFiles
argument-hint: 'Provide the project name with generated Terraform configs'
---

# Test: Convention & Security Compliance (TS-10, TS-11)

Run test suites TS-10 (Convention Compliance) and TS-11 (Security Baseline)
from the Terraform E2E test plan against generated Terraform configurations.

## Mission

Inspect generated `.tf` files for compliance with CAF naming conventions,
project standards, and Azure security baseline requirements.

## Scope & Preconditions

- Read `docs/tf-tests/terraform-e2e-test-plan.md` sections TS-10 and TS-11
- `infra/terraform/${input:projectName}/` MUST contain generated `.tf` files
- No Azure authentication required (static analysis only)

## Inputs

| Variable               | Description                                     | Default  |
| ---------------------- | ----------------------------------------------- | -------- |
| `${input:projectName}` | Project name with Terraform configs to validate | Required |

## Workflow

### TS-10: Convention Compliance

**TS-10-01: CAF naming**

Search generated resource names for CAF patterns:

- `rg-{project}-{env}`
- `kv-{short}-{env}-{suffix}`
- `st{short}{env}{suffix}`

**TS-10-02: Storage account names**

Grep for `azurerm_storage_account` names — verify no hyphens,
≤ 24 chars, lowercase only.

**TS-10-03: Key Vault names**

Grep for Key Vault names — verify ≤ 24 chars.

**TS-10-04: Default region**

Read `variables.tf` — confirm `location` default is `swedencentral`.

**TS-10-05: Variable descriptions**

Search all `variable` blocks — every one must have `description`.

**TS-10-06: Variable types**

Search all `variable` blocks — every one must have `type`.

**TS-10-07: No terraform -target**

Search deploy scripts and all `.tf` files:

```bash
grep -r "terraform.*-target" infra/terraform/${input:projectName}/ || echo "PASS"
```

**TS-10-08: Count conditionals (if phased)**

If `var.deployment_phase` exists, verify module calls use
`count = var.deployment_phase == "all" || ...`.

### TS-11: Security Baseline Compliance

**TS-11-01: TLS 1.2**

```bash
grep -r "min_tls_version" infra/terraform/${input:projectName}/
```

All instances must be `"TLS1_2"`.

**TS-11-02: HTTPS only**

```bash
grep -r "https_traffic_only_enabled\|https_only" infra/terraform/${input:projectName}/
```

Must be `true` on all applicable resources.

**TS-11-03: No public blob**

```bash
grep -r "public_access_enabled\|allow_nested_items_to_be_public" \
  infra/terraform/${input:projectName}/
```

Must be `false`.

**TS-11-04: Managed identity**

```bash
grep -r "identity" infra/terraform/${input:projectName}/ | grep -i "systemassigned\|userassigned"
```

Preferred over keys/connection strings.

**TS-11-05: SQL AD-only auth**

If SQL resources exist:

```bash
grep -r "azuread_authentication_only" infra/terraform/${input:projectName}/
```

Must be `true`.

**TS-11-06: No inline secrets**

```bash
grep -rn "password\|secret\|connection_string" infra/terraform/${input:projectName}/*.tf \
  | grep -v "sensitive\|key_vault\|description\|variable\|#"
```

Must return empty (no plaintext secrets).

**TS-11-07: Public network access**

```bash
grep -r "public_network_access_enabled" infra/terraform/${input:projectName}/
```

Must be `false` for production data services.

### Update Test Tracker

Update the **Test Execution Tracker** in
`docs/tf-tests/terraform-e2e-test-plan.md`:

- Set TS-10 and TS-11 Result, Date, Executor, Notes

## Output Expectations

```text
TS-10: Convention Compliance  — [PASS/FAIL] (X/8 tests passed)
TS-11: Security Baseline      — [PASS/FAIL] (X/7 tests passed)
Failing tests: [list any failures with IDs]
```
