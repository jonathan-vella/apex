# S02: Seven-Step Agent Workflow for Azure Infrastructure

> **Version 5.3.0** | [Back to Scenarios](../README.md)

## Meet Jennifer Chen

> _"My clients pay for architecture, not typing. Every hour I spend on boilerplate
> is an hour I'm not designing solutions."_

**Jennifer Chen** is a Solutions Architect at Meridian Systems, a Microsoft SI Partner specializing
in healthcare. She has a new client engagement: Contoso Healthcare needs a HIPAA-compliant patient
portal with a tight budget ($800/month) and ambitious timeline. Jennifer knows the 7-step agent
workflow will be her secret weapon—turning 18 hours of manual work into a 45-minute structured process.

---

## 🎯 Overview

This demo showcases GitHub Copilot's **7-step agent workflow** for designing and implementing Azure infrastructure,
starting with VS Code's built-in **Plan Agent** and handing off to specialized custom agents.
Each step includes an **approval gate** where you review and approve before proceeding.
It demonstrates how architects and IT professionals can leverage plan-driven development
to move from business requirements to near-production-ready Bicep templates through a structured, iterative process.

> **Working Implementation**: The complete workflow output is available as near-production-ready infrastructure
> in [`../../infra/bicep/contoso-patient-portal/`](../../infra/bicep/contoso-patient-portal/)
> (1,070 lines of Bicep, 10 modules).
>
> **📖 Official Documentation**:
> See [VS Code Plan Agent Documentation](https://code.visualstudio.com/docs/copilot/chat/chat-planning)
> for complete details on the built-in planning features.

**Target Audience**: Solution Architects, Cloud Architects, Infrastructure Engineers, IT Professionals

**Scenario**: Design and implement a HIPAA-compliant patient portal for Contoso Healthcare

**Time**: 45-60 minutes (full workflow) or 15-20 minutes (abbreviated demo)

## 🌟 Why This Matters

Traditional infrastructure design involves:

- ⏱️ **Hours of manual work**: Requirements → Architecture → Code
- 📝 **Context loss**: Switching between tools and formats
- 🔄 **Rework**: Architectural decisions not reflected in code
- 📚 **Documentation lag**: Code and docs out of sync
- 🎯 **Scope creep**: No structured planning before implementation

**With 7-Step Agentic Workflow (Plan-First with Approval Gates)**:

- 📋 **Research before code**: VS Code Plan Agent researches comprehensively before any changes
- ✅ **Approval gates**: Review and approve each step before proceeding
- ⚡ **45 minutes**: Complete workflow from requirements to deployable code (vs. 18 hours manual)
- 🔗 **Automatic handoffs**: Context preserved between agents via UI controls
- ✅ **Aligned outputs**: Plan drives architecture drives implementation
- 📖 **Living documentation**: Plans saved as reusable `*.prompt.md` files
- 💰 **Cost-validated**: Budget estimates before implementation
- 📊 **Progress tracking**: Built-in todo list tracks completion during complex tasks
- 🎨 **Optional diagrams**: Generate Python architecture diagrams at any step

## Related Assets

| Resource                                                            | Description                          |
| ------------------------------------------------------------------- | ------------------------------------ |
| [Contoso Patient Portal](../../infra/bicep/contoso-patient-portal/) | Working implementation (1,070 lines) |
| [Workflow Guide](../../docs/reference/workflow.md)                  | Complete workflow documentation      |
| [ADR-003: AVM-First](../../docs/adr/ADR-003-avm-first-approach.md)  | Module selection rationale           |
| [Presenter Toolkit](../../docs/presenter/)                          | Demo delivery guides                 |
| [S03: Documentation](../S03-documentation-generation/)              | Next: documentation automation       |

## 🤖 The Seven Steps

### Step 1: Requirements Agent (`@requirements`) - _Custom Agent - Start Here_

> **This is a custom agent**, not VS Code's built-in Plan agent.
> It's designed to research and plan before any code changes are made.

- **Purpose**: Research tasks comprehensively using read-only tools and codebase analysis before implementation
- **Input**: High-level tasks (features, refactoring, bugs, infrastructure projects)
- **Output**:
  - High-level summary with breakdown of steps
  - Open questions for clarification
  - Saved plan as `*.prompt.md` file (editable prompt file)
  - Handoff controls to implementation agents
- **Key Features**:
  - **Read-only research**: Analyzes codebase without making changes
  - **Iterative refinement**: Stay in plan mode to refine before implementation
  - **Plan files**: Generates `*.prompt.md` files you can edit and reuse
  - **Todo tracking**: Creates todo list to track progress during complex tasks
  - **UI controls**: "Save Plan" or "Hand off to implementation agent" buttons

**How to Use**:

1. Open Chat view (`Ctrl+Alt+I`)
2. Select **Plan** from the agents dropdown
3. Enter your high-level task and submit
4. Preview the proposed plan draft and provide feedback for iteration
5. Once finalized, save the plan or hand off to an implementation agent

**Example Prompts**:

- "Design a HIPAA-compliant patient portal for Contoso Healthcare with $800/month budget"
- "Create infrastructure for a multi-tier web application with Azure App Service and SQL Database"
- "Implement zone-redundant deployment for existing application"

**Usage**: Always start with `@requirements` for multi-step infrastructure projects.
The plan ensures all requirements are considered before any code changes.

### Step 2: Architect (`architect`)

- **Purpose**: Azure Well-Architected Framework assessment (NO CODE CREATION)
- **Input**: Business requirements, constraints, technical needs
- **Output**: WAF scores, service recommendations, cost estimates, HIPAA compliance mapping
- **Approval Gate**: Review WAF assessment before proceeding
- **Handoff**: Architecture assessment → Bicep Planning Specialist
- **Optional**: Generate Architecture Diagram → diagram

### Step 3: Design Artifacts (Optional)

- **Purpose**: Generate design documentation before implementation
- **Agents**: `diagram` and `adr`
- **Output**: Architecture diagrams with `-des` suffix, ADRs for proposed decisions
- **Handoff**: Continue to Bicep Planning Specialist

### Step 4: Bicep Planning Specialist (`bicep-plan`)

- **Purpose**: Machine-readable implementation plan with governance discovery
- **Input**: Architecture assessment
- **Output**: Resource definitions, dependencies, cost tables, governance constraints
- **Governance**: Discovers Azure Policy constraints before planning
- **Approval Gate**: Review implementation plan before code generation
- **Handoff**: Implementation plan → Bicep Implementation Specialist

### Step 5: Bicep Implementation Specialist (`bicep-code`)

- **Purpose**: near-production-ready Bicep templates
- **Input**: Implementation plan
- **Output**: Modular Bicep templates, parameter files, deployment scripts
- **Approval Gate**: Review generated code before deployment
- **Handoff**: Templates ready for deployment
- **Regional Default**: `swedencentral` (renewable energy)
- **Naming Convention**: Generates unique suffixes using `uniqueString()` to prevent resource name collisions
- **Optional**: Generate Architecture Diagram → diagram

### Step 7: As-Built Artifacts (Optional)

- **Purpose**: Generate as-built documentation after implementation
- **Agents**: `diagram` and `adr`
- **Output**: Architecture diagrams with `-ab` suffix, ADRs for implemented decisions
- **Use Case**: Document final state, any deviations from design

### Optional: ADR Generator (`adr`)

- **Purpose**: Document architectural decisions for enterprise governance
- **Input**: Architecture discussions, trade-offs, decisions from any step
- **Output**: Structured ADR in markdown format (saved to `/docs/adr/`)
- **Use Case**: Document key decisions during workflow (skip for speed-focused demos)

### Optional: Diagram Generator (`diagram`)

- **Purpose**: Generate Python architecture diagrams using `diagrams` library
- **Input**: Architecture context from Step 2 or Step 4
- **Output**: Python file + PNG image in `docs/diagrams/`
- **Use Case**: Visual documentation for stakeholders

## 📋 Scenario: Contoso Healthcare Patient Portal

**Business Context**:

- **Organization**: Contoso Healthcare (mid-sized healthcare provider)
- **Need**: Secure patient portal for appointment scheduling, medical records access
- **Patients**: 10,000 active patients
- **Staff**: 50 clinical and administrative users
- **Compliance**: HIPAA mandatory (BAA required)

**Technical Requirements**:

- **Budget**: $800/month maximum
- **SLA**: 99.9% uptime minimum
- **Region**: Default `swedencentral` (can adjust for latency/compliance)
- **Performance**: Support 60+ concurrent users
- **Security**: Encryption at rest and in transit, audit logging, unique resource names

**Constraints**:

- Must deploy within 4 weeks
- Team has Azure experience but limited IaC expertise
- Prefer managed services over IaaS

## 🚀 Quick Start

### Prerequisites

- Visual Studio Code with GitHub Copilot (Plan Agent is built-in)
- Azure subscription (for deployment validation)
- Custom agents configured (see [Workflow Guide](../../docs/reference/workflow.md))

### Run the Demo

1. **Navigate to prompts directory**:

   ```powershell
   cd scenarios/S02-agentic-workflow/prompts
   ```

2. **Open VS Code**:

   ```powershell
   code .
   ```

3. **Open GitHub Copilot Chat** (`Ctrl+Alt+I`)

4. **Follow the agentic workflow**:

   | Stage | Agent                   | Duration  | Key Output                               |
   | ----- | ----------------------- | --------- | ---------------------------------------- |
   | 0     | `Requirements` (custom) | 5-10 min  | Implementation plan + `*.prompt.md` file |
   | 1     | `architect`             | 10-15 min | WAF assessment + cost estimates          |
   | 2     | `bicep-plan`            | 5-10 min  | Resource breakdown + Mermaid diagram     |
   | 3     | `bicep-code`            | 10-15 min | Modular Bicep templates                  |
   | 4     | Validation & Deployment | 5-10 min  | `bicep build` + `bicep lint`             |

5. **Pro Tip**: Use the UI handoff controls at the end of each agent's response to seamlessly transition
   to the next agent with full context preserved.

See [DEMO-SCRIPT.md](DEMO-SCRIPT.md) for detailed walkthrough.

## 📁 Demo Structure

```text
S02-agentic-workflow/
├── README.md                           # This file
├── DEMO-SCRIPT.md                      # Step-by-step presentation guide
├── scenario/
│   ├── business-requirements.md        # Customer scenario details
│   └── architecture-diagram.md         # Target architecture visual
├── prompts/
│   └── workflow-prompts.md             # All prompts for the workflow stages
├── solution/
│   ├── outputs/
│   │   ├── README.md                   # Outputs index
│   │   ├── stage1-architecture-assessment.md   # WAF scores, recommendations
│   │   └── stage2-implementation-plan.md       # Resource definitions, dependencies
│   └── templates/
│       └── [Link to infra/bicep/contoso-patient-portal/]
└── [Workflow Output: ../../agent-output/contoso-patient-portal/]
    ├── 00-plan.md                      # Requirements Agent output
    ├── 01-azure-architect.md           # WAF assessment
    ├── 02-bicep-plan.md                # Implementation plan
    ├── 03-bicep-code-gen.md            # Bicep generation
    └── contoso-cost-estimate.md        # Cost breakdown (~$207/mo)
```

## 🎬 Demo Flow

### Part 0: Planning with Requirements Agent (5-10 minutes)

**Agent**: `@requirements` (Custom)

1. Open Copilot Chat (`Ctrl+Alt+I`)
2. Select **Plan** from the agents dropdown
3. Submit the high-level requirement:

   ```text
   Design a HIPAA-compliant patient portal for Contoso Healthcare.
   - 10,000 patients, 50 staff members
   - $800/month budget constraint
   - 99.9% SLA requirement
   - 3-month implementation timeline
   ```

4. Review the plan draft:
   - High-level summary of the approach
   - Breakdown of implementation steps
   - Open questions for clarification (answer these to refine)
5. **Iterate**: Provide feedback to refine the plan ("Add security considerations", "Include cost breakdown")
6. **Save or Handoff**:
   - Click **"Save Plan"** → Generates `*.prompt.md` file for later use
   - OR Click **"Hand off to implementation agent"** → Proceed to architecture

**Key Takeaway**: Plan Agent researches comprehensively before any code changes.
The plan becomes a reusable `*.prompt.md` file.

### Part 1: Architecture Design (10-15 minutes)

**Agent**: `architect`

1. From Plan Agent handoff, or select Architect agent (`Ctrl+Alt+I`)
2. The plan context is automatically passed to the architect
3. Review outputs:
   - WAF scores (Security: 9/10, Reliability: 7/10, etc.)
   - Service recommendations with justification
   - Cost breakdown ($334/month vs $800 budget)
   - HIPAA compliance checklist
4. **Click "Plan Bicep Implementation" handoff button**

**Key Takeaway**: Agent provides comprehensive architecture assessment in ~2 minutes vs. hours of manual analysis.

### Part 2: Implementation Planning (10 minutes)

**Agent**: `bicep-plan`

1. Agent auto-selects from handoff
2. Review implementation plan:
   - 12 Azure resources with complete specs
   - Mermaid dependency diagram
   - 4-phase deployment strategy (35 tasks)
   - Cost estimation table
   - Testing procedures
3. **Click "Generate Bicep Code" handoff button**

**Key Takeaway**: Machine-readable plan bridges architecture and code, eliminating manual translation errors.

### Part 3: Bicep Template Generation (15 minutes)

**Agent**: `bicep-code`

1. Agent auto-selects from handoff
2. Review generated templates:
   - `main.bicep` orchestrator
   - 11 modular templates
   - Parameter files for environments
   - Deployment automation script
3. Validate templates:

   ```powershell
   cd solution/templates
   bicep build main.bicep --stdout --no-restore
   bicep lint main.bicep
   ```

````

4. (Optional) What-if deployment:

   ```powershell
   .\deploy.ps1 -WhatIf
````

**Key Takeaway**: near-production-ready templates in minutes, following Azure best practices and security defaults.

## 📊 Value Metrics

| Metric                      | Traditional Approach     | With 5-Agent Workflow | Improvement        |
| --------------------------- | ------------------------ | --------------------- | ------------------ |
| **Planning & Requirements** | 1-2 hours                | 5 minutes             | **96% reduction**  |
| **Architecture Assessment** | 2-4 hours                | 5 minutes             | **96% reduction**  |
| **Implementation Planning** | 3-6 hours                | 5 minutes             | **95% reduction**  |
| **Bicep Template Creation** | 4-8 hours                | 10 minutes            | **95% reduction**  |
| **Total Time**              | 10-20 hours              | 45 minutes            | **96% reduction**  |
| **Context Loss**            | High (multiple handoffs) | None (automatic)      | **Eliminated**     |
| **Documentation**           | Manual, often outdated   | Auto-generated        | **Always current** |

**Time Savings**:

- Traditional approach: 18 hours
- With agentic workflow: 1 hour
- **Time saved: 17 hours per project (94% reduction)**

## 🔑 Key Features Demonstrated

### Agent Handoffs

- **Automatic context transfer** between agents
- **No copy/paste required** - seamless workflow
- **Preserved decisions** - architecture drives implementation

### Security Defaults

- HTTPS-only enforcement
- TLS 1.2 minimum on all services
- Private endpoints for data tier
- Managed identities (no passwords)
- Entra ID Authentication for SQL Server
- NSG deny-all defaults

### Cost Optimization

- Service recommendations within budget
- Reservation opportunities identified
- Monthly cost breakdown with drivers
- Alternative SKU suggestions

### Compliance

- HIPAA compliance mapping
- Azure BAA coverage confirmation
- Encryption at rest and in transit
- Audit logging to Log Analytics

### Production Readiness

- Modular, maintainable templates
- Environment-specific parameters
- Deployment automation
- Validation procedures
- Rollback strategies

## 🎯 Learning Objectives

By the end of this demo, participants will:

1. ✅ Understand the **7-step agentic workflow** for Azure infrastructure (starting with Plan Agent)
2. ✅ Use VS Code's built-in **Plan Agent** to research before implementing
3. ✅ Generate and edit **`*.prompt.md` plan files** for reusable workflows
4. ✅ Use agent handoff buttons/controls for seamless transitions
5. ✅ Interpret WAF scores and architecture recommendations
6. ✅ Navigate implementation plans to understand dependencies
7. ✅ Validate generated Bicep templates
8. ✅ Articulate time savings and ROI to stakeholders

## 🛠️ Customization Options

### Adjust Scenario Complexity

**Simpler** (20-min demo):

- Remove private endpoints
- Use Basic tier services
- Single region deployment
- Skip ADR generation

**More Complex** (60-min demo):

- Add Azure Front Door with WAF
- Multi-region with Traffic Manager
- Azure Firewall for network security
- Customer-managed keys for encryption
- Include ADR generation for decisions

### Change Industry Vertical

- **Financial Services**: PCI-DSS compliance, fraud detection
- **Retail**: E-commerce platform, inventory management
- **Manufacturing**: IoT hub, predictive maintenance
- **Education**: Learning management system, student portal

### Vary Budget/Scale

- **Small**: $200/month (Basic tiers, single instance)
- **Medium**: $800/month (Standard tiers, zone redundancy) ← Current scenario
- **Large**: $5,000/month (Premium tiers, multi-region, advanced security)

## 📚 Resources

### Documentation

- [VS Code Plan Agent Documentation](https://code.visualstudio.com/docs/copilot/chat/chat-planning) -
  **Official VS Code docs for built-in Plan Agent**
- [Workflow Guide](../../docs/reference/workflow.md) - Complete documentation with agent handoffs
- [Custom Agent Configuration](../../.github/agents/) - Agent definitions with swedencentral defaults
- [Azure Well-Architected Framework](https://learn.microsoft.com/azure/well-architected/)
- [Azure Verified Modules](https://azure.github.io/Azure-Verified-Modules/)
- [Context Engineering Guide](https://code.visualstudio.com/docs/copilot/guides/context-engineering-guide) -
  Best practices for AI-assisted development

### Related Demos

- [Demo 01: Bicep Baseline (S01)](../S01-bicep-baseline/) - Intro to Bicep with Copilot
- [Demo 03: Documentation Generation (S03)](../S03-documentation-generation/) - Documentation automation

### Workflow Output Files

- [Contoso Patient Portal Outputs](../../agent-output/contoso-patient-portal/) - Complete workflow documentation
- [Cost Estimate](../../agent-output/contoso-patient-portal/contoso-cost-estimate.md) - Detailed pricing (~$207/mo)

### Implementation Files

- [Bicep Templates](../../infra/bicep/contoso-patient-portal/)
- [Deployment Script](../../infra/bicep/contoso-patient-portal/deploy.ps1)

## 🎤 Presentation Tips

### Opening (2 minutes)

- **Hook**: "What if you could go from customer requirements to near-production-ready infrastructure in 30 minutes?"
- Present traditional timeline (2-3 days)
- Introduce 7-step agentic workflow concept (7-step workflow with approval gates)

### During Demo (35 minutes)

- **Pause after each agent output** - let audience absorb
- **Highlight surprises** - "Notice Copilot included HIPAA compliance automatically"
- **Show before/after** - manual effort vs. agent output
- **Invite questions** - engage audience throughout

### Closing (3 minutes)

- **Summarize metrics** - 95% time reduction, 17 hours saved per project
- **Emphasize production-readiness** - not just quick, but correct
- **Call to action** - "Try this with your next project"

### Common Questions

**Q: Does this work for non-Azure clouds?**
A: Agents are Azure-specific, but the workflow pattern applies. Similar agents could be built for AWS/GCP.

**Q: Can I customize agent behavior?**
A: Yes! Edit agent.md files in `.github/agents/` to adjust instructions, add patterns,
or change output formats.

**Q: What if I disagree with agent recommendations?**
A: Agents provide guidance, not mandates.
You can edit outputs before proceeding to next stage or regenerate with different constraints.

**Q: Does this replace architects?**
A: No - it augments their capabilities. Architects still make decisions;
agents handle time-consuming documentation and code generation.

## 🧪 Variations to Try

1. **Change Compliance Requirements**:
   - Swap HIPAA for PCI-DSS or SOC 2
   - Observe how recommendations change

2. **Adjust Budget**:
   - Set budget to $200/month or $5,000/month
   - See how SKU recommendations adapt

3. **Add Specific Requirements**:
   - "Must use Azure Firewall"
   - "Require multi-region active-active"
   - See how architecture adjusts

4. **Generate ADR**:
   - After Stage 1, use ADR agent
   - Document decision to use Standard vs. Premium tiers

## ✅ Success Criteria

Demo is successful when audience:

- [ ] Understands the **7-step agentic workflow** concept (starting with VS Code's built-in Plan Agent)
- [ ] Recognizes Plan Agent as a **custom agent** (not a custom agent)
- [ ] Understands how **`*.prompt.md` files** preserve and share implementation plans
- [ ] Sees value in automatic context handoffs via UI controls
- [ ] Recognizes time savings (96% reduction, 18 hours → 45 minutes)
- [ ] Appreciates near-production-ready output quality (unique suffixes, regional defaults)
- [ ] Wants to try it on their own projects

## 📝 Feedback & Improvement

This demo was created from an actual test execution of the 7-step agentic workflow. If you have suggestions for improvement:

1. Open an issue in the repository
2. Describe your scenario/variation
3. Share outcomes and lessons learned

---

## 🎓 Trainer Notes

> **For instructors delivering this scenario in workshops or training sessions.**

### Audience Assessment

Before starting, gauge your audience:

| Question                                | If "Yes"   | Adjust Approach                         |
| --------------------------------------- | ---------- | --------------------------------------- |
| "Who has used GitHub Copilot Chat?"     | Many hands | Skip basic Copilot intro                |
| "Who has built Bicep/ARM templates?"    | Most       | Focus on workflow, not syntax           |
| "Who has designed HIPAA architectures?" | Some       | They can validate agent recommendations |
| "Who has used VS Code Plan Agent?"      | Few        | Spend more time on Step 1 demo          |

### Common Stumbling Points

| Phase                 | Issue                         | How to Help                                    |
| --------------------- | ----------------------------- | ---------------------------------------------- |
| Step 1 (Requirements) | "Where's the Plan Agent?"     | Show `Ctrl+Alt+I` agent picker                 |
| Step 2 (Architect)    | "Why no code?"                | Emphasize WAF guidance vs implementation       |
| Step 4 (Bicep Plan)   | "Too much output"             | Use collapsible sections, focus on key modules |
| Step 5 (Bicep Code)   | "Validation errors"           | Expected! Show iterative refinement            |
| Handoffs              | "Lost context between agents" | Demonstrate UI handoff buttons                 |

### Facilitation Tips

1. **Demo the approval gates** — Show how to review before proceeding
2. **Use a timer** — 45 minutes is achievable; don't rush Step 2
3. **Show the generated `.prompt.md` files** — Plans are reusable artifacts
4. **Validate live** — Run `bicep build` to prove code works
5. **Compare to manual** — "This took 18 hours without agents"

### Time Adjustments

| Audience               | Recommended Time | Focus Areas                                  |
| ---------------------- | ---------------- | -------------------------------------------- |
| Architects             | 30 min           | Skip basics, focus on WAF assessment quality |
| Developers             | 45 min           | Full workflow, emphasize code generation     |
| IT Pros new to IaC     | 60 min           | Extended Step 1, more explanation            |
| Executives (demo only) | 20 min           | Abbreviated, focus on time savings           |

### Post-Session Resources

Share these with participants:

- 📖 This README and `examples/agentic-workflow-conversation.md`
- 🎯 [Workflow Guide](../../docs/reference/workflow.md)
- 📚 [VS Code Plan Agent Docs](https://code.visualstudio.com/docs/copilot/chat/chat-planning)
- 💬 Repository issues for questions

---

**Demo Version**: 1.0.0  
**Last Updated**: November 18, 2025  
**Tested With**: GitHub Copilot (Claude Sonnet 4.5), Azure CLI 2.50.0+, Bicep 0.20.0+
