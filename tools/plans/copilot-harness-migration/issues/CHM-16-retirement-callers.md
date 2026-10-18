## CHM-16: complete retirement callers and historical compatibility

GitHub: [#787](https://github.com/jonathan-vella/apex/issues/787).
Requirements: R1, R9, R12. Priority: P1.
Depends on: CHM-11, CHM-12, CHM-13, CHM-14, CHM-15.
Status: proposed implementation; only replacements already accepted may retire.

### Objective and inputs

Close all active callers and references for approved obsolete mechanisms.
Use CHM-09 per-asset dispositions, tested replacement results, current filesystem/discovery and actual
cross-language/dynamic consumers. INVESTIGATE or material content-gap rows are not deletion approval.

### Allowed scope and activities

Selected retired agent/entry/skill/meta assets and their direct descriptions, allowlists, handoffs,
registries/generated graphs/catalogs, workflow table/DAG, package aggregates/globs, hooks/CI,
tests/fixtures, schemas and local/published documentation references.
Read/update relevant `apex-docs` callers through CHM-07, not an invented local site.
Preserve archives, attribution/licenses, historical readers and existing project evidence.

1. Confirm the useful outcome has a working replacement or justified removal.
2. Trace code, prose, native discovery, npm globs, direct CI and Python/Node subprocess callers.
3. Remove active dependencies, including tests that lock obsolete archive wording, without rewriting archives.
4. Regenerate only owned outputs and correct current migration/changelog claims without inventing history.
5. Remove the retired active mechanism; verify no accidental discovery or unresolved caller remains.

### Validation and negative cases

Run `npm run validate:agents`, `npm run validate:agent-registry`, `npm run validate:skills`,
`npm run validate:explorer-graph`, `npm run lint:links` and targeted entrypoint/ownership/archive tests.
Escalate to affected tool-contract/CI aggregates when caller breadth requires it.
Test active retired route cannot resolve, historical fixture still reads, no duplicate MCP registration,
no broken direct CI/npm import and no cross-language evaluator orphan false positive.

### Acceptance and evidence

- [ ] Every retirement has explicit outcome/replacement, caller/test/docs closure and owner-approved disposition.
- [ ] Archive and protected project bytes remain unchanged; historical reader behavior is tested.
- [ ] Changelog/model-attestation feedback and remaining shared-guidance contradictions are actually closed.
- [ ] No active registry/description/handoff advertises retired roles or non-VS-Code supported runtimes.

Return exact retired/redirected paths, searches/caller evidence, tests and compatibility/rollback boundary.
Stop on hidden consumer, unread material or unclear license/provenance requirement.
No merge, auto-merge, deployment or historical finding/hash changes.
