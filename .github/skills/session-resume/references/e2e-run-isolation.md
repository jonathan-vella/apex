<!-- ref:e2e-run-isolation-v1 -->

# E2E Run Isolation Rules

Each E2E run MUST produce independently generated artifacts. Copying, cloning,
or adapting artifacts from other runs is strictly prohibited.

## Prohibited Actions

- **NEVER** read files from `agent-output/{other-project}/` where
  `{other-project}` is not the current run's project name
- **NEVER** read files from `infra/bicep/{other-project}/` or
  `infra/terraform/{other-project}/`
- **NEVER** read `agent-output/_baselines/` to use as copy sources
  (baselines are for benchmark scoring scripts only)
- **NEVER** copy an artifact from one run directory to another and
  find-replace the project name
- **NEVER** reuse `decision_log` entries (including timestamps) from a
  different run

## Allowed Cross-Run Reads

- Reading shared templates: `.github/skills/`, `.github/agents/`,
  `.github/instructions/`
- Reading the RFQ input: `tests/e2e-inputs/`
- Reading prompt definitions: `tests/prompts/`, `.github/prompts/`
- Reading validation scripts: `scripts/`
- Reading the current run's own `agent-output/{project}/` artifacts
  for downstream steps (e.g., Step 2 reads Step 1's output)

## Timestamp Coherence

- All `decision_log[].timestamp` values MUST fall between the run's
  `started` timestamp and the current wall-clock time
- All `steps[].started` and `steps[].completed` values MUST be
  monotonically increasing and within the run's time window
- `08-iteration-log.json` timestamps MUST reflect actual execution,
  not fabricated round-number durations

## Post-Step Freshness Verification

After each step produces artifacts, the orchestrator MUST verify freshness
if other runs exist in `agent-output/`:

1. List other `contoso-service-hub-*` directories under `agent-output/`
2. For each primary artifact produced by the current step, check whether
   a byte-identical file exists in any other run directory
3. If a byte-identical match is found: the artifact is INVALID. Delete it,
   log a `run-isolation-violation` lesson, and re-execute the step
4. Minor differences (only project name substitution) also count as copies

> **ENFORCEMENT**: A run where >50% of artifacts are byte-identical to an
> existing run is fraudulent and must be terminated with status
> `E2E_BLOCKED` and reason `run-isolation-violation`.
