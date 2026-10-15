# Changelog

Entries are grouped by conventional-commit type. Breaking changes list the migration steps.

## Unreleased

### Breaking changes

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

- `apex-recall review-audit --attempt-input <path>` computes the attempt digest from input files, so the start and the
  outcome records agree and a changed input is rejected. It prints `input_digest` and
  `permission_granted_by_this_record: false`; `authorization: not_granted` remains for existing readers.
- `validate:iac-contract --stage deploy|post-deploy|go-live` and an optional `blocks` list on `capability_checks` let an
  unresolved capability block only the stages it names. A capability without `blocks` still blocks every stage.
- `policy-property-map` entries accept `status` (`satisfied`, `pending`, `not-applicable`, `unsatisfiable`) and
  `not_applicable_reason`. A not-applicable row needs a reason; an unsatisfiable row fails and routes to Governance.
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
