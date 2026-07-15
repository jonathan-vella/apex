---
title: "Operate the vNext Preview"
description: "Configure, preview, apply, destroy, reconcile, diagnose, and recover local APEX vNext runs."
sidebar:
  order: 6
---

Run operations from the initialized consumer repository. Add `--json` whenever another process consumes the result.

## Check Setup and Health

```bash
apex setup
apex setup --live --json
apex doctor --json
apex doctor --fix --yes --json
```

`setup --live` checks Azure CLI authentication. `doctor` checks Node.js, workspace state, required executables, managed
files, runtime compatibility, provider configuration, backend readiness, and the Terraform CI transport limitation.
Repair mode refreshes managed files and the runtime lock; it does not authenticate Azure or invent provider settings.

## Configure a Native Provider

Store nonsecret settings in a local JSON file and pass it once with `--provider-config`. A successful command persists
the validated settings to `.apex/provider-config.json`.

```json title="provider-config.bicep.json"
{
  "bicep": {
    "resourceGroup": "rg-apex-preview-dev",
    "deploymentName": "apex-preview-dev",
    "stackName": "apex-preview-dev",
    "templateFile": ".apex/work/RUN/TASK/code/main.bicep",
    "parametersFile": ".apex/work/RUN/TASK/code/main.parameters.json",
    "actionOnUnmanage": "deleteResources",
    "ownershipAuthorizesDeleteResources": true,
    "denySettingsMode": "denyDelete"
  }
}
```

```json title="provider-config.terraform.json"
{
  "terraform": {
    "cwd": ".apex/work/RUN/TASK/code",
    "target": "subscription-preview",
    "planDirectory": ".apex/local/terraform-plans",
    "lockfileHash": "REPLACE_WITH_CURRENT_SHA256"
  }
}
```

Do not add tokens, passwords, keys, credentials, backend secrets, or Terraform state to provider configuration. Use the
actual run and task paths returned by `apex task context`.

Bicep preview lists deployment stacks in the configured resource group and selects the exact `stackName` in process. A
missing exact stack is treated as an empty managed set, so the first cloud mutation remains the approved
`az stack group create`. Malformed, duplicate, or wrong-resource-group stack entries fail before Gate 4.

`lockfileHash` must equal the current raw SHA-256 of `.terraform.lock.hcl`. The CLI also hashes all `.tf`, `.tf.json`,
`.tfvars`, `.tfvars.json`, and lock files under `cwd`, excluding `.terraform/`. Preview and deploy recompute that tree;
source drift, variable drift, lock drift, or a symlink fails closed. `configHash` may pin an expected tree hash but is not
required because APEX always computes the current value.

APEX stores preview bindings and encrypted Terraform plan artifacts under `.apex/local/provider-runtime/`. The generated
local transport key is mode `0600` and never enters provider configuration. A trusted process can instead inject a
base64-encoded 32-byte key through `APEX_PLAN_TRANSPORT_KEY`; never print, commit, or place that value in a workflow
definition. Injecting a key does not qualify production CI transport.

## Transfer Repository State to CI

Create a writer-transfer claim first, then encrypt only the selected repository-backed state for that claim:

```bash
apex state transfer-export \
  --claim "$CLAIM_HASH" \
  --file apex-state-transfer.json \
  --recipient "$RECIPIENT" \
  --ttl-seconds 1800 \
  --yes --json
```

The recipient imports with the same externally supplied 32-byte transport key:

```bash
apex state transfer-import \
  --file apex-state-transfer.json \
  --recipient "$RECIPIENT" \
  --yes --json
```

The import is staging-free but preflights every entry before any write. Existing byte-identical files make a retry
idempotent; any differing file, symlink ancestor, unsafe path, secret-bearing JSON, stale claim, or binding mismatch
fails closed. The command never writes `.apex/local/plan-transport.key` and never accepts writer authority. Run
`apex writer transfer-accept --claim "$CLAIM_HASH" --recipient "$RECIPIENT" --head "$COMMIT"` separately after the
existing approval ceremony.

The scanner recognizes only three exact secure assertions in `runtime/defaults.v1.json`, with their required boolean
values. A changed value or the same field name at any other path fails closed. The envelope expiry must not exceed the
writer-transfer claim expiry.

## Transfer Exact Provider Authority to Apply

Set the intended apply recipient when creating a Terraform preview. Terraform encrypts the saved plan for that identity,
which may differ from the current preview writer:

```bash
apex preview --operation apply --provider terraform --recipient "$RECIPIENT" --json
```

After preview completes, create exactly one writer-transfer claim from the preview writer to that recipient, then export
only the binding for the preview. Terraform also includes the exact encrypted saved-plan artifact referenced by that
binding. A transfer claim created before preview cannot authorize the preview.

```bash
apex provider transfer-export \
  --preview "$PREVIEW_HASH" \
  --provider terraform \
  --file apex-provider-authority.json \
  --recipient "$RECIPIENT" \
  --ttl-seconds 1800 \
  --yes --json
```

In the separate apply job, supply the same external key and import before Gate 4 approval and deployment:

```bash
apex provider transfer-import \
  --file apex-provider-authority.json \
  --recipient "$RECIPIENT" \
  --yes --json
```

The import accepts only the exact hash-derived binding path and optional Terraform artifact path. It rejects changed
destinations and symlinked runtime ancestors, while allowing byte-identical retries. It never transfers or creates the
transport key, approves Gate 4, or invokes a provider. Keep production CI apply blocked until a live separate-job proof
qualifies the complete repository-state and provider-authority sequence.

## Approve Gate 4 in a Protected Workflow

Configure the apply job with a protected GitHub Environment and set `APEX_GITHUB_ENVIRONMENT` to that environment's
exact name. Create the writer-transfer claim with that same name in `--environment`; the claim, encrypted state handoff,
accepted ownership, and approval must agree. GitHub supplies the remaining context variables. After importing state and
provider authority, accept the writer transfer with the canonical recipient for the current run, attempt, and job. Then
approve Gate 4 without an `--actor` flag:

```bash
apex gate decide \
  --gate 4 \
  --decision approved \
  --mechanism github-environment \
  --json
```

The CLI derives the evidence actor as `github:<actor-id>:<actor>` and the recipient as
`github-actions:<repository>:<run-id>:<run-attempt>:<job>`. It rejects local invocation, pull-request refs, missing or
malformed variables, stale ownership, and any repository, branch, commit, workflow, recipient, or owner-epoch mismatch
against the accepted writer-transfer claim. The approval expires no later than its exact deployment preview.

The accepted transfer must advance the preview owner epoch by exactly one. Gate 4 records the authenticated claim hash,
and deploy recomputes the same proof from ownership, claim bytes, and journal order. A second transfer, changed claim,
superseded preview, expired writer lease, or changed dependency revision fails before approval or provider execution.
Approval expires at the earlier of the preview and current writer lease.

GitHub Environment evidence records the workflow actor, not the identity of a required reviewer. In a repository where
one maintainer can trigger the workflow and approve its environment, this does not prove independent review. Configure
reviewer separation and environment protection outside APEX when separation of duties is required.

Production CI remains blocked until the protected-environment ceremony and the complete separate-job transfer path have
live proof on the exact release candidate.

Bicep defaults to `detachAll`. Set `ownershipAuthorizesDeleteResources: true` only when the stack exclusively owns every
resource it may delete. `deleteAll` additionally requires an explicitly dedicated sandbox resource group and separate
authorization in provider configuration.

## Preview and Apply Locally

Complete required tasks and gates first, then configure the selected run's provider:

```bash
apex preview --operation apply --provider bicep \
  --provider-config provider-config.bicep.json --json
apex gate decide --gate 4 --decision approved --actor local-user --json
apex deploy --preview "$PREVIEW_HASH" --json
```

For Terraform, use `--provider terraform` and the Terraform provider config. The preview saves the plan under the local
plan directory, immediately encrypts it into the local provider runtime, removes the plaintext plan, and deploy applies
the approved exact plan. Provider transfer is implemented, but production CI encrypted plan transport remains blocked
pending live proof across separate preview and apply jobs.

The semantic dependency revision covers project/run identity, target, IaC track, runtime lock, and accepted artifact
hashes. Writer ownership epoch is separate authority: an ownership-only transfer preserves the revision while approval
and deploy still require the exact consecutive owner epoch and transfer lineage.

## Preview and Apply a Destroy

Destroy is also preview-bound:

```bash
apex preview --operation destroy --provider terraform --json
apex gate decide --gate 4 --decision approved --actor local-user --json
apex deploy --preview "$DESTROY_PREVIEW_HASH" --json
```

Bicep destroy uses the configured deployment stack and its ownership settings. Review `actionOnUnmanage` and
`denySettingsMode` before approval. Do not substitute an unscoped Azure deletion command.

## Inspect and Recover

```bash
apex inventory --json
apex reconcile --json
apex diagnose --json
apex project history --limit 50 --json
apex cache status --json
apex cache clear --json
```

`reconcile` requires an existing recorded inventory and appends a reconciliation event. `diagnose` is read-only and
combines run status with doctor results. Cache entries are deterministic and safe to recompute.

## Manage Updates, Telemetry, and Writers

- Run `apex update --json` to update managed customizations. Resolve `APEX_CONFLICT` without overwriting user changes.
- Use `apex telemetry consent --value true|false`, `telemetry export`, and `telemetry delete` for optional telemetry.
- Use `apex writer show` before transfer. Create and accept a claim only with the current repository head and intended
  recipient workflow; expired or stale claims must be recreated.

Use the [CLI reference](../cli-reference/) for every flag and the [testing guide](../testing/) before a real sandbox run.
