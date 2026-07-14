## APEX vNext Product Requirements

APEX vNext replaces the current prompt-led workflow with a deterministic TypeScript runtime and npm CLI while retaining
selected v1 behavior. Managed VS Code customizations remain the user experience; the kernel owns workflow, state,
authorization, validation, evidence, and controlled capabilities.

## Goals

- Make platform-engineering runs deterministic, resumable, auditable, and safe under one active writer.
- Preserve the approved v1 behavior dispositions in [phase-0a/v1-behavior-compatibility.md](phase-0a/v1-behavior-compatibility.md).
- Support Bicep and Terraform through one track-neutral workflow and equivalent logical outcomes.
- Ship a clean-installable npm runtime plus managed VS Code customizations with safe update and rollback.
- Bind every approval and external operation to exact inputs, state, target, commit, evidence, and expiry.
- Measure release quality from deterministic events and retain unavailable evidence without inventing claims.

## Users

- Platform engineers who gather requirements, design Azure platforms, generate IaC, and operate deployments.
- Reviewers and approvers who need bounded, traceable decisions and exact deployment previews.
- Repository maintainers who package, qualify, release, support, and roll back APEX.
- Security and governance owners who require least privilege, policy traceability, and evidence retention.

## Functional Requirements

### REQ-DIST-001: Distribution And Installation

The release must provide an npm `apex` CLI and kernel that install a versioned managed customization bundle into a clean
supported workspace. Init, update, rollback, and uninstall must be transactional, detect local edits, and avoid silently
overwriting unrelated files.

### REQ-STATE-001: Runtime State And Writer Authority

The runtime must use a hash-linked event journal, atomic persistence, compare-and-swap mutation, one active-writer lease,
ownership epochs, crash reconciliation, and explicit local-to-CI writer transfer bound to project, run, repository,
branch, commit, recipient, and expiry.

### REQ-CONTRACT-001: Persisted Contracts And Compatibility

Persisted data and capability messages must use schema-first versioned contracts with deterministic serialization,
metadata coverage, strict validation, secret-reference support, upcast policy, and precise refusal of incompatible major
versions.

### REQ-WORKFLOW-001: Workflow And Gates

A data-only workflow manifest must be routing authority. A run targets one environment, one Azure scope, and one IaC
track. It exposes Requirements, Architecture and Cost, Implementation Plan, and Deployment Preview as the only human
approval gates; required deterministic validation and reviews remain blocking preconditions.

### REQ-REQUIREMENTS-001: Requirements And Intent

Requirements capture must use bounded user interaction, preserve unresolved assumptions explicitly, produce typed
requirements and SKU intent, and prevent later stages from silently changing approved product intent.

### REQ-ARCH-001: Architecture, Cost, Quota, And Availability

Architecture must trace resources to requirements and current pricing, quota, regional availability, reliability,
security, operations, performance, and cost evidence. Stale or unavailable blocking evidence must prevent approval.

### REQ-GOV-001: Governance And Policy

Live effective Azure Policy, including inherited assignments and exemptions, must be discovered before architecture
approval. Every applicable effect must map to implementation properties or an explicit blocking disposition.

### REQ-PLAN-001: Track-Neutral Planning

Planning must separate implementation intent from Bicep or Terraform binding, maintain an acyclic dependency graph, map
all requirements and governance constraints, and produce environment inputs without embedding secrets.

### REQ-IAC-001: Dual-Track IaC

Bicep and Terraform must derive from the same approved intent, preserve logical resource parity, use exact tool and module
pins, enforce the security baseline, and pass a thin dual-track proof before broader scenario claims.

### REQ-BICEP-001: Bicep Lifecycle

Bicep preview, apply, inventory, reconciliation, and destroy must use native Azure commands and deployment-stack
ownership where qualified. A fallback may operate only when it proves complete managed-resource coverage and safe delete
semantics.

### REQ-TERRAFORM-001: Terraform Lifecycle

Terraform must use a secured Azure Storage backend with identity-based access, locking, retention, and compliant
networking. Preview must create a protected saved plan; approval and apply must bind that exact plan, lineage, serial,
inputs, commit, recipient, and expiry. Production CI apply remains blocked until recipient-bound encrypted transport is
qualified.

### REQ-APPROVAL-001: Preview And Approval Binding

Deployment Preview is the production approval ceremony. Approval must bind actor and run identity, target, operation,
inputs, IaC tree, policy envelope, preview, commit, owner epoch, recipient, and expiry. Stale, substituted, incomplete,
or rejected evidence must fail closed.

### REQ-OPS-001: Operations, Promotion, And Diagnosis

Operations must be read-first and journaled. Environment promotion creates a linked run, inherits only unchanged neutral
gates, refreshes environment-specific preview and approval, and never inherits Gate 4. Diagnosis, reconciliation,
inventory, and destroy must preserve operation ownership and evidence.

### REQ-QUALITY-001: Quality And Evidence

The runtime must produce deterministic scorecard measurements, evidence hashes, provenance, redacted logs, restart and
fault results, cache correctness results, and explicit unavailable dispositions. Subjective evidence must be labeled and
must not satisfy deterministic gates.

### REQ-CAPABILITY-001: Capabilities And Optional Packs

External operations must pass through a versioned capability protocol with grants, roles, expiry, bounded output,
timeouts, redaction, and safe argv execution. Python, Deno, governance, pricing, and diagram packs remain optional,
independently locked, verified, transactional, and non-blocking when absent unless the selected workflow needs them.

### REQ-SECURITY-001: Security And Supply Chain

Agents must not self-approve, deploy models, or bypass kernel authorization. The release must provide least-privilege
roles, secret and PII redaction, symlink and traversal defenses, immutable dependency pins, release manifest, CycloneDX
SBOM, provenance, and no high or critical unresolved security finding.

### REQ-CUSTOMIZATION-001: Managed VS Code Experience

APEX remains VS Code-only for this release. Interactive specialists use direct handoffs and may ask users; hidden workers
cannot ask users and return typed `needs_input` results. Model tiers, grants, handoffs, managed files, and MCP inventory
must be validated against the shipped bundle.

### REQ-DETERMINISM-001: Deterministic Packaging And Validation

Equivalent inputs must produce byte-stable contracts, rendered artifacts, generated IaC, package tarballs, release
manifest, SBOM, and provenance. Validators must have executable registry ownership, stable diagnostics, and equivalent
local, hook, and CI behavior.

### REQ-DOCS-001: Documentation And Lifecycle

Installation, workflow, CLI, security, operations, testing, capability packs, upgrade, downgrade, rollback, uninstall,
release, and v1 maintenance behavior must match the candidate implementation. The v1 support end date is set relative to
cutover, and v1 sessions are not resumable in vNext.

### REQ-IMPROVE-001: Bounded Improvement

The quality and evidence lifecycle may store redacted structured observations, detect deterministic recurrence, and
produce inert proposals. Human decisions and the normal issue and pull-request flow remain mandatory. Observations and
proposals cannot inject context or autonomously edit policy, prompts, agents, skills, code, issues, pull requests,
releases, or deployments.

## Non-Functional Requirements

- **Compatibility:** Every approved Phase 0A disposition is preserved, changed through its named replacement owner, or
  retired through its approved removal gate.
- **Security:** Kernel authorization and deterministic validators fail closed on missing, stale, malformed, secret-bearing,
  or substituted state.
- **Reliability:** Runs survive restart at each gate, reject stale writers, reconcile partial commits, and retain evidence.
- **Performance:** Release measurements meet [quality-scorecard.v1.json](../../config/quality-scorecard.v1.json) targets,
  tolerances, minimum samples, and unavailable-data rules.
- **Portability:** The supported devcontainer and clean consumer workflow install exact locked dependencies without
  depending on unpublished workspace state.
- **Accessibility:** User-facing CLI and documentation provide clear text status, actionable diagnostics, and no
  color-only meaning.
- **Privacy:** Telemetry is separate, optional, exportable, and deletable; raw chat history is never scraped or replayed.

## Exclusions

- Distributed collaborative writers.
- Cross-version resume of v1 sessions or artifacts.
- GitHub Copilot CLI or non-VS Code agent runtimes.
- Preview VS Code plugin behavior as a first-release dependency.
- Autonomous issue creation, repository edits, pull requests, approvals, releases, or deployments from improvement data.
- Generic unscoped Bicep destroy or post-approval Terraform plan regeneration.
- Production Terraform CI apply before encrypted recipient-bound plan transport is proven.
- External repository or organization webhook changes without separate authorization.

## Release Metrics

The exact metric contract is [quality-scorecard.v1.json](../../config/quality-scorecard.v1.json). Blocking metrics include
setup completion, first-task success, workflow elapsed time, restart and resume, deterministic validation escape,
capability failure, context size, and cache correctness. Gate-revision loops may omit a claim when unavailable; all other
unavailable blocking measurements block release.

## Cutover Acceptance

Cutover requires all of the following on the exact candidate head:

- Every requirement above maps to passing automated evidence or an explicitly required manual/live result.
- The Phase 0A compatibility matrix has no unowned drift.
- Required CI and CodeQL checks pass, with no unresolved critical or high security finding.
- Clean install, update, rollback, uninstall, package reproducibility, SBOM, provenance, and publication dry run pass.
- Supported VS Code handoffs, questions, hidden workers, MCP startup, restart, and cross-device resume are qualified.
- Bicep and Terraform preview, approval, apply, inventory, diagnosis, destroy, and recovery scenarios are qualified.
- GitHub Environment/OIDC approval and local-to-CI writer transfer are proven.
- Scorecard sample requirements and unavailable-data dispositions are satisfied.
- Release and rollback rehearsals, documentation audit, v1 critical-fix sync, and `npm run validate:all` pass.
- Every open risk has an owner and acceptable release disposition.
- A maintainer explicitly authorizes cutover, publication, final tags, and merge to `main`.
