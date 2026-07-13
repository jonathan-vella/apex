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

## Preview and Apply Locally

Complete required tasks and gates first, then configure the selected run's provider:

```bash
apex preview --operation apply --provider bicep \
  --provider-config provider-config.bicep.json --json
apex gate decide --gate 4 --decision approved --actor local-user --json
apex deploy --preview "$PREVIEW_HASH" --json
```

For Terraform, use `--provider terraform` and the Terraform provider config. The preview saves the plan under the local
plan directory, and deploy applies the approved exact plan. Production CI encrypted plan transport is not qualified.

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

Use the [CLI reference](./cli-reference/) for every flag and the [testing guide](./testing/) before a real sandbox run.
