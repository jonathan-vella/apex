# S08: GitHub Copilot Coding Agent

> **Version 5.3.0** | [Back to Scenarios](../README.md)

---

## Meet Alex Petrov

> **Role:** Cloud Operations Engineer at Contoso Healthcare
> **Experience:** 6 years in Azure operations, recently joined the patient portal team
> **Today's Challenge:** Add monitoring and alerting before tomorrow's production go-live
> **The Twist:** On-call rotation starts in 24 hours—needs alerts configured today

_"We deployed the patient portal infrastructure last week, but nobody set up monitoring.
I've got a dozen other tickets, and my on-call shift starts tomorrow. If something breaks
in production without alerts, I'll be debugging blind at 2 AM."_

**What Alex will discover:** GitHub Copilot Coding Agent can autonomously implement
monitoring infrastructure from a well-written GitHub Issue—creating a PR with
near-production-ready Bicep code while Alex focuses on other priorities.

---

## Overview

This scenario demonstrates **GitHub Copilot Coding Agent**—the feature that lets you
assign GitHub Issues directly to Copilot, which then autonomously analyzes the codebase,
implements changes, and opens a Pull Request for review.

Unlike interactive Copilot Chat, the Coding Agent works **asynchronously**. You create
an issue, assign it to Copilot, and continue with other work while it implements the solution.

## ⚠️ Prerequisites (Important!)

> **This scenario requires specific GitHub Copilot features that may not be available
> on all plans or repositories.**

| Requirement              | Details                                                           |
| ------------------------ | ----------------------------------------------------------------- |
| **GitHub Copilot Plan**  | Business or Enterprise (Coding Agent not available on Individual) |
| **Coding Agent Enabled** | Must be enabled by organization admin in Copilot settings         |
| **Repository Access**    | Copilot must have write access to the repository                  |
| **Branch Protection**    | Copilot creates PRs—ensure branch protection allows this          |

### Verify Your Setup

```bash
# Check if coding agent is available (look for "Copilot" in assignees)
gh issue create --title "Test" --body "Test" --web
# If you can assign to "Copilot" in the assignee dropdown, you're ready!
```

---

## Scenario Details

| Attribute           | Value                                                 |
| ------------------- | ----------------------------------------------------- |
| **Duration**        | 10-15 minutes (including Copilot processing time)     |
| **Difficulty**      | Beginner-Intermediate                                 |
| **Target Audience** | IT Pros, DevOps Engineers, Platform Teams             |
| **Azure Services**  | Azure Monitor, Action Groups, Alert Rules, Dashboards |

## Learning Objectives

By completing this scenario, you will:

1. **Understand** how Copilot Coding Agent differs from interactive Copilot Chat
2. **Create** well-structured GitHub Issues that Copilot can execute effectively
3. **Assign** issues to Copilot and monitor progress
4. **Review** Copilot-generated PRs with appropriate scrutiny
5. **Apply** this pattern to automate routine infrastructure tasks

---

## The Challenge

| Problem                                      | Impact                          | Business Cost          |
| -------------------------------------------- | ------------------------------- | ---------------------- |
| Infrastructure deployed without monitoring   | Blind to performance issues     | Potential SLA breaches |
| Manual alert configuration is time-consuming | 2-4 hours per environment       | Delayed go-live        |
| Inconsistent alerting across environments    | Alert fatigue, missed incidents | Increased MTTR         |
| Documentation often skipped                  | Knowledge silos                 | Onboarding friction    |

## The Solution

Instead of manually writing Bicep modules for monitoring, Alex will:

1. **Create a GitHub Issue** with clear requirements for monitoring
2. **Assign to Copilot** using the `@github-copilot` mention or assignee
3. **Review the PR** that Copilot creates autonomously
4. **Merge and deploy** near-production-ready monitoring infrastructure

---

## Demo Options

### Option A: Quick Demo (5 minutes)

**Issue:** Add 3 basic alert rules (CPU, Memory, HTTP errors)

Best for: Time-constrained demos, proof of concept

### Option B: Full Demo (10-15 minutes)

**Issue:** Add alerts + action group + email notifications + dashboard

Best for: Comprehensive demonstrations, showing full capabilities

---

## Demo Components

```
scenarios/S08-coding-agent/
├── README.md                           # This file
├── DEMO-SCRIPT.md                      # Step-by-step presenter guide
├── prompts/
│   └── effective-prompts.md            # Issue writing best practices
├── examples/
│   ├── issue-option-a-simple.md        # Quick demo issue text
│   └── issue-option-b-full.md          # Full demo issue text
└── scenario/
    └── requirements.md                 # Business context
```

**GitHub Issue Template:**

```
.github/ISSUE_TEMPLATE/copilot-agent-task.yml
```

---

## Quick Start

### Option 1: Use the Issue Template (Recommended)

1. Go to **Issues** → **New Issue**
2. Select **"Copilot Agent Task"** template
3. Fill in the monitoring requirements
4. Assign to **Copilot** (or mention `@github-copilot`)
5. Watch Copilot work!

### Option 2: Copy-Paste Issue

1. Open `examples/issue-option-b-full.md`
2. Create new GitHub Issue with that content
3. Assign to Copilot

### Option 3: Use GitHub CLI

```bash
# Create issue from template
gh issue create \
  --title "Add Azure Monitor alerts to patient portal" \
  --body-file scenarios/S08-coding-agent/examples/issue-option-b-full.md \
  --assignee @me

# Then reassign to Copilot via web UI
```

---

## Key Features Demonstrated

| Feature                    | Description                           | IT Pro Benefit                  |
| -------------------------- | ------------------------------------- | ------------------------------- |
| **Autonomous Execution**   | Copilot works without supervision     | Focus on higher-value tasks     |
| **Codebase Understanding** | Analyzes existing code before changes | Context-aware implementations   |
| **PR-Based Workflow**      | Creates reviewable pull requests      | Maintains code review standards |
| **Iterative Refinement**   | Can respond to PR comments            | Collaborative improvement       |
| **Session Logs**           | Documents reasoning and decisions     | Audit trail for changes         |

---

## Conversation Flow with Coding Agent

```
┌─────────────────────────────────────────────────────────────────┐
│ Phase 1: Issue Creation                                         │
│ ─────────────────────                                          │
│ • Write clear, specific issue with acceptance criteria          │
│ • Reference existing files/modules if relevant                  │
│ • Include constraints (region, naming, tags)                    │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 2: Assignment                                             │
│ ────────────────────                                           │
│ • Assign issue to Copilot (assignee or @mention)               │
│ • Copilot begins autonomous analysis                           │
│ • Status updates appear in issue comments                       │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 3: Implementation (Autonomous)                            │
│ ────────────────────────────────────                           │
│ • Copilot analyzes codebase structure                          │
│ • Creates branch and implements changes                         │
│ • Generates tests if applicable                                 │
│ • Opens Pull Request with detailed description                  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 4: Review & Refinement                                    │
│ ──────────────────────────────                                 │
│ • Review PR diff and session logs                              │
│ • Request changes via PR comments if needed                     │
│ • Copilot can iterate based on feedback                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ Phase 5: Merge & Deploy                                         │
│ ───────────────────────                                        │
│ • Approve and merge PR                                         │
│ • Deploy via existing CI/CD pipeline                           │
│ • Validate alerts in Azure Portal                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

### Time Efficiency

| Task                      | Manual Approach | With Coding Agent             | Savings |
| ------------------------- | --------------- | ----------------------------- | ------- |
| Write alert Bicep modules | 2-3 hours       | 5 min (issue writing)         | 90%+    |
| Create action groups      | 30 min          | Included                      | 100%    |
| Configure dashboard       | 1-2 hours       | Included                      | 90%+    |
| Documentation             | Often skipped   | Auto-generated PR description | ∞       |

### Quality Indicators

| Metric                        | Target | Measurement               |
| ----------------------------- | ------ | ------------------------- |
| PR created successfully       | 100%   | Issue → PR conversion     |
| Code compiles (`bicep build`) | 100%   | CI validation             |
| Follows existing patterns     | High   | Code review assessment    |
| Includes all requirements     | High   | Acceptance criteria check |

---

## Best Practices for Issue Writing

### ✅ Do

- **Be specific:** "Add CPU alert when > 80% for 5 minutes"
- **Reference existing code:** "Follow the pattern in `modules/app-service.bicep`"
- **Include constraints:** "Use swedencentral region, include standard tags"
- **Define acceptance criteria:** Clear checklist of what "done" looks like
- **Scope appropriately:** One logical unit of work per issue

### ❌ Don't

- **Be vague:** "Add some monitoring"
- **Overload:** "Refactor everything and add monitoring and fix bugs"
- **Skip context:** Assume Copilot knows your conventions
- **Forget validation:** Always review the PR before merging

---

## Troubleshooting

| Issue                   | Symptom                        | Solution                            |
| ----------------------- | ------------------------------ | ----------------------------------- |
| Can't assign to Copilot | "Copilot" not in assignee list | Enable Coding Agent in org settings |
| Copilot doesn't respond | Issue assigned but no activity | Check Copilot has repo access       |
| PR has errors           | `bicep build` fails            | Comment on PR asking Copilot to fix |
| Wrong implementation    | Doesn't match requirements     | Clarify requirements in PR comment  |
| Takes too long          | > 30 min without PR            | Complex issues may need breakdown   |

📖 **For general issues** (Dev Container, Azure auth, Copilot problems), see the [Troubleshooting Guide](../../docs/troubleshooting.md).

---

## Related Scenarios

- **[S01 Bicep Baseline](../S01-bicep-baseline)** — Learn Bicep fundamentals first
- **[S02 Agentic Workflow](../S02-agentic-workflow)** — Interactive agent workflow
- **[S04 Service Validation](../S04-service-validation)** — Test the alerts you create

---

## Next Steps

### For Demo Presenters

1. Verify Coding Agent is enabled before the demo
2. Pre-create a test issue to confirm it works
3. Have backup plan (show a previously completed PR)
4. Practice the timing—Copilot may take 2-10 minutes

### For Learners

1. Start with Option A (simple) to understand the workflow
2. Progress to Option B for real-world complexity
3. Create your own issues for your infrastructure needs
4. Review session logs to understand Copilot's reasoning

### For Teams

1. Create issue templates for common infrastructure tasks
2. Establish PR review standards for Copilot-generated code
3. Document which tasks are "Copilot-suitable"
4. Track time savings for ROI reporting

---

## Key Takeaways

**For Engineers:**

- Coding Agent handles routine infrastructure tasks autonomously
- Well-written issues are the key to good results
- Always review PRs—Copilot augments, not replaces, your expertise

**For Leaders:**

- Measurable time savings on repetitive infrastructure work
- Maintains code review standards and audit trails
- Enables engineers to focus on higher-value activities

**For Partners:**

- Demonstrates GitHub Copilot's enterprise capabilities
- Shows integration with existing DevOps workflows
- Quantifiable ROI through time savings metrics

---

_This scenario demonstrates how GitHub Copilot Coding Agent transforms routine
infrastructure tasks from hours of manual work into minutes of issue writing,
enabling IT Pros to deliver faster while maintaining quality and governance._
