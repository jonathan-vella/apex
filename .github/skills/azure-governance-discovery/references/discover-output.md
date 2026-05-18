<!-- ref:discover-output-v1 -->

# `discover.py` Output Handling

`04g-Governance` Phase 1 calls
`.github/skills/azure-governance-discovery/scripts/discover.py` via
`run_in_terminal`. The script is pure ETL — never wrap it in a subagent.
This reference documents stdout shape, exit codes, anti-patterns, and
the discovery-signature persistence contract.

---

## Stdout shape

- **Line 1 only is structured** — a single JSON status object with
  fields `status`, `cache_hit`, `assignment_total`, `blockers`,
  `auto_remediate`, `exempted`.
- **Remaining lines are a human-readable Markdown preview for the
  user**. Do NOT pipe them back into the model. They are not for LLM
  re-ingestion.
- The script also writes a **`discovery_metadata` envelope** at the top
  of `agent-output/{project}/04-governance-constraints.json` (L0
  attestation). Do NOT hand-author this object. `discover.py` computes
  it deterministically (signature = `sha256` over stable-sorted
  `(policy_id, effect, scope, params)` tuples). Every downstream
  consumer (Planner, CodeGen, Deploy) reads it first.

## Exit codes ↔ status

| Exit | Status     | Action                                                                                  |
| ---- | ---------- | --------------------------------------------------------------------------------------- |
| 0    | `COMPLETE` | Proceed to Phase 2 (envelope self-check passed inside `discover.py`).                   |
| 1    | `PARTIAL`  | Present partial state to the user; ask whether to continue. Also emitted when the end-of-discovery self-check (re-fetch page 1 of `policyAssignments`) detected a count drift — see `discover.py` stderr for the drifted surface. |
| 2    | `FAILED`   | STOP and surface the error (typically `az login` needed).                               |
| 3    | bad args   | STOP and surface the error.                                                             |

## Bash history-expansion fix

Always prefix inline terminal commands containing `!` with `set +H &&`
to disable bash history expansion (otherwise `!` in JSON strings
triggers `event not found` errors). Already baked into the canonical
invocation in 04g body.

## Anti-patterns (HARD)

- Do NOT improvise discovery via `az rest`, `execution_subagent`, or
  inline Python REST scripts. ALL Azure Policy REST work goes through
  `discover.py`. If the script fails with exit code 2, surface the
  error — do not reinvent the discovery path.
- Do NOT call `mcp_azure-mcp_get_azure_bestpractices`. Governance
  discovers constraints from live Azure Policy data, not best-practice
  recommendations (~21 s overhead, irrelevant output).
- Do NOT read `tmp/{project}-governance-live.json`. That legacy
  intermediate wastes ~2–3 min on 920+ lines of raw data. The
  authoritative governance file is
  `agent-output/{project}/04-governance-constraints.json`.

## Discovery signature persistence (HARD)

After `discover.py` (or `render_cached_governance.py`) exits 0, persist
the signature so Phase 0.4 / Phase 2.7 can detect resume-eligibility on
the next invocation:

```bash
SIG=$(jq -r '.discovery_metadata.completeness_signature' \
  agent-output/{project}/04-governance-constraints.json)
apex-recall decide {project} --key discovery_signature --value "$SIG" --json
```

This MUST run on BOTH the live `discover.py` path and the cached
`render_cached_governance.py` path. The `05-IaC Planner` reads and
re-asserts the same key idempotently on entry; both writers are
registered in
[`tools/apex-recall/docs/decision-keys.md`](../../../../tools/apex-recall/docs/decision-keys.md).
