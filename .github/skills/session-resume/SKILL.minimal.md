<!-- digest:auto-generated from SKILL.md — do not edit manually -->

# Session Resume (Minimal)

State file: `agent-output/{project}/00-session-state.json`

Write moments: step start, sub-step done, step done, decision made, finding update.

Resume: read JSON → check `steps.{N}.status` → branch (pending/in_progress/complete/skipped).

Claim: check lock heartbeat → acquire → renew on sub-step → release on completion.

Read `SKILL.md` or `SKILL.digest.md` for full protocol.
