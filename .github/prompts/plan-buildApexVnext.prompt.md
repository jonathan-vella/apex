## Plan: Build the APEX vNext Rewrite

Rebuild APEX with a greenfield implementation while treating the existing APEX product as a brownfield replacement. The
revised approach first characterizes v1, proves the risky platform and deployment assumptions, and only then locks the
architecture. A deterministic TypeScript kernel and npm `apex` CLI own workflow, state, validation, evidence, and
authorized capabilities. Managed workspace-native VS Code customizations supply thin agents and skills. The release
establishes a durable fake-provider walking skeleton, proves one thin dual-track contract, and then completes Bicep and
Terraform breadth while preserving selected v1 operational behavior.

**Locked decisions**

- Distribution is hybrid: an npm package provides the `apex` CLI/kernel and `apex init/update` materializes a versioned
  workspace customization bundle under supported VS Code discovery paths. A managed-file manifest enables three-way
  updates and refuses to overwrite user changes silently. Agent plugin packaging is an optional convenience only after
  the supported VS Code release makes it production-ready and enterprise policy permits it; Preview plugin behavior is
  not a first-release dependency.
- Workspace customizations expose narrow APEX MCP tools. Creative agents do not receive general shell, Azure,
  deployment, or unrestricted filesystem tools. The kernel controls only its own context projection and capabilities;
  VS Code conversation history and system context are explicitly outside its enforcement boundary.
- APEX is the preferred entry agent. Interactive specialists that use `askQuestions` or a higher-cost model run as
  direct handoff targets, not subagents. Hidden autonomous workers never ask users, return a typed `needs_input` result
  when blocked, and use a model at or below the parent cost tier. A build validator enforces this invocation graph.
- One active writer is allowed per project run. Local leases plus compare-and-swap protect the journal. Transfer to CI
  uses an ownership epoch bound to project, run, repository, branch, commit, and recipient workflow; the transfer event,
  GitHub concurrency key, fresh-head check, lease release/expiry, and stale-epoch rejection are enforced. Distributed
  collaborative writers are deferred.
- Each workflow run targets one environment and Azure scope. Promotion to another environment creates a linked run that
  reuses approved shared contracts. Gates 1-3 are inherited as immutable attestations only when their complete dependency
  hashes and accepted-risk scopes are unchanged; the first invalidated gate reopens. Every environment receives a new
  preview, Gate 4 decision, deployment, inventory, and evidence.
- The normal delivery path has four logical gates: Requirements, Architecture and Cost, Implementation Plan, and
  Deployment Preview. Gate views show concise semantic changes and reasons for invalidation. The Deployment Preview
  decision is the production approval ceremony, not a separate pre-approval followed by another confirmation.
- GitHub Environments with required reviewers plus GitHub OIDC are the first noninteractive production approval
  mechanism. The approval evidence binds the actor/run identity, environment, target, commit,
  intent/binding/IaC/input/preview hashes, and expiry. Other CI providers are deferred behind a future provider
  interface.
- Bicep deployments use Azure deployment stacks where the Phase 0 spike verifies required scope and delete behavior.
  Isolated sandbox runs may own and delete a dedicated resource group. There is no unscoped generic Bicep destroy.
- Terraform uses a secured Azure Storage backend by default, with OIDC/Managed Identity rather than shared keys, state
  locking, versioning/retention, scoped access, and governance-compliant networking. Preview creates a protected saved
  plan and deploy applies that exact plan. Phase 0B must prove a short-lived encrypted plan handoff whose digest,
  lineage/serial, inputs, expiry, commit, and recipient job identity are bound to approval evidence; production CI apply
  remains blocked if that protocol cannot be proven, and no post-approval plan regeneration is permitted.
- Native Azure CLI/Bicep or Terraform commands are the audited deployment path. `azure.yaml` may be emitted as optional
  compatibility output, but `azd provision` is not allowed to bypass the approved native preview.
- Both Bicep and Terraform ship end to end in the first complete release. A track-neutral implementation-intent contract
  is bound separately to Bicep and Terraform realization contracts.
- No v1 session or artifact importer is built. Existing projects remain on a v1 maintenance branch for 12 months after
  cutover, receiving security and critical fixes. The exact support end date is published at cutover.
- Preserve v1 setup/doctor, quota and regional availability checks, post-deploy diagnosis, run lessons/quality
  reporting, and project list/search/history behavior. Their internals are rewritten behind kernel contracts.
- Deterministic CI uses no Azure credentials or model calls. Manual release qualification covers the supported VS Code
  release and Azure sandboxes; no recurring paid model canary or LLM-as-judge is introduced.
- Contracts are introduced in feature-owned waves. Only persisted or published boundaries receive compatibility
  guarantees; internal TypeScript types remain inexpensive to change. Deterministic validation uses one in-process
  registry and content-addressed caches keyed by every relevant input, configuration, and toolchain hash.
- Python and Deno integrations are optional, exact-locked capability packs installed only when a workflow requires
  them. The TypeScript core, project status, and nondependent workflows remain usable when a pack is absent. Retained
  implementations are rewritten only when measured reliability, security, or maintenance evidence justifies it.
- Use the newest production-supported release channel: the newest supported Node.js LTS patch, and the newest stable/GA
  release for ecosystems without LTS channels. Resolve the newest mutually compatible set at adoption and at a recorded
  release cutoff, then pin exact versions/digests and lock transitive dependencies. New releases after the cutoff enter
  the next candidate. Exceptions require an owner, evidence, expiry, and upgrade target.
- The repository is private and is the approved evidence boundary. Required approval and deployment attestations remain
  immutable. Other evidence uses per-type allowlists, byte and retention budgets, content deduplication, and structural
  redaction before generic secret scanning; uncertain output remains ignored local data. Optional telemetry is disabled
  by default, separable from authorization evidence, and supports consent withdrawal, export, and deletion. Credentials,
  secret values, Terraform state, and saved Terraform plan files remain prohibited from Git.
- Site redesign remains deferred, but minimum accurate vNext installation, workflow, security, operations, support, and
  v1-versioning content is required on the public site before cutover.

**Target architecture**

- `packages/contracts/` owns wave-delivered JSON Schemas for persisted and published boundaries plus generated TypeScript
  types. Internal package interfaces do not become compatibility contracts by default.
- `packages/kernel/` owns runtime-bundle compatibility, workflow reduction, tasks, leases, gates, provenance,
  invalidation, operation reconciliation, authorization, and telemetry.
- `packages/cli/` owns the `apex` executable, stable JSON/error/exit-code contracts, and the APEX MCP server used by
  VS Code Copilot.
- `packages/capabilities/` owns typed in-process, process, MCP, Azure CLI, Bicep, and Terraform adapters plus optional
  capability-pack loading. It is the only path to state-changing external operations.
- `packages/renderers/` produces deterministic human views from canonical contracts.
- `packages/testkit/` provides fake capabilities, scenario builders, clock/ID injection, mutation helpers, crash/fault
  injection, and contract assertions from Phase 1 onward.
- `customizations/` contains the source bundle for managed workspace agents, curated skills, minimal instructions, and
  `.vscode/mcp.json` configuration that launches `apex mcp serve`. An optional `plugin/` adapter packages the same source
  only when its supported VS Code contract passes qualification.
- `config/runtime-bundle.v1.json` binds workflow, defaults, schemas, validators, customization manifest, CLI, capability
  protocol, required capability packs, and toolchain versions/hashes into one compatible release unit.
- `config/workflow.v1.json` contains only deterministic nodes, edges, conditions, validators, invalidation rules, role
  ownership, and four gates. It never executes arbitrary expressions.
- `config/defaults.v1.json` contains nonsecret product defaults and security invariants; live governance remains
  authoritative for the target scope.
- `config/toolchain.v1.json` records authoritative source, release channel, newest observed stable version, observation
  cutoff, selected exact pin/digest, compatibility set, installed version, and approved exceptions.

**Consumer state layout**

- `.apex/apex.lock.json` pins the compatible `apex` CLI, customization bundle, optional plugin adapter, runtime bundle,
  workflow, defaults, schemas, validators, capability protocol, required capability packs, and toolchain hashes.
- `.apex/customizations.lock.json` records the source bundle version and per-file base/current hashes so updates can
  three-way merge or stop with an actionable conflict instead of overwriting user edits.
- `.apex/config.json` stores repository-level nonsecret configuration and the selected project.
- `.apex/objects/sha256/{prefix}/{hash}` stores immutable, content-addressed accepted artifacts, including complete
  nonsecret live evidence.
- `.apex/projects/{project}/project.json` stores project identity and references to shared approved contracts.
- `.apex/projects/{project}/runs/{run-id}/run.json` stores one environment/scope, parent promotion run, selected IaC
  track, and runtime-lock reference.
- `.apex/projects/{project}/runs/{run-id}/journal/` stores immutable hash-linked events using the representation selected
  by Phase 0B scale benchmarks. Verified snapshots or immutable event segments may accelerate replay while preserving
  the prior head, reproducibility, CAS, and approval lineage. The chain provides corruption evidence, not authentication
  against a malicious repository writer.
- `.apex/projects/{project}/runs/{run-id}/refs/` stores typed references to accepted objects, findings, approvals,
  previews, inventories, and views.
- `.apex/projects/{project}/runs/{run-id}/views/` stores deterministic Markdown renderings.
- `.apex/work/{run-id}/{task-id}/` is an ignored staging area. Agents can write only here through APEX MCP tools.
- `.apex/local/{run-id}/` is ignored and stores leases, derived snapshots, Terraform saved plans, secret-bearing
  transient responses, uncertain command output, and recovery metadata. `.apex/cache/` is ignored and stores validated
  content-addressed results that are safe to recompute. Secrets are resolved only at operation time and never copied
  into task context.

**Target contract families**

- Runtime and execution: `runtime-bundle-lock-v1`, `project-config-v1`, `run-config-v1`, `task-envelope-v1`,
  `task-result-v1`, `event-v1`, `operation-record-v1`, `approval-evidence-v1`, and `evidence-manifest-v1`.
- Creative intent: `requirements-v1`, `sku-manifest-v1`, `architecture-v1`, `cost-estimate-v1`, and
  `review-findings-v1`.
- Governance and planning: `governance-constraints-v1`, `policy-property-map-v1`, `implementation-intent-v1`,
  `iac-binding-v1`, and `environment-inputs-v1`.
- IaC and deployment: `logical-resource-manifest-v1`, `iac-handoff-v1`, `execution-plan-attestation-v1`,
  `deployment-preview-v1`, and `resource-inventory-v1`.
- Qualification: `scenario-v1`, `quality-report-v1`, and `telemetry-v1`.
- Wave 1 contains only the runtime lock, project/run/task/event, requirements, minimal intent/binding, approval,
  deployment-preview, operation, and evidence boundaries needed by the durable walking skeleton. Later contracts are
  added immediately before their owning feature rather than designed speculatively.
- Every persisted or published schema has a stable `$id`, declared JSON Schema dialect, compatibility policy, maximum
  size, sensitivity classification, and deterministic semantic validators. Schema validation and handwritten business
  validators are separate registry entries in one process.
- vNext event and contract evolution uses explicit upcasters/migrations. A newer `apex` CLI either upgrades an older
  compatible project transactionally or refuses with a precise compatibility error; it never silently changes workflow
  semantics.

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

1. Build a minimal npm `apex` CLI and workspace customization bundle in a clean repository. Score workspace-native
   agents, skills, instructions, and `.vscode/mcp.json` against the Preview agent-plugin path for discovery, trust,
   enterprise policy, pinning, update, rollback, provenance, and uninstall. Workspace-native delivery remains the
   baseline unless a production-supported plugin path is strictly better on the recorded evidence.
2. Prove the interaction topology in a fresh supported VS Code host: `APEX` is the preferred entry point; Requirements,
   Architect, Planner, and approval-bearing operators run as direct handoff targets with working `askQuestions` and
   their configured models; autonomous workers run as hidden subagents. Test hidden handoff targets explicitly and keep
   interactive specialists picker-visible if that behavior is not reliable.
3. Prove that creative agents can complete a staged-output task without shell, direct filesystem write, Azure, or
   deployment tools. Attempt bypasses in VS Code and document platform controls that are advisory versus enforceable.
   Verify that subagents cannot ask users, return typed `needs_input`, and never request a model above the parent cost
   tier; higher-tier transitions must use direct handoffs.
4. Prototype the event-store interface, one-writer lease/CAS, Git divergence detection, content-addressed promotion,
   stale task rejection, and crash reconciliation. Benchmark representative append, replay, status, search, clone, Git,
   and VS Code file-watcher loads with explicit p95 budgets; compare atomic files, immutable segments, and verified
   snapshots without weakening the hash chain.
5. Prove local-to-CI ownership transfer with a bound writer epoch, atomic transfer event, GitHub concurrency key,
   fetch/head validation, local lease release or expiry, stale-epoch rejection, retry handling, and crash recovery.
6. Prototype Terraform backend bootstrap, exact saved-plan protection, state lineage/serial binding, destroy plans, lock
   contention, and partial-apply reconciliation. Prove an encrypted, access-scoped, short-lived plan handoff to the exact
   Environment-approved recipient job; reject substitution, expiry, stale heads, unauthorized download, and plan
   regeneration. If this fails, production Terraform CI apply is out of scope until a safe protocol exists.
7. Verify Azure deployment stack create/update/delete and preview behavior at every supported target scope needed by the
   reference workload. Confirm how ignored/unevaluated what-if changes and unsupported resource types become blockers.
   Verify sandbox resource-group teardown separately.
8. Verify GitHub Environment required-reviewer flow and OIDC claims available to the kernel. Define the approval
   envelope, writer epoch, recipient identity, and replay/expiry protections.
9. Define a small release scorecard and benchmark baseline for setup completion, first-task success, p95 elapsed time,
   restart/resume, deterministic validation escapes, gate revision loops, capability failures, context bytes, and cache
   reuse. Store machine-readable rules for each metric: pass/fail target, comparison direction, allowed tolerance,
   representative scenario, minimum sample size or confidence rule, measurement source, owner, and unavailable-data
   disposition. Freeze the rules before evaluating a release candidate; no unavailable metric may become a release
   claim.
10. Reserve package and optional capability-pack names. Verify npm provenance, lazy Python/Deno pack installation,
    absent-pack behavior, update/rollback, and a measured replacement criterion for retained implementations.
11. Resolve the initial newest mutually compatible toolchain from authoritative sources and record the observation
    cutoff, VS Code policy requirements, model availability, and observed model cost tiers.

Verification:

- Each spike produces a go/no-go result, threat/limitation statement, and executable proof test.
- A failed spike changes the affected locked decision before implementation; ADRs are not written around an unproven
  assumption.
- No first-release path depends solely on a Preview VS Code surface. Direct handoff, `askQuestions`, MCP startup,
  workspace update, and model-tier behavior pass in the supported release channel.
- Journal, evidence, and cache designs meet the recorded scale budgets before their storage representations are frozen.

### Phase 0C: Lock architecture and create the vNext branch

1. Write ADRs for distribution and fallback, interactive-agent versus subagent topology, model-tier routing,
   trust/tool boundary, writer transfer, event representation and scale budgets, artifact staging, runtime
   compatibility, one-environment runs, gate inheritance, approval identity, Terraform plan transport, contract waves,
   Bicep ownership, native deployment, evidence lifecycle, version policy, no-import boundary, and deterministic
   evaluation.
2. Convert spike results and the behavior matrix into a dependency-based work breakdown and risk register. Estimate
   delivery only now, with ranges, confidence, staffing assumptions, and contingency; remove the unsupported calendar
   estimate from the old plan.
3. Create an immutable v1 baseline tag and the long-lived `vnext` branch from the validated baseline. Reserve the final
   v1 mainline release tag for Phase 12 cutover, and keep `main` on v1 until then.
4. Add vNext-targeted CI and branch protections. Site redesign checks may remain excluded, but shared/root changes that
   affect the current site must still preserve v1 documentation integrity.
5. Add a scheduled/main-change sync check for critical v1 fixes and test the cherry-pick procedure with a harmless
   change.
6. Add recurring cutover rehearsals from Phase 1 onward: shared-file conflict reports, side-by-side v1/vNext toolchain
   installation, lock compatibility, documentation routing, and dry-run release/rollback in a disposable repository.
   Set maximum sync age and unresolved-conflict thresholds.

Verification:

- Every locked decision traces to a spike or explicit product choice.
- Branch CI can validate the vNext surface independently without weakening v1 maintenance checks.

### Phase 1: Deliver the TypeScript foundation and durable VS Code walking skeleton

1. Create npm workspaces for the TypeScript core. Define a capability-pack protocol so retained Python and Deno projects
   are independently locked, lazy-installed integrations rather than prerequisites for core installation or status.
2. Pin the newest Node.js LTS patch and newest stable/GA mutually compatible TypeScript/npm/tooling set. Use exact
   dev/CI pins, a compatible npm `engines` range for consumers, exact GitHub Action SHAs, immutable images/features, and
   generated SBOM inputs.
3. Add hash-locked resolution and frozen commands only for capability packs required by the current reference journey;
   record them in the runtime bundle. Direct Azure resource API versions used outside AVM must be current stable
   supported versions and exactly recorded.
4. Implement shared result/error types, stable JSON output, documented exit codes, injectable clock/ID/random sources,
   canonical path handling with symlink defense, size limits, redaction, and safe process execution without shell
   interpolation.
5. Scaffold `packages/testkit`, including fake adapters, deterministic fixtures, temporary workspaces, process crash
   injection, malicious path/content fixtures, and real VS Code contract fixtures.
6. Scaffold the CLI, MCP server, managed workspace customization bundle, and optional plugin adapter with
   signed/provenance-capable packaging. `apex --version` reports CLI, customization bundle, optional adapter, runtime
   bundle, and protocol compatibility.
7. Implement Wave 1 contracts and a durable production-code walking skeleton: `apex init`, preferred APEX entry agent,
   direct Requirements handoff with `askQuestions`, staged requirements acceptance, minimal intent, fake hash-bound
   preview, approval, operation event, deterministic rendering, and restart/resume from repository state.
8. Add one offline pin-consistency check and a separate networked freshness check. Freshness never makes ordinary
   deterministic tests depend on network state.

Verification:

- Clean checkout build, lint, unit tests, package-boundary checks, required-pack tests, and lock verification pass.
- The packed `apex` CLI and managed workspace customizations install into a clean repository, preserve user edits on
  update, and report compatible versions. The core journey works without unrelated Python or Deno packs.
- A fresh supported VS Code host completes the walking skeleton, shows the question panel, resumes after restart, and
  emits byte-identical state and views on replay.
- Path traversal, symlink escape, shell injection, oversized output, and secret-redaction unit tests pass before
  capabilities exist.

### Phase 2: Define contracts, runtime locking, event state, and artifact acceptance

1. Deliver contracts in feature-owned waves. Extend Wave 1 only when the next owning feature requires a persisted or
   published boundary; internal TypeScript types remain unversioned until they cross that boundary.
2. Implement RFC-style canonical JSON encoding, event and object hashing, the benchmark-selected journal representation,
   expected-head CAS, ownership epochs, local writer leases, stale-lease recovery, local-to-CI transfer, verified
   snapshots where justified, and deterministic reduction. Hash chains are documented as corruption detection only.
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
7. Implement runtime-bundle compatibility checks and transactional vNext-to-vNext migrations with backup and rollback
   only for published or persisted contracts.
8. Implement the evidence lifecycle: per-type allowlists and budgets, structural redaction, uncertain-output quarantine,
   secret scanning, content deduplication, retention and archival, repository growth SLOs, and separable telemetry
   consent/export/delete. Approval and deployment attestations remain immutable; state and saved plans never enter Git.

Verification:

- Property and fault tests prove deterministic replay, migration, CAS conflict handling, corruption detection, lease
  expiry, writer transfer, stale-epoch rejection, stale tasks, duplicate completion, artifact overwrite prevention,
  precise invalidation, and crash-after-side-effect reconciliation.
- A fresh clone reconstructs complete nonsecret state and evidence from the runtime lock, journal, and
  content-addressed objects.
- Append, replay, status, search, clone, Git, and file-watcher benchmarks remain within the Phase 0B budgets at the
  representative scale; snapshots and segments reproduce the same journal head and reduced state.
- Rehashing a maliciously rewritten journal is explicitly outside the hash-chain guarantee; authenticated approval
  evidence remains independently verifiable.

### Phase 3: Implement workflow, tasks, gates, and the `apex` CLI control plane

1. Define the workflow manifest with deterministic condition operators, reachability/cycle validation, terminal/blocked
   states, retry/refinement routes, validator bindings, source dependencies, and per-environment run semantics. Do not
   use `eval` or arbitrary scripts for conditions.
2. Implement the four gates. Review and mandatory validation precede each gate. Accepted risk requires finding ID,
   rationale, owner, expiry, and scope and cannot bypass secrets, authorization, security baseline, active Deny policy,
   stale preview, or destructive-operation controls. Render a concise semantic diff, changed dependency hashes,
   invalidation reason, and recommended action instead of requiring users to reread full artifacts.
3. Implement next-task selection, bounded delta projections with content references, typed `needs_input` results, and
   role/capability enforcement. State only that the kernel does not add raw chat history; VS Code may retain its own
   context and that context is excluded from kernel byte measurements.
4. Implement the CLI groups: `init/update`, `setup/doctor`, `project list/use/show/search`, `status`,
   `task next/context/complete/cancel`, `review resolve`, `gate decide`, `validate`, `preview`, `deploy`, `reconcile`,
   `inventory`, `diagnose`, `render`, and `promote`.
5. Define `preview --operation apply|destroy`; `deploy` may execute only the exact approved operation. Promotion creates
   a new environment run referencing shared approved contracts. It inherits Gates 1-3 only when complete dependency
   hashes and accepted-risk scope match, records that inheritance immutably, reopens the first invalidated gate, and
   always invalidates environment-specific preview, Gate 4, deployment, and inventory.
6. Ensure every command has stable human and JSON output, explicit project/run/environment selection, noninteractive
   behavior, and documented exit codes.

Verification:

- Table-driven tests cover every node/edge, refinement path, gate revision, promotion, cancellation, failure, recovery,
  and both IaC conditions.
- The initial run contains four human decisions. A promoted run may inherit unchanged Gates 1-3 but always receives a
  fresh production TTY or GitHub Gate 4 decision.
- No workflow behavior or state mutation depends on agent prose or handoff buttons.

### Phase 4: Build authorized capabilities, setup, discovery, and validators

1. Define the capability protocol: identity, side-effect class, input/output/error schemas, required role, credential
   scope, availability, timeout, retry/backoff, idempotency key, redaction, output limits, and reconciliation method.
2. Implement `setup` and `doctor` for CLI/customization compatibility, managed-file drift, optional plugin policy,
   Azure CLI and GitHub authentication, target scope, OIDC/Managed Identity, RBAC, required providers, capability packs,
   registry reachability, Terraform backend readiness, and VS Code discovery. `doctor --fix` previews idempotent safe
   remediations, requires confirmation for changes, and always returns one actionable next step.
3. Adapt Azure Pricing and governance discovery as validated, lazy capability packs. Governance output distinguishes
   complete, partial, and failed discovery; includes all pages/scopes/definitions/assignments/parameters/exemptions, API
   versions, TTL, and completeness signature. Partial/failed/stale discovery blocks Architecture approval.
4. Add region/service/SKU availability and quota capabilities before Architecture and repeat them before Preview. No
   automatic SKU substitution is allowed; changes return through Architecture/Plan and invalidate cost and approvals.
5. Add AVM Bicep and Terraform metadata resolvers, exact module/provider/API pinning, and a documented native-resource
   fallback when no suitable AVM exists.
6. Add Bicep, deployment-stack, Terraform/backend/plan, Azure CLI, policy, Resource Graph, ARM GET, Git, filesystem,
   hashing, pricing-pack, and optional Draw.io-pack adapters. Use VS Code MCP sandboxing where supported as defense in
   depth, but keep kernel authorization authoritative and preserve equivalent behavior where sandboxing is unavailable.
7. Build one in-process validator registry with shared compiled schemas and handwritten TypeScript business/security
   validators. Cache pure validation and rendering by content, dependency, configuration, and toolchain hashes; invalidate
   on any input change and never cache external freshness or authorization decisions. Port every preserved v1 rule
   through the behavior matrix rather than inferring domain rules from schemas.
8. Define policy precheck honestly: static intent/property mapping plus current effective policy discovery and provider
   validation/what-if. It is a blocker when known constraints fail, but never claims to predict every runtime policy
   result. Deployment-time Azure enforcement remains authoritative.

Verification:

- Every adapter has malformed-output, timeout, retry, auth, permission, throttling, redaction, idempotency, and
  reconciliation tests.
- Capability denial tests prove creative roles cannot call state-changing, shell, raw filesystem, or credential-bearing
  operations.
- Validator coverage maps every accepted artifact type and preserved v1 rule to executable checks and mutation tests.
  Cache tests mutate each key dependency and prove stale results cannot survive; absent optional packs degrade only the
  workflows that declare them.

### Phase 5: Deliver managed VS Code Copilot customizations

1. Build the managed workspace bundle with a preferred visible `APEX` coordinator; interactive Requirements, Architect,
   Planner, and approval-bearing Operator/Diagnose specialists; hidden autonomous CodeGen, reviewer, validation, pricing,
   and preview workers; and curated Azure skills. Interactive specialists may be hidden only when supported VS Code
   qualification proves handoff-only discovery and invocation reliable.
2. Interactive specialists run as direct top-level handoff targets with their own model and `askQuestions` tools. Hidden
   workers run only as subagents, never call `askQuestions`, and return typed output or `needs_input` for the active
   top-level agent to present. Higher-cost model transitions use handoffs, never subagent delegation.
3. Add a build-time invocation-graph validator: every subagent edge must target the same or a lower observed model cost
   tier; subagent-only agents cannot include interactive tools; direct handoff targets must pass question-panel tests;
   and explicit allowlists prevent unintended worker selection.
4. Agents obtain bounded task envelopes and content references through APEX MCP, write only to task staging through APEX
   MCP, and submit through APEX MCP. Capabilities run through the kernel; agents do not invoke pricing, Azure, Bicep,
   Terraform, Git, or shell directly.
5. Keep `.github/copilot-instructions.md` minimal in consumer repositories. Use path instructions only for authoring
   generated IaC and never for workflow routing or security authorization. Skills use progressive loading; large,
   isolated investigations may use forked context only after that VS Code feature passes qualification.
6. Treat model labels as VS Code recommendations. Use fast models for routing and bounded deterministic transformations,
   stronger reasoning models for requirements/architecture/planning, and coding models for IaC. Record effective models,
   cost tiers, context bytes, cache reuse, and fallbacks; model availability never changes kernel contracts or gates.
7. Implement managed-file install, three-way update, rollback, trust notice, provenance verification, and clean uninstall.
   Package the same source as an optional agent plugin only if the supported VS Code channel and enterprise policy pass
   Phase 0B. Hooks remain optional Preview defense in depth and never enforce authorization.

Verification:

- A fresh supported VS Code host loads every expected managed agent and skill ID, presents direct specialist question
  panels, and completes the fixture task with no terminal or direct file tool.
- Restart VS Code and resume from repository state in the same checkout; a separate-device resume requires commit/pull
  and detects divergent heads.
- Managed customization downgrade/upgrade preserves user edits or stops with an actionable conflict. The optional plugin
  adapter, when shipped, must be behaviorally equivalent and respect `apex.lock.json`.

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

### Phase 8: Prove a thin dual-track contract, then complete the Bicep slice

1. Before either track gains breadth, implement the minimum shared CodeGen, validation, preview, approval, operation,
   inventory, and destroy path for one secure reference resource through both Bicep and Terraform bindings.
2. Execute both thin paths against fake providers and real sandboxes. Compare logical manifests, policy/security
   controls, secret handling, preview normalization, approval binding, inventory, and destroy semantics. Revise shared
   intent/binding contracts before compatibility is frozen if either track exposes a mismatch.
3. CodeGen then receives only the approved intent, Bicep binding, policy map, typed environment references, runtime lock,
   and Bicep skill. It writes dependency-sized batches to staging through APEX MCP.
4. Validate each batch and the final tree with formatting, build/lint, security, policy, SKU, exact-version,
   source-coverage, and logical-resource-manifest checks. Emit a content-addressed handoff with tool evidence and tree
   hash.
5. Preview recomputes all hashes, resolves secrets only inside the capability, and runs scope-correct
   deployment-stack/ARM what-if and provider validation. Normalize creates/modifies/deletes/ignores/unevaluated items,
   coverage/confidence, policy findings, estimated cost delta, target, and expiry.
6. Material ignored, short-circuited, or unevaluated resources block approval unless a narrowly scoped human risk
   decision is permitted by policy. Hard security/policy uncertainty cannot be accepted.
7. Gate 4 is decided interactively in the kernel or by verified GitHub Environment/OIDC evidence. It binds the exact
   template, parameters, target, stack, environment, policy envelope, toolchain, and preview hashes.
8. Deploy rechecks freshness, writer epoch, and hashes, writes operation-started evidence, executes the deployment
   stack, and
   reconciles indeterminate outcomes by operation ID. It does not claim transactional rollback.
9. Inventory combines deployment outputs, Resource Graph with eventual-consistency retries, and scoped ARM GETs. Commit
   the complete secret-free inventory, including resource IDs and configuration, to the private repository.
10. Teardown uses stack delete for owned resources. Dedicated sandbox runs may delete their owned resource group after a
    destroy preview and Gate 4 approval.
11. Render concise as-built evidence and run post-deploy health checks.

Verification:

- The reference Bicep scenario completes codegen, validation, preview, Gate 4, apply, inventory, drift comparison,
  destroy preview, approval, and teardown.
- The thin Bicep and Terraform paths pass before Bicep breadth is accepted; changes to their shared contracts rerun both
  paths.
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
4. Preview acquires the state lock and creates a non-speculative saved apply or destroy plan. A local run stores it with
   restrictive permissions under `.apex/local`; CI stores only encrypted bytes in the Phase 0B-approved short-lived,
   access-scoped transport. Bind state lineage/serial, lockfile, configuration, variables, environment, target, commit,
   intent/binding/IaC hashes, tool version, writer epoch, expiry, plan hash, and recipient job identity, then commit only
   the secret-free attestation and normalized preview.
5. Gate 4 approves that exact plan through TTY or GitHub Environment/OIDC. Deploy validates the approval, current head,
   writer epoch, artifact digest, recipient OIDC identity, state lineage/serial, and expiry before decrypting and applying
   the saved plan. It never regenerates an implicit plan. Delete plan bytes after terminal success or expiry; preserve
   only the attestation/hash. Production CI apply remains disabled unless this ceremony passed Phase 0B qualification.
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
   validation results, static context bytes, output bytes, capability calls, cache hits/misses, and elapsed time.
   Subjective quality is never presented as deterministic fact.
4. Define `scenario-v1` fixtures for secure storage, private web/API, governance conflict, destructive change,
   crash/cold resume, promotion, policy drift, and both lifecycle tracks.
5. Use tiered deterministic test lanes without Azure credentials or model calls: affected unit/schema/contract checks on
   ordinary changes, broader integration/property/fault checks before integration, and the complete
   mutation/supply-chain/offline-pin suite for release candidates. Cache only pure checks and require the complete suite
   before cutover. Registry access is credential-free, not fully offline.
6. Run manual release qualification using real VS Code Copilot: at least one clean-install full workflow, one
   restart-and-resume flow, and both IaC tracks across the matrix. Store complete outcomes and user-consented VS Code
   telemetry in the private repository; conversation transcripts are included only when explicitly selected as
   evidence.
7. Confirm optional outputs cannot affect canonical machine inputs or gate quality.
8. Evaluate the Phase 0B release scorecard against deterministic fixtures and the manual VS Code matrix. Regressions in
   setup success, task completion, p95 latency, restart/resume, validation escape rate, gate loops, capability failures,
   context budget, or cache correctness are decided by the frozen machine-readable targets, tolerances, sample rules,
   and unavailable-data dispositions. Failures block release unless an owner records rationale, expiry, and a
   next-candidate target.

Verification:

- Every preserved behavior-matrix row has a passing test or manual release check.
- Every deliberate security/contract/state mutation is caught, and all unavailable telemetry remains labeled
  `unmeasured`.

### Phase 11: Harden security, telemetry, supply chain, packaging, and documentation

1. Re-run the Phase 0 threat model against implemented trust boundaries: malicious repository content, prompt injection,
   managed-customization and optional-plugin supply chain, MCP and capability packs, symlink/TOCTOU, process output,
   credentials, approvals, writer transfer, event rewriting, state/plan exposure, and deployment side effects.
2. Verify role/capability authorization and VS Code sandbox/permission behavior. No prompt instruction is credited as
   an enforcement control.
3. Record kernel-measured metrics directly. Import VS Code token/model telemetry only with user consent, reject any
   detected credentials or secret values, record source/method/confidence, and commit the complete accepted telemetry to
   the private repository.
4. Generate SBOMs and provenance for the npm `apex` CLI, workspace customization bundle, every shipped capability pack,
   optional plugin adapter, containers, actions, and release artifacts. Sign or attest releases using registry-supported
   provenance and verify them during install/update.
5. Run license, dependency, secret, malware/package-integrity, and vulnerability checks. Approved exceptions are
   time-bounded and included in release evidence.
6. At the release cutoff, refresh every versioned component from authoritative sources, resolve the newest
   production-supported mutually compatible set, update exact locks/digests, and rerun all qualification. A release
   published after the cutoff does not race the candidate but is mandatory for the next candidate.
7. Publish versioned `apex` CLI and workspace customization installation, optional plugin status, workflow/gates,
   security/trust, evidence lifecycle, Bicep stacks, Terraform state and CI plan transport, approval, diagnosis,
   troubleshooting, update/rollback, v1 support, and release-operation documentation.
8. Update the public site minimally before cutover with vNext guidance and a clear versioned v1 maintenance banner.
   Defer visual redesign and broad content gardening.

Verification:

- Independent security review has no unresolved release-blocking findings.
- Clean installs verify artifact provenance, exact compatible versions, managed customization discovery, three-way
  update, fresh-host MCP startup, optional-pack behavior, and rollback.
- Documentation is discoverable without reading agent prompts.

### Phase 12: Release and cut over

1. Run the rehearsed clean-clone installation, managed customization upgrade/downgrade with user edits, optional plugin
   smoke test when shipped, VS Code restart/resume, event migration/replay, writer-transfer recovery, the complete
   deterministic suite, and both real Azure sandbox lifecycles including teardown.
2. Freeze the release runtime bundle and publish the `apex` CLI, workspace customization bundle, required capability
   packs, optional plugin adapter, provenance, SBOM, compatibility table, scorecard, known limitations, and support
   policy.
3. Immediately before cutover, create `v1-maintenance` from the actual v1 `main` head, tag its final mainline release,
   publish the support end date 12 months later, and validate its critical-fix pipeline.
4. Merge `vnext` to `main` only after every release criterion passes. Tag the first vNext major release and publish
   migration guidance stating that v1 projects are not resumable in vNext.
5. Rollback product distribution by restoring the prior compatible `apex` CLI, managed customization base, capability
   packs, optional plugin adapter, and runtime bundle and, if necessary, restoring `main` to the v1-maintenance or prior
   vNext release. Preserve user customization edits and never rewrite project event/object history during rollback.
6. Keep old implementation code accessible through Git history and release tags rather than dormant active-tree copies.

Verification:

- A new repository can install the `apex` CLI and managed workspace customizations, initialize a run, and discover all
  supported agents, skills, and MCP tools in a fresh supported VS Code host without an agent plugin.
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
- `/workspaces/apex/.github/agents/` — role, interaction, model, diagnostics, and operational behavior inventory; rewrite
  as managed workspace agents with direct interactive handoffs and bounded autonomous workers.
- `/workspaces/apex/.github/skills/` — curate domain knowledge only; remove state mutation and workflow routing.
- `/workspaces/apex/tools/mcp-servers/azure-pricing/` — retain as a lazy exact-locked capability pack until measured
  evidence justifies replacement.
- `/workspaces/apex/tools/mcp-servers/drawio/` — retain as an optional lazy capability pack outside the critical path.
- `/workspaces/apex/.devcontainer/` and `/workspaces/apex/.github/workflows/` — toolchain, CI, provenance, and
  branch-maintenance inventory.
- `/workspaces/apex/tests/` and `/workspaces/apex/tools/tests/` — characterization failures, scenarios, and fixtures to
  preserve or replace deliberately.
- `/workspaces/apex/site/` — keep v1 accurate during development and add minimum versioned vNext content before cutover.

**Global verification**

1. Every v1 behavior has an approved preserve/change/retire disposition and matching evidence.
2. The kernel is the only supported state transition and external-operation path; VS Code instructions are never
   counted as authorization.
3. Runtime bundle, published schemas/events/contracts, managed customizations, capability packs, optional plugin adapter,
   and `apex` CLI upgrades are versioned, transactional where applicable, preserve user edits, and reject
   incompatibility safely.
4. Four logical gates apply per environment run. Promotions may inherit unchanged Gates 1-3 with immutable hash-bound
   evidence; Gate 4 is always fresh and bound to the exact deployment inputs. CI approval is authenticated to the
   GitHub Environment/OIDC identity, while local TTY approval records the verified local execution context without
   claiming cryptographic user authentication.
5. Terraform applies the exact protected plan through the qualified local or encrypted CI ceremony; Bicep operates only
   within explicit deployment-stack or sandbox resource-group ownership. Both reject stale writer epochs and repository
   heads.
6. Both IaC tracks satisfy the same neutral intent and expose explicit, reviewed parity exceptions.
7. Credentials, secret values, Terraform state, saved plan files, uncertain output, and unapproved telemetry remain
   outside Git and prompts. Required attestations are immutable; other accepted evidence follows allowlists, byte and
   retention budgets, deduplication, and consent lifecycle controls.
8. Deterministic CI requires neither Azure credentials nor model calls; credential-free registry access is allowed and
   declared.
9. VS Code can install, discover, select, execute, and resume compatible APEX tasks after restart or commit/pull without
   chat-history state. Interactive or higher-model transitions use direct handoffs; autonomous subagents are
   noninteractive and never exceed the parent model cost tier.
10. The release scorecard meets its setup, correctness, latency, resume, context, capability, and cache thresholds with
    no unowned or unbounded exceptions.
11. The release uses the newest production-supported mutually compatible versions observed at the recorded cutoff, with
    exact pins, provenance, SBOM, and no unapproved exceptions.
12. v1 remains supported for 12 months after cutover and the public documentation clearly separates v1 maintenance from
    vNext.

**Scope boundaries**

- Included: `apex` CLI/kernel, managed workspace VS Code customizations, both IaC tracks, one-environment runs and linked
  promotion, setup/doctor, governance/pricing/quota, four logical gates, native preview/deploy/destroy, inventory,
  diagnosis, lessons/quality, runtime upgrades, security/supply chain, and minimum public docs.
- Deferred: distributed concurrent writers, hosted/multi-tenant coordination, non-GitHub CI approval providers, direct
  model APIs, autonomous headless model orchestration, GitHub Copilot CLI support, a mandatory agent plugin while that
  surface is Preview, custom VS Code extension, v1 state/artifact import, recurring model evaluation, multi-pass
  reviews, mandatory diagrams, full site redesign, and rewriting retained Python/Deno capabilities without measured
  need.
- `azd` remains optional compatibility output only and is not part of the audited deployment path.

**Decisions from alignment**

- Hybrid npm `apex` CLI plus managed workspace-native VS Code customizations; agent plugin packaging is optional and
  qualification-gated.
- APEX is the preferred entry agent. Interactive and higher-model work uses direct handoffs; hidden subagents are
  noninteractive and same/lower-tier only.
- Single active writer per project run with an enforceable local-to-CI ownership epoch transfer.
- One environment per run; linked runs model promotion and inherit unchanged Gates 1-3 while always refreshing Gate 4.
- Contracts ship in feature-owned waves after a durable walking skeleton, and a thin dual-track proof precedes either
  track's breadth.
- Validation is in-process, dependency-keyed, cached only when pure, and tiered for fast feedback plus full release
  qualification.
- Python and Deno integrations are lazy capability packs rather than core installation prerequisites.
- Newest production-supported release channels, including latest Node.js LTS patch.
- Azure deployment stacks plus dedicated sandbox resource-group teardown for Bicep.
- Native audited deployment; azd compatibility output only.
- GitHub Environment required reviewers plus OIDC for CI production approval.
- Preserve setup/doctor, quotas/availability, diagnosis, lessons/quality, and project search/history.
- Use the private repository as the approved evidence boundary with immutable required attestations and bounded,
  allowlisted, deduplicated, retention-aware optional evidence.
- Production Terraform CI applies only an encrypted, recipient-bound saved plan proven in Phase 0B; regeneration after
  approval is forbidden.
- Release decisions use a measured scorecard for correctness, speed, resume, context, capability reliability, and cache
  safety without an LLM judge.
- “Offline” qualification means credential-free and model-free; locked registries may be accessed.
- v1 receives security and critical fixes for 12 months after cutover.
