---
name: orchestration-helper
description: >
  Meta-skill explaining the Conductor pattern and agent orchestration.
  Use when users ask about: "how does the Conductor work", "agent orchestration",
  "workflow coordination", "multi-agent setup", or "subagent delegation".
  Provides guidance on structuring agent workflows with mandatory pause points.
license: MIT
metadata:
  author: azure-agentic-infraops
  version: "1.0"
  category: workflow-automation
---

# Agent Orchestration Skill

A reference guide for the InfraOps Conductor pattern and multi-agent orchestration
in VS Code 1.109+.

## 🎭 Conductor Pattern Overview

The InfraOps Conductor implements **agent orchestration** - a pattern where a master
agent coordinates specialized subagents through a structured development workflow.

### Key Benefits

| Benefit | Description |
|---------|-------------|
| **Context Efficiency** | Each subagent operates in its own context window |
| **Specialization** | Different agents use models optimized for their task |
| **Human Control** | Mandatory pause points for approval at critical stages |
| **Quality Gates** | Validation cycles ensure standards before proceeding |
| **Parallel Execution** | Independent tasks can run across multiple subagents |

## 📋 The 7-Step Workflow

```
Step 1: Requirements      →  @Requirements      →  01-requirements.md
Step 2: Architecture      →  @Architect         →  02-architecture-assessment.md
Step 3: Design (optional) →  @Design            →  03-des-*.md/py/png
Step 4: Planning          →  @Bicep Plan        →  04-implementation-plan.md
Step 5: Implementation    →  @Bicep Code        →  infra/bicep/{project}/
Step 6: Deploy            →  @Deploy            →  06-deployment-summary.md
Step 7: Documentation     →  Skills             →  07-*.md
```

## 🚦 Mandatory Approval Gates

The Conductor **MUST pause** at these points:

| Gate | After Step | Artifact to Review | User Action |
|------|------------|-------------------|-------------|
| 1 | Requirements | 01-requirements.md | Confirm requirements complete |
| 2 | Architecture | 02-architecture-assessment.md | Approve WAF assessment |
| 3 | Planning | 04-implementation-plan.md | Approve implementation plan |
| 4 | Pre-Deploy | Validation results | Approve lint/what-if/review |
| 5 | Post-Deploy | 06-deployment-summary.md | Verify deployment |

## 🔄 Validation Cycle (Step 5)

Before deployment, the Bicep Code agent runs a TDD-style validation:

```
┌─────────────────────────────────────────────────────────────┐
│  @bicep-lint-subagent                                       │
│    └─ bicep lint, bicep build                               │
│    └─ Returns: PASS/FAIL with diagnostics                   │
├─────────────────────────────────────────────────────────────┤
│  @bicep-whatif-subagent                                     │
│    └─ az deployment group what-if                           │
│    └─ Returns: Change summary, policy violations            │
├─────────────────────────────────────────────────────────────┤
│  @bicep-review-subagent                                     │
│    └─ AVM standards, naming, security review                │
│    └─ Returns: APPROVED/NEEDS_REVISION/FAILED               │
└─────────────────────────────────────────────────────────────┘
```

## 📦 Agent Hierarchy

### Primary Agents (User-Invokable)

| Agent | Role | Model |
|-------|------|-------|
| InfraOps Conductor | Master orchestrator | Claude Opus 4.6 |
| Requirements | Requirements gathering | Claude Opus 4.6 |
| Architect | WAF assessment | Claude Opus 4.6 |
| Design | Diagrams & ADRs | Claude Sonnet 4.5 |
| Bicep Plan | Implementation planning | Claude Opus 4.6 |
| Bicep Code | Template generation | Claude Sonnet 4.5 |
| Deploy | Azure deployment | Claude Sonnet 4.5 |
| Diagnose | Troubleshooting | Claude Sonnet 4.5 |

### Subagents (Conductor-Invoked Only)

| Subagent | Role | Model |
|----------|------|-------|
| bicep-lint-subagent | Syntax validation | Claude Haiku 4.5 |
| bicep-whatif-subagent | Deployment preview | Claude Haiku 4.5 |
| bicep-review-subagent | Code review | Claude Sonnet 4.5 |

## 🛠️ VS Code 1.109 Frontmatter

### User-Invokable Agent

```yaml
---
name: My Agent
description: What this agent does
model: ["Claude Opus 4.6 (copilot)", "Claude Sonnet 4.5 (copilot)"]
user-invokable: true
agents: ["Agent1", "Agent2"]  # Agents this can delegate to
tools: [...]
handoffs:
  - label: "Button Label"
    agent: TargetAgent
    prompt: "Context for handoff"
    send: true
    model: "Claude Sonnet 4.5 (copilot)"  # Optional: model for handoff
---
```

### Subagent (Hidden from UI)

```yaml
---
name: my-subagent
description: What this subagent does
model: "Claude Haiku 4.5 (copilot)"
user-invokable: false
disable-model-invocation: false
agents: []  # Subagents typically don't delegate
tools: [...]
---
```

## 📝 Settings for Orchestration

Enable in `.vscode/settings.json`:

```json
{
  "chat.customAgentInSubagent.enabled": true,
  "chat.agentFilesLocations": {
    ".github/agents": true,
    ".github/agents/_subagents": true
  },
  "chat.agentSkillsLocations": {
    ".github/skills": true
  },
  "github.copilot.chat.responsesApiReasoningEffort": "high"
}
```

## 🎯 Starting the Conductor

1. Open VS Code Chat
2. Select "InfraOps Conductor" from agent dropdown
3. Describe your Azure infrastructure project
4. The Conductor will guide you through all 7 steps with approval gates

## 🔘 Understanding Handoff Buttons

When the Conductor responds, you'll see multiple handoff buttons. Here's when to use each:

### Navigation Buttons

| Button | When to Use |
|--------|-------------|
| **▶ Start New Project** | Begin a fresh project from Step 1 |
| **▶ Resume Workflow** | Continue from where you left off (checks existing artifacts) |
| **▶ Review Artifacts** | View summary of all generated artifacts for current project |

### Step Buttons

| Button | Purpose |
|--------|---------|
| **Step 1: Gather Requirements** | Jump to requirements gathering |
| **Step 2: Architecture Assessment** | Jump to WAF assessment |
| **Step 4: Implementation Plan** | Jump to planning (skips optional Step 3) |
| **Step 5: Generate Bicep** | Jump to code generation |
| **Step 6: Deploy** | Jump to deployment |

### Utility Buttons

| Button | Purpose |
|--------|---------|
| **Diagnose Issues** | Troubleshoot Azure resource problems |

### Best Practices

1. **Sequential workflow**: Use step buttons in order (1 → 2 → 4 → 5 → 6)
2. **After completing a step**: Click the next step button or use "Resume Workflow"
3. **Returning to a session**: Use "Resume Workflow" to detect existing artifacts
4. **Reviewing progress**: Use "Review Artifacts" before continuing

## Example Session

```
User: Build a web app with Azure SQL backend in Sweden Central

Conductor: 📋 Starting new project workflow...
           Creating: agent-output/webapp-sql/

           [Delegates to @Requirements]
           ...gathering requirements...

─────────────────────────────────────────────
📋 GATE 1: REQUIREMENTS COMPLETE
Artifact: agent-output/webapp-sql/01-requirements.md

Shall I proceed to Architecture Assessment (Step 2)?
─────────────────────────────────────────────

User: Yes, proceed

           [Delegates to @Architect]
           ...WAF assessment...

─────────────────────────────────────────────
🏗️ GATE 2: ARCHITECTURE COMPLETE
Cost Estimate: $150/month

Shall I proceed to Implementation Planning (Step 4)?
─────────────────────────────────────────────

[...continues through all gates...]
```

## Reference Links

- [VS Code 1.109 Release Notes](https://code.visualstudio.com/updates/v1_109)
- [Agent Orchestration Docs](https://code.visualstudio.com/updates/v1_109#_agent-orchestration)
- [Copilot Orchestra](https://github.com/ShepAlderson/copilot-orchestra)
- [GitHub Copilot Atlas](https://github.com/bigguy345/Github-Copilot-Atlas)
