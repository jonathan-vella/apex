---
description: "Test adversarial review (challenger-review-subagent) integration (TS-13)"
agent: "agent"
tools:
  - agent
  - execute/runInTerminal
  - read/readFile
  - edit/createFile
  - search/listDirectory
  - search/textSearch
argument-hint: "Provide the test project name for adversarial review validation"
---

# Test: Adversarial Review — Challenger Subagent (TS-13)

Run test suite TS-13 from the Terraform E2E test plan to validate the
`challenger-review-subagent` definition, parent agent wiring, multi-pass
rotation logic, and documentation integration.

## Mission

Verify the adversarial review system works correctly across the full
7-step workflow: subagent definition is valid, all parent agents wire to
it correctly, 3-pass rotation follows the prescribed lens order, and
documentation reflects the review column accurately.

## Scope & Preconditions

- Read `docs/tf-tests/terraform-e2e-test-plan.md` section TS-13
- `npm install` must be completed (for frontmatter validator)
- For standalone invocation tests (TS-13B-05): Azure auth may be
  needed if the challenger reads Azure resources
- Agent definition files must exist under `.github/agents/`

## Inputs

| Variable               | Description             | Default  |
| ---------------------- | ----------------------- | -------- |
| `${input:projectName}` | Test project for review | Required |

## Workflow

### Phase A: Subagent Definition (TS-13A-01 — TS-13A-10)

1. Run `npm run lint:agent-frontmatter` — confirm
   `challenger-review-subagent` passes
2. Read `.github/agents/_subagents/challenger-review-subagent.agent.md`
3. Verify frontmatter: `user-invokable: false`, `agents: []`,
   tools include `read`, `search`, `web`, `azure-mcp/*`
4. Verify body sections: Inputs (6 params), Review Focus Lenses (4),
   Severity Levels (3), Output Format (JSON schema), Artifact Types (7)
5. Verify skill loading mandate: `azure-defaults`, `azure-artifacts`,
   `bicep-policy-compliance`

### Phase B: 10-Challenger Wrapper (TS-13B-01 — TS-13B-05)

1. Read `.github/agents/10-challenger.agent.md`
2. Verify `agents: ["challenger-review-subagent"]`
3. Verify body: filename-to-artifact_type table (7 entries),
   delegates with `review_focus="comprehensive"`, `pass_number=1`
4. Verify writes to `agent-output/{project}/challenge-findings-*.json`
5. If feasible, invoke `10-Challenger` on a test artifact in
   `agent-output/${input:projectName}/` and verify JSON output

### Phase C: Parent Agent Wiring (TS-13C-01 — TS-13C-13)

For each parent agent, verify:

1. **02-requirements** — `agents` includes `challenger-review-subagent`;
   1x comprehensive review
2. **03-architect** — 3x architecture + 1x cost-estimate review
3. **05t-terraform-planner** — 1x governance + 3x implementation-plan
4. **05b-bicep-planner** — same as 05t (parity check)
5. **06t-terraform-codegen** — 3x iac-code; must_fix re-lint loop
6. **06b-bicep-codegen** — same as 06t (parity check)
7. **07t-terraform-deploy** — 1x comprehensive deployment-preview
8. **07b-bicep-deploy** — same as 07t (parity check)

### Phase D: Multi-Pass Rotation (TS-13D-01 — TS-13D-07)

1. Pick any 3-pass agent (05t or 03-architect) and verify:
   - Pass 1 = `security-governance`, Pass 2 = `architecture-reliability`,
     Pass 3 = `cost-feasibility`
   - `pass_number` increments 1 → 2 → 3
   - `prior_findings` chains: null → pass1 → pass1+2
2. Verify output file naming: `-pass1.json`, `-pass2.json`, `-pass3.json`
3. Verify single-pass agents (02, 07t) use NO `-pass{N}` suffix
4. Verify deduplication rule in subagent body
5. Verify approval gates merge all pass findings

### Phase E: Conductor & Documentation (TS-13E-01 — TS-13E-06)

1. Read `01-conductor.agent.md` — verify subagent table rows and
   Gate 1 references `challenge-findings-requirements.json`
2. Read `agent-definitions.instructions.md` — verify
   `challenger-review-subagent` in subagents table
3. Read `.github/copilot-instructions.md` — verify Review column
4. Read `AGENTS.md` — verify Review column and subagent count (9)

### Final: Update Test Tracker

Update TS-13 row in the **Test Execution Tracker** in
`docs/tf-tests/terraform-e2e-test-plan.md`.

## Output Expectations

Summary per sub-suite:

```text
TS-13 ADVERSARIAL REVIEW RESULTS
═════════════════════════════════
TS-13A: Subagent Definition      — [PASS/FAIL] (X/10)
TS-13B: 10-Challenger Wrapper    — [PASS/FAIL] (X/5)
TS-13C: Parent Agent Wiring      — [PASS/FAIL] (X/13)
TS-13D: Multi-Pass Rotation      — [PASS/FAIL] (X/7)
TS-13E: Conductor & Docs         — [PASS/FAIL] (X/6)

Overall: [PASS/FAIL] — X/41 tests passed
```
