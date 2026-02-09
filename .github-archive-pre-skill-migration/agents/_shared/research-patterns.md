# Shared Research Patterns for All Agents

> **Purpose**: Eliminate duplication across agents by providing common research patterns,
> validation workflows, and confidence gates used throughout the 7-step workflow.

## Standard Research Workflow

All agents follow this common pattern (adapt steps 3-4 for domain-specific needs):

```
┌──────────────────────────────────────────────────────────────┐
│ Step 1: Validate Prerequisites                               │
│   → Check previous agent's artifact exists                   │
│   → If missing, STOP and request handoff                     │
├──────────────────────────────────────────────────────────────┤
│ Step 2: Read Agent Context                                   │
│   → Read template structure (skip content reprocessing)      │
│   → Reference shared defaults (cached)                       │
│   → Read previous artifact for context (not re-query Azure)  │
├──────────────────────────────────────────────────────────────┤
│ Step 3: Domain-Specific Research                             │
│   → Perform agent-specific queries/analysis                  │
│   → Query external sources ONLY for new information          │
├──────────────────────────────────────────────────────────────┤
│ Step 4: Confidence Gate (80% Rule)                           │
│   → Verify sufficient context to proceed                     │
│   → If < 80%, ASK user for clarification                     │
└──────────────────────────────────────────────────────────────┘
```

## Validation Checklist Pattern

### Prerequisites Validation

Every agent should validate its inputs using this pattern:

```markdown
**BEFORE {agent task}, verify:**

- [ ] Previous artifact exists: `agent-output/{project}/{artifact-number}-*.md`
- [ ] Artifact is complete (has all required H2 sections from template)
- [ ] No blockers or warnings in previous step

**If validation fails**: STOP and request handoff to previous agent.
```

### Template Structure Reference

**DO NOT re-read template contents during workflow execution.**

Templates define output structure - reference them for H2 headers only:

| Agent | Template File | Use For |
|-------|---------------|---------|
| Requirements | `01-requirements.template.md` | H2 section names only |
| Architect | `02-architecture-assessment.template.md` | H2 section names only |
| Design | N/A (uses skills) | Follow skill output format |
| Bicep Plan | `04-implementation-plan.template.md` | H2 section names only |
| Bicep Code | `05-implementation-reference.template.md` | H2 section names only |
| Deploy | `06-deployment-summary.template.md` | H2 section names only |

**Optimization**: Read template ONCE at agent initialization, cache H2 structure.

### Context Reading Pattern

**DO**: Read previous agent's artifact for context  
**DON'T**: Re-query external APIs for information already in artifacts

```markdown
## Context Reuse (Efficient)

1. **Requirements → Architect**:
   - Architect reads `01-requirements.md` for project scope, NFRs, compliance
   - SKIP re-querying user or workspace for same information

2. **Architect → Bicep Plan**:
   - Bicep Plan reads `02-architecture-assessment.md` for resource list, SKU decisions
   - SKIP re-querying Azure docs for resources already assessed

3. **Bicep Plan → Bicep Code**:
   - Bicep Code reads `04-implementation-plan.md` for AVM modules, dependencies
   - SKIP re-scanning workspace for AVM availability (already documented)

4. **Bicep Code → Deploy**:
   - Deploy reads `05-implementation-reference.md` for template paths
   - SKIP re-validating Bicep syntax if implementation ref confirms validation

## Shared Information Sources

```

### Shared Defaults (Cached)

All agents reference `.github/agents/_shared/defaults.md` for:

- Default regions (`swedencentral`, `germanywestcentral`)
- Required tags (`Environment`, `ManagedBy`, `Project`, `Owner`)
- Naming conventions (CAF patterns)
- Security baseline (TLS 1.2+, HTTPS-only, etc.)

**Optimization**: Read once per session, cache in agent context.

## Confidence Gate Pattern (80% Rule)

**Universal confidence threshold**: Proceed when you have **80% confidence** in having sufficient context.

### Confidence Assessment Criteria

| Confidence Level | Indicators | Action |
|------------------|------------|--------|
| **High (80-100%)** | All critical info available, minimal assumptions | ✅ Proceed to artifact generation |
| **Medium (60-79%)** | Some assumptions required, minor gaps | ⚠️ Document assumptions, ASK user for critical gaps |
| **Low (0-59%)** | Major information gaps, high uncertainty | ❌ STOP - Request clarification |

### Domain-Specific Confidence Criteria

#### Requirements Agent

Confidence = Are all critical NFRs defined?

- SLA target, RTO, RPO documented
- Compliance requirements identified (or confirmed none)
- Budget constraints known
- Scale/performance targets specified

#### Architect Agent

Confidence = Can I assess all WAF pillars?

- All required Azure services identified
- SKU options researched
- Cost estimates calculable
- Security/compliance requirements clear

#### Bicep Plan Agent

Confidence = Can I plan all implementations?

- All resources have AVM modules (or justification for raw Bicep)
- Dependencies mapped
- Governance constraints discovered
- Naming/tagging strategy defined

#### Bicep Code Agent

Confidence = Can I generate valid Bicep?

- Implementation plan complete
- AVM schemas fetched (preflight check passed)
- Module structure determined
- No blocking governance policies

#### Deploy Agent

Confidence = Can I deploy safely?

- Bicep templates validated
- What-if analysis successful
- Azure credentials confirmed
- Resource group exists or can be created

## Anti-Patterns to Avoid

### ❌ Don't: Re-Query Same Information

```markdown
<!-- BAD: Architect queries Azure docs for services already in requirements -->
Requirements document lists: "Azure SQL Database, App Service, Key Vault"
Architect queries: "What is Azure SQL Database?" (redundant if already documented)

<!-- GOOD: Architect reads requirements, queries ONLY for architecture decisions -->
Requirements document lists: "Azure SQL Database"
Architect queries: "Azure SQL Database SKU comparison for 99.95% SLA" (new info)
```

### ❌ Don't: Search Workspace Repeatedly

```markdown
<!-- BAD: Every agent searches agent-output/ -->
Requirements: search_workspace("agent-output/")
Architect: search_workspace("agent-output/")  ← redundant
Bicep Plan: search_workspace("agent-output/") ← redundant

<!-- GOOD: First agent searches, passes context via artifacts -->
Requirements: search_workspace("agent-output/"), create 01-requirements.md
Architect: read 01-requirements.md (context already gathered)
```

### ❌ Don't: Re-validate Previous Work

```markdown
<!-- BAD: Bicep Code re-validates governance already discovered -->
Bicep Plan: Run ARG query for Azure Policies → 04-governance-constraints.md
Bicep Code: Run ARG query again for same policies ← redundant

<!-- GOOD: Bicep Code reads governance artifact -->
Bicep Plan: Run ARG query → 04-governance-constraints.md
Bicep Code: Read 04-governance-constraints.md (constraints already discovered)
```

### ✅ Do: Validate Fresh State (When Needed)

```markdown
<!-- GOOD: Deploy runs what-if (state changes since planning) -->
Bicep Plan: Plan resources based on requirements
Bicep Code: Generate templates
Deploy: Run what-if ← REQUIRED (actual Azure state may have changed)
```

## Optimization Summary

| Research Task | Frequency | Rationale |
|---------------|-----------|-----------|
| Read template structure | Once per agent init | Structure doesn't change |
| Read shared defaults | Once per session | Defaults don't change mid-workflow |
| Read previous artifact | Once per agent start | Context from previous step |
| Query Azure docs | Only for NEW info | Avoid re-querying known facts |
| Search workspace | First agent only | Pass context via artifacts |
| Validate governance | Once (Bicep Plan) | Cached in artifact |
| Run what-if | Deploy only | Required for actual state |
| Fetch AVM schemas | Once (Bicep Code preflight) | Cached in preflight check |

## When to Re-Query/Re-Validate

**Re-query external sources when:**

- User explicitly requests refresh ("update cost estimate", "check latest AVM versions")
- Artifact is stale (timestamp > 30 days old - future enhancement)
- Previous validation failed or artifact missing
- Actual Azure state needs verification (Deploy agent what-if)

**Don't re-query when:**

- Information already in previous artifact
- No material change expected (regional defaults, templates)
- Agent is delegating work that includes the query

## Implementation Guidance

**For agent developers adding new agents:**

1. **Reference this file** in agent definition frontmatter
2. **Follow validation pattern** for prerequisites
3. **Read artifacts, not raw data** for context
4. **Use 80% confidence gate** for consistency
5. **Document domain-specific confidence criteria**

**Example agent integration:**

```markdown
## Research Requirements (MANDATORY)

> **See [Research Patterns](_shared/research-patterns.md)** for shared validation
> and confidence gate patterns used across all agents.

<research_mandate>
**MANDATORY: Before {agent task}, run research following shared patterns.**

### Step 1: Validate Prerequisites (Standard Pattern)
<!-- Reference shared pattern -->
- Confirm `{previous-artifact}.md` exists in `agent-output/{project}/`
- Read artifact for context
- If missing, STOP and request handoff

### Step 2: Read Agent Context (Standard Pattern)
<!-- Reference shared pattern -->
- Reference template for H2 structure only
- Read shared defaults (cached)
- Skip workspace search (context in artifacts)

### Step 3: Domain-Specific Research
<!-- Agent-specific queries -->
- {Agent-specific research tasks}
- Query ONLY for information not in previous artifacts

### Step 4: Confidence Gate (Standard 80% Rule)
<!-- Reference shared pattern -->
Only proceed when you have **80% confidence** in:
- {Domain-specific confidence criteria}

If below 80%, ASK user for clarification.
</research_mandate>
```
