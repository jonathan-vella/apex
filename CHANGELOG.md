# Changelog

Entries are grouped by conventional-commit type. Breaking changes list the migration steps.

## Unreleased

### Fixes

#### CFS-compatible Python setup

Retain Pillow 12.3.0 and Ruff 0.17.0 instead of newer pins unavailable through the configured CFS proxy.
Validate Python 3.15 installation, rendering and recall tests using CFS-only package downloads.
Record the seven-day upstream artifact-age minimum and the distinction between the corporate-devbox proxy
and authenticated CFS-compliant feeds required for automated builds and CI. Browsing URLs and direct public
registries are not installation fallbacks. Published setup documentation needs the corresponding
`jonathan-vella/apex-docs` update.

Keep the evaluator's internal validation variant separate from the distro's `/etc/os-release` `VARIANT`
field, preventing readonly-variable errors and empty distro/OS evidence on Azure Linux.
Add regression coverage and document the verified CFS PowerShell endpoint for analyzer provisioning.

### Breaking changes

#### Azure Linux 4 development container

Replace the Ubuntu development image with the explicitly accepted Azure Linux 4 preview, pinned by manifest digest.
Select latest stable retained tooling at the recorded execution cutoff, including Python 3.15.0 and stable
Current Node 26.12.0. Preserve Python's supported minimum and add a current-interpreter CI lane.
Install Terraform, GitHub CLI, and Bicep as checksum-verified binaries; install Azure CLI in an isolated Python
environment instead of the Debian-specific upstream Feature. Remove the unused default Az PowerShell module
bundle and `dos2unix`, while retaining PowerShell and pinned PSScriptAnalyzer.

Build historical baseline and candidate from their complete source revisions, with a common isolated evaluator.
Require explicit distro/version/architecture evidence and complete mandatory-check results.
The user starts automated local acceptance after rebuild and attachment; lifecycle setup does not launch it.
Native container builds remain pending because the implementation environment has no container engine.
See [the devcontainer guide](.devcontainer/README.md) for pins, manual testing, and build limitations.
Published setup and release documentation require a separate follow-up in `jonathan-vella/apex-docs`.

#### GitHub operations consolidates the manual commit entrypoint

Replace `/apex-git-commit` with `/apex-github-operations commit` and an explicit file/hunk scope.
The canonical skill remains discoverable and inherits the caller's model/tools; fixed owner/model
prerequisites and the separate manual wrapper are removed.
Commit-only requests stop after the local commit. Push, PR writes, merge and auto-merge require
their own explicit authorization; combined requests must cover each action and its scope.
Infrastructure and generated artifacts require explicit inclusion rather than inferred staging.
Full-index checks, partial staging, author identity, normal hooks, co-author attribution and
credential-change approval remain part of the procedure.

Retire the historical Sensei-specific merge procedure and undocumented Smart PR label/watchdog
automation. GitHub operations use `git`/`gh`, including REST/GraphQL, before discovered MCP fallbacks.
Token-printing authentication examples and interactive staging are removed; PR creation uses
the actual template locations and verified head/base, and merge checks the approved head SHA.

Local hooks and Branch Enforcement now share the same validators. Use `scripts/` for script branches
(files under `tools/scripts/` or `package.json`), not `tools/scripts/`. Domain scope violations now
block local pushes as well as CI; unavailable comparison bases fail instead of falling back silently.
Use a cross-cutting prefix such as `fix/` for changes spanning domains. Automation prefixes remain supported.
Published entrypoint and branch-policy documentation must be synchronized in `jonathan-vella/apex-docs`.

#### Instruction audit remediation and Copilot-only discovery

Remove Local-only customization-location settings from workspace and devcontainer configuration.
Copilot discovers APEX's conventional `.github/` locations; the VS Code validator now rejects
these ineffective legacy location settings instead of requiring them.
The redundant `fix:artifact-h2` npm alias is removed; use
`npm run fix:artifacts -- <artifact-path>` to preview, then add `--apply` for reviewed changes.

Instruction contracts now require observed terminal prompts and existing authorization rather than
confirmation inferred from silence. Governance guidance uses the producer's `required_value` key and
conditional property mappings. Markdown/artifact enforcement, CI jobs, documentation triggers and
model-neutral authoring ownership are documented against their actual local contracts.
Historical project evidence and independent approval/review requirements remain unchanged.

#### Copilot SDK entrypoints replace Local prompt adapters

The target is the GitHub Copilot SDK harness inside VS Code, not a standalone CLI
or headless deployment service. Local prompt roots and split-harness adapters move to
`.archive/pre-cpharness/` and are excluded from active discovery.

Migration:

1. Select `01-Orchestrator` and use `/apex-workflow-start` with a fresh or `resume` operation.
2. Use `/apex-github-operations` for scoped commit/GitHub work and `/apex-debug-log-export`
   for log export instead of their former prompt adapters.
3. Main workers use actual native bounded task prompts/results, not custom execution envelopes,
   readiness nonce turns or mandatory raw-log verification. Model/effort labels remain diagnostics.
   Direct owner selection remains available, with native questioning in every interactive main.
4. Native forms use `ask_user`; delegated steps return pending forms to their interactive parent.
   A completed worker or accepted finding never approves a workflow/deployment gate.
5. Profile repository-scoped native `events.jsonl` files. Legacy logs remain readable but cannot
   certify SDK acceptance. Export includes raw events only with explicit `--include-raw`.

Custom-agent runtime acceptance and MCP projection still require live verification;
static validation and built-in worker probes do not certify the cutover.

#### Native agent bodies and interaction

All active main and leaf bodies are audited and condensed around native interaction, bounded work,
actual output contracts and current domain evidence. Active `handoffs` metadata is removed after the
owner observed no controls with Probe Source selected in Copilot. This is not a blanket claim about
all VS Code versions. `00-handoff.md` remains a durable recovery artifact, not a UI transition.
Direct Requirements, Architect, Design and Governance retain native `ask_user`.
Delegated mains return input forms to the parent; leaves return role-specific failures.
No source tool list or successful task proves credential isolation or genuine human approval.

#### Repository agent runtime hooks are retired

The owner intentionally removed Tool Guardian and the advisory SubagentStop hook.
Remove their stale workspace/devcontainer registrations and runtime-only validator/test commands.
Do not restore them as migration prerequisites or introduce a replacement guardian.
Git Lefthook checks, secret/dependency scans and Azure security/governance requirements remain.
Native permissions are not claimed to provide equivalent regex/self-modification protection.
Consequential authorization and actual deployment scope remain separate requirements.

#### Reopening a step marks dependent steps stale and supersedes the Plan approval

`apex-recall start-step <project> <step> --force` on a completed step now sets every dependent step that is `complete`
or `in_progress` to the new `stale` status, clears its `started`, `completed` and `sub_step`, and sets
`decisions.plan_status` to `SUPERSEDED` when it was `APPROVED` or `EXCEPTION_AUTHORIZED` and the reopened step is 1, 2,
3_5 or 4. Artifacts and risk authorizations are kept as history. A stale step is not complete, so the next step cannot
start until it is re-completed in order.

Who is affected: readers of `session.steps[*].status` that enumerate statuses, and any gate that expects `APPROVED`
after a reopen. CodeGen and the risk gates already require `APPROVED` or a current exception and now fail closed.

Migration:

1. Treat any status you do not recognize, including `stale`, as unfinished.
2. After a reopen, re-complete each stale step in order (`start-step`, then `complete-step`, or `transition`);
   starting a stale step clears its stale markers.
3. Re-run the reviews and approvals the reopened step owns; the Plan needs a new approval before `plan_status` returns
   to `APPROVED`.
4. Existing projects are unchanged until a step is reopened. Validate hand-written state with
   `npm run validate:session-state`.

#### Step 2 cannot complete while scratch or failed cost files remain

`apex-recall complete-step <project> 2` and `transition --from-step 2 --complete` exit with code 2 (`step2_residue`)
while the project folder holds a `*.tmp.md` file, or a `02-cost-estimate*.json`, `02-cost-candidates*.json` or
`03-des-cost-estimate*.json` file with `"status": "FAILED"`. `--allow-missing-challenger` does not bypass it.
`npm run validate:challenger-presence` reports the same files for projects whose Step 2 is already complete.

Migration:

1. Move superseded or failed cost files to `agent-output/<project>/_meta/` (only the top level is checked).
2. Delete scratch `*.tmp.md` files such as `02-waf-research.tmp.md`.
3. Re-run the command.

#### Reviews may not freeze mutable parent-owned files as supporting inputs

`validate-challenger-findings.mjs --metadata ... --supporting-input` refuses `sku-manifest.json`, `sku-manifest.md`,
`00-handoff.md`, `00-session-state.json`, `README.md` and `*-decisions.json`. `--verify-cache` rejects an existing review
that declares one, so `complete-step` and `transition --complete` fail for it.

Migration:

1. Generate a fresh review without the file; a review is never restamped to change its inputs.
2. Quote what you read from it in the review text instead (for `sku-manifest.json`, its `current_revision`).
3. Select the new review with the existing `--plan-review` or `--governance-review` options where they apply.

#### A `phase` parameter may not declare a default

`validate:iac-contract` fails a `params[]` entry named `phase` or `deployment_phase` that has a `default`, because an
omitted value would deploy every phase and bypass the per-phase approval gates.

Migration: remove `default` from the parameter in `04-iac-contract.json` and the Bicep or Terraform source, and pass the
phase explicitly on every deployment. Refresh the contract hashes afterwards (see below).

#### Raw resources need a row in the plan's exceptions section

When a plan has a `### Raw Resource Exceptions` heading, `validate:iac-contract-consistency` fails any contract resource
without an AVM module entry that is not named in that section. Plans without the heading only warn.

Migration: add one row per raw resource (resource type, stack, scope, evidence URL, rationale, review date) under
`### Raw Resource Exceptions`, or write `_None._` when every resource uses AVM, then refresh the contract hashes.

### Features

- PowerShell tooling adds `npm run setup:powershell`, `lint:powershell` and `test:powershell`.
  PSScriptAnalyzer 1.24.0 installs in current-user scope; parsing and selected-rule diagnostics fail closed.
  Maintained scripts and negative fixtures are checked through CI and existing Git hooks, not runtime hooks.
- Deploy, Diagnose and manual Challenger entries disable implicit model invocation.
  Structural validation preserves this policy without forcing every other role to
  enable implicit invocation. This is not a claim of independent credential isolation.
- `verify-worker-ready.mjs` remains a historical diagnostic reader, not an active agent-body runtime gate.
  Actual artifact validity, reviewer result provenance and human gates remain separate;
  neither catalog runtime IDs nor readiness records grant project or deployment permission.
- Earlier migration candidates included Tool Guardian and advisory subagent checks.
  These runtime hooks are now retired by owner instruction; their earlier behavior is not active protection.
- `apex-recall review-audit --attempt-input <path>` computes the attempt digest from input files, so the start and the
  outcome records agree and a changed input is rejected. It prints `input_digest` and
  `permission_granted_by_this_record: false`; `authorization: not_granted` remains for existing readers.
- `validate:iac-contract --stage deploy|post-deploy|go-live` and an optional `blocks` list on `capability_checks` let an
  unresolved capability block only the stages it names. A capability without `blocks` still blocks every stage.
- `policy-property-map` entries accept `status` (`satisfied`, `pending`, `not-applicable`, `unsatisfiable`) and
  `not_applicable_reason`. A not-applicable row needs a reason; an unsatisfiable row fails and routes to Governance.
- Contract resources accept optional `phase`, `consumes` and `target` (private endpoints). `validate:iac-contract` then
  fails a `depends_on` into a later phase and a consumer that does not `depends_on` a private endpoint targeting what it
  consumes. Contracts without the fields are not checked.
- `npm run sync:draft-contract-hashes` is now a registered command. It updates only the `plan_ref` and `l1m_ref` digest
  bytes, keeps the file's formatting, and `--write` replaces the contract atomically. It still refuses an approved plan.
- `render-session-handoff` shows stale steps with the reason they are stale.

### Documentation

- Architect, Orchestrator, Requirements and Planner guidance, the plan and requirements templates, the workflow gates,
  the review protocol and the Bicep patterns skill now carry the nordic-foods lessons: ask owner inputs before
  architecture approval, never substitute an owner decision to meet a budget, show the architecture's value in the
  Planner panel, route new resource types through Refresh Governance, and prefer the MCR tag list over the AVM metadata
  tool when deciding whether a module exists.
- New reference: private-registry App Service with certificateless Entra sign-in.
- The Architect validation checklist moved to `apex-azure-defaults/references/architect-validation-checklist.md`.
