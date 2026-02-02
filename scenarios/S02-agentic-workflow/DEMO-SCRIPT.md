Demo Script: Agentic Workflow for Azure Infrastructure

**Duration**: 45-60 minutes (full) | 20-25 minutes (abbreviated)  
**Audience**: Solution Architects, Cloud Architects, Infrastructure Engineers  
**Presenter Prep Time**: 15 minutes

## 🎯 Demo Objectives

By the end of this demo, the audience will:

1. Understand how VS Code's **built-in Plan Agent** enables plan-driven development
2. See how custom agents streamline infrastructure design after planning
3. Experience the value of automatic context handoffs between agents
4. Recognize 95% time savings vs. traditional approaches
5. Feel confident trying the workflow on their own projects

## 📋 Pre-Demo Checklist

### Environment Setup (10 minutes before)

- [ ] VS Code open with GitHub Copilot installed
- [ ] Open `scenarios/S02-agentic-workflow/` directory
- [ ] GitHub Copilot Chat visible (`Ctrl+Alt+I`)
- [ ] Verify **Plan** agent available in dropdown (built-in, no setup required)
- [ ] Test custom agent selection (`Ctrl+Alt+I`) - verify all 4 custom agents available
- [ ] Have `prompts/workflow-prompts.md` ready in second window
- [ ] Azure Portal open (optional - for showing deployment validation)
- [ ] Review [Workflow Guide](../../docs/reference/workflow.md) for complete workflow documentation

### Presenter Preparation

- [ ] Review scenario (`scenario/business-requirements.md`)
- [ ] Rehearse Plan Agent → Architecture → Planning → Implement flow
- [ ] Practice handoff transitions (both UI buttons and manual agent switching)
- [ ] Prepare answers to common questions (see below)
- [ ] Test Bicep validation commands (if doing live validation)

## 🎬 Demo Script

---

### Opening: The Challenge (3 minutes)

**[Slide or Verbal]**

"Let me show you a common scenario. You're meeting with a customer - Contoso Healthcare - and they need a patient portal. Let's look at their requirements..."

**[Open `scenario/business-requirements.md`]**

**Scroll through key points:**

- 10,000 patients, $800/month budget
- HIPAA mandatory
- 99.9% SLA requirement
- 12-week timeline

**The Traditional Approach:**

"Traditionally, this would take 2-3 days:

- Day 1: Architect reviews requirements, creates architecture document (4-6 hours)
- Day 2: Infrastructure engineer translates to Bicep templates (6-8 hours)
- Day 3: Security review, cost optimization, revisions (4 hours)

**Total: 14-18 hours of expert time**

But what if we could do this in 30-45 minutes?"

---

### Stage 0: VS Code Plan Agent (3:00 - 10:00)

**[Open GitHub Copilot Chat - `Ctrl+Alt+I`]**

"Before we dive into architecture, let's use VS Code's **built-in Plan Agent** to research and break down this project. This is a native VS Code feature that ensures we understand all requirements before writing any code."

**[Click agents dropdown and select 'Plan']**

"I'm selecting the **Plan** agent from the dropdown. Unlike our custom agents, Plan is built into VS Code."

**Paste this prompt:**

```text
I need to design and implement a HIPAA-compliant patient portal for Contoso Healthcare.

Context:
- 10,000 patients, 50 staff members
- $800/month budget constraint
- 99.9% SLA requirement
- 3-month implementation timeline
- HIPAA compliance mandatory

Please help me:
1. Break down this project into implementation phases
2. Identify key architectural decisions
3. Estimate costs for different approaches
4. Recommend which specialized agents to use for each phase
```

**While agent processes (30-60 seconds):**

> "The Plan Agent is researching our requirements using read-only tools. It analyzes the codebase and context without making any changes. This is key - we plan before we code."

**[Agent returns plan draft - scroll through output]**

**Highlight key sections:**

1. **Summary and Steps:**

   > "See how it broke down our project into manageable phases - Foundation, Platform, Security, Configuration. This becomes our roadmap."

2. **Open Questions:**

   > "Notice the clarifying questions - 'What EHR system for integration?', 'Any specific Azure regions required?'. Let's answer these to refine our plan."

**[Optional: Provide clarifying answers to refine the plan]**

```text
- EHR integration: REST API, existing system
- Region: swedencentral (default) or germanywestcentral
- Prefer managed services over VMs
```

1. **Plan Controls:**

   > "Now look at these controls at the bottom - we can **Save Plan** to create a reusable `*.prompt.md` file, or **Hand off to implementation agent** to proceed with the architecture."

**[Click 'Save Plan' to show the *.prompt.md file generation - OPTIONAL]**

**[Then click 'Hand off to implementation agent' or manually transition]**

---

### Stage 1: Architecture Design (10:00 - 18:00)

**[Select `architect` from Custom Agents dropdown - `Ctrl+Alt+I`]**

"Now I'm switching to our **Architect** custom agent. The plan context carries forward automatically."

**[Open `prompts/workflow-prompts.md` and copy Stage 1 prompt]**

**Paste prompt and submit:**

```text
Design an Azure architecture for the Contoso Healthcare patient portal based on our plan.

**Business Context:**
- Organization: Mid-sized healthcare provider
- Patients: 10,000 active patients
- Staff: 50 clinical and administrative users
- Compliance: HIPAA mandatory (BAA required)

**Technical Requirements:**
- Budget: $800/month maximum
- SLA: 99.9% uptime minimum
- Regions: swedencentral preferred (sustainable operations)
- Performance: Support 60+ concurrent users
...
```

**While agent processes (30-60 seconds):**

"The Architect agent is trained on the Azure Well-Architected Framework. It uses the context from our Plan Agent to assess this scenario across 5 pillars: Security, Reliability, Performance, Cost, and Operations."

**[Agent returns results - scroll through output]**

**Highlight key sections:**

1. **WAF Scores:**

```yaml
Security: 9/10 (High confidence) - Private endpoints, managed identities
Reliability: 7/10 (Medium) - Zone redundancy limited by budget
Cost: 8/10 (High) - $334/month well under $800 budget
```

"Notice it scored each pillar and provided confidence levels. This helps us understand trade-offs."

1. **Service Recommendations:**

```yaml
   - App Service Standard S1 (zone-redundant, 2 instances) - $146/month
   - SQL Database Standard S2 (50 DTUs) - $150/month
   - Key Vault for secrets management - $3/month
   ...
```

"It recommended specific SKUs with justifications and costs."

1. **HIPAA Compliance:**

```text
   ✅ Encryption at rest (TDE for SQL Database)
   ✅ Encryption in transit (TLS 1.2 minimum)
   ✅ Private endpoints for network isolation
   ✅ Audit logging to Log Analytics
   ...
```

"Compliance requirements are automatically mapped."

**[Scroll to bottom - find handoff button]**

"Now here's the magic - see this **'Plan Bicep Implementation'** button? This hands off to the next agent with full context preserved - both the original plan AND the architecture assessment."

**[Click handoff button]**

---

### Stage 2: Implementation Planning (18:00 - 25:00)

**[Bicep Planning Specialist agent auto-selects]**

"The Bicep Planning Specialist is now active. It received the entire conversation - the original plan from Stage 0, AND the architecture assessment from Stage 1. No copy/paste needed!"

**[Agent processes and returns implementation plan]**

**Scroll through output, highlighting:**

1. **Resource Definitions:**

   ```yaml
   - resourceGroup:
       name: rg-contoso-patient-portal
       kind: Raw
       purpose: Foundation container for all resources
       estimatedCost:
         sku: N/A
         monthlyRange: $0
   ```

````

   "Each resource is fully specified with purpose, dependencies, parameters, and costs."

2. **Mermaid Dependency Diagram:**

   ```mermaid
%%{init: {'theme':'neutral'}}%%
   graph TD
       RG[Resource Group] --> VNet[Virtual Network]
       VNet --> NSGs[Network Security Groups]
       ...
````

"Visual dependency graph shows deployment order."

1. **4-Phase Implementation:**

```yaml
Phase 1: Foundation (8 tasks)
Phase 2: Platform Services (8 tasks)
Phase 3: Security & Application (9 tasks)
Phase 4: Configuration & Access (10 tasks)
```

"Progressive deployment ensures dependencies are met."

1. **Cost Table:**

```bicep
   | Resource | Monthly Cost |
   |----------|--------------|
   | App Service Plan | $146 |
   | SQL Database | $150 |
   | Total | $331-346 |
```

"Detailed cost breakdown with optimization opportunities."

**[Find handoff button at bottom]**

"Now we hand off to the Bicep Implementation Specialist..."

**[Click 'Generate Bicep Code' button]**

---

### Stage 3: Bicep Template Generation (25:00 - 38:00)

**[Bicep Implementation Specialist agent auto-selects]**

"The implementation specialist generates near-production-ready Bicep templates from the plan."

**[Agent generates templates]**

**[Navigate to `../../infra/bicep/contoso-patient-portal/` in Explorer]**

"Let's look at what was generated..."

**[Open `main.bicep`]**

```bicep
// Main orchestration template
targetScope = 'subscription'

param location string = 'eastus2'
param environment string = 'prod'
...
```

"Clean, modular main orchestrator with clear structure."

**[Open `modules/` directory]**

"11 separate module files - each with single responsibility:

- `networking.bicep` - VNet, subnets, NSGs
- `app-service.bicep` - Web application hosting
- `sql-database.bicep` - Database with TDE encryption
- `key-vault.bicep` - Secrets management
- `private-endpoints.bicep` - Secure connectivity
  ..."

**[Open `deploy.ps1`]**

```powershell
# Deployment script with validation
function Test-Prerequisites {
    # Check Azure CLI...
    # Check Bicep CLI...
    # Check authentication...
}
```

"Deployment automation with pre-flight checks, validation, and error handling."

**[Optional: Live Validation]**

**If time permits, run validation:**

```powershell
cd infra/bicep/contoso-patient-portal
bicep build main.bicep --stdout --no-restore
```

**[Show successful compilation]**

"Zero errors - near-production-ready on first attempt!"

```powershell
bicep lint main.bicep
```

"Linting passes - follows Azure best practices."

**[Optional: Show what-if]**

```powershell
.\deploy.ps1 -WhatIf
```

"What-if shows exactly what would be deployed - no surprises."

---

### Value Summary (38:00 - 45:00)

**[Switch back to presentation or verbal summary]**

"Let's recap what we just accomplished in 45 minutes:

**Traditional Approach:**

- Requirements Analysis & Research: 2-4 hours
- Architecture Assessment: 4-6 hours
- Implementation Planning: 3-6 hours
- Bicep Template Creation: 6-8 hours
- **Total: 15-24 hours**

**With 5-Agent Workflow (Plan-First):**

- Stage 0 (Plan Agent): 7 minutes
- Stage 1 (Architecture): 8 minutes
- Stage 2 (Planning): 7 minutes
- Stage 3 (Implementation): 13 minutes
- **Total: 35-45 minutes**

**Time Savings: 95%**

**Time Comparison:**

- Traditional: 18-20 hours
- With agentic workflow: 45 minutes - 1 hour
- **Time saved: 17+ hours per project**

**Key Benefits of Starting with Plan Agent:**

✅ **Research before code**: Plan Agent uses read-only tools to understand requirements  
✅ **Reusable plans**: `*.prompt.md` files can be shared with team or reused  
✅ **Clarifying questions**: Identifies gaps before architecture decisions  
✅ **Progress tracking**: Todo list tracks completion during implementation

**But it's not just speed...**

✅ **Consistent Quality**: Best practices applied automatically  
✅ **No Context Loss**: Plan → Architecture → Implementation with full context  
✅ **Security Defaults**: HIPAA compliance built-in  
✅ **Production Ready**: Deployable immediately  
✅ **Always Documented**: Living documentation via plan files

---

### Q&A and Next Steps (45:00 - 50:00)

**Common Questions:**

**Q: What's the difference between Plan Agent and the custom agents?**
A: Plan Agent is built into VS Code - it researches and plans using read-only tools. Custom agents like `architect` are specialized for specific domains and can generate outputs. Plan researches, custom agents implement.

**Q: Can I skip the Plan Agent and go straight to architecture?**
A: Yes, for simple projects. But for complex multi-step work, Plan Agent ensures you understand requirements before implementation. It often catches issues early.

**Q: What happens to the `*.prompt.md` files?**
A: They're saved in your workspace and can be edited, shared with team members, or invoked later. They're reusable implementation blueprints.

**Q: Does this work for other compliance frameworks?**
A: Yes! Swap HIPAA for PCI-DSS, SOC 2, or ISO 27001 in Stage 1 prompt.

**Q: Can I customize agent behavior?**
A: Absolutely. Edit `.github/agents/*.agent.md` files to adjust instructions. Plan Agent behavior is configured via VS Code settings.

**Q: What if I disagree with recommendations?**
A: You control the process - iterate in Plan mode to refine, edit outputs before proceeding to next stage, or regenerate with different constraints.

**Q: Does this replace architects?**
A: No - it augments them. Architects make decisions; agents handle time-consuming documentation and code generation.

**Q: What about other clouds (AWS, GCP)?**
A: The workflow pattern applies universally. You'd need to create cloud-specific agents with appropriate best practices.

**Next Steps for Audience:**

1. **Try It**: Use this demo scenario on your own machine
2. **Customize**: Edit prompts for your customer scenarios
3. **Experiment**: Adjust budgets, compliance requirements, complexity
4. **Share**: Show colleagues and customers the ROI

**Where to Find Everything:**

- Demo Files: `scenarios/S02-agentic-workflow/`
- Agent Configuration: `.github/agents/`
- Full Workflow Guide: `docs/reference/workflow.md`
- Bicep Templates: `infra/bicep/contoso-patient-portal/`

---

## 🎭 Abbreviated Demo (20-25 minutes)

If short on time, use this condensed version:

1. **Opening (2 min)**: Show requirements, state traditional timeline
2. **Stage 0 - Plan (4 min)**: Select Plan agent, submit prompt, show plan draft with steps and questions, mention `*.prompt.md` file
3. **Stage 1 (5 min)**: Submit prompt, highlight WAF scores and cost estimate only, click handoff
4. **Stage 2 (3 min)**: Show resource list and Mermaid diagram only, click handoff
5. **Stage 3 (6 min)**: Show generated file structure and one module file only
6. **Wrap-up (3 min)**: ROI metrics and Q&A

## 🎨 Presentation Variations

### For Executives

- Focus on time savings (19 hours saved per project)
- Emphasize speed to market (12-week timeline achievable)
- Highlight risk reduction (security defaults, compliance automation)

### For Architects

- Deep-dive WAF scores and trade-off analysis
- Show architecture diagram generation
- Discuss customization of agent instructions

### For Developers

- Focus on code quality (modular templates, security defaults)
- Show validation commands (bicep build/lint)
- Demonstrate deployment automation

### For IT Pros

- Emphasize operational benefits (standardization, reproducibility)
- Show deployment script pre-flight checks
- Discuss rollback and troubleshooting procedures

## 🧪 Interactive Elements

### Audience Participation Ideas

1. **Change a Requirement**: Ask audience to suggest budget change ($200 or $2,000) and regenerate Stage 1
2. **Add Compliance**: Ask what industry they're in and add compliance requirement (PCI-DSS, SOC 2)
3. **Complexity Vote**: Ask if they want simpler (Basic tier) or more complex (multi-region) version

### Live Demos

- Deploy to actual Azure subscription (requires 30-45 min total)
- Show Azure Portal resources after deployment
- Test App Service URL accessibility

## 📝 Presenter Notes

### Timing Tips

- **Stage 0 Plan generation**: ~30-60 seconds (explain plan-first approach while waiting)
- **Stage 1 Architecture generation**: ~30-60 seconds (talk about WAF pillars while waiting)
- **Stage 2 Planning generation**: ~45-90 seconds (explain Mermaid diagram benefits)
- **Stage 3 Bicep generation**: ~60-120 seconds (discuss modular design principles)

### Things That Can Go Wrong

- **Plan Agent not showing in dropdown**: Ensure VS Code and GitHub Copilot extension are up to date (Plan is built-in since late 2024)
- **Custom agent not available**: Verify GitHub Copilot subscription and custom agent configuration in `.github/agents/`
- **Handoff button missing**: Manually copy context and switch agents via `Ctrl+Alt+I`
- **Plan file not saving**: Check workspace write permissions
- **Bicep validation fails**: Use pre-generated templates from `solution/outputs/` directory
- **Sorry, the response hit the length limit. Please rephrase your prompt error**: Update the prompt to stay within the allowed limits, or break it into smaller requests, or consider switching to a different model.
- **Audience questions derail timing**: "Great question - let's discuss after the demo"

### Energy Management

- Pause after each agent output to let audience absorb
- Use humor: "I'm pressing a button and getting near-production-ready code - this still amazes me"
- Invite reactions: "Have you seen anything like this before?"

---

**Demo Version**: 1.0.0  
**Last Updated**: November 18, 2025  
**Tested By**: GitHub Copilot team  
**Feedback**: Open an issue in the repo
