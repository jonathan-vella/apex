<!-- ref:bicepparam-pattern-v1 -->

# `*.bicepparam` Pattern (Wave 2)

Records the **only** APEX-sanctioned shape for environment-specific
Bicep inputs: `*.bicepparam` files materialised at deploy time from
`agent-output/{project}/04-environment-manifest.json`. The committed
`main.bicep` MUST NOT hard-code GUIDs, subscription IDs, deployer
object IDs, or e-mail addresses.

> Loaded on demand by `06b-Bicep CodeGen` and `07b-Bicep Deploy` when
> they generate or render parameter files. Source: workflow
> simplification plan, Workstream E.

---

## File contract

```text
infra/bicep/{project}/
├── main.bicep                # ← committed, env-agnostic
├── main.dev.bicepparam       # ← committed, references env vars only
├── main.prod.bicepparam      # ← committed, references env vars only
└── modules/…
```

Each `main.<env>.bicepparam` uses `readEnvironmentVariable()` (Bicep CLI
≥ 0.21.0 — pinned in `tools/registry/tool-version-pins.json`) to pull
real values at compile time:

```bicep
using './main.bicep'

param environment           = 'dev'
param projectName           = readEnvironmentVariable('APEX_PROJECT')
param subscriptionId        = readEnvironmentVariable('APEX_SUBSCRIPTION_ID')
param tenantId              = readEnvironmentVariable('APEX_TENANT_ID')
param deployerObjectId      = readEnvironmentVariable('APEX_DEPLOYER_OBJECT_ID')
param existingApiAppObjectId = readEnvironmentVariable('APEX_EXISTING_API_APP_OBJECT_ID')
param alertEmails           = split(readEnvironmentVariable('APEX_ALERT_EMAILS'), ',')
param budgetMonthlyUsd      = int(readEnvironmentVariable('APEX_BUDGET_MONTHLY_USD'))
```

The deploy agent (`07b-Bicep Deploy`) exports `APEX_*` env vars from
`04-environment-manifest.json` before calling
`az deployment sub create --parameters main.dev.bicepparam`. Nothing
secret is logged — `07b` redacts via
`tools/scripts/validate-environment-manifest.mjs --redact` before
writing `06-deployment-summary.md`.

---

## Anti-patterns (blocked by `validate:iac-security-baseline`)

```bicep
// ❌ NEVER — env-specific GUID in source.
param deployerObjectId string = '2dcbd005-a02f-49c9-b5fb-5c03d4f6e28a'

// ❌ NEVER — secret default.
param adminPassword string = 'P@ssw0rd123!'

// ❌ NEVER — env-aware logic in main.bicep.
param environment string
var subscriptionId = environment == 'prod' ? '00000000-0000-0000-0000-000000000000' : '...'
```

The lint rule fires when a string literal matching the GUID regex
appears as a default value or non-null literal in committed
`*.bicep`/`*.bicepparam` files.

---

## Generation rules for 06b-Bicep CodeGen

1. Read `04-iac-contract.json#params[]` — these are the only params
   surfaced on `main.bicep`.
2. For each environment in `04-environment-manifest.json`, emit a
   `main.<env>.bicepparam` skeleton whose values are all
   `readEnvironmentVariable('APEX_<UPPER_SNAKE>')`.
3. Emit a sibling `infra/bicep/{project}/README.md` snippet listing the
   `APEX_*` env vars required by each environment.
4. Output the param→env-var mapping into
   `05-iac-handoff.json#required_inputs[]` so the deploy agent can wire
   the environment without re-reading the bicep tree.

---

## Validation gate

`bicep build main.dev.bicepparam` MUST succeed inside the validate
subagent — this catches typos in `readEnvironmentVariable()` keys and
ensures the param file actually compiles against `main.bicep`.

Validate-subagent records the build verdict in
`05-iac-handoff.json#validation_summary.validate_gate`.
