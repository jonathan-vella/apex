# Workflow Prompts: Healthcare Patient Portal Scenario

**Scenario:** Contoso Healthcare Inc. - HIPAA-compliant patient portal for appointment scheduling  
**Use Case:** Demonstrates agentic workflow starting with the custom Requirements Agent  
**Budget:** $800/month | **Users:** 10,000 patients, 50 staff | **Timeline:** 3 months

> 💡 **Plan-First Approach:** This workflow starts with the custom Requirements Agent (`@requirements`) to research
> and break down the project before diving into architecture. The Requirements Agent uses read-only tools
> to understand requirements, generates clarifying questions, and produces reusable `*.prompt.md` files.
> See [VS Code Plan Agent Documentation](https://code.visualstudio.com/docs/copilot/chat/chat-planning) for details on VS Code's built-in Plan agent.

> 💡 **Discovery-First Approach:** Each stage includes discovery questions to help you understand
> _why_ agents make specific recommendations, not just _what_ they recommend. Ask these questions
> during your conversation to deepen your understanding of Azure architecture and Bicep patterns.

---

## Stage 0: Planning with Requirements Agent

**Agent:** `@requirements` (Custom - Select "Requirements" from agents dropdown)  
**Objective:** Research requirements comprehensively and create actionable implementation plan before architecture

> **Key Capability:** The Requirements Agent is a custom agent that:
>
> - **Researches using read-only tools** - analyzes codebase without making changes
> - **Breaks down tasks** into manageable, actionable steps
> - **Asks clarifying questions** to refine understanding
> - **Generates `*.prompt.md` files** - reusable, editable plan documents
> - **Provides handoff controls** - "Save Plan" or "Hand off to implementation agent"

### How to Invoke

1. Open Chat view (`Ctrl+Alt+I`)
2. Select **Plan** from the agents dropdown (not a custom agent)
3. Enter your high-level task and submit
4. Review the plan draft, answer clarifying questions
5. Iterate until satisfied, then save or hand off

### Discovery Questions (Ask Before/During)

Understanding plan-driven development:

```text
- Why should I plan before jumping into architecture?
- How does Plan Agent research without making changes?
- What should I include in my initial prompt vs. wait for clarifying questions?
```

Understanding project scope:

```text
- What factors determine whether a project needs all 5 agents vs. fewer?
- How do you decide which specialized agent to hand off to?
- What information from the requirements doc is most critical for the plan?
```

Understanding plan files:

```text
- What is a `*.prompt.md` file and how do I use it later?
- Can I share plan files with my team?
- How do I edit a saved plan and re-invoke it?
```

### Prompt

```text
I need to design and implement a HIPAA-compliant patient portal for Contoso Healthcare.
Before diving into architecture, I want to understand the full scope and create a solid plan.

**Context:**
- 10,000 patients, 50 staff members
- $800/month budget constraint
- HIPAA compliance required (encryption, audit logging, access controls)
- 3-month implementation timeline
- Prefer managed Azure services over VMs
- Region: swedencentral preferred (sustainable operations)

Please help me:
1. Break down this project into implementation phases
2. Identify the key architectural decisions I'll need to make
3. List open questions that need clarification
4. Recommend which specialized agents to use for each phase

I'm using a agentic workflow - please help me understand when to use:
- architect (WAF assessment)
- bicep-plan (implementation planning)
- bicep-code (code generation)
- adr_generator (decision documentation - optional)
```

### Expected Plan Output

The Plan Agent should return:

- [ ] **Summary**: High-level approach to the project
- [ ] **Implementation Steps**: Breakdown into phases (Foundation, Platform, Security, etc.)
- [ ] **Open Questions**: Clarifying questions (EHR integration details? DR requirements?)
- [ ] **Agent Recommendations**: Which agents to use when
- [ ] **UI Controls**: "Save Plan" and "Hand off to implementation agent" buttons

### Iterating on the Plan

After reviewing the initial plan, provide clarifying answers:

```text
Answering your questions:
- EHR integration: REST API to existing Epic system
- DR requirements: RPO 1 hour, RTO 4 hours
- Authentication: Azure AD SSO with MFA
- Team Azure experience: Intermediate (comfortable with Portal, learning IaC)

Please refine the plan with these details.
```

### Teaching Moments to Look For

- [ ] Plan Agent uses **read-only tools** - no code changes until you hand off
- [ ] Explains the role of each specialized agent in the workflow
- [ ] Shows how requirements map to implementation phases
- [ ] Provides clarifying questions that surface hidden requirements
- [ ] Identifies decision points that will affect the final design
- [ ] Shows "Save Plan" and "Hand off" controls at the end

### Saving the Plan

When you click "Save Plan", VS Code generates a `*.prompt.md` file:

```markdown
# contoso-patient-portal-plan.prompt.md

## Summary

[High-level approach]

## Implementation Phases

### Phase 1: Foundation

- Resource group
- Networking
  ...

## Open Decisions

- [ ] DR strategy confirmation
- [ ] EHR API authentication method
      ...
```

This file can be:

- Edited and refined
- Shared with team members for review
- Invoked later to resume the workflow
- Used as documentation

### Handoff to Architecture

Click **"Hand off to implementation agent"** or manually:

1. Press `Ctrl+Alt+I`
2. Select `architect`
3. The plan context carries forward automatically

---

## Stage 1: Architect

**Agent:** `architect`  
**Objective:** Get architecture recommendations with WAF assessment and cost estimates

### Discovery Questions (Ask Before/During)

Understanding WAF pillars:

```text
- Why did you score Reliability at X/10? What would raise or lower it?
- How do the 5 WAF pillars trade off against each other in this design?
- Which pillar is most critical for HIPAA compliance and why?
```

Understanding service selection:

```text
- Why App Service over Container Apps for this scenario?
- What drove the decision to use SQL Database vs. Cosmos DB?
- When would you recommend Private Endpoints vs. Service Endpoints?
```

Understanding cost trade-offs:

```text
- What's the cost difference between S1 and P1v3 App Service?
- Which services are "must-have" for HIPAA vs. "nice-to-have"?
- How would you reduce costs if the budget was $500/month instead?
```

### Prompt

```text
Design an Azure architecture for Contoso Healthcare's patient portal.

**Business Context:**
- Company: Contoso Healthcare Inc.
- Need: Secure web-based patient portal for appointment scheduling
- Users: 10,000 patients, 50 staff members
- Launch target: 3 months

**Business Outcomes:**
- Reduce phone call volume by 60%
- Enable 24/7 appointment scheduling
- Improve patient satisfaction scores
- Demonstrate HIPAA compliance to auditors

**Technical Requirements:**
- Web application (responsive, browser-based)
- Integration with existing EHR system via REST API
- 99.9% availability SLA (8.76 hours downtime/year max)
- Response time < 2 seconds for typical operations
- Secure authentication (Azure AD SSO preferred)
- Secure storage for appointment data

**Non-Functional Requirements:**
- HIPAA compliance mandatory (encryption at rest/transit, audit logging, access controls)
- Data residency: US regions only
- Budget: $800/month operating cost
- Team has basic Azure experience (prefer managed services)
- Operational simplicity (minimal maintenance overhead)

**Constraints:**
- No custom infrastructure management (no VMs to patch)
- Must support existing EHR REST API integration
- Integration with existing corporate Azure AD tenant

Please provide:
1. Complete WAF assessment with scores for all 5 pillars
2. Recommended Azure services with specific SKUs
3. Architecture diagram description
4. Detailed monthly cost estimate
5. Security and compliance considerations
6. Trade-off analysis
7. Implementation recommendations

After your assessment, hand off to the Bicep Planning Specialist for detailed implementation planning.
```

### Expected Outputs

- [ ] All 5 WAF pillars assessed with scores (X/10)
- [ ] Confidence level stated
- [ ] Specific Azure service recommendations (App Service, Azure SQL, Key Vault, etc.)
- [ ] Cost estimate table with monthly breakdown
- [ ] HIPAA compliance mapping
- [ ] US region recommendations
- [ ] Trade-off discussions
- [ ] Links to Microsoft documentation

### Teaching Moments to Look For

- [ ] Agent explains _why_ each WAF pillar received its score
- [ ] Trade-offs are clearly articulated (cost vs. security, simplicity vs. features)
- [ ] HIPAA requirements mapped to specific Azure features (TDE, audit logs, etc.)
- [ ] Cost optimization suggestions beyond the initial recommendation

### Key Validation Points

- **Security Score:** Should be 8-10 (HIPAA requirements)
- **Cost:** Should be ≤ $800/month
- **Services:** App Service, Azure SQL Database, Key Vault, Application Insights, Private Endpoints
- **Region:** East US 2 or similar US region
- **SLA:** Composite SLO should meet 99.9% requirement

---

## Stage 2: ADR Generator (Optional)

**Agent:** `adr_generator`  
**Objective:** Document architectural decisions for compliance audit trails and team knowledge sharing

### Discovery Questions (Ask Before/During)

Understanding ADR purpose:

```text
- Why do we need ADRs for a HIPAA-compliant project?
- How do ADRs help during compliance audits?
- What's the difference between ADRs and regular documentation?
```

Understanding decision documentation:

```text
- What alternatives did we consider and why were they rejected?
- How do we document cost-driven decisions?
- What happens when a decision needs to be revisited?
```

### Prompt

```text
Create Architecture Decision Records for the key decisions in our patient portal:

**Decision 1:** Why Azure App Service over Container Apps?
**Decision 2:** Why Azure SQL Database over Cosmos DB?
**Decision 3:** Why Private Endpoints for network isolation?

For each ADR, please explain:
- The context that led to this decision
- Alternatives we considered
- Why we chose this option
- What trade-offs we're accepting

This documentation will be reviewed during HIPAA compliance audits.
```

### Teaching Moments to Look For

- [ ] ADRs explain the "why" not just the "what"
- [ ] Trade-offs are clearly documented
- [ ] Future implications are considered
- [ ] Compliance relevance is highlighted

---

## Stage 3: Bicep Planning Specialist

**Agent:** `bicep-plan`  
**Objective:** Create detailed implementation plan with diagrams and cost breakdown

### Discovery Questions (Ask Before/During)

Understanding resource dependencies:

```text
- Why must Key Vault be deployed before App Service?
- What happens if we deploy resources in the wrong order?
- How do circular dependencies get resolved in Bicep?
```

Understanding phased deployment:

```text
- Why split into multiple phases instead of one deployment?
- What's the advantage of Foundation → Platform → Security ordering?
- How do we handle failures in Phase 2 without breaking Phase 1?
```

Understanding AVM modules:

```text
- What's the advantage of using Azure Verified Modules?
- When should we use AVM vs. custom resource definitions?
- How do we customize AVM module behavior?
```

### Prompt

```bicep
Create a detailed Bicep implementation plan for the Contoso Healthcare patient portal architecture recommended in the previous assessment.

**Context from Architecture Assessment:**
- Azure App Service (Standard S1 or higher)
- Azure SQL Database (Standard tier with TDE)
- Azure Key Vault for secrets
- Application Insights for monitoring
- Azure Front Door or Application Gateway (if recommended)
- Private endpoints for security
- Azure AD integration

**Planning Requirements:**
1. Detailed resource breakdown with dependencies
2. Specific Azure resource types and API versions
3. Parameter definitions for dev/staging/prod environments
4. Mermaid dependency diagram showing deployment order
5. Cost estimation table with SKU details
6. Testing and validation strategy
7. Rollback procedures
8. Phase-based implementation approach

**Infrastructure Environments:**
- Development: Cost-optimized, single region
- Production: High availability, meets all compliance requirements

**Save Plan To:**
agent-output/contoso-patient-portal/04-implementation-plan.md

**Additional Considerations:**
- HIPAA compliance requirements (encryption, private endpoints, audit logging)
- US regions only (East US primary, Central US secondary)
- Budget constraint: $800/month for production
- Include Application Insights diagnostic settings on all resources
- Network isolation where possible (private endpoints)

After creating the plan, hand off to the Bicep Implementation Specialist to generate the templates.
```

### Expected Outputs

- [ ] Plan file created in `agent-output/contoso-patient-portal/`
- [ ] Complete resource breakdown with YAML blocks
- [ ] Mermaid dependency diagram (should render in preview)
- [ ] Cost estimation table with monthly totals
- [ ] Testing strategy documented
- [ ] Rollback procedures included
- [ ] 3-4 implementation phases defined
- [ ] Parameter structure for multiple environments

### Teaching Moments to Look For

- [ ] Resource dependencies are visualized and explained
- [ ] Phase boundaries have clear rationale
- [ ] Cost estimates refine the initial architecture estimate
- [ ] Testing strategy covers validation at each phase

### Key Validation Points

- **Plan File:** `agent-output/contoso-patient-portal/04-implementation-plan.md` exists
- **Diagram:** Mermaid syntax valid, shows resource dependencies
- **Phases:** Foundation → Platform → Security (logical deployment order)
- **Parameters:** Environment-specific (dev/prod), location, naming prefix

---

## Stage 4: Bicep Implementation Specialist

**Agent:** `bicep-code`  
**Objective:** Generate near-production-ready Bicep templates using progressive implementation

### Discovery Questions (Ask Before/During)

Understanding Bicep patterns:

```text
- Why use uniqueString() for resource names instead of manual suffixes?
- What's the purpose of @description decorators on parameters?
- How do outputs from one module become inputs to another?
```

Understanding security defaults:

```text
- Why TLS 1.2 minimum instead of TLS 1.3?
- What's the difference between managed identity and service principal?
- How does Key Vault RBAC differ from access policies?
```

Understanding validation:

```text
- What does 'bicep build' check that 'bicep lint' doesn't?
- How do we test Bicep templates without deploying?
- What are common causes of deployment failures?
```

### Prompt

```bicep
Implement the Bicep templates for the Contoso Healthcare patient portal based on the implementation plan in agent-output/contoso-patient-portal/04-implementation-plan.md

**Implementation Approach:**
Use progressive implementation pattern with these phases:

**Phase 1: Foundation Resources**
- Resource group
- Virtual network (if using private endpoints)
- Network security groups
- Azure Key Vault

Output to: temp/contoso-healthcare-portal/phase1-foundation/

**Phase 2: Data & Application Platform**
- Azure SQL Database with private endpoint
- App Service Plan
- App Service (web app)
- Application Insights

Output to: temp/contoso-healthcare-portal/phase2-platform/

**Phase 3: Security & Integration**
- Private endpoints configuration
- Diagnostic settings
- Azure AD app registration (document only, actual setup manual)
- Key Vault secrets and access policies

Output to: temp/contoso-healthcare-portal/phase3-security/

**Requirements:**
1. Use latest stable API versions (2023-05-01 or newer)
2. Include all required tags: Environment, ManagedBy, Project, CostCenter
3. Enable diagnostic settings on all resources
4. Use private endpoints for SQL Database
5. Configure TLS 1.2 minimum on all services
6. Generate deployment scripts (deploy-phase1.ps1, deploy-phase2.ps1, deploy-phase3.ps1)
7. Include parameter files for dev and prod environments
8. Add @description decorators to all parameters
9. Generate main.bicep orchestrator that can deploy all phases

**Security Defaults:**
- HTTPS only on App Service
- SQL TDE enabled
- Key Vault soft delete enabled
- No public blob access on storage (if used)
- Managed identity for App Service → Key Vault access
- Entra ID Authentication for SQL Server (User/Group)

**Validation:**
After generating each phase:
- Run bicep build
- Run bicep lint
- Document any warnings

Create a deployment guide (deploy.md) with step-by-step instructions.
```

### Expected Outputs

**Phase 1 Files:**

- [ ] `temp/contoso-healthcare-portal/phase1-foundation/main.bicep`
- [ ] `temp/contoso-healthcare-portal/phase1-foundation/parameters.dev.json`
- [ ] `temp/contoso-healthcare-portal/phase1-foundation/parameters.prod.json`
- [ ] `temp/contoso-healthcare-portal/phase1-foundation/deploy-phase1.ps1`

**Phase 2 Files:**

- [ ] `temp/contoso-healthcare-portal/phase2-platform/main.bicep`
- [ ] `temp/contoso-healthcare-portal/phase2-platform/parameters.dev.json`
- [ ] `temp/contoso-healthcare-portal/phase2-platform/parameters.prod.json`
- [ ] `temp/contoso-healthcare-portal/phase2-platform/deploy-phase2.ps1`

**Phase 3 Files:**

- [ ] `temp/contoso-healthcare-portal/phase3-security/main.bicep`
- [ ] `temp/contoso-healthcare-portal/phase3-security/parameters.dev.json`
- [ ] `temp/contoso-healthcare-portal/phase3-security/parameters.prod.json`
- [ ] `temp/contoso-healthcare-portal/phase3-security/deploy-phase3.ps1`

**Orchestration Files:**

- [ ] `temp/contoso-healthcare-portal/main.bicep` (calls all phases)
- [ ] `temp/contoso-healthcare-portal/deploy.md` (deployment guide)

### Teaching Moments to Look For

- [ ] Agent explains why certain API versions are chosen
- [ ] Security defaults are justified (not just applied blindly)
- [ ] Validation commands demonstrate what they check
- [ ] Error handling and rollback strategies are explained

### Key Validation Points

```powershell
# Validate all Bicep templates
bicep build temp/contoso-healthcare-portal/phase1-foundation/main.bicep
bicep build temp/contoso-healthcare-portal/phase2-platform/main.bicep
bicep build temp/contoso-healthcare-portal/phase3-security/main.bicep

# Check for required tags
Select-String -Path "temp/contoso-healthcare-portal/phase*/*.bicep" -Pattern "Environment|ManagedBy|Project"

# Check for security defaults
Select-String -Path "temp/contoso-healthcare-portal/phase*/*.bicep" -Pattern "httpsOnly|minTlsVersion|transparentDataEncryption"
```

---

## Discovery Question Reference

### Questions to Ask Any Agent

These questions work across all stages to deepen understanding:

**Understanding Decisions:**

```text
- Why did you choose X over Y?
- What are the trade-offs of this approach?
- What would change if the budget was different?
- What are the risks of this recommendation?
```

**Understanding Azure:**

```text
- What's the SLA for this service?
- How does this service handle failures?
- What's the cost difference between tiers?
- When would you NOT recommend this service?
```

**Understanding Bicep:**

```text
- Why is this parameter required vs. optional?
- What happens if this resource fails to deploy?
- How do I test this before deploying to production?
- What would make this template more reusable?
```

### The "5 Whys" Pattern

When an agent gives a recommendation, use progressive "why" questions:

1. **Initial:** "Why Azure App Service?"
2. **Deeper:** "Why Standard tier vs. Premium?"
3. **Trade-off:** "Why not Container Apps?"
4. **Constraint:** "What would change if we had more budget?"
5. **Learning:** "When would App Service be the wrong choice?"

This pattern transforms tool-learning into architecture-learning.

---

## Variations and Extensions

### Variation 1: Higher Budget Scenario ($2,000/month)

Modify Stage 1 prompt to include:

- Premium App Service tier
- Azure Front Door with WAF
- Geo-replication for SQL Database
- Azure Cache for Redis

### Variation 2: Multi-Region Deployment

Add to Stage 1 prompt:

- Primary region: East US 2
- Secondary region: Central US
- Traffic Manager or Azure Front Door
- Active-passive failover strategy

### Variation 3: Enhanced Security

Add to all stages:

- Application Gateway with WAF
- Azure Firewall for egress filtering
- Azure DDoS Protection Standard
- Microsoft Defender for Cloud

---

## Tips for Successful Execution

### Agent Handoffs

1. **Use the handoff button** at the end of each stage response
2. If handoff doesn't work, manually switch agents and reference previous output
3. Context should carry forward automatically

### Cost Optimization

- Initial recommendation may exceed budget
- Ask agent to optimize: "Can you reduce costs while maintaining HIPAA compliance?"
- Trade-offs will be clearly explained

### HIPAA Compliance

- Architecture must include encryption, audit logging, and access controls
- Agent should reference specific Microsoft documentation
- BAA coverage should be confirmed

### Troubleshooting

**Issue:** Cost estimate too high  
**Solution:** Ask agent to remove optional services (e.g., Front Door, Redis Cache)

**Issue:** Missing private endpoints  
**Solution:** Explicitly request in Stage 2: "Ensure all data services use private endpoints"

**Issue:** Bicep validation errors  
**Solution:** Agent should provide fixes, but you can also run `bicep lint --diagnostics-format sarif`

---

## Related Scenarios

- **E-Commerce Platform:** Similar architecture, add Azure Cache for Redis
- **Financial Services:** Add HSM-backed Key Vault, increase to Premium tier
- **Education Portal:** Lower-cost Basic tier acceptable, remove private endpoints
- **Government Application:** Requires Azure Government cloud regions

---

**Last Updated:** 2025-01-15  
**Tested With:** GitHub Copilot custom agents (agentic workflow)
