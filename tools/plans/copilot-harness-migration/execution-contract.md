## Migration execution contract

**Current authorization:** owner-approved implementation and real-Azure E2E, recorded from the
2026-10-18 10:18 UTC owner message in [execution status](execution-status.md).
Progression between engineering packets is delegated when their documented criteria actually pass.
This is an engineering delivery contract, not a replacement for live Azure workflow rules.

### Runtime and scope

- Product runtime: Copilot session target inside VS Code, using the SDK/Agent Host.
- No supported Local, standalone CLI, cloud-agent or other-IDE execution path is added.
- Ordinary migration engineering uses the interactive parent and bounded native engineering/test workers.
- Skills provide domain knowledge, not permissions or independent model/runtime guarantees.
- Keep existing user work, untracked project artifacts, historical findings and review provenance intact.
- Preserve the owner's intentional runtime hook deletions. Remove stale registrations/callers and obsolete
  tests; never restore/reconstruct hooks or introduce a replacement guardian framework.
  Unrelated Git Lefthook/CI security checks remain. Missing hook compatibility cannot block the migration.

### Autopilot work after approval

Proceed autonomously with dependency-ready, explicitly scoped reads/edits, deterministic validation,
bounded repairs, feature-branch commits/pushes, GitHub issue/PR updates and relevant reviewer fixes.
Prefer tested project commands and finite work packets over improvised shell or repeated model round-trips.
Do not ask for confirmation of each already-approved technical step.
Use parallel work only with disjoint writes; serialize shared-file/schema/registry changes.

Each packet supplies:

1. Objective, rationale and input files/revisions.
2. Exact allowed paths, commands and side effects; protected/no-go paths.
3. Expected behavior/output shape and positive/negative acceptance cases.
4. Required evidence and affected caller/test/docs closure.
5. Failure categories, bounded recovery and owner stop conditions.
6. Compatibility readers and rollback plan.

### Human decisions and enforcement

Ask the owner for material scope/requirements, permissions, security weakening, risk/budget acceptance,
external credential changes or consequential approval. Batch independent decisions when possible.
Decline and cancellation never approve; freeform form input must be validated.
Native Autopilot can answer questions automatically, so an `ask_user` return is not independent signoff.
CHM-10 must prove the chosen approval/execution boundary with harmless operations.
If the required consequential boundary is unavailable, block that action and report the precise limitation;
continue independent engineering without claiming either equivalent native protection or full pilot acceptance.
Frontmatter, hooks, review output, issue assignment and this file do not grant deployment authority.

No merge into `main`, auto-merge, protection bypass, force-push, credential switching, unscoped Azure writes,
deletion, historical-evidence rewrite or automatic issue closure is authorized.
CHM-18 permits deployment only after tenant/subscription, resource boundary, budget, actions and controls
are explicitly established. An active subscription or an Autopilot answer cannot supply missing owner scope.
Keep PRs updated and open. A comment is resolved only after its actual fix/no-change decision is evidenced;
planned implementation feedback stays unresolved and linked to the owning packet.

### Bounded recovery

Classify blockers as missing input, permission denied, unavailable capability, invalid artifact,
technical failure, stale evidence or external service failure.
Allow one justified retry for transient/empty tool output, then report the exact failure.
Allow at most two in-scope technical repair/retest iterations per packet before surfacing a blocker.
Do not retry permission denials, change identity, substitute unsupported routing or reset review attempts.
Existing stricter production review budgets still apply until an approved replacement lands.

### Validation and evidence

Use the smallest existing test selector and expand to aggregate checks when the change requires it.
Record actual candidate revision, inputs, commands, exit codes, native observations and unresolved failures.
Missing optional usage is UNKNOWN; missing required behavior is BLOCKED. No synthetic shutdown or approval.
Keep raw logs local, select the exact authorized session and redact any shared excerpts.
No token/cost/latency savings claim without equivalent-task measurements and actual attribution.

Documentation-only planning changes need targeted format/link consistency checks, not an Azure workflow.
Current root/CI checks may expose pre-existing project failures; disclose rather than waive or repair history.
Do not directly lint existing `agent-output` artifacts through forbidden owner-only paths.

### Completion, review and rollback

Return changed paths, commits, positive/negative results, evidence, review-thread dispositions and next gate.
Preserve atomic state writers, conflict checks and historical readers where required.
If a mutation committed but indexing failed, reindex explicitly; do not repeat the mutation.
Rollback only the packet's changes through a reviewed revert; do not reset shared work or silently restore backups.
Code rollback cannot undo cloud side effects. Deployment authority is now granted within established scope;
cleanup authority remains a separate explicit decision.
