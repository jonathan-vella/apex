## Roadmap: VS Code Copilot-only delivery

**Current gate: OWNER PLAN APPROVAL PENDING.**
This revision authorizes planning/issue/PR alignment only, not a pilot or implementation.
Both feature PRs remain open and unmerged; auto-merge is prohibited.
Use the [PRD](prd.md), [backlog](backlog.md) and [execution contract](execution-contract.md).

### Wave 0: align and approve the plan

- Preserve CHM-01/#769 and CHM-02/#771 as closed historical work.
- Reframe the existing open issues rather than create a competing migration backlog.
- Register the bounded simplification packets and their dependencies.
- Update APEX #779, `jonathan-vella/apex-docs#43`, relevant issues and the review register.
- Keep the recovery assessment, withdrawn evidence and archived plan intact.

Exit: **owner approves the revised plan**. A planning commit, issue state or green CI is not that approval.

### Wave 1: establish the smallest runtime proof

1. CHM-09 selects asset dispositions and closes material pilot gaps.
2. CHM-03 verifies native VS Code Copilot discovery/lifecycle and CHM-05 verifies relevant MCP/hooks.
   These may proceed in parallel with disjoint fixtures.
3. CHM-10 proves the independently approved no-op execution boundary.
4. CHM-04 exercises a representative no-cloud lead/skill/reviewer workflow.

Exit: genuine target-runtime evidence for positive/negative cases; owner accepts the pilot before fleet changes.
Do not probe every legacy worker with a handshake or start the old Azure workflow to certify this architecture.

### Wave 2: simplify in bounded engineering slices

- CHM-15 separates native structural/domain checks from prose conventions.
- CHM-11 converts one conversational role at a time to the accepted lead/skill model.
- CHM-12 moves deterministic leaf work into tested language-specific adapters.
- CHM-13 consolidates review, then CHM-14 simplifies durable state behind compatible readers.
- CHM-16 closes all active retirement callers and references after replacements work.

CHM-11 and CHM-13 may run independently after their prerequisites, but not edit shared files concurrently.
CHM-12 and CHM-14 can proceed in separate tool/state lanes.
Each packet delivers a tested feature-branch change and updates its PR; no repeated confirmation for in-scope fixes.
Owner decisions are batched when independent, not multiplied by legacy phase boundaries.

Exit: accepted replacements preserve Azure outcomes and historical evidence; no active caller relies on retirement.

### Wave 3: verify the final VS Code experience

- CHM-06 validates genuine evidence handling and optional usage coverage.
- CHM-17 runs final no-Azure-write E2E on the resulting candidate, including Autopilot, review and recovery.
- Rerun only affected checks after changes; finish with current source/remote validation.

Exit: final-candidate behavior is evidenced, not inferred from earlier pilot or fixture passes.
Missing required behavior is BLOCKED; missing optional telemetry is explicitly UNKNOWN.

### Wave 4: align documentation and hand off

- CHM-07 may prepare proposal documentation throughout, but final acceptance follows CHM-17.
- Run the actual `apex-docs` content/link/build checks and address its PR feedback.
- CHM-08 assembles requirements, issue state, source/runtime evidence, review dispositions and both PR heads.

Exit: READY_FOR_OWNER_REVIEW or BLOCKED, with precise remaining decisions.
No merge, publishing or Azure deployment follows automatically.

### Optional later work

Measured model-tier/performance comparisons, generic skill-pack rationalization, stronger externally enforced
audit integration and a real-Azure E2E are separate owner-scoped work, not hidden prerequisites.
Real-Azure E2E needs explicit subscription, budget, write/cleanup authority and functional/private-connectivity tests.
The retired E2E launcher is not recreated by this plan.

### Replanning and failure rules

Update the existing issue packet, backlog, roadmap and PR when dependencies or scope change.
Keep old evidence attributable; do not change hashes or findings to match a new candidate.
Technical failures get bounded repair and targeted revalidation; unresolved authority stays a human decision.
Neither a passed packet nor final readiness authorizes merging into `main`.
