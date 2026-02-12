# GitHub Copilot Pilot Success Checklist

> **Version 5.3.0** | [Back to Presenter Resources](README.md)
>
> A structured guide for planning, executing, and evaluating a GitHub Copilot pilot for IT Professionals.

---

## Pre-Pilot Phase (Week -1)

### Prerequisites

- [ ] **Licensing confirmed** - GitHub Copilot Business licenses procured ($19/user/month)
- [ ] **Pilot team selected** - 3-5 IT Pros with mix of experience levels
- [ ] **VS Code installed** - Latest version on all pilot machines
- [ ] **GitHub Copilot extension installed** - Verified working in VS Code
- [ ] **Dev Container ready** (optional) - Pre-configured environment for consistency

### Baseline Metrics Captured

- [ ] **Current task timing documented** - How long do these tasks take today?
  - [ ] IaC development (Bicep creation)
  - [ ] PowerShell/Bash scripting
  - [ ] Troubleshooting time (average per incident)
  - [ ] Documentation time (per document/page)
- [ ] **Quality baseline established** - Current error rates, rework frequency
- [ ] **Satisfaction survey completed** - Pre-pilot team sentiment

### Pilot Scope Defined

- [ ] **Use cases identified** - Which tasks will be measured?
  - [ ] Hub-spoke network deployment
  - [ ] Storage account automation
  - [ ] Key Vault configuration
  - [ ] Compliance validation scripts
  - [ ] Runbook documentation
- [ ] **Success criteria agreed** - What defines "success"? (See metrics below)
- [ ] **Stakeholder alignment** - Leadership aware and supportive

---

## Pilot Week 1: Onboarding & First Tasks

### Day 1-2: Setup & Orientation

- [ ] **Team kickoff completed** - Explained pilot goals and expectations
- [ ] **Initial training delivered** - 30-60 min orientation on Copilot basics
  - [ ] How to invoke suggestions (Tab to accept)
  - [ ] Using Copilot Chat for questions
  - [ ] Writing effective prompts
- [ ] **First task assigned** - Simple, low-risk infrastructure task
- [ ] **Support channel established** - Slack/Teams channel for questions

### Day 3-5: Hands-On Practice

- [ ] **Each pilot member has completed at least 3 tasks with Copilot**
- [ ] **Time tracking started** - Using spreadsheet or tool to log:
  - Task name
  - Estimated time (without Copilot)
  - Actual time (with Copilot)
  - Quality notes
- [ ] **Early feedback collected** - Quick pulse check on experience
- [ ] **Blockers identified and addressed** - Any setup or workflow issues?

### Week 1 Checkpoint

| Metric                               | Target        | Actual  |
| ------------------------------------ | ------------- | ------- |
| Pilot members actively using Copilot | 100%          | \_\_\_% |
| Tasks completed with Copilot         | 3+ per person | \_\_\_  |
| Average time savings observed        | 40%+          | \_\_\_% |
| Major blockers                       | 0             | \_\_\_  |

---

## Pilot Week 2: Expanded Use Cases

### Tasks to Complete

- [ ] **Infrastructure deployment** - VNet, subnets, NSGs (S01-style)
- [ ] **Automation script** - PowerShell for resource management
- [ ] **Troubleshooting session** - Use Copilot Chat for diagnostics
- [ ] **Documentation generation** - README or runbook creation

### Observations to Capture

- [ ] **What prompts work best?** - Document effective prompt patterns
- [ ] **What doesn't work?** - Note limitations or frustrations
- [ ] **Quality assessment** - Is generated code production-ready?
- [ ] **Security review** - Any concerns about generated code?

### Week 2 Checkpoint

| Metric                      | Target | Actual  |
| --------------------------- | ------ | ------- |
| Average time savings        | 50%+   | \_\_\_% |
| Code quality (1-5 scale)    | 4+     | \_\_\_  |
| Team confidence (1-5 scale) | 4+     | \_\_\_  |
| Would recommend to others   | Yes    | \_\_\_  |

---

## Pilot Week 3-4: Real-World Validation

### Production-Adjacent Tasks

- [ ] **Real project work** - Apply Copilot to actual planned work
- [ ] **Complex scenarios** - Multi-resource deployments, edge cases
- [ ] **Team collaboration** - Pair programming with Copilot assistance
- [ ] **Documentation sprint** - Catch up on documentation backlog

### Data Collection

- [ ] **Task log completed** - All tasks with before/after timing
- [ ] **Quality review conducted** - Code review of Copilot-assisted output
- [ ] **Final survey distributed** - Comprehensive feedback questionnaire

---

## Success Criteria Evaluation

### Quantitative Metrics

| Metric                            | Threshold | Target | Result   | Pass? |
| --------------------------------- | --------- | ------ | -------- | ----- |
| **Time savings (IaC)**            | 40%       | 70%    | \_\_\_%  | ☐     |
| **Time savings (scripting)**      | 40%       | 65%    | \_\_\_%  | ☐     |
| **Time savings (docs)**           | 50%       | 75%    | \_\_\_%  | ☐     |
| **Code quality score**            | 3.5/5     | 4.0/5  | \_\_\_/5 | ☐     |
| **Zero critical security issues** | 0         | 0      | \_\_\_   | ☐     |
| **Adoption rate**                 | 80%       | 100%   | \_\_\_%  | ☐     |

### Qualitative Metrics

| Metric                     | Evaluation                                  |
| -------------------------- | ------------------------------------------- |
| **Team satisfaction**      | ☐ Positive ☐ Neutral ☐ Negative             |
| **Would recommend**        | ☐ Yes ☐ Maybe ☐ No                          |
| **Reduced frustration**    | ☐ Significantly ☐ Somewhat ☐ Not noticeable |
| **Learning acceleration**  | ☐ Visible ☐ Minimal ☐ None                  |
| **Ready for team rollout** | ☐ Yes ☐ With modifications ☐ No             |

---

## Go/No-Go Decision Framework

### ✅ GO Criteria (all must be true)

- [ ] Time savings ≥ 40% on measured tasks
- [ ] No critical security vulnerabilities in generated code
- [ ] ≥ 80% of pilot team recommends expansion
- [ ] Quality score ≥ 3.5/5 on code review
- [ ] No unresolved blockers preventing team adoption

### ⚠️ CONDITIONAL GO (requires mitigation)

- [ ] Time savings 25-40% (acceptable with targeted training)
- [ ] Minor security concerns (fixable with review process)
- [ ] 60-80% recommendation rate (investigate holdouts)

### ❌ NO-GO Criteria (any one blocks)

- [ ] Time savings < 25% (not delivering value)
- [ ] Critical security issues (unacceptable risk)
- [ ] < 50% recommendation rate (team resistance)
- [ ] Major unresolved technical blockers

---

## Post-Pilot Actions

### If GO Decision

- [ ] **Expansion plan created** - Phased rollout to additional team members
- [ ] **Training materials developed** - Based on pilot learnings
- [ ] **Best practices documented** - Effective prompts, workflows
- [ ] **Success story drafted** - For internal communication
- [ ] **Budget approved** - Licenses for expanded team

### If NO-GO Decision

- [ ] **Root cause analysis completed** - Why did the pilot fail?
- [ ] **Remediation plan created** - What would need to change?
- [ ] **Re-pilot timeline set** - When to try again with improvements
- [ ] **Alternative solutions evaluated** - Other tools to consider

---

## Pilot Report Template

### Executive Summary

```
Pilot Duration: [4 weeks]
Team Size: [5 IT Pros]
Use Cases Tested: [IaC, scripting, docs, troubleshooting]

Key Results:
- Average time savings: [X]%
- Code quality score: [X]/5
- Team recommendation rate: [X]%

Decision: [GO / CONDITIONAL GO / NO-GO]

Next Steps: [Expand to 15 users / Address concerns / Re-evaluate in Q2]
```

### Detailed Metrics

_Attach completed task log and survey results_

### Lessons Learned

_Document what worked, what didn't, and recommendations for rollout_

---

## Resources

| Resource                  | Link                                                 |
| ------------------------- | ---------------------------------------------------- |
| **ROI Calculator**        | [roi-calculator.md](roi-calculator.md)               |
| **Executive Pitch**       | [executive-pitch.md](executive-pitch.md)             |
| **Time Savings Evidence** | [time-savings-evidence.md](time-savings-evidence.md) |
| **Prompt Guide**          | [docs/prompt-guide/](../prompt-guide/)               |

---

## Document Info

|                |                               |
| -------------- | ----------------------------- |
| **Created**    | November 2025                 |
| **Purpose**    | Pilot planning and evaluation |
| **Audience**   | IT managers, pilot leads      |
| **Maintainer** | Repository maintainers        |
