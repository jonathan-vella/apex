# Nordic-foods replay fixtures

Phase J of the nordic-foods lessons plan. These fixtures power two
test modes:

- **J5 per-PR**: `tests/fixtures/nordic-foods-replay/expected-transcript.md`
  is the canonical "good" transcript; `tests/fixtures/nordic-foods-replay/transcript.spec.mjs`
  greps it for the forbidden patterns from J2 and the affirmative
  checks from J3. Runs on every PR — cheap, deterministic.
- **J1 nightly**: a CI workflow (`.github/workflows/replay-nordic-foods.yml`,
  authored separately) spawns a fresh sandbox project, runs Steps
  1 → 6, captures the live chat transcript, and replays J2/J3 against
  it. Per-PR cost is mitigated by recording the live transcript only
  on `main` schedule + on-demand `workflow_dispatch`.

## Forbidden patterns (J2)

Every string in `forbidden-patterns.json` must be **absent** from any
transcript:

| Pattern | Origin |
| ------- | ------ |
| `Reply approve.*hand off to.*IaC Planner` | nordic-p1 architect |
| `INVALID_XML` | nordic-p1 drawio |
| `Cannot iterate over null` | nordic-p1 bicep-deploy |
| `4 PascalCase tag baseline` | nordic-p1 governance |
| `Must the resource group.*same region` | nordic-p1 governance |
| `failed to decode message.*surrogate` | nordic-p1 drawio |

## Affirmative checks (J3)

Every check in `affirmative-checks.json` must be **present**:

- SKU confirmation panel before any `cost-estimate-subagent` call.
- Budget gate iff design exceeds budget.
- Per-finding askMe (question count == finding count).
- Drawio chosen by default when D1 fires.
- Governance Phase 2.7 with exactly 2 questions.

## Acceptance criterion

All forbidden patterns absent AND all affirmative checks pass. Failure
on the per-PR check means the recorded fixture itself drifted; failure
on the nightly live replay means a regression in agent behaviour —
revisit the relevant phase of the lessons plan.
