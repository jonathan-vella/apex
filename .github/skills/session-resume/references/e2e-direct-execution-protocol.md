<!-- ref:e2e-direct-execution-protocol-v1 -->

# E2E Direct Execution Protocol

Fallback protocol for when agent delegation (`@agent` / `agent` tool) is
unavailable (e.g., invoked via `runSubagent` from a parent chat).

## Detection and Switch

If the first agent delegation attempt fails or the `agent` tool is not listed
in available tools, switch to direct execution mode for all subsequent steps.

## Direct Execution Mode

Execute each step inline by reading the corresponding agent definition
(`.github/agents/*.agent.md`) and its referenced skills, then performing the
work directly using available tools (file read/write, terminal, MCP, search, web).

Rules:

1. Read each step agent's skills before executing
2. Apply the same artifact templates, naming conventions, and validation gates
3. MCP tools are still required (Pricing, Draw.io, Governance when authenticated)
4. Log `"execution_mode": "direct"` in `00-session-state.json`
5. Add a lesson noting agent delegation was unavailable
6. Run isolation applies equally — do not read/copy artifacts from other runs

## Inline Challenger Reviews (Direct Mode)

When delegation is unavailable, perform challenger reviews inline:

1. Read `.github/agents/_subagents/challenger-review-subagent.agent.md`
2. Read `.github/skills/azure-defaults/references/adversarial-checklists.md`
3. Read the step's primary artifact end to end
4. Apply the `comprehensive` lens — challenge assumptions, find missing failure
   modes, verify governance compliance, check WAF alignment, hidden dependencies
5. Produce structured findings as valid JSON matching the challenger subagent
   output contract: `challenged_artifact`, `artifact_type`, `review_focus`,
   `pass_number`, `challenge_summary`, `compact_for_parent`, `risk_level`,
   `must_fix_count`, `should_fix_count`, `suggestion_count`, and `issues[]`
6. Save to `agent-output/{project}/10-challenger-step{N}.json`
7. If `must_fix` count > 0: re-execute the step with findings as correction context

## Post-Review Gate (Both Modes)

After every review (delegated or inline):

1. Save challenger JSON to `agent-output/{project}/10-challenger-step{N}.json`
2. Update `review_audit.step_{N}` in `00-session-state.json`:
   ```json
   {
     "passes_executed": 1,
     "lens": "comprehensive",
     "must_fix": 0,
     "should_fix": 2,
     "suggestion": 1,
     "execution_mode": "direct"
   }
   ```
3. Gate check: before moving to the next step, verify both:
   - `review_audit.step_{N}.passes_executed >= 1` in session state
   - `10-challenger-step{N}.json` file exists

Steps 1, 2, 3.5, 4, 5, and 6 require challenger reviews. Every review produces
a persisted JSON file.
