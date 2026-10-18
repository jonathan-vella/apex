## CHM-09: adopt assessment dispositions in bounded slices

GitHub: [#780](https://github.com/jonathan-vella/apex/issues/780).
Requirements: R9, R10, R12. Priority: P0. Depends on: owner plan approval.
Status: owner execution approval recorded on 2026-10-18 at 10:18 UTC; issue creation alone grants no authority.
Delivery is APEX #779; product runtime is Copilot inside VS Code only.

### Objective and inputs

Translate the 2026-10-18 assessment into a current, evidence-backed asset/change map for the pilot and each
subsequent implementation packet. Use the PRD, assessment-adoption document, owner-held research ledger
and current filesystem discovery; existing instructions/validators are evidence, not the necessity standard.
Do not require a new attestation framework or exhaustive semantic reread before the first bounded pilot.

### Allowed scope and behavior

Planning asset manifest and per-packet scope records; read relevant agents, instructions, skills/sub-assets,
hooks/config, tooling/tests, registries and archived predecessors.
Do not alter production source, state, project artifacts or Azure resources in this packet.
If the owner-held ledger is unavailable, rediscover only selected scope and mark remaining gaps.

### Activities and validation

1. Reconcile current paths against research; record changes since baseline `ea8cb382`.
2. Record one primary KEEP/ADAPT/CONSOLIDATE/REPLACE/RETIRE/INVESTIGATE disposition per selected asset.
3. Include purpose/consumer, native overlap, actual dependencies/cross-language callers, useful tests,
   proposed output, evidence/gap and confidence.
4. Resolve material gaps for the pilot first, then assign remaining gaps to the packet that changes the asset.
5. Flag owner product decisions for generic prepare/validate/deploy and optional maintenance skill scope.
6. Check duplicate/missing paths and ensure no retirement is justified solely by a filename or lack of npm caller.

### Acceptance and evidence

- [x] Owner explicitly approved the revised PRD and implementation in the 2026-10-18 10:18 UTC message.
- [ ] Pilot scope has no material unexamined dependency.
- [ ] Each selected asset has reason, disposition, caller impact, confidence and explicit evidence gap.
- [ ] Every remaining gap has a named downstream packet; no unbounded re-audit blocks unrelated work.
- [ ] Azure security, live governance, review/state integrity and historical compatibility have explicit owners.
- [ ] Generic app pack and cost-review policy decisions are surfaced before affected retirement.

Negative cases: missing asset/caller, duplicate row, unknown native capability and cross-language subprocess.
Return the scoped manifest, revision and owner decisions; no code rollback is needed.
Stop only the affected slice for missing evidence. No merge, auto-merge, deployment or history repair.
