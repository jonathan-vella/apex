<!-- ref:resume-checks-v1 -->

# Resume-Complete Short-Circuit (Step 3.5)

Phase 0.4 of `04g-Governance` checks whether Step 3.5 is already complete
before starting any discovery. Guards against cold-boot re-entry from
subagent dispatch, resumed sessions, or challenger re-invocation where the
current turn does not know prior work exists.

---

## Refresh override (non-skippable)

When the invocation prompt contains `Refresh Governance`, `re-run`, or
`rediscover`, OR when a downstream agent traversed the refresh handoff per
[`governance-drift-routing.md`](../../apex-iac-common/references/governance-drift-routing.md),
this short-circuit is **disabled**. Skip to Phase 1 and call
`discover.py --refresh` regardless of cache state.

## Short-circuit conditions (ALL must hold)

Skip to Phase 3 (Approval Gate) only if **every** check passes:

1. **Step status** — `apex-recall show <project> --json` returns
   `steps."3_5".status == "complete"`.
2. **Artifact presence** — both `04-governance-constraints.{md,json}`
   exist under `agent-output/{project}/`.
3. **Discovery status** — JSON `discovery_status == "COMPLETE"`.
4. **Envelope present** — JSON contains a non-empty `discovery_metadata`
   object.
5. **Signature match** — `discovery_metadata.completeness_signature`
   equals the cached `decisions.discovery_signature` value in the
   `apex-recall` snapshot.
6. **TTL fresh** —
   `age_days = (now - discovery_metadata.discovered_at) / 86400 <= discovery_metadata.ttl_days`
   (default `ttl_days = 7`).
7. **Confirmations reused** —
   `governance_gate_status.resolved_confirmations` already contains all
   three required topics: RG tag keys, allowed locations, RG/resource
   same-region. Phase 2.7 prior resolutions are reused only when the
   snapshot they were recorded against has NOT changed.
8. **No explicit refresh request** — the user did NOT ask for `refresh`,
   `re-run`, or `rediscover`.
9. **Review validity** — if constraints require reconciliation review, the completed review's
   `cache_inputs` match the current artifact, checklist, protocol, subagent, and model, and the reviewed
   architecture and governance inputs are unchanged with no unresolved blockers. Use the existing
   Findings Cache procedure; invocation counts and discovery signatures alone do not establish this.
   When the graph permits skipping review because no actionable constraints exist, preserve that exception.

If only review validity fails while discovery and confirmations remain valid, go to Phase 2.5
for reconciliation review; do not rediscover unchanged policy solely to refresh review evidence.
For other failed checks, proceed to Phase 0.45 subject to the refresh overrides below. **Signature drift OR TTL
expiry forces a full pass** — the prior Phase 2.7 confirmations against a
stale snapshot are NOT trusted (locked S3 decision: single clock;
confirmations age transitively with the snapshot they were recorded
against).

For TTL expiry or signature drift, bypass baseline selection and cached reuse;
go directly to Phase 1 with `discover.py --refresh`, even without an explicit
user refresh request. Obtain new confirmations against the fresh snapshot.
