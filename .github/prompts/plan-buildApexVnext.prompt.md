## Plan: Build the APEX vNext Rewrite

Rebuild APEX with a greenfield implementation while treating the existing APEX product as a brownfield replacement. The
revised approach first characterizes v1, proves the risky platform and deployment assumptions, and only then locks the
architecture. A deterministic TypeScript kernel and npm CLI own workflow, state, validation, evidence, and authorized
capabilities. A cross-client Copilot plugin supplies thin agents and skills for VS Code and GitHub Copilot CLI. The
release proves one complete Bicep vertical slice before adding Terraform and parity, while preserving selected v1
operational behavior.

**Locked decisions**

- Distribution is hybrid: an npm package provides the `apex` CLI/kernel and a versioned cross-client Copilot plugin
  provides agents, skills, hooks, and MCP configuration. Consumer repositories keep project state plus an APEX runtime
  lock and may recommend the plugin; they do not vendor the plugin payload by default.
- The plugin exposes narrow APEX MCP tools. Creative agents do not receive general shell, Azure, deployment, or
  unrestricted filesystem tools. The kernel controls only its own context projection and capabilities; client
  conversation history and system context are explicitly outside its enforcement boundary.
- One active writer is allowed per project run. Local leases plus compare-and-swap protect the journal. Distributed
  collaborative writers are deferred. A CI deployment job becomes the active writer only for its approved run; local
  execution must be quiescent.
- Each workflow run targets one environment and Azure scope. Promotion to another environment creates a linked run that
  reuses approved shared contracts but receives its own preview, approval, deployment, inventory, and evidence.
- The normal delivery path has four human gates per environment run: Requirements, Architecture and Cost, Implementation
  Plan, and Deployment Preview. The Deployment Preview decision is the production approval ceremony, not a separate
  pre-approval followed by another confirmation.
- GitHub Environments with required reviewers plus GitHub OIDC are the first noninteractive production approval
  mechanism. The approval evidence binds the actor/run identity, environment, target, commit,
  intent/binding/IaC/input/preview hashes, and expiry. Other CI providers are deferred behind a future provider
  interface.
- Bicep deployments use Azure deployment stacks where the Phase 0 spike verifies required scope and delete behavior.
  Isolated sandbox runs may own and delete a dedicated resource group. There is no unscoped generic Bicep destroy.
- Terraform uses a secured Azure Storage backend by default, with OIDC/Managed Identity rather than shared keys, state
  locking, versioning/retention, scoped access, and governance-compliant networking. Preview creates a protected saved
  plan and deploy applies that exact plan.
- Native Azure CLI/Bicep or Terraform commands are the audited deployment path. `azure.yaml` may be emitted as optional
  compatibility output, but `azd provision` is not allowed to bypass the approved native preview.
- Both Bicep and Terraform ship end to end in the first complete release. A track-neutral implementation-intent contract
  is bound separately to Bicep and Terraform realization contracts.
- No v1 session or artifact importer is built. Existing projects remain on a v1 maintenance branch for 12 months after
  cutover, receiving security and critical fixes. The exact support end date is published at cutover.
- Preserve v1 setup/doctor, quota and regional availability checks, post-deploy diagnosis, run lessons/quality
  reporting, and project list/search/history behavior. Their internals are rewritten behind kernel contracts.
- Deterministic CI uses no Azure credentials or model calls. Manual release qualification covers real Copilot clients
  and Azure sandboxes; no recurring paid model canary or LLM-as-judge is introduced.
- Use the newest production-supported release channel: the newest supported Node.js LTS patch, and the newest stable/GA
  release for ecosystems without LTS channels. Resolve the newest mutually compatible set at adoption and at a recorded
  release cutoff, then pin exact versions/digests and lock transitive dependencies. New releases after the cutoff enter
  the next candidate. Exceptions require an owner, evidence, expiry, and upgrade target.
- The repository is private and is the approved evidence boundary. Commit complete nonsecret evidence without identifier
  sanitization, including tenant, subscription, principal and resource IDs, inventories, operational logs, and
  user-consented client telemetry. Credentials, secret values, Terraform state, and saved Terraform plan files remain
  prohibited from Git because they can contain plaintext secrets; keep them in their secured backend or ignored local
  runtime storage.
- Site redesign remains deferred, but minimum accurate vNext installation, workflow, security, operations, support, and
  v1-versioning content is required on the public site before cutover.

**Target architecture**

- `packages/contracts/` owns versioned JSON Schemas and generated TypeScript types.
- `packages/kernel/` owns runtime-bundle compatibility, workflow reduction, tasks, leases, gates, provenance,
  invalidation, operation reconciliation, authorization, and telemetry.
- `packages/cli/` owns the `apex` executable, stable JSON/error/exit-code contracts, and the APEX MCP server used by
  both Copilot clients.
- `packages/capabilities/` owns typed in-process, process, MCP, Azure CLI, Bicep, and Terraform adapters. It is the only
  path to state-changing external operations.
- `packages/renderers/` produces deterministic human views from canonical contracts.
- `packages/testkit/` provides fake capabilities, scenario builders, clock/ID injection, mutation helpers, crash/fault
  injection, and contract assertions from Phase 1 onward.
- `plugin/` contains `plugin.json`, thin agents, curated skills, lifecycle hooks, and MCP configuration that launches
  the installed `apex mcp serve` command.
- `config/runtime-bundle.v1.json` binds workflow, defaults, schemas, validators, plugin, CLI, capability protocol, and
  toolchain versions/hashes into one compatible release unit.
- `config/workflow.v1.json` contains only deterministic nodes, edges, conditions, validators, invalidation rules, role
  ownership, and four gates. It never executes arbitrary expressions.
- `config/defaults.v1.json` contains nonsecret product defaults and security invariants; live governance remains
  authoritative for the target scope.
- `config/toolchain.v1.json` records authoritative source, release channel, newest observed stable version, observation
  cutoff, selected exact pin/digest, compatibility set, installed version, and approved exceptions.

**Consumer state layout**

- `.apex/apex.lock.json` pins the compatible CLI, plugin, runtime bundle, workflow, defaults, schemas, validators,
  capability protocol, and toolchain hashes.
- `.apex/config.json` stores repository-level nonsecret configuration and the selected project.
- `.apex/objects/sha256/{prefix}/{hash}` stores immutable, content-addressed accepted artifacts, including complete
  nonsecret live evidence.
- `.apex/projects/{project}/project.json` stores project identity and references to shared approved contracts.
- `.apex/projects/{project}/runs/{run-id}/run.json` stores one environment/scope, parent promotion run, selected IaC
  track, and runtime-lock reference.
- `.apex/projects/{project}/runs/{run-id}/events/{sequence}-{event-id}.json` stores individually atomic, hash-linked
  events. The chain provides corruption evidence, not authentication against a malicious repository writer.
- `.apex/projects/{project}/runs/{run-id}/refs/` stores typed references to accepted objects, findings, approvals,
  previews, inventories, and views.
- `.apex/projects/{project}/runs/{run-id}/views/` stores deterministic Markdown renderings.
- `.apex/work/{run-id}/{task-id}/` is an ignored staging area. Agents can write only here through APEX MCP tools.
- `.apex/local/{run-id}/` is ignored and stores leases, derived snapshots, Terraform saved plans, secret-bearing
  transient responses, and recovery metadata. Complete secret-free inventory, logs, and user-consented telemetry may be
  accepted into the private repository. Secrets are resolved only at operation time and never copied into task context.

**Canonical contracts**

- Runtime and execution: `runtime-bundle-lock-v1`, `project-config-v1`, `run-config-v1`, `task-envelope-v1`,
  `task-result-v1`, `event-v1`, `operation-record-v1`, `approval-evidence-v1`, and `evidence-manifest-v1`.
- Creative intent: `requirements-v1`, `sku-manifest-v1`, `architecture-v1`, `cost-estimate-v1`, and
  `review-findings-v1`.
- Governance and planning: `governance-constraints-v1`, `policy-property-map-v1`, `implementation-intent-v1`,
  `iac-binding-v1`, and `environment-inputs-v1`.
- IaC and deployment: `logical-resource-manifest-v1`, `iac-handoff-v1`, `execution-plan-attestation-v1`,
  `deployment-preview-v1`, and `resource-inventory-v1`.
- Qualification: `scenario-v1`, `quality-report-v1`, and `telemetry-v1`.
- Every schema has a stable `$id`, declared JSON Schema dialect, compatibility policy, maximum size, sensitivity
  classification, and deterministic semantic validators. Schema validation and handwritten business validators are
  separate registry entries.
- vNext event and contract evolution uses explicit upcasters/migrations. A newer CLI either upgrades an older compatible
  project transactionally or refuses with a precise compatibility error; it never silently changes workflow semantics.

**Steps**

### Phase 0A: Establish the v1 behavioral baseline

1. Capture the failed baseline command output currently blocking the freeze. Classify each failure as product defect,
   environmental defect, or obsolete check; fix it or record a narrowly approved waiver. Archive the exact command, tool
   versions, commit, logs, and successful exit evidence before tagging.
2. Create a behavior-compatibility matrix for every user-facing and runtime v1 surface: setup/auth, project
   initialization, workflow transitions and returns, gates, reviews, artifacts, state/resume/search, pricing,
   governance, quotas, AVM resolution, Bicep, Terraform, azd, validation, deploy recovery, inventory, diagnosis,
   lessons, hooks, distribution, and documentation.
3. Mark each behavior `preserve`, `change`, or `retire`, with rationale, replacement owner, source commit/path, and
   either a characterization test or explicit acceptance. The selected preserved operational behaviors are mandatory
   first-release rows.
4. Capture deterministic golden inputs and normalized expected outputs from representative v1 scenarios, plus a
   known-defects ledger so the rewrite does not preserve bugs accidentally.
5. Define the v1 maintenance policy, critical-fix classification, cherry-pick direction, security response ownership,
   and 12-month support commitment.

Verification:

- The baseline tag is forbidden until the recorded suite succeeds or every remaining waiver is explicit and approved.
- Every current agent, CLI/setup command, validator family, schema, MCP server, workflow node, and public operational
  behavior maps to the matrix.
- Golden scenarios and known defects are reproducible at the frozen v1 commit.

### Phase 0B: Run feasibility and security spikes

1. Build a minimal npm CLI plus Copilot plugin and install it into a clean repository. Verify both VS Code and Copilot
   CLI discover the same agent/skill identifiers and can invoke the same APEX MCP task tools.
2. Prove that creative agents can complete a staged-output task without shell, direct filesystem write, Azure, or
   deployment tools. Attempt bypasses in both clients and document platform controls that are advisory versus
   enforceable.
3. Prototype the one-writer lease/CAS event journal, Git divergence detection, content-addressed promotion, stale task
   rejection, and recovery from a crash between external side effect and success-event append.
4. Prototype Terraform backend bootstrap, saved-plan protection, state lineage/serial binding, exact-plan apply, destroy
   plan, lock contention, and partial-apply reconciliation without committing state or plan data.
5. Verify Azure deployment stack create/update/delete and preview behavior at every supported target scope needed by the
   reference workload. Confirm how ignored/unevaluated what-if changes and unsupported resource types become blockers.
   Verify sandbox resource-group teardown separately.
6. Verify GitHub Environment required-reviewer flow and OIDC claims available to the kernel. Define the approval
   envelope and replay/expiry protections.
7. Verify actual telemetry exposed by each Copilot client. Classify each metric as kernel-measured, client-imported,
   estimated, or unavailable; no unavailable metric may become a release claim.
8. Reserve package/plugin names and verify npm, plugin marketplace/source installation, Python capability packaging,
   Deno locking, update, rollback, and provenance paths.
9. Resolve the initial newest mutually compatible toolchain from authoritative sources and record the observation
   cutoff.

Verification:

- Each spike produces a go/no-go result, threat/limitation statement, and executable proof test.
- A failed spike changes the affected locked decision before implementation; ADRs are not written around an unproven
  assumption.

### Phase 0C: Lock architecture and create the vNext branch

1. Write ADRs for distribution, trust/tool boundary, writer model, event integrity scope, artifact staging, runtime
   compatibility, one-environment runs, four gates, approval identity, contract split, Terraform state, Bicep ownership,
   native deployment, private-repository evidence and secret handling, version policy, no-import boundary, and
   deterministic evaluation.
2. Convert spike results and the behavior matrix into a dependency-based work breakdown and risk register. Estimate
   delivery only now, with ranges, confidence, staffing assumptions, and contingency; remove the unsupported calendar
   estimate from the old plan.
3. Create an immutable v1 baseline tag and the long-lived `vnext` branch from the validated baseline. Reserve the final
   v1 mainline release tag for Phase 12 cutover, and keep `main` on v1 until then.
4. Add vNext-targeted CI and branch protections. Site redesign checks may remain excluded, but shared/root changes that
   affect the current site must still preserve v1 documentation integrity.
5. Add a scheduled/main-change sync check for critical v1 fixes and test the cherry-pick procedure with a harmless
   change.

Verification:

- Every locked decision traces to a spike or explicit product choice.
- Branch CI can validate the vNext surface independently without weakening v1 maintenance checks.

### Phase 1: Scaffold the polyglot foundation, security primitives, and testkit

1. Create npm workspaces for TypeScript packages only. Keep Python and Deno as explicit external projects with
   independent exact lockfiles and frozen install commands.
2. Pin the newest Node.js LTS patch and newest stable/GA mutually compatible TypeScript/npm/tooling set. Use exact
   dev/CI pins, a compatible npm `engines` range for consumers, exact GitHub Action SHAs, immutable images/features, and
   generated SBOM inputs.
3. Add Python hash-locked dependency resolution and enforce `deno.lock --frozen`; record both in the runtime bundle.
   Direct Azure resource API versions used outside AVM must be current stable supported versions and exactly recorded.
4. Implement shared result/error types, stable JSON output, documented exit codes, injectable clock/ID/random sources,
   canonical path handling with symlink defense, size limits, redaction, and safe process execution without shell
   interpolation.
5. Scaffold `packages/testkit` now, including fake adapters, deterministic fixtures, temporary workspaces, process crash
   injection, malicious path/content fixtures, and client-contract fixtures.
6. Scaffold the CLI, MCP server, and plugin, including signed/provenance-capable packaging. `apex --version` reports
   CLI, plugin expectation, runtime bundle, and protocol compatibility.
7. Add one offline pin-consistency check and a separate networked freshness check. Freshness never makes ordinary
   deterministic tests depend on network state.

Verification:

- Clean checkout build, lint, unit tests, package-boundary checks, Python tests, Deno tests, and lock verification pass.
- Packed CLI and local plugin install into a clean repository and report compatible versions.
- Path traversal, symlink escape, shell injection, oversized output, and secret-redaction unit tests pass before
  capabilities exist.

### Phase 2: Define contracts, runtime locking, event state, and artifact acceptance

1. Design and review all canonical schemas, starting from valuable v1 concepts but not copying workflow-specific prose
   contracts.
2. Implement RFC-style canonical JSON encoding, event hashing, object hashing, atomic event-file creation, expected-head
   CAS, local writer leases, stale-lease recovery, and deterministic reduction. Hash chains are documented as corruption
   detection only.
3. Implement task staging and atomic artifact acceptance: snapshot once, scan/classify, redact or reject, validate
   schema and business rules, hash, promote to the content-addressed store, then append the acceptance event. Canonical
   paths are never direct model write targets.
4. Implement task IDs, leases, expiry, allowed inputs/outputs, runtime lock, capability grants, byte/time/retry budgets,
   duplicate-completion idempotency, stale-output rejection, and cancellation.
5. Implement provenance dependency edges and cascading invalidation. Any changed requirement, governance envelope,
   pricing basis, defaults, intent, binding, environment input, IaC tree, toolchain, or workflow hash invalidates
   precisely the downstream artifacts, reviews, gates, and previews that depend on it.
6. Implement external operation lifecycle events: requested, authorized, started, observed, succeeded, failed,
   indeterminate, reconciled, and compensated where possible. Recovery queries provider operation IDs/state rather than
   blindly repeating side effects.
7. Implement runtime-bundle compatibility checks and transactional vNext-to-vNext schema/event migrations with backup
   and rollback.
8. Implement evidence classification for the private repository. Acceptance rejects credentials and secret values,
   prevents Terraform state and saved plan files from entering Git, and otherwise preserves complete identifiers,
   configuration, logs, inventory, and consented telemetry without pseudonymization. Secret-bearing transient responses
   remain in secured backends or ignored local storage.

Verification:

- Property and fault tests prove deterministic replay, migration, CAS conflict handling, corruption detection, lease
  expiry, stale tasks, duplicate completion, artifact overwrite prevention, precise invalidation, and
  crash-after-side-effect reconciliation.
- A fresh clone reconstructs complete nonsecret state and evidence from the runtime lock, event files, and
  content-addressed objects.
- Rehashing a maliciously rewritten journal is explicitly outside the hash-chain guarantee; authenticated approval
  evidence remains independently verifiable.

### Phase 3: Implement workflow, tasks, gates, and the CLI control plane

1. Define the workflow manifest with deterministic condition operators, reachability/cycle validation, terminal/blocked
   states, retry/refinement routes, validator bindings, source dependencies, and per-environment run semantics. Do not
   use `eval` or arbitrary scripts for conditions.
2. Implement the four gates. Review and mandatory validation precede each gate. Accepted risk requires finding ID,
   rationale, owner, expiry, and scope and cannot bypass secrets, authorization, security baseline, active Deny policy,
   stale preview, or destructive-operation controls.
3. Implement next-task selection, bounded kernel projections, and role/capability enforcement. State only that the
   kernel does not add raw chat history; clients may retain their own context and that context is excluded from kernel
   byte measurements.
4. Implement the CLI groups: `init/update`, `setup/doctor`, `project list/use/show/search`, `status`,
   `task next/context/complete/cancel`, `review resolve`, `gate decide`, `validate`, `preview`, `deploy`, `reconcile`,
   `inventory`, `diagnose`, `render`, and `promote`.
5. Define `preview --operation apply|destroy`; `deploy` may execute only the exact approved operation. Promotion creates
   a new environment run referencing shared approved contracts and deliberately invalidates environment-specific
   planning, preview, approval, and inventory.
6. Ensure every command has stable human and JSON output, explicit project/run/environment selection, noninteractive
   behavior, and documented exit codes.

Verification:

- Table-driven tests cover every node/edge, refinement path, gate revision, promotion, cancellation, failure, recovery,
  and both IaC conditions.
- The normal delivery path contains four decisions per environment run, with production TTY or GitHub approval
  represented as Gate 4 itself.
- No workflow behavior or state mutation depends on agent prose or handoff buttons.

### Phase 4: Build authorized capabilities, setup, discovery, and validators

1. Define the capability protocol: identity, side-effect class, input/output/error schemas, required role, credential
   scope, availability, timeout, retry/backoff, idempotency key, redaction, output limits, and reconciliation method.
2. Implement `setup` and `doctor` for CLI/plugin compatibility, Azure CLI and GitHub authentication, target scope,
   OIDC/Managed Identity, RBAC, required providers, external runtime packages, registry reachability, Terraform backend
   readiness, and client customization discovery.
3. Adapt Azure Pricing and governance discovery as validated external processes. Governance output distinguishes
   complete, partial, and failed discovery; includes all pages/scopes/definitions/assignments/parameters/exemptions, API
   versions, TTL, and completeness signature. Partial/failed/stale discovery blocks Architecture approval.
4. Add region/service/SKU availability and quota capabilities before Architecture and repeat them before Preview. No
   automatic SKU substitution is allowed; changes return through Architecture/Plan and invalidate cost and approvals.
5. Add AVM Bicep and Terraform metadata resolvers, exact module/provider/API pinning, and a documented native-resource
   fallback when no suitable AVM exists.
6. Add Bicep, deployment-stack, Terraform/backend/plan, Azure CLI, policy, Resource Graph, ARM GET, Git, filesystem,
   hashing, pricing, and optional Draw.io adapters.
7. Build the validator registry as explicit composition of JSON Schema validators and handwritten TypeScript
   business/security validators. Port every preserved v1 rule through the behavior matrix; do not infer domain rules
   from schemas.
8. Define policy precheck honestly: static intent/property mapping plus current effective policy discovery and provider
   validation/what-if. It is a blocker when known constraints fail, but never claims to predict every runtime policy
   result. Deployment-time Azure enforcement remains authoritative.

Verification:

- Every adapter has malformed-output, timeout, retry, auth, permission, throttling, redaction, idempotency, and
  reconciliation tests.
- Capability denial tests prove creative roles cannot call state-changing, shell, raw filesystem, or credential-bearing
  operations.
- Validator coverage maps every accepted artifact type and preserved v1 rule to executable checks and mutation tests.

### Phase 5: Package portable Copilot customizations

1. Build the Copilot plugin with thin `apex-coordinator`, `apex-requirements`, `apex-architect`, `apex-planner`,
   `apex-codegen`, `apex-reviewer`, and `apex-operator` agents plus curated Azure skills.
2. Agents obtain task envelopes and context through APEX MCP, write only to task staging through APEX MCP, and submit
   outputs through APEX MCP. Capabilities run through the kernel; agents do not invoke pricing, Azure, Bicep, Terraform,
   Git, or shell directly.
3. Keep the frontmatter/tool profile to the tested VS Code/Copilot CLI intersection. Handoffs are optional VS Code UI
   only. Agent and skill names are portable, and client-specific fields are isolated and ignored safely.
4. Keep `.github/copilot-instructions.md` minimal in consumer repositories. Use path instructions only for authoring
   generated IaC and never for workflow routing or security authorization.
5. Treat model labels as client-specific recommendations. At release, test the newest generally available compatible
   client/model options, record the effective observed model, and provide fallbacks; model availability never changes
   kernel contracts or gate rules.
6. Implement plugin install, version check, update, rollback, trust notice, and marketplace/source verification.
   `apex doctor` detects missing, disabled, stale, or incompatible plugins.

Verification:

- Both clients load identical supported agent/skill IDs and complete the same fixture task with no terminal or direct
  file tool.
- Start in one client and resume in the other from repository state in the same checkout; a separate-device resume
  requires commit/pull and detects divergent heads.
- Plugin downgrade/upgrade respects `apex.lock.json` or fails with an actionable compatibility error.

### Phase 6: Deliver Requirements, pre-architecture discovery, Architecture, Cost, and review

1. Requirements uses bounded question batches and continues until mandatory fields have values, explicit unknowns, or
   approved deferrals; remove the arbitrary one-follow-up limit.
2. Emit and validate Requirements and initial user pins, run one comprehensive Requirements review, resolve mandatory
   findings, render the view, then open Gate 1.
3. After Gate 1, run setup readiness, complete governance discovery, pricing candidate lookup, quota/region/service
   availability, and current defaults before Architecture authors recommendations. Missing authentication or incomplete
   governance is a blocker, not an empty result.
4. Architecture emits traceable resources, dependencies, identity/networking/operations/recovery decisions, WAF
   trade-offs, SKU revisions, and unresolved decisions. Cost emits currency, units, quantities, price type, region,
   usage assumptions, discounts/exclusions, source timestamp, uncertainty, and arithmetic.
5. Run Architecture review and deterministic traceability/cost/governance checks, resolve mandatory findings, render the
   view, then open Gate 2.
6. Revisions produce new immutable object versions and automatically invalidate downstream work.

Verification:

- Every mandatory requirement has a disposition and every architecture resource traces to requirements and current
  governance.
- Cost totals reproduce from line items and no unavailable price is silently invented.
- Gate 1 and Gate 2 cannot open before their corresponding reviews and validators pass.

### Phase 7: Deliver track-neutral planning and stack bindings

1. Planner emits `implementation-intent-v1` containing only logical resources, controls, dependencies, identity,
   networking, diagnostics, outputs, environment obligations, and source hashes.
2. A binding resolver emits `iac-binding-v1` for the selected track: exact modules/providers/API versions,
   parameters/variables, naming, scopes, deployment phases, backend/stack ownership, outputs, and mappings from every
   logical resource/control to code-generation obligations.
3. Reference parity scenarios generate both Bicep and Terraform bindings from the same intent. Real project runs
   generate the selected binding only unless explicit parity output is requested.
4. Emit environment inputs as nonsecret values and typed secret references; values are resolved only by authorized
   preview/deploy capabilities.
5. Reconcile effective policy effects including Deny, Modify, Append, DeployIfNotExists, Audit and exemptions into the
   logical policy map and binding obligations.
6. Validate uniqueness, acyclic dependencies, complete resource/control coverage, naming, exact pins, policy mappings,
   environment inputs, state/stack ownership, and source hashes.
7. Run one comprehensive Plan review, resolve mandatory findings, render the plan, then open Gate 3. Plan-rooted defects
   return here; architecture-rooted defects return to Phase 6 and invalidate Gate 2 onward.

Verification:

- Mutation tests catch omitted/extra resources, duplicate names, cycles, stale pins, broken policy mappings, missing
  backend/ownership, secret literals, and unbound controls.
- The neutral intent contains no Bicep/Terraform syntax or module/provider identifiers.

### Phase 8: Prove the complete Bicep vertical slice

1. CodeGen receives only the approved intent, Bicep binding, policy map, typed environment references, runtime lock, and
   Bicep skill. It writes dependency-sized batches to staging through APEX MCP.
2. Validate each batch and the final tree with formatting, build/lint, security, policy, SKU, exact-version,
   source-coverage, and logical-resource-manifest checks. Emit a content-addressed handoff with tool evidence and tree
   hash.
3. Preview recomputes all hashes, resolves secrets only inside the capability, and runs scope-correct
   deployment-stack/ARM what-if and provider validation. Normalize creates/modifies/deletes/ignores/unevaluated items,
   coverage/confidence, policy findings, estimated cost delta, target, and expiry.
4. Material ignored, short-circuited, or unevaluated resources block approval unless a narrowly scoped human risk
   decision is permitted by policy. Hard security/policy uncertainty cannot be accepted.
5. Gate 4 is decided interactively in the kernel or by verified GitHub Environment/OIDC evidence. It binds the exact
   template, parameters, target, stack, environment, policy envelope, toolchain, and preview hashes.
6. Deploy rechecks freshness and hashes, writes operation-started evidence, executes the deployment stack, and
   reconciles indeterminate outcomes by operation ID. It does not claim transactional rollback.
7. Inventory combines deployment outputs, Resource Graph with eventual-consistency retries, and scoped ARM GETs. Commit
   the complete secret-free inventory, including resource IDs and configuration, to the private repository.
8. Teardown uses stack delete for owned resources. Dedicated sandbox runs may delete their owned resource group after a
   destroy preview and Gate 4 approval.
9. Render concise as-built evidence and run post-deploy health checks.

Verification:

- The reference Bicep scenario completes codegen, validation, preview, Gate 4, apply, inventory, drift comparison,
  destroy preview, approval, and teardown.
- Crash-before/after request, partial deployment, stale preview, policy drift, tree/input change, target change, and ARG
  lag are exercised.

### Phase 9: Add the complete Terraform slice and parity

1. Resolve or bootstrap the contracted Azure Storage backend through an explicit authorized setup operation. Record the
   complete nonsecret backend identity; verify OIDC/MI access, lock behavior, retention/versioning, and governance
   before init.
2. CodeGen emits exact provider/module pins, `.terraform.lock.hcl`, backend configuration without credentials,
   variables/outputs, and logical mappings from the approved Terraform binding.
3. Validate formatting, init, validate, security, policy, SKU, exact pins, source coverage, backend configuration, and
   logical-resource manifest.
4. Preview acquires the state lock and creates a non-speculative saved apply or destroy plan. Store it with restrictive
   permissions under `.apex/local`, bind state lineage/serial, lockfile, configuration, variables, environment, target,
   intent/binding/IaC hashes, tool version, expiry, and plan hash, then commit a complete secret-free JSON summary to
   the private repository.
5. Gate 4 approves that exact saved plan through TTY or GitHub Environment/OIDC. Deploy applies the saved plan file,
   never a regenerated implicit plan, while holding the state lock. Delete the local plan after terminal success or
   expiry; preserve only its attestation/hash.
6. Reconcile interrupted or partial applies from Terraform state and Azure, without force-unlock or state surgery unless
   separately authorized and audited.
7. Run apply/inventory/drift and destroy-plan/apply lifecycle in the sandbox.
8. Compare Bicep and Terraform logical manifests against the same neutral intent. Parity means equivalent declared
   resources, dependencies, controls, outputs, and accepted explicit differences, not provider implementation identity.
9. Emit optional `azure.yaml` compatibility output and validate it, but exclude azd execution from audited release
   qualification.

Verification:

- No Terraform state, saved plan file, credentials, or secret variable value enters Git, contracts, telemetry, or
  prompts. Complete secret-free command output and evidence may be committed.
- Backend contention, stale state serial, changed variable, changed lockfile, expired plan, partial apply, force-unlock
  request, and destroy are covered.
- Required reference scenarios pass logical parity with every exception explicit and reviewed.

### Phase 10: Complete operations and deterministic qualification

1. Implement project list/use/show/search/history over contracts, events, findings, approvals, and complete
   private-repository evidence, replacing the preserved apex-recall query behavior.
2. Implement read-only-by-default diagnosis using inventory, Azure health, Activity Logs, and configured Log Analytics.
   Complete secret-free queries and results may be committed as evidence in the private repository. Any remediation
   becomes a new authorized preview/approval operation with risk and rollback notes.
3. Generate deterministic run lessons and quality reports from actual events: retries, blockers, failures, recoveries,
   validation results, static context bytes, output bytes, capability calls, and elapsed time. Subjective quality is
   never presented as deterministic fact.
4. Define `scenario-v1` fixtures for secure storage, private web/API, governance conflict, destructive change,
   crash/cold resume, promotion, policy drift, and both lifecycle tracks.
5. Run unit, schema, contract, integration, mutation, property, fault, renderer-idempotence, supply-chain, and offline
   pin tests without Azure credentials or model calls. Registry access is allowed for credential-free compile/validate
   qualification; describe it as credential-free, not fully offline.
6. Run manual release qualification using real Copilot: at least one full workflow in each client, a cross-client
   resume, and both IaC tracks across the matrix. Store complete outcomes and user-consented client telemetry in the
   private repository; conversation transcripts are included only when explicitly selected as evidence.
7. Confirm optional outputs cannot affect canonical machine inputs or gate quality.

Verification:

- Every preserved behavior-matrix row has a passing test or manual release check.
- Every deliberate security/contract/state mutation is caught, and all unavailable telemetry remains labeled
  `unmeasured`.

### Phase 11: Harden security, telemetry, supply chain, packaging, and documentation

1. Re-run the Phase 0 threat model against implemented trust boundaries: malicious repository content, prompt injection,
   plugin/MCP supply chain, symlink/TOCTOU, process output, credentials, approvals, event rewriting, state/plan
   exposure, and deployment side effects.
2. Verify role/capability authorization and client sandbox/permission behavior. No prompt instruction is credited as an
   enforcement control.
3. Record kernel-measured metrics directly. Import client token/model telemetry only with user consent, reject any
   detected credentials or secret values, record source/method/confidence, and commit the complete accepted telemetry to
   the private repository.
4. Generate SBOMs and provenance for npm CLI, plugin, Python capability, Deno capability, containers, actions, and
   release artifacts. Sign or attest releases using registry-supported provenance and verify them during install/update.
5. Run license, dependency, secret, malware/package-integrity, and vulnerability checks. Approved exceptions are
   time-bounded and included in release evidence.
6. At the release cutoff, refresh every versioned component from authoritative sources, resolve the newest
   production-supported mutually compatible set, update exact locks/digests, and rerun all qualification. A release
   published after the cutoff does not race the candidate but is mandatory for the next candidate.
7. Publish versioned CLI/plugin installation, workflow/gates, security/trust, private-repository evidence and secret
   handling, Bicep stacks, Terraform state, approval, diagnosis, troubleshooting, update/rollback, v1 support, and
   release-operation documentation.
8. Update the public site minimally before cutover with vNext guidance and a clear versioned v1 maintenance banner.
   Defer visual redesign and broad content gardening.

Verification:

- Independent security review has no unresolved release-blocking findings.
- Clean installs verify artifact provenance, exact compatible versions, plugin discovery, MCP startup, and rollback.
- Documentation is discoverable without reading agent prompts.

### Phase 12: Release and cut over

1. Run a clean-clone installation and upgrade/downgrade rehearsal, both client smoke tests, cross-client resume, event
   migration/replay, crash recovery, complete deterministic suite, and both real Azure sandbox lifecycles including
   teardown.
2. Freeze the release runtime bundle and publish CLI, plugin, external capability packages/artifacts, checksums,
   provenance, SBOM, compatibility table, known limitations, and support policy.
3. Immediately before cutover, create `v1-maintenance` from the actual v1 `main` head, tag its final mainline release,
   publish the support end date 12 months later, and validate its critical-fix pipeline.
4. Merge `vnext` to `main` only after every release criterion passes. Tag the first vNext major release and publish
   migration guidance stating that v1 projects are not resumable in vNext.
5. Rollback product distribution by restoring the prior compatible CLI/plugin/runtime bundle and, if necessary,
   restoring `main` to the v1-maintenance or prior vNext release. Never rewrite project event/object history during
   product rollback.
6. Keep old implementation code accessible through Git history and release tags rather than dormant active-tree copies.

Verification:

- A new repository can install the CLI and plugin, initialize a run, and discover all supported customizations in both
  clients.
- Both tracks complete requirements through approved teardown with complete nonsecret evidence committed to the private
  repository and Terraform state, saved plans, credentials, and secret values kept out of Git.
- v1 maintenance remains independently installable and testable after cutover.

**Relevant files**

- `/workspaces/apex/.github/prompts/plan-buildApexVnext.prompt.md` — replace with this revised plan after approval.
- `/workspaces/apex/package.json` — current validation/build/setup behavior inventory and future TypeScript workspace
  root.
- `/workspaces/apex/.github/skills/workflow-engine/templates/workflow-graph.json` — v1 behavior and return-path
  inventory only; do not port directly.
- `/workspaces/apex/tools/apex-recall/` — state, atomic-write, recovery, search, and compatibility lessons; reimplement
  behind the new event/object model.
- `/workspaces/apex/tools/schemas/` — v1 contract concepts and characterization inputs.
- `/workspaces/apex/tools/scripts/` — validator/setup/quality behavior inventory; classify every relevant rule before
  porting.
- `/workspaces/apex/.github/agents/` — role, workflow, diagnostics, and operational behavior inventory; rewrite as
  plugin agents.
- `/workspaces/apex/.github/skills/` — curate domain knowledge only; remove state mutation and workflow routing.
- `/workspaces/apex/tools/mcp-servers/azure-pricing/` — retain as a locked external capability behind the kernel.
- `/workspaces/apex/tools/mcp-servers/drawio/` — retain as an optional locked external capability.
- `/workspaces/apex/.devcontainer/` and `/workspaces/apex/.github/workflows/` — toolchain, CI, provenance, and
  branch-maintenance inventory.
- `/workspaces/apex/tests/` and `/workspaces/apex/tools/tests/` — characterization failures, scenarios, and fixtures to
  preserve or replace deliberately.
- `/workspaces/apex/site/` — keep v1 accurate during development and add minimum versioned vNext content before cutover.

**Global verification**

1. Every v1 behavior has an approved preserve/change/retire disposition and matching evidence.
2. The kernel is the only supported state transition and external-operation path; client instructions are never counted
   as authorization.
3. Runtime bundle, schema, event, contract, plugin, and CLI upgrades are versioned, transactional where applicable, and
   reject incompatibility safely.
4. Four gates apply per environment run. Gate 4 is hash-bound to the exact deployment inputs; CI approval is
   additionally authenticated to the GitHub Environment/OIDC identity, while local TTY approval records the verified
   local execution context without claiming cryptographic user authentication.
5. Terraform applies the exact protected plan; Bicep operates only within explicit deployment-stack or sandbox
   resource-group ownership.
6. Both IaC tracks satisfy the same neutral intent and expose explicit, reviewed parity exceptions.
7. Credentials, secret values, Terraform state, and saved plan files remain outside Git, prompts, and telemetry;
   complete nonsecret live identifiers, logs, inventories, configuration, and consented telemetry may be committed to
   the private repository.
8. Deterministic CI requires neither Azure credentials nor model calls; credential-free registry access is allowed and
   declared.
9. Both Copilot clients can install, discover, execute, and cross-resume compatible APEX tasks without handoff buttons
   or chat-history state.
10. The release uses the newest production-supported mutually compatible versions observed at the recorded cutoff, with
    exact pins, provenance, SBOM, and no unapproved exceptions.
11. v1 remains supported for 12 months after cutover and the public documentation clearly separates v1 maintenance from
    vNext.

**Scope boundaries**

- Included: CLI/kernel, plugin, both IaC tracks, one-environment runs and linked promotion, setup/doctor,
  governance/pricing/quota, four gates, native preview/deploy/destroy, inventory, diagnosis, lessons/quality, runtime
  upgrades, security/supply chain, and minimum public docs.
- Deferred: distributed concurrent writers, hosted/multi-tenant coordination, non-GitHub CI approval providers, direct
  model APIs, autonomous headless model orchestration, custom VS Code extension, v1 state/artifact import, recurring
  model evaluation, multi-pass reviews, mandatory diagrams, full site redesign, and rewriting retained Python/Deno
  capabilities without measured need.
- `azd` remains optional compatibility output only and is not part of the audited deployment path.

**Decisions from alignment**

- Hybrid npm CLI plus Copilot plugin.
- Single active writer per project run.
- One environment per run; linked runs model promotion.
- Newest production-supported release channels, including latest Node.js LTS patch.
- Azure deployment stacks plus dedicated sandbox resource-group teardown for Bicep.
- Native audited deployment; azd compatibility output only.
- GitHub Environment required reviewers plus OIDC for CI production approval.
- Preserve setup/doctor, quotas/availability, diagnosis, lessons/quality, and project search/history.
- Use the private repository as the approved store for complete nonsecret evidence; do not sanitize identifiers, logs,
  inventories, configuration, or consented telemetry.
- “Offline” qualification means credential-free and model-free; locked registries may be accessed.
- v1 receives security and critical fixes for 12 months after cutover.
