## APEX vNext Register

This register contains high-signal release and project concerns. GitHub Issues own executable work state. Replace
`Pending` related-issue values with issue links during the GitHub bootstrap, and add closure proof before closing an
entry.

Allowed entry types are `RISK`, `ASSUMPTION`, `ISSUE`, `DEPENDENCY`, `DEFECT`, and `REGRESSION`.

## Open Entries

### RISK-001: Exact-Head Integration Checks Are Red

- **Type:** `RISK`
- **Owner:** Release engineering
- **Impact:** Cutover and any baseline tag remain blocked.
- **Evidence:** PR #533 at `7fc27966`; CI, docs, devcontainer summary, and CodeQL checks are failing.
- **Related issue:** [#537](https://github.com/jonathan-vella/apex/issues/537),
  [#538](https://github.com/jonathan-vella/apex/issues/538),
  [#539](https://github.com/jonathan-vella/apex/issues/539), and
  [#540](https://github.com/jonathan-vella/apex/issues/540)
- **Mitigation:** Resolve each product failure separately, then rerun required checks on the exact integration head.
- **State:** Open
- **Closure proof:** Required-check URLs showing success on the candidate SHA.

### RISK-002: Terraform CI Plan Transport Is Not Qualified

- **Type:** `RISK`
- **Owner:** Terraform runtime
- **Impact:** Production Terraform CI apply cannot be enabled.
- **Evidence:** [Security documentation](../../site/src/content/docs/vnext/security.md) limits support to local exact-plan
  operation; `REQ-TERRAFORM-001` requires recipient-bound encrypted transport.
- **Related issue:** [#544](https://github.com/jonathan-vella/apex/issues/544)
- **Mitigation:** Prove encrypted, expiring, recipient-bound plan transport and exact-plan apply in GitHub Actions.
- **State:** Open
- **Closure proof:** Live CI evidence bound to the approved preview, head, lineage, serial, and recipient.

### RISK-003: GitHub Project Access Is Unavailable To The Current Token

- **Type:** `RISK`
- **Owner:** Repository maintainer
- **Impact:** The `APEX vNext` planning view, fields, and views cannot be inspected or created in this execution.
- **Evidence:** `gh project list --owner jonathan-vella` returned `Resource not accessible by personal access token` on
  2026-07-14.
- **Related issue:** [#541](https://github.com/jonathan-vella/apex/issues/541)
- **Mitigation:** Grant the token Projects read/write scope or create the project through an authorized maintainer session.
- **State:** Blocked
- **Closure proof:** Project URL and verified field and view inventory.

### ASSUMPTION-001: VS Code Handoff Topology Is Supported

- **Type:** `ASSUMPTION`
- **Owner:** VS Code experience
- **Impact:** Failure would require more agents to remain picker-visible and would change the intended user experience.
- **Evidence:** The managed customization manifest validates invocation edges, but no fresh supported VS Code evidence is
  bound to the current candidate.
- **Related issue:** [#543](https://github.com/jonathan-vella/apex/issues/543)
- **Mitigation:** Run direct handoff, hidden worker, model-tier, and `askQuestions` scenarios in a clean supported VS Code.
- **State:** Open
- **Closure proof:** Versioned manual qualification evidence on the exact candidate head.

### DEPENDENCY-001: Phase 0A Evidence Remains Frozen

- **Type:** `DEPENDENCY`
- **Owner:** Product governance
- **Impact:** Editing the baseline would invalidate approved compatibility and defect dispositions.
- **Evidence:** [Phase 0A baseline](phase-0a/README.md) and its sealed evidence manifest.
- **Related issue:** Not applicable
- **Mitigation:** Treat `docs/vnext/phase-0a/**` as read-only and express later decisions in this project document set.
- **State:** Active
- **Closure proof:** Retained through cutover; no closure expected before archival.

### DEPENDENCY-002: Existing Integration Branch Supersedes The Deferred-Branch Assumption

- **Type:** `DEPENDENCY`
- **Owner:** Repository maintainer
- **Impact:** Delivery topology differs from the Phase 0A sequencing note but preserves its no-cutover boundary.
- **Evidence:** PR #533 is open and draft from `feat/apex-vnext-rewrite`; [DECISION-002](DECISIONS.md#decision-002-use-the-existing-integration-branch).
- **Related issue:** [#536](https://github.com/jonathan-vella/apex/issues/536)
- **Mitigation:** Use issue branches and pull requests into the integration branch; keep `main` on v1.
- **State:** Accepted
- **Closure proof:** Final exact-head cutover decision and merge history.

### DEFECT-001: CI Lint Resolves Unbuilt Generated Packages

- **Type:** `DEFECT`
- **Owner:** Validation and CI
- **Impact:** The required `ci` check fails before vNext qualification can run.
- **Evidence:** CI run `29274684761` reports unresolved imports for `packages/testkit/dist/index.js` and
  `packages/renderers/dist/index.js` from `tools/scripts/qualify-vnext.mjs`.
- **Related issue:** [#538](https://github.com/jonathan-vella/apex/issues/538)
- **Mitigation:** Align lint with the build graph or avoid generated-only imports while preserving focused diagnostics.
- **State:** Open
- **Closure proof:** Regression test and successful required CI check on the fixing SHA.

### DEFECT-002: vNext Documentation Contains Broken Relative Links

- **Type:** `DEFECT`
- **Owner:** Documentation
- **Impact:** Docs checks and every devcontainer matrix leg fail.
- **Evidence:** Docs run `29274684657` reports broken links among CLI, installation, operations, security, testing, and
  workflow pages; devcontainer run `29274685239` fails only its internal `validate-all` link check on every leg.
- **Related issue:** [#539](https://github.com/jonathan-vella/apex/issues/539)
- **Mitigation:** Correct cross-page links and retain strict link validation.
- **State:** Open
- **Closure proof:** Link regression coverage and successful docs and devcontainer checks on the fixing SHA.

### REGRESSION-001: CodeQL Detects Polynomial ReDoS In IaC Generation

- **Type:** `REGRESSION`
- **Owner:** Capabilities and security
- **Impact:** High-severity security finding blocks cutover.
- **Evidence:** CodeQL alert #34, `js/polynomial-redos`, in `packages/capabilities/src/iac-generation.ts` at the PR head.
- **Related issue:** [#537](https://github.com/jonathan-vella/apex/issues/537)
- **Mitigation:** Replace vulnerable matching with bounded parsing and add adversarial long-input tests.
- **State:** Open
- **Closure proof:** Regression test, closed alert #34, and successful CodeQL check on the fixing SHA.

### DEFECT-003: Package Clean-Install Test Times Out And Leaks Its Child

- **Type:** `DEFECT`
- **Owner:** Release engineering
- **Impact:** `npm run qualify:vnext` cannot complete and package clean-install evidence is unavailable.
- **Evidence:** On 2026-07-14, `test:vnext-pack` produced tarballs, SBOM, provenance, and manifest, then timed out at
  180 seconds during consumer `npm install`; the child remained alive until the execution terminated it after 544 seconds.
- **Related issue:** [#540](https://github.com/jonathan-vella/apex/issues/540)
- **Mitigation:** Add abort-aware subprocess cleanup, preserve bounded diagnostics, and determine why local tarball install
  stalls.
- **State:** Open
- **Closure proof:** Deterministic timeout regression test and successful clean-install pack test.

### ISSUE-001: Live Qualification Evidence Is Unavailable

- **Type:** `ISSUE`
- **Owner:** Release qualification
- **Impact:** VS Code, GitHub approval, Azure Bicep, and Azure Terraform release claims remain unavailable.
- **Evidence:** Deterministic suites pass, but no exact-head live evidence satisfies [PRD.md](PRD.md) cutover acceptance.
- **Related issue:** [#543](https://github.com/jonathan-vella/apex/issues/543)
- **Mitigation:** Prepare scripts and templates, then run or hand off user-owned scenarios after automated gates are green.
- **State:** Open
- **Closure proof:** Evidence index with candidate and dependency hashes for every required scenario.

### ISSUE-002: Scorecard Sample Requirements Are Not Satisfied

- **Type:** `ISSUE`
- **Owner:** Quality engineering
- **Impact:** Required release metrics remain blocking or unclaimable.
- **Evidence:** [quality-scorecard.v1.json](../../config/quality-scorecard.v1.json) requires repeated samples; current tests
  prove deterministic evaluation but do not provide the release sample set.
- **Related issue:** [#542](https://github.com/jonathan-vella/apex/issues/542)
- **Mitigation:** Produce repeated mutation, fault, restart, context, cache, and capability measurements.
- **State:** Open
- **Closure proof:** Scorecard artifacts satisfying every minimum-sample and unavailable-data rule.

## Closed Or Historical Entries

The approved v1 defect ledger remains in [phase-0a/v1-known-defects.md](phase-0a/v1-known-defects.md). Do not duplicate
or renumber those historical entries here. New vNext defects use this register and a linked GitHub issue.
