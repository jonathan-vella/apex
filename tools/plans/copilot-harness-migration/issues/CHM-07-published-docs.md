## CHM-07: align proposed and verified documentation

GitHub: [#774](https://github.com/jonathan-vella/apex/issues/774).
Requirements: R8, R9. Priority: P1. Depends on: CHM-17 and CHM-18 for final acceptance.
Implementation is authorized; unverified pilot/deployment claims and site publication are not.
Companion: [jonathan-vella/apex-docs#43](https://github.com/jonathan-vella/apex-docs/pull/43), issue #40 there.

### Objective and inputs

Keep the existing documentation PR aligned with APEX #779, this PRD/backlog/roadmap and the actual
proposed-versus-verified state. Read the docs repository's own instructions and existing relevant pages.
Do not create a second plan system, an APEX site directory or claim publication from a comment.

### Allowed changes and behavior

Relevant setup, workflow/agents, debug/export, migration/troubleshooting and proposed release-note pages in
the authorized `docs/copilot-sdk-harness-cutover` branch only.
Preserve existing public anchors and distinguish current production behavior from the proposed target.
Feature-branch commits/pushes, issue/PR updates and relevant reviewer fixes are authorized.
No merge, auto-merge, publication, credential switching or unrelated docs refactor.

### Required coverage

- VS Code Copilot-only target, with historical Local archives inactive and no standalone CLI/cloud support claim.
- Optional lead/domain skills/native review, tested adapters and genuine approval/credential separation as proposals.
- Autopilot routine engineering autonomy and the fact that chat auto-answers are not human approval.
- Durable project governance distinct from native session SQL; genuine scoped evidence and missing usage as UNKNOWN.
- Owner approval before implementation, representative no-cloud pilot and final E2E still required.
- Existing unresolved external-link/runtime gaps disclosed, not silently waived.

### Validation and acceptance

Use actual `apex-docs` commands: `npm run check:docs`, `npm run build`, `npm run check:links`,
and focused existing tests for edited content/anchors. Test changed external links where relevant;
preserve unchanged HTTP/access failures explicitly instead of weakening checks.

- [ ] Current proposal docs and both PR descriptions agree on scope, status and no-merge boundary.
- [ ] No future role/command/pilot is described as shipped or accepted.
- [ ] Existing anchors, truthful historical statements and relevant tests remain intact.
- [ ] Final verified behavior is updated only after CHM-17 evidence, with docs checks on the actual head.
- [ ] Issue/PR state and validation are linked; neither opening nor pushing means published.

Return paths, exact commands/results, feature commit, review dispositions and publication state.
Rollback only this docs change; retain old anchors/readers where promised.
Stop for missing checkout/authority or missing runtime evidence for a verified claim.
