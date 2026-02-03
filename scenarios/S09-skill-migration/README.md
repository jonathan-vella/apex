# S09: Skill Migration Validation

Validates that converted skills (azure-diagrams, azure-adr, azure-workload-docs) produce
equivalent outputs to their predecessor agents (diagram, adr, docs).

## Objective

Confirm 9→6 agent reduction maintains functional parity using diff-based validation against
`agent-testing/` baseline artifacts.

## Baseline Artifacts

| Artifact | Agent (Before) | Skill (After) |
|----------|----------------|---------------|
| `agent-testing/03-des-diagram.py` | diagram | azure-diagrams |
| `agent-testing/03-des-adr-*.md` | adr | azure-adr |
| `agent-testing/07-*.md` (7 files) | docs | azure-workload-docs |

## Validation Test Cases

### Test 1: Triggering (Skill Discovery)

| Test | Input Prompt | Expected Skill |
|------|--------------|----------------|
| T1.1 | "Generate architecture diagram" | azure-diagrams |
| T1.2 | "Create ADR for database choice" | azure-adr |
| T1.3 | "Generate workload documentation" | azure-workload-docs |
| T1.4 | "Write meeting notes" | **None** (negative trigger) |
| T1.5 | "Create a Python script" | **None** (negative trigger) |

### Test 2: Functional (Output Quality)

Compare skill outputs against baseline using semantic diff:

```bash
# Diagram skill validation
diff -u agent-testing/03-des-diagram.py <new-output> | head -50

# ADR skill validation
diff -u agent-testing/03-des-adr-*.md <new-output> | head -50

# Docs skill validation (all 7 types)
for f in agent-testing/07-*.md; do
  diff -u "$f" <new-output> | head -20
done
```

**Pass criteria**: Structure matches, content variations acceptable.

### Test 3: Performance

| Metric | Baseline (Agent) | Target (Skill) |
|--------|------------------|----------------|
| Token usage | Measure | ≤ 110% of baseline |
| Tool calls | Measure | ≤ baseline |
| Time to complete | Measure | ≤ 120% of baseline |

## Execution Steps

1. **Capture baseline**: Record agent outputs for test prompts
2. **Run skill tests**: Execute same prompts with skills enabled
3. **Diff comparison**: Compare outputs using semantic diff
4. **Document results**: Record pass/fail for each test case

## Results Template

| Test | Status | Notes |
|------|--------|-------|
| T1.1 | ⏳ | |
| T1.2 | ⏳ | |
| T1.3 | ⏳ | |
| T1.4 | ⏳ | |
| T1.5 | ⏳ | |
| T2 Diagrams | ⏳ | |
| T2 ADR | ⏳ | |
| T2 Docs | ⏳ | |
| T3 Performance | ⏳ | |

## Success Criteria

- [ ] All T1.x triggering tests pass
- [ ] T2 functional outputs match baseline structure
- [ ] T3 performance within acceptable range
- [ ] No regressions in calling agent workflows
