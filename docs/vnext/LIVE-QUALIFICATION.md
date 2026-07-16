# vNext Live Qualification

This procedure prepares the manual GitHub Environment ceremony for issues
[#543](https://github.com/jonathan-vella/apex/issues/543) and
[#544](https://github.com/jonathan-vella/apex/issues/544). It does not record live deployment proof. A run is evidence
only after the candidate-bound apply and destroy ceremonies complete and their outputs are accepted into the release
evidence index.

## Prerequisites

Bootstrap the committed control plane from `infra/bicep/vnext-qualification/bootstrap.bicep`. Supply the dedicated
GitHub deployment principal and the local handoff uploader principal at deployment time. Do not commit a parameter file.

Configure the `vnext-qualification` GitHub Environment with required reviewer protection and these secrets:

- `AZURE_CLIENT_ID`, `AZURE_TENANT_ID`, and `AZURE_SUBSCRIPTION_ID` for OIDC.
- `APEX_PLAN_TRANSPORT_KEY`, canonical base64 encoding of exactly 32 random bytes.

Configure these Environment variables from the bootstrap outputs and canonical governance contract:

- `APEX_CONTROL_RESOURCE_GROUP`, `APEX_BACKEND_STORAGE_ACCOUNT`, `APEX_BICEP_RESOURCE_GROUP`, and
  `APEX_TERRAFORM_RESOURCE_GROUP`.
- `APEX_LOG_ANALYTICS_WORKSPACE_RESOURCE_ID`, `APEX_LOCATION`, and `APEX_PROJECT_NAME`.
- `APEX_QUALIFICATION_TAGS_JSON`, containing exactly the ten discovered tag keys enforced by the workflow validator.

The context validator requires subscription `00858ffc-dded-4f0f-8bbf-e17fff0d47d9`, project `vnext`, location
`swedencentral`, the `rg-vnext-qualification-*` resource groups, the bootstrap workspace/account naming contract, and
the exact approved tag values. A key-only or free-form tag object is rejected.

GitHub only accepts `workflow_dispatch` when the workflow file exists on the default branch. Review and merge the inert,
dispatch-only workflow bootstrap before attempting live qualification; this is a separate explicit approval and does not
merge the candidate runtime. The launcher verifies default-branch presence before dispatch and still executes the exact
`feat/apex-vnext-rewrite` candidate SHA. It also requires the default-branch, integration-branch, and local workflow
blobs to be byte-identical. Until that bootstrap merge is approved, dispatch is intentionally blocked.

The repository currently has a single-maintainer reviewer limitation. The sandbox Environment permits self-review so
the ceremony can run, but that does not demonstrate independent approval or separation of duties. Record this limitation
in retained evidence; production qualification requires an independently authorized reviewer.

## Dispatch

Build the vNext CLI locally, initialize or select the candidate state, and set `APEX_PLAN_TRANSPORT_KEY` in the
current process. The launcher requires a clean `feat/apex-vnext-rewrite` checkout and an explicit `--yes` because it
dispatches a workflow, opens a bounded backend network session, and uploads an encrypted handoff. Before dispatch, it
proves local management-plane authentication, transient endpoint and firewall mutation, handoff-container data access,
selected APEX track/Gate readiness, and default-branch workflow availability. Failure at this stage creates no workflow
run or writer claim.

```bash
npm run build:vnext
node tools/scripts/vnext-live-handoff.mjs dispatch --yes \
  --track bicep --operation apply --ref feat/apex-vnext-rewrite \
  --resource-group <control-resource-group> --storage-account <backend-account>
```

Repeat with the required track and operation combinations. After retrieving an apply result, dispatch `destroy` from the
same selected run; the new destroy preview supersedes the prior Gate 4 decision and requires a fresh Environment approval.
The launcher returns nonsecret JSON containing the handoff
UUID and exact run URL. A human must approve the `vnext-qualification` Environment when GitHub requests review. The
launcher never approves an Environment.

Each dispatch is valid only for run attempt one. A retry requires a new dispatch and a new encrypted handoff.

## Retrieve

After the apply job returns authority, retrieve it into an exact-candidate checkout. A first retrieval requires no
conflicting `.apex` state; retries may reuse byte-identical imported state or an already accepted exact local return.
The blob is deleted only after import and exact writer-claim acceptance succeed.

```bash
node tools/scripts/vnext-live-handoff.mjs retrieve --yes \
  --handoff-id <uuid> --track bicep --operation apply \
  --resource-group <control-resource-group> --storage-account <backend-account> \
  --destination /absolute/path/to/clean-candidate
```

For preview recovery, add `--stage preview-failure`. If the return blob is unavailable, the launcher prints the exact
fallback artifact name; it does not download arbitrary workflow artifacts.

## Security Model

- The backend has public network access Disabled at rest and a default-deny firewall. A session is admitted only when
  the exact governance exception is active and has at least 75 minutes remaining. The caller applies the live policy's
  `SecurityControl=Ignore` tag, enables the endpoint, and adds only its observed public IPv4 `/32`. Cleanup removes the
  rule, restores Disabled, removes the tag, and verifies both final states. The tag is never persistent.
- Before apply opens its session, it removes and verifies the preview rule is absent. This preserves the exception's
  one-runner maximum even after a failed preview cleanup.
- Azure access uses Entra authentication and GitHub OIDC. Shared keys, client secrets, plaintext plans, plaintext state,
  and the transport key are never artifacts.
- Preview and apply are separate protected jobs with distinct canonical recipients. Apply imports encrypted state and
  exact provider authority, accepts the exact writer claim, records GitHub Environment Gate 4, and deploys only the
  preview hash emitted by the preview job.
- The authority artifact contains only encrypted state and provider envelopes. Evidence artifacts are nonsecret.
- The workflow returns writer authority to `local:<handoff-id>` after acceptance, including failure paths where possible.

## Local Validation

The structural validator parses YAML and checks trigger, permission, action, Environment, recipient, transfer, cleanup,
Gate 4, exact-preview, encrypted-artifact, return-path, and forbidden-command invariants. Its mutation suite also tests
the launcher's pure argument, recipient, workflow-reference, and transport-key helpers without subprocess or network use.

```bash
npm run validate:vnext-live-workflow
npm run test:vnext-live-workflow
npm run test:vnext-validator
npm run qualify:vnext
```

Local success proves only that the prepared surface satisfies repository contracts. It does not prove GitHub reviewer,
OIDC, Azure RBAC propagation, Bicep deployment-stack, Terraform backend, apply, destroy, or authority-return behavior.
