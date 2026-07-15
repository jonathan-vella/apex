---
title: "Secure the vNext Preview"
description: "Understand kernel authority, staged writes, exact approvals, evidence, and provider boundaries."
sidebar:
  order: 5
---

The APEX kernel is authoritative for project and run state, task envelopes, allowed output kinds, validation, artifact
acceptance, gate state, approval binding, provider authorization, and writer ownership. Conversation history and VS Code
system context remain outside that enforcement boundary.

## Stage Before Acceptance

Agents write through narrow MCP tools into `.apex/work/<run>/<task>/`, an ignored task staging area. The kernel checks
the current journal head and writer epoch, allowed paths and file types, byte limits, schemas, and business rules before
promoting accepted content into `.apex/objects/sha256/` and appending an immutable journal event.

Do not give creative agents general filesystem, shell, Git, Azure, Bicep, Terraform, or deployment tools. A staged file
is not canonical state, and a handoff or chat message is not evidence of completion.

## Enforce One Writer

Each run has one active writer. Local leases and journal compare-and-swap reject stale tasks and concurrent mutation.
Transfer to CI binds an ownership epoch to the project, run, repository, branch, commit, workflow, sender, recipient,
current Git head, and expiry. A stale epoch or mismatched head cannot authorize an operation.

Repository-state transfer uses a separate AES-256-GCM envelope from encrypted Terraform plan transport. Authenticated
metadata binds the envelope implementation and version, kind, plaintext digest, recipient, timestamps, claim, selected
project/run, writer epoch, journal head, repository, branch, commit, workflow, and optional approval environment. Import
authenticates and validates the complete bundle before atomic mode-`0600` writes. It refuses path traversal, symlinks,
secret-bearing JSON, oversized files, unreferenced objects, changed existing state, and any attempt to include
`.apex/local/`.

State import is not writer acceptance. The protected recipient must run the existing `writer transfer-accept` command
after import so approval and authority transfer remain separate operations.

GitHub Environment Gate 4 approval is authorized only after that accepted ownership exists at the run's current epoch.
The CLI derives context exclusively from GitHub Actions process variables and binds repository, full branch ref, commit,
workflow ref, run and attempt, job, environment, workflow actor, and canonical recipient into approval evidence. It
accepts no caller-supplied context document. The service compares every source-control field and recipient back to the
accepted ownership record before recording approval.

The evidence actor `github:<actor-id>:<actor>` identifies the workflow actor. APEX does not infer or attest the identity
of a GitHub Environment reviewer because GitHub does not expose that identity through these process variables. A
single-maintainer repository can therefore permit trigger-and-approve self-review unless its environment protection
rules enforce separation. Treat reviewer independence as an external repository governance control.

The current preview exposes writer transfer primitives, but production CI operation remains subject to release
qualification and provider-specific evidence. Do not simulate transfer by editing run files.

## Bind Preview to Apply

`apex preview` records operation, provider, target, inputs, IaC, policy, commit, owner epoch, changes, blockers, and
expiry. Deployment Preview approval binds that exact hash. `apex deploy` rejects missing, rejected, expired, stale, or
substituted approval and preview data.

- **Bicep:** native operations use Azure deployment stacks for apply and destroy ownership semantics. There is no
  unscoped generic Bicep destroy path.
- **Terraform:** preview creates a protected saved plan and execution-plan attestation. Apply uses that exact saved
  plan; it must not regenerate a plan after approval.

Preview bindings and encrypted plan artifacts persist across CLI process restarts under `.apex/local/provider-runtime/`.
The local AES-256-GCM key is generated with restrictive permissions or injected at runtime through
`APEX_PLAN_TRANSPORT_KEY`. A symlinked runtime path, permissive key file, wrong recipient, expired artifact, or changed
binding fails closed. Terraform configuration hashing includes source, automatic variable, and provider lock files while
excluding derived `.terraform/` content. Plaintext saved plans are removed immediately after encryption and temporary
apply files are disposed after use.

Provider-authority transfer uses the generic recipient-bound encrypted envelope to move only the exact preview binding
and, for Terraform, its exact encrypted saved-plan artifact. Authenticated bindings include provider, operation,
project/run, owner epoch, preview hash, recipient, and Terraform artifact reference and digest. Import validates the
complete envelope and bundle before writing only hash-derived paths beneath `.apex/local/provider-runtime/`. It cannot
transfer `plan-transport.key`, latest pointers, unrelated previews, or plaintext plans, and it does not approve Gate 4 or
deploy.

:::caution[Terraform CI limitation]
Production CI encrypted saved-plan transport is not yet qualified. Repository-state and provider-authority transfer are
implemented, but the separate preview/apply job sequence still requires live proof. Do not claim or enable production CI
Terraform apply until both recipient-bound transports pass live qualification.
:::

## Separate Evidence and Telemetry

Evidence acceptance applies kind and content-type policy, byte limits, structural redaction, secret scanning, and
content-addressed storage. Required approval and deployment attestations are part of authorization evidence. Optional
telemetry is disabled by default and can be consented to, exported, or deleted independently.

Never commit credentials, secret values, Terraform state, saved Terraform plan files, secret-bearing transient output,
or `.apex/local/`. APEX installs `.apex/.gitignore` to exclude `local/`, `work/`, and `cache/` while preserving
repository-backed locks, objects, projects, journals, refs, and views. Provider configuration must contain nonsecret
settings only; the CLI rejects secret-like keys. Never echo or persist `APEX_PLAN_TRANSPORT_KEY`. Resolve credentials
only at operation time through Azure CLI, OIDC, Managed Identity, or another approved external credential source.

Use the [operations guide](../operations/) to configure providers without secrets.
