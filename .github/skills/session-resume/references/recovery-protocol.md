<!-- ref:recovery-protocol-v1 -->

# Recovery Protocol

## Resume Detection Protocol

Every agent MUST execute this protocol as its **first action** (before reading
skills, templates, or predecessor artifacts):

```text
1. Check if `agent-output/{project}/00-session-state.json` exists
   ├─ NO  → Fresh start. Create state file from template. Proceed normally.
   └─ YES → Read it. Check steps.{my_step}.status:
            ├─ "pending"      → First run of this step. Set to "in_progress". Proceed normally.
            ├─ "in_progress"  → RESUME. Read sub_step field:
            │                    ├─ null → Step started but no sub-step recorded. Restart step.
            │                    └─ "phase_X_..." → Skip to that checkpoint. Do NOT re-read
            │                       files already listed in context_files_used.
            ├─ "complete"     → Step already done. Inform user. Offer to re-run or return.
            └─ "skipped"      → Step was skipped (e.g. Step 3). Proceed to next.
```

## Direct Invocation Detection

When an agent is invoked directly (not via Orchestrator), it must also check
whether PRIOR steps are complete:

```text
1. Read 00-session-state.json
2. For each step < my_step:
   ├─ "complete" or "skipped" → OK
   └─ "pending" or "in_progress" → WARN user that prerequisites may be incomplete.
      Offer to: (a) proceed anyway, (b) hand off to the Orchestrator.
```

## State Write Protocol

Agents update `00-session-state.json` at these moments:

1. **Step start**: Set `status: "in_progress"`, `started: {ISO timestamp}`
2. **Sub-step completion**: Update `sub_step` to the checkpoint name,
   append any new files to `artifacts`, update `updated` timestamp
3. **Step completion**: Set `status: "complete"`, `completed: {ISO timestamp}`,
   `sub_step: null`, finalize `artifacts` list
4. **Decision made**: Add to top-level `decisions` object
5. **Challenger finding**: Append unresolved `must_fix` titles to `open_findings`;
   remove resolved ones

> Always overwrite the file atomically (write complete JSON, not patches).
> Always update the `updated` field.

### Write Example (sub-step completion)

After completing Phase 2 (WAF assessment) in the Architect agent:

```json
{
  "steps": {
    "2": {
      "status": "in_progress",
      "sub_step": "phase_2_waf",
      "started": "2026-03-02T10:05:00Z",
      "artifacts": ["agent-output/{project}/02-architecture-assessment.md"],
      "context_files_used": ["00-session-state.json", "01-requirements.md"]
    }
  },
  "updated": "2026-03-02T10:15:00Z",
  "current_step": 2
}
```

## Orchestrator Integration

The Orchestrator agent has additional responsibilities:

1. **Project init**: Create `00-session-state.json` from template alongside
   the project directory. Set `project`, `branch`, initial `current_step: 1`.
2. **Gate transitions**: Update JSON state AND `00-handoff.md` at every gate.
   The JSON is the machine source of truth; the Markdown is for human review.
3. **Resume**: Read `00-session-state.json` FIRST (instant state recovery).
   Fall back to `00-handoff.md` → artifact scan only if JSON is missing.
4. **Routing**: Set `iac_tool` in JSON after Step 1 completes (determines
   which agent names populate steps 4-6).

## Portability

This skill is designed for reuse across projects:

- JSON schema is generic (no project-specific fields)
- Resume protocol works with any numbered step workflow
- Sub-step checkpoints are defined per agent, not per project
- Template file can be copied to bootstrap new workflows
