## CHM-11: consolidate conversational roles into lead and skills

GitHub: [#782](https://github.com/jonathan-vella/apex/issues/782).
Requirements: R1, R4, R10. Priority: P1. Depends on: CHM-15 and owner acceptance of CHM-04.
Status: proposed implementation after plan/pilot approval.

### Objective and inputs

Current source slice: every main/leaf body has been audited and migrated to bounded native execution,
with explicit direct `ask_user`, delegated input forms, no active UI handoffs and no custom readiness ritual.
See [agent-body readiness](../agent-body-readiness.md) for actual test/runtime evidence.
This is not yet roster retirement or a change to domain review/approval requirements.

Replace forced numbered conversational ownership with an optional short lead, on-demand domain workflows and
bounded native workers where independent context matters. Use the accepted pilot and CHM-09 asset map.
Preserve valuable outputs and domain constraints, not the existing roster by default.

### Allowed scope

One role slice at a time: main `01` through `11` agent definitions, their directly consumed skills/instructions,
entry descriptions and registry/DAG references necessary to keep the slice working.
Requirements, architecture/design, governance/plan, code authoring, as-built/diagnose and context utilities are
separate finite slices. Deploy role consolidation consumes CHM-10's boundary; no deployment is executed.
Do not delete deterministic leaves or rewrite review/state internals owned by CHM-12 through CHM-14.

### Expected behavior and validation

The interactive parent owns material input; domain skills load on demand; no routine readiness handshake/log
path dependency. Keep real approval/security/output/stop rules in the short role body.
Native Agent remains usable for routine repository engineering.

Run `npm run validate:agents`, `npm run validate:agent-registry`, `npm run validate:skills`,
`npm run test:workflow-handoffs` and targeted behavior/entry tests for each slice.
Update obsolete roster/prose assertions together with the change; do not preserve them as product requirements.
Test missing requirements, conflicting SKU, incomplete governance, unavailable reviewer/tool, one-shot worker,
denied action, unexpected output and scope escape against synthetic fixtures.

### Acceptance and evidence

- [ ] Each changed role responsibility has a usable skill/tool/parent replacement or explicit justified agent.
- [ ] Required content, security and review outcomes survive without the numbered chain.
- [ ] Shared/startup/root dispatch guidance conflicts from PR #779 are actually fixed and tested.
- [ ] Diagnostic/design/as-built/manual-review invocation and input-channel feedback has actual behavior coverage.
- [ ] Model labels and instruction globs are not treated as execution/attachment proof.
- [ ] Slice callers and tests stay consistent; unrelated roles/project history are untouched.

Return exact slice files/inputs, tests/native results, PR-comment evidence and rollback commit boundary.
Stop for new product/permission decisions; preserve compatibility readers and existing gates until replacement.
No merge, auto-merge, cloud changes or findings reset.
