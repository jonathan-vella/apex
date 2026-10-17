## CHM-07: publish verified Copilot harness migration guidance

Related: [PR #767](https://github.com/jonathan-vella/apex/pull/767).
GitHub: [#774](https://github.com/jonathan-vella/apex/issues/774).
Requirement: R8. Priority: P1. Depends on: CHM-06 (#768).
Suggested executor: documentation coding agent with an explicitly authorized `apex-docs` checkout.

### Objective and inputs

Update the separate [documentation repository](https://github.com/jonathan-vella/apex-docs) to describe
verified SDK harness behavior and the cutover from Local entrypoints.
Use the candidate revision, current APEX instructions and skill references, CHM-03 through CHM-06 evidence,
the documentation repository's instructions, and relevant existing pages under `src/content/docs/`.
Historical APEX baseline: `ee2712cc341ad0cc19a4b21ba9bf3701ce5aefcd`.

### Allowed changes and prerequisites

Read APEX source; write only relevant setup, workflow, migration, troubleshooting, log-export,
and release-note pages in the approved `apex-docs` checkout.
Do not create an APEX `site/` directory or duplicate published product documentation inside APEX.
Before changing repositories, the parent supplies the checkout, approved branch, and any publication permission.
Do not commit, push, create a documentation PR, or publish a site without explicit authorization for that action.

### Activities

1. Inventory current documentation pages and link each proposed change to verified source or runtime evidence.
2. Document canonical manual skills, human-selected Orchestrator, parent-mediated forms,
   main/leaf boundaries, fail-closed readiness, and definition-owned routing without claiming model eligibility.
3. Document actual VS Code MCP projection, required operator prerequisites, native capture/export,
   explicit resume, approval stops, and historical prompt archival.
4. Explain unsupported runtime behavior and recovery without inventing a universal `/resume` guarantee.
5. Add user-facing migration notes and known limitations; remove active Local-only instructions
   while preserving intentionally historical material.
6. Run the documentation repository's own applicable build, link, formatting, and content checks.
7. Return the patch and validation; if publication is approved, link the actual documentation PR or revision.

### Acceptance criteria

- [x] Every behavior claim is traceable to current source and accepted runtime evidence.
- [x] Setup, entrypoints, forms, delegation, MCP, telemetry, recovery, and approval boundaries are covered.
- [x] No false parity, automatic approval, complete billing, or unsupported routing claim remains.
- [x] Relevant documentation checks pass with recorded commands and exit codes.
- [x] Release notes explain the cutover and remaining limitations.
- [x] A reviewed documentation PR or published revision is linked (`jonathan-vella/apex-docs#40`) before final release acceptance.

### Return and stop conditions

Return changed documentation paths, validation results, evidence links, and publication state.
Preparation may start with an inventory earlier, but acceptance requires completed CHM-06 evidence.
If the checkout, permissions, or runtime evidence is missing, return the blocker; do not invent a repository path,
publish elsewhere, or mark the documentation delivered.
