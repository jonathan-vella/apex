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
[`governance-drift-routing.md`](../../iac-common/references/governance-drift-routing.md),
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

If any check fails, proceed to Phase 0.45. **Signature drift OR TTL
expiry forces a full pass** — the prior Phase 2.7 confirmations against a
stale snapshot are NOT trusted (locked S3 decision: single clock;
confirmations age transitively with the snapshot they were recorded
against).
