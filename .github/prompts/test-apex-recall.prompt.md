---
name: "Test apex-recall"
description: "Step-by-step test plan for the apex-recall CLI"
agent: "agent"
tools: ["runInTerminal"]
---

# Test Plan: apex-recall CLI

Step-by-step validation of the apex-recall feature across all phases.
Three stages: automated (run now), synthetic data (run now), and live workflow (run after a real project).

---

## Stage 1 — Automated Tests (run now, no data needed)

These all pass today with synthetic fixtures. Run them to confirm nothing has regressed.

### Step 1: Unit tests

```bash
python -m pytest tests/test_apex_recall/ -v
```

**Expected**: 43 tests pass. Covers indexer logic, all 7 commands, edge cases (malformed JSON, empty corpus, nonexistent project).

### Step 2: Python lint

```bash
cd tools/apex-recall && python -m ruff check src/
```

**Expected**: All checks passed.

### Step 3: npm wired validation

```bash
npm run test:apex-recall
npm run lint:python
```

**Expected**: Both pass. Confirms the wiring in `package.json` is correct.

### Step 4: Full validation suite

```bash
npm run validate:all
```

**Expected**: All validations passed. Confirms apex-recall doesn't break any existing checks.

### Step 5: Markdown and docs

```bash
npm run lint:md
npm run lint:docs-freshness
```

**Expected**: Zero errors, zero freshness findings.

---

## Stage 2 — Synthetic Data Smoke Test (run now)

Create a realistic project under `agent-output/` to test the full CLI against real-looking data without running the actual workflow.

### Step 6: Create synthetic project data

```bash
mkdir -p agent-output/test-smoke

cat > agent-output/test-smoke/00-session-state.json << 'EOF'
{
  "schema_version": "3.0",
  "project": "test-smoke",
  "iac_tool": "Bicep",
  "region": "swedencentral",
  "branch": "feat/test-smoke",
  "updated": "2026-04-22T10:00:00Z",
  "current_step": 3,
  "decisions": {
    "region": "swedencentral",
    "compliance": "GDPR",
    "budget": "EUR 500/mo",
    "architecture_pattern": "hub-spoke",
    "deployment_strategy": "phased",
    "complexity": "standard"
  },
  "open_findings": ["WAF: no disaster recovery plan"],
  "decision_log": [
    {
      "step": 1,
      "decision": "Hub-spoke network topology",
      "rationale": "Isolates workloads, central firewall",
      "timestamp": "2026-04-22T08:00:00Z"
    },
    {
      "step": 2,
      "decision": "App Service Plan B1 over Container Apps",
      "rationale": "Budget constraint, no container expertise",
      "timestamp": "2026-04-22T09:00:00Z"
    }
  ],
  "steps": {
    "1": { "status": "complete" },
    "2": { "status": "complete" },
    "3": { "status": "in_progress", "sub_step": "phase_3_design" }
  }
}
EOF

cat > agent-output/test-smoke/01-requirements.md << 'EOF'
# Requirements

## Functional Requirements
- Web application with user authentication
- REST API backend on App Service
- SQL Database for persistence

## Non-Functional Requirements
- GDPR compliance for EU data residency
- Budget under EUR 500/month
- 99.9% availability SLA
EOF

cat > agent-output/test-smoke/02-architecture-assessment.md << 'EOF'
# Architecture Assessment

## WAF Pillar Analysis

### Security
- Managed Identity for all service-to-service auth
- Key Vault for secrets management
- TLS 1.2 minimum

### Reliability
- Zone-redundant App Service Plan
- SQL Database geo-replication (future)

### Cost Optimization
- B1 App Service Plan fits EUR 500/mo budget
- Reserved instances recommended for production
EOF

cat > agent-output/test-smoke/00-handoff.md << 'EOF'
# Handoff

Step 3 (Design) in progress. Architecture approved.
Next: complete design diagrams, then proceed to IaC planning.
EOF
```

### Step 7: Reindex and verify health

```bash
apex-recall reindex --json
apex-recall health --json
```

**Expected**:

- reindex: `{"reindexed": true, "artifacts": 4}`
- health: `db_exists: true`, `total_artifacts: 4`, `total_projects: 1`, `projects: ["test-smoke"]`, `stale: false`, `schema_ok: true`

### Step 8: Test Tier 1 — orientation

```bash
apex-recall sessions --json --limit 5
apex-recall files --json --limit 5
```

**Expected**:

- sessions: 1 entry with `project: "test-smoke"`, `current_step: 3`, `iac_tool: "Bicep"`, `complexity: "standard"`
- files: 4 entries ordered by modification time, each with project/file/type/step fields

### Step 9: Test Tier 2 — targeted search

```bash
apex-recall search 'GDPR' --json
apex-recall search 'hub-spoke' --json
apex-recall search 'nonexistent-term-xyz' --json
apex-recall decisions --json --project test-smoke
```

**Expected**:

- GDPR search: hits in requirements and/or architecture
- hub-spoke: hits in session-state and/or architecture
- nonexistent: empty array `[]`
- decisions: entries from both `decisions` object and `decision_log` array

### Step 10: Test Tier 3 — full project dump

```bash
apex-recall show test-smoke --json
```

**Expected**: JSON with `project`, `session` (including decisions, open_findings, decision_log), `artifacts` array (4 items), `artifact_count: 4`.

### Step 11: Test token budget

```bash
# Tier 1 should be compact
apex-recall sessions --json --limit 5 | wc -c
apex-recall files --json --limit 5 | wc -c
```

**Expected**: Each output under ~500 characters (well within the ~50-token target for Tier 1).

### Step 12: Test empty result fallback

```bash
apex-recall show nonexistent-project --json
apex-recall search 'impossible-term-abc123' --json
apex-recall decisions --json --project nonexistent-project
```

**Expected**: All return empty structured results (empty arrays/objects), exit code 0, no crashes.

### Step 13: Test auto-reindex on stale data

```bash
# Add a new file after indexing
echo "# Governance" > agent-output/test-smoke/04-governance-constraints.md

# Run a query (should auto-detect staleness and reindex)
apex-recall files --json --limit 5
```

**Expected**: 5 artifacts returned (the new file is included without manual reindex).

### Step 14: Clean up synthetic data

```bash
rm -rf agent-output/test-smoke
apex-recall reindex --json
```

**Expected**: `{"reindexed": true, "artifacts": 0}`

---

## Stage 3 — Live Workflow Integration (run after a real project)

These tests validate that the session-resume skill integration works as intended.
Run them after completing at least Steps 1-2 of a real project via the Orchestrator.

### Step 15: Index real project data

```bash
apex-recall reindex --json
apex-recall health --json
```

**Expected**: Non-zero artifact count, project name matches the real project.

### Step 16: Verify progressive disclosure with real data

```bash
# Tier 1
apex-recall sessions --json --limit 5
apex-recall files --json --limit 10

# Tier 2
apex-recall search 'security' --json
apex-recall decisions --json

# Tier 3
apex-recall show <project-name> --json
```

**Expected**: Meaningful results from real artifacts. Decisions reflect actual choices made during the workflow.

### Step 17: Test session-resume skill integration

1. Open VS Code Chat (`Ctrl+Shift+I`)
2. Select the **Orchestrator** agent
3. Ask it to resume or start a step for the project
4. **Observe**: Does the agent invoke `apex-recall sessions` or `apex-recall files` as its first action?
5. **Observe**: Does it escalate to Tier 2/3 only when it needs more context?
6. **Observe**: If apex-recall returns empty results, does it fall back to reading artifact files directly?

**Expected**: The agent follows the progressive disclosure protocol documented in the session-resume skill.

### Step 18: Test cross-project recall (needs 2+ projects)

After running the workflow for a second project:

```bash
apex-recall sessions --json
apex-recall files --json --limit 20
apex-recall search 'hub-spoke' --json
```

**Expected**: Results span both projects. Sessions list both. Search finds matches across projects.

---

## Stage 4 — Devcontainer Rebuild (run when convenient)

### Step 19: Rebuild the container

1. `F1` → **Dev Containers: Rebuild Container**
2. Wait for setup to complete (Step 11 should show apex-recall install)

### Step 20: Verify post-rebuild state

```bash
which apex-recall
apex-recall --version
apex-recall health --json
```

**Expected**: CLI is on PATH, version is 0.1.0, health runs without errors (may show 0 artifacts if `tmp/` was cleared).

---

## Quick Reference

| Stage            | Steps | Can run now?         | Prerequisites                       |
| ---------------- | ----- | -------------------- | ----------------------------------- |
| 1 — Automated    | 1-5   | Yes                  | None                                |
| 2 — Synthetic    | 6-14  | Yes                  | None                                |
| 3 — Live         | 15-18 | After a real project | Complete Steps 1-2 via Orchestrator |
| 4 — Devcontainer | 19-20 | When convenient      | Patience (3-5 min rebuild)          |
